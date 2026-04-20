# Databricks notebook source
# MAGIC %md
# MAGIC # Fuel Price Intelligence — One-Click Setup
# MAGIC
# MAGIC This notebook sets up everything you need to run the full demo end to end.
# MAGIC
# MAGIC **What it does:**
# MAGIC 1. Creates a Unity Catalog catalog and schemas (bronze, silver, gold)
# MAGIC 2. Stores your EIA API key securely in a Databricks secret scope
# MAGIC 3. Finds (or creates) a SQL warehouse for the app
# MAGIC 4. Runs the full data pipeline — ingest, transform, analytics, forecast, internal data
# MAGIC 5. Deploys the interactive web application
# MAGIC
# MAGIC **Before you start, you need:**
# MAGIC - A Databricks workspace with **Unity Catalog** enabled
# MAGIC - A free EIA API key — get one at [eia.gov/opendata/register.php](https://www.eia.gov/opendata/register.php)
# MAGIC
# MAGIC **Time:** ~10 minutes start to finish.

# COMMAND ----------

# MAGIC %md
# MAGIC ## Step 1 — Configure
# MAGIC Fill in the two fields above this cell and hit **Run**.
# MAGIC
# MAGIC - **Catalog Name**: Where your data lives in Unity Catalog (default is fine)
# MAGIC - **EIA API Key**: Your free API key from eia.gov

# COMMAND ----------

dbutils.widgets.text("catalog_name", "siteone_eia", "1. Catalog Name")
dbutils.widgets.text("eia_api_key", "", "2. EIA API Key")

CATALOG = dbutils.widgets.get("catalog_name").strip()
EIA_API_KEY = dbutils.widgets.get("eia_api_key").strip()

if not EIA_API_KEY:
    raise ValueError(
        "Please enter your EIA API key in the widget above. "
        "Get a free key at https://www.eia.gov/opendata/register.php"
    )

print(f"  Catalog:  {CATALOG}")
print(f"  API Key:  {'*' * max(0, len(EIA_API_KEY) - 4)}{EIA_API_KEY[-4:]}")

# COMMAND ----------

# MAGIC %md
# MAGIC ## Step 2 — Create Catalog & Schemas

# COMMAND ----------

spark.sql(f"CREATE CATALOG IF NOT EXISTS {CATALOG}")
spark.sql(f"CREATE SCHEMA IF NOT EXISTS {CATALOG}.bronze")
spark.sql(f"CREATE SCHEMA IF NOT EXISTS {CATALOG}.silver")
spark.sql(f"CREATE SCHEMA IF NOT EXISTS {CATALOG}.gold")

print(f"  Catalog '{CATALOG}' ready with bronze / silver / gold schemas")

# COMMAND ----------

# MAGIC %md
# MAGIC ## Step 3 — Store API Key Securely

# COMMAND ----------

from databricks.sdk import WorkspaceClient

w = WorkspaceClient()

SCOPE = CATALOG  # use catalog name as secret scope for simplicity

try:
    w.secrets.create_scope(scope=SCOPE)
    print(f"  Created secret scope: {SCOPE}")
except Exception as e:
    if "RESOURCE_ALREADY_EXISTS" in str(e) or "already exists" in str(e).lower():
        print(f"  Secret scope '{SCOPE}' already exists — reusing it")
    else:
        raise

w.secrets.put_secret(scope=SCOPE, key="eia_api_key", string_value=EIA_API_KEY)
print(f"  EIA API key stored securely")

# COMMAND ----------

# MAGIC %md
# MAGIC ## Step 4 — Find a SQL Warehouse

# COMMAND ----------

warehouse = None

for wh in w.warehouses.list():
    # Prefer a serverless warehouse
    if getattr(wh, "enable_serverless_compute", False):
        warehouse = wh
        break
    # Fall back to any warehouse
    if warehouse is None:
        warehouse = wh

if warehouse is None:
    print("  No warehouse found — creating a serverless SQL warehouse...")
    from databricks.sdk.service.sql import CreateWarehouseRequestWarehouseType
    result = w.warehouses.create_and_wait(
        name=f"{CATALOG}-warehouse",
        cluster_size="2X-Small",
        warehouse_type=CreateWarehouseRequestWarehouseType.PRO,
        enable_serverless_compute=True,
        auto_stop_mins=10,
    )
    warehouse = result
    print(f"  Created warehouse: {warehouse.name}")

