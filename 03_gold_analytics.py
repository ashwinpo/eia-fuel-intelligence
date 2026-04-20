# Databricks notebook source
# MAGIC %md
# MAGIC # EIA Fuel Prices — Gold Layer
# MAGIC Build analytics-ready tables with calculated fields: WoW change, MoM change,
# MAGIC rolling averages, and regional comparisons.

# COMMAND ----------

# MAGIC %md
# MAGIC ## Configuration

# COMMAND ----------

dbutils.widgets.text("catalog", "siteone_eia", "Catalog Name")
CATALOG = dbutils.widgets.get("catalog").strip()

SILVER_TABLE = f"{CATALOG}.silver.fuel_prices"
GOLD_WEEKLY = f"{CATALOG}.gold.weekly_fuel_summary"
GOLD_REGIONAL = f"{CATALOG}.gold.regional_comparison"

# COMMAND ----------

# MAGIC %md
# MAGIC ## Weekly Summary with Trend Metrics (National)

# COMMAND ----------

from pyspark.sql import functions as F, Window

df_silver = spark.table(SILVER_TABLE)

# National-level, key products only
df_national = (
    df_silver
    .filter(F.col("area_name") == "U.S.")
    .filter(F.col("product").isin("EPMR", "EPD2DXL0", "EPM0", "EPMP"))
)

# Window for week-over-week and rolling calculations
w_product = Window.partitionBy("product").orderBy("price_date")
w_rolling_4 = Window.partitionBy("product").orderBy("price_date").rowsBetween(-3, 0)
w_rolling_12 = Window.partitionBy("product").orderBy("price_date").rowsBetween(-11, 0)

df_weekly = (
    df_national
    .withColumn("prev_week_price", F.lag("price_per_gallon", 1).over(w_product))
    .withColumn("wow_change", F.round(F.col("price_per_gallon") - F.col("prev_week_price"), 4))
    .withColumn("wow_pct_change", F.round(
        (F.col("price_per_gallon") - F.col("prev_week_price")) / F.col("prev_week_price") * 100, 2
    ))
    # 4-week and 12-week rolling averages
    .withColumn("avg_4wk", F.round(F.avg("price_per_gallon").over(w_rolling_4), 4))
    .withColumn("avg_12wk", F.round(F.avg("price_per_gallon").over(w_rolling_12), 4))
    # Month-over-month (4 weeks back)
    .withColumn("price_4wk_ago", F.lag("price_per_gallon", 4).over(w_product))
    .withColumn("mom_change", F.round(F.col("price_per_gallon") - F.col("price_4wk_ago"), 4))
    .select(
        "price_date",
        "product",
        "product_name",
        "product_category",
        "price_per_gallon",
        "prev_week_price",
        "wow_change",
        "wow_pct_change",
        "avg_4wk",
        "avg_12wk",
        "price_4wk_ago",
        "mom_change",
    )
)

df_weekly.write.mode("overwrite").saveAsTable(GOLD_WEEKLY)
print(f"Gold weekly summary: {spark.table(GOLD_WEEKLY).count()} rows")

# COMMAND ----------

# MAGIC %md
# MAGIC ## Regional Comparison

# COMMAND ----------

# All regions, key products (Regular Gas + Diesel)
df_regional = (
    df_silver
    .filter(F.col("product").isin("EPMR", "EPD2DXL0"))
)

w_region = Window.partitionBy("product", "duoarea").orderBy("price_date")

df_regional_gold = (
    df_regional
    .withColumn("prev_week_price", F.lag("price_per_gallon", 1).over(w_region))
    .withColumn("wow_change", F.round(F.col("price_per_gallon") - F.col("prev_week_price"), 4))
    .select(
        "price_date",
        "product",
        "product_name",
        "product_category",
        "duoarea",
        "area_name",
        "price_per_gallon",
        "prev_week_price",
        "wow_change",
    )
)

df_regional_gold.write.mode("overwrite").saveAsTable(GOLD_REGIONAL)
print(f"Gold regional comparison: {spark.table(GOLD_REGIONAL).count()} rows")

# COMMAND ----------

# MAGIC %md
# MAGIC ## Validation

# COMMAND ----------

# Latest week snapshot — national
display(
    spark.table(GOLD_WEEKLY)
    .orderBy(F.desc("price_date"), "product_name")
    .limit(20)
)

# COMMAND ----------

# Latest week — regional diesel comparison
display(
    spark.table(GOLD_REGIONAL)
    .filter(F.col("product") == "EPD2DXL0")
    .filter(F.col("price_date") == spark.table(GOLD_REGIONAL).agg(F.max("price_date")).collect()[0][0])
    .orderBy("price_per_gallon")
)
