# Databricks notebook source
# MAGIC %md
# MAGIC # EIA Fuel Price Ingestion — Bronze Layer
# MAGIC Pull weekly retail gasoline and diesel prices from the EIA Open Data API (v2).
# MAGIC No pre-built connectors — just `requests` and Spark.

# COMMAND ----------

# MAGIC %md
# MAGIC ## Configuration

# COMMAND ----------

dbutils.widgets.text("catalog", "siteone_eia", "Catalog Name")
dbutils.widgets.text("secret_scope", "siteone_eia", "Secret Scope")

CATALOG = dbutils.widgets.get("catalog").strip()
SCOPE = dbutils.widgets.get("secret_scope").strip()

API_KEY = dbutils.secrets.get(scope=SCOPE, key="eia_api_key").strip()
BRONZE_SCHEMA = "bronze"
BRONZE_TABLE = f"{CATALOG}.{BRONZE_SCHEMA}.fuel_prices_raw"

BASE_URL = "https://api.eia.gov/v2/petroleum/pri/gnd/data"

# Products we care about
PRODUCTS = [
    "EPM0",      # Total Gasoline
    "EPMR",      # Regular Gasoline
    "EPMP",      # Premium Gasoline
    "EPD2D",     # No 2 Diesel
    "EPD2DXL0",  # No 2 Diesel Ultra Low Sulfur
]

# COMMAND ----------

# MAGIC %md
# MAGIC ## Pull data from EIA API

# COMMAND ----------

import requests
from pyspark.sql import functions as F
from pyspark.sql.types import StructType, StructField, StringType, DoubleType, DateType

def fetch_eia_data(api_key, products, offset=0, length=5000):
    """Fetch weekly fuel prices from EIA API v2."""
    params = {
        "api_key": api_key,
        "frequency": "weekly",
        "data[]": "value",
        "sort[0][column]": "period",
        "sort[0][direction]": "desc",
        "offset": offset,
        "length": length,
    }
    # Add product facets
    for p in products:
        params.setdefault("facets[product][]", [])
    # requests handles list params differently, build manually
    param_parts = [
        f"api_key={api_key}",
        "frequency=weekly",
        "data[]=value",
        "sort[0][column]=period",
        "sort[0][direction]=desc",
        f"offset={offset}",
        f"length={length}",
    ]
    for p in products:
        param_parts.append(f"facets[product][]={p}")

    url = BASE_URL + "?" + "&".join(param_parts)
    response = requests.get(url)
    response.raise_for_status()
    result = response.json()
    return result["response"]["data"], int(result["response"]["total"])

# Paginate through all data
all_rows = []
offset = 0
page_size = 5000

while True:
    data, total = fetch_eia_data(API_KEY, PRODUCTS, offset=offset, length=page_size)
    all_rows.extend(data)
    print(f"Fetched {len(all_rows)} / {total} rows")
    if len(all_rows) >= total or len(data) == 0:
        break
    offset += page_size

print(f"Total rows fetched: {len(all_rows)}")

# COMMAND ----------

# MAGIC %md
# MAGIC ## Write to Bronze Delta table

# COMMAND ----------

from datetime import datetime

# Convert to Spark DataFrame
df_raw = spark.createDataFrame(all_rows)

# Add ingestion metadata
df_bronze = (
    df_raw
    .withColumn("_ingested_at", F.current_timestamp())
    .withColumn("_source", F.lit("eia_api_v2"))
)

# Write as Delta — overwrite for initial load, merge for incremental later
df_bronze.write.mode("overwrite").saveAsTable(BRONZE_TABLE)

row_count = spark.table(BRONZE_TABLE).count()
print(f"Bronze table {BRONZE_TABLE} written: {row_count} rows")

# COMMAND ----------

# MAGIC %md
# MAGIC ## Quick validation

# COMMAND ----------

display(
    spark.table(BRONZE_TABLE)
    .groupBy("product-name")
    .agg(
        F.count("*").alias("row_count"),
        F.min("period").alias("earliest"),
        F.max("period").alias("latest"),
    )
    .orderBy("product-name")
)
