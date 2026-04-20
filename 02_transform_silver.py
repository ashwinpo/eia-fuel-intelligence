# Databricks notebook source
# MAGIC %md
# MAGIC # EIA Fuel Prices — Silver Layer
# MAGIC Clean, type-cast, and standardize bronze data into an analytics-ready format.

# COMMAND ----------

# MAGIC %md
# MAGIC ## Configuration

# COMMAND ----------

dbutils.widgets.text("catalog", "siteone_eia", "Catalog Name")
CATALOG = dbutils.widgets.get("catalog").strip()

BRONZE_TABLE = f"{CATALOG}.bronze.fuel_prices_raw"
SILVER_TABLE = f"{CATALOG}.silver.fuel_prices"

# COMMAND ----------

# MAGIC %md
# MAGIC ## Transform

# COMMAND ----------

from pyspark.sql import functions as F

df_bronze = spark.table(BRONZE_TABLE)

df_silver = (
    df_bronze
    # Clean column names (API returns hyphenated names)
    .withColumnRenamed("product-name", "product_name")
    .withColumnRenamed("area-name", "area_name")
    .withColumnRenamed("process-name", "process_name")
    .withColumnRenamed("series-description", "series_description")
    # Type casting
    .withColumn("price_date", F.to_date("period"))
    .withColumn("price_per_gallon", F.col("value").cast("double"))
    # Simplify product names for readability
    .withColumn("product_category", F.when(F.col("product").startswith("EPD"), "Diesel")
                                     .otherwise("Gasoline"))
    # Keep useful columns
    .select(
        "price_date",
        "product",
        "product_name",
        "product_category",
        "duoarea",
        "area_name",
        "price_per_gallon",
        "series",
        "series_description",
        "units",
    )
    # Drop nulls in price
    .filter(F.col("price_per_gallon").isNotNull())
)

df_silver.write.mode("overwrite").saveAsTable(SILVER_TABLE)

row_count = spark.table(SILVER_TABLE).count()
print(f"Silver table {SILVER_TABLE} written: {row_count} rows")

# COMMAND ----------

# MAGIC %md
# MAGIC ## Validation — sample data

# COMMAND ----------

display(
    spark.table(SILVER_TABLE)
    .filter(F.col("area_name") == "U.S.")
    .filter(F.col("product").isin("EPMR", "EPD2DXL0"))
    .orderBy(F.desc("price_date"))
    .limit(20)
)