WAREHOUSE_ID = warehouse.id
print(f"  Using warehouse: {warehouse.name} (ID: {WAREHOUSE_ID})")

# COMMAND ----------

# MAGIC %md
# MAGIC ## Step 5 — Run Data Pipeline
# MAGIC This runs the full medallion pipeline: Bronze → Silver → Gold → Forecast → Internal Data.
# MAGIC Takes about 5 minutes.

# COMMAND ----------

# Figure out where this notebook lives so we can find the others
notebook_path = (
    dbutils.notebook.entry_point.getDbutils()
    .notebook().getContext().notebookPath().get()
)
notebook_dir = "/".join(notebook_path.split("/")[:-1])

params = {"catalog": CATALOG, "secret_scope": SCOPE}

steps = [
    ("01_ingest_bronze",      "Pulling EIA data into bronze layer..."),
    ("02_transform_silver",   "Cleaning and typing into silver layer..."),
    ("03_gold_analytics",     "Building weekly summaries and regional comparisons..."),
    ("04_forecast",           "Training Prophet model and forecasting 8 weeks out..."),
    ("05_synthetic_internal", "Generating delivery zone and surcharge data..."),
]

for notebook_name, description in steps:
    print(f"  {description}")
    try:
        dbutils.notebook.run(
            f"{notebook_dir}/{notebook_name}",
            timeout_seconds=600,
            arguments=params,
        )
        print(f"    Done.")
    except Exception as e:
        print(f"    FAILED: {e}")
        raise

print(f"\n  Pipeline complete — all tables in {CATALOG}.gold are ready.")

# COMMAND ----------

# MAGIC %md
# MAGIC ## Step 6 — Deploy the Web App
# MAGIC This creates a Databricks App that serves the fuel intelligence dashboard.

# COMMAND ----------

import base64

# Build the correct app.yaml with this workspace's warehouse
app_yaml = f"""command:
  - /bin/sh
  - -c
  - "python -m uvicorn backend.main:app --host 0.0.0.0 --port 8000"
resources:
  - name: sql-warehouse
    sql_warehouse:
      id: {WAREHOUSE_ID}
      permission: CAN_USE
env:
  - name: DATABRICKS_CATALOG
    value: {CATALOG}
  - name: DATABRICKS_SQL_WAREHOUSE_ID
    value: {WAREHOUSE_ID}
"""

# Write the customized app.yaml into the app directory
# (Git Folders support file writes via the Workspace API)
app_dir = f"{notebook_dir}/app"

w.workspace.import_(
    content=base64.b64encode(app_yaml.encode()).decode(),
    path=f"{app_dir}/app.yaml",
    format="AUTO",
    overwrite=True,
)
print(f"  Configured app.yaml with warehouse {WAREHOUSE_ID}")

# COMMAND ----------

# Create (or update) and deploy the Databricks App
APP_NAME = f"{CATALOG.replace('_', '-')}-fuel-intel"

try:
    app = w.apps.get(APP_NAME)
    print(f"  App '{APP_NAME}' already exists — deploying update...")
except Exception:
    print(f"  Creating app '{APP_NAME}'...")
    app = w.apps.create_and_wait(
        name=APP_NAME,
        description="Fuel Price Intelligence Dashboard — EIA data, Prophet forecasts, delivery margin analysis",
    )
    print(f"  App created.")

# Deploy from the app directory in this repo
deployment = w.apps.deploy_and_wait(
    app_name=APP_NAME,
    source_code_path=app_dir,
)
print(f"  Deployment status: {deployment.status.state if deployment.status else 'submitted'}")

# COMMAND ----------

# MAGIC %md
# MAGIC ## Done!

# COMMAND ----------

app_url = f"https://{w.config.host.replace('https://', '')}/apps/{APP_NAME}"
print("=" * 60)
print()
print("  Your Fuel Intelligence Dashboard is live!")
print()
print(f"  App URL:  {app_url}")
print()
print(f"  Catalog:    {CATALOG}")
print(f"  Warehouse:  {warehouse.name}")
print()
print("  To refresh data, re-run this notebook or schedule it as a job.")
print()
print("=" * 60)
