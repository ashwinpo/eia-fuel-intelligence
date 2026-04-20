# Databricks notebook source
# MAGIC %md
# MAGIC # Synthetic Internal Data — Delivery Zones
# MAGIC Simulates internal delivery zone data for demo purposes.
# MAGIC In production, this would come from your fleet/logistics systems.

# COMMAND ----------

# MAGIC %md
# MAGIC ## Delivery Zones

# COMMAND ----------

from pyspark.sql import functions as F
from pyspark.sql.types import *

dbutils.widgets.text("catalog", "siteone_eia", "Catalog Name")
CATALOG = dbutils.widgets.get("catalog").strip()

ZONES_TABLE = f"{CATALOG}.gold.delivery_zones"
SURCHARGE_TABLE = f"{CATALOG}.gold.surcharge_config"

# Delivery zone data — simulated internal
# padd_region maps each zone to EIA PADD diesel price region for margin calc
# Tuned so high-diesel regions (CA, PADD5, NE) show margin stress
zones = [
    ("STX", "Texas", "R30", 820, 45, 270.0, 175.0, 31.0, -99.5),
    ("SFL", "Florida", "R1Z", 690, 38, 265.0, 168.0, 28.0, -82.5),
    ("SCA", "California", "SCA", 540, 48, 275.0, 182.0, 37.0, -119.5),
    ("YORD", "Chicago", "R20", 380, 35, 255.0, 160.0, 41.9, -87.6),
    ("Y44HO", "Houston", "R30", 450, 55, 268.0, 172.0, 29.8, -95.4),
    ("YMIA", "Miami", "R1Z", 310, 32, 260.0, 170.0, 25.8, -80.2),
    ("YBOS", "Boston", "R1X", 260, 30, 262.0, 175.0, 42.4, -71.1),
    ("Y35NY", "New York", "R1Y", 340, 28, 270.0, 182.0, 40.7, -74.0),
    ("YDEN", "Denver", "R40", 220, 58, 258.0, 168.0, 39.7, -105.0),
    ("SWA", "Washington DC", "R1Z", 290, 30, 262.0, 168.0, 38.9, -77.0),
    ("YCLE", "Cleveland", "R20", 200, 40, 250.0, 155.0, 41.5, -81.7),
    ("SMN", "Minnesota", "R20", 190, 50, 248.0, 155.0, 46.0, -94.5),
    ("Y48SE", "Seattle", "R5XCA", 230, 42, 268.0, 178.0, 47.6, -122.3),
    ("SCO", "Colorado", "R40", 210, 55, 255.0, 165.0, 39.0, -105.5),
    ("Y05LA", "Los Angeles", "SCA", 480, 38, 278.0, 188.0, 34.1, -118.2),
]

schema = StructType([
    StructField("duoarea", StringType()),
    StructField("zone_name", StringType()),
    StructField("padd_region", StringType()),
    StructField("deliveries_per_week", IntegerType()),
    StructField("avg_miles_per_delivery", IntegerType()),
    StructField("revenue_per_delivery", DoubleType()),
    StructField("base_cost_per_delivery", DoubleType()),
    StructField("latitude", DoubleType()),
    StructField("longitude", DoubleType()),
])

df_zones = spark.createDataFrame(zones, schema)
df_zones = df_zones.withColumn("fleet_mpg", F.lit(6.2))

df_zones.write.mode("overwrite").option("overwriteSchema", "true").saveAsTable(ZONES_TABLE)
print(f"Delivery zones table: {spark.table(ZONES_TABLE).count()} rows")

# COMMAND ----------

# MAGIC %md
# MAGIC ## Surcharge Configuration

# COMMAND ----------

surcharge = [
    (4.50, 0.08, "per $0.10 above baseline", "2026-01-15"),
]

schema_sc = StructType([
    StructField("baseline_fuel_price", DoubleType()),
    StructField("surcharge_rate", DoubleType()),
    StructField("surcharge_model", StringType()),
    StructField("last_calibrated", StringType()),
])

df_sc = spark.createDataFrame(surcharge, schema_sc)
df_sc.write.mode("overwrite").saveAsTable(SURCHARGE_TABLE)
print(f"Surcharge config table: {spark.table(SURCHARGE_TABLE).count()} rows")

# COMMAND ----------

# MAGIC %md
# MAGIC ## Margin View — Joins zones with latest regional diesel prices

# COMMAND ----------

MARGIN_VIEW = f"{CATALOG}.gold.delivery_margins"

spark.sql(f"""
CREATE OR REPLACE VIEW {MARGIN_VIEW} AS
WITH latest_prices AS (
    SELECT duoarea, area_name, price_per_gallon, wow_change, price_date
    FROM {CATALOG}.gold.regional_comparison
    WHERE product = 'EPD2DXL0'
      AND price_date = (SELECT MAX(price_date) FROM {CATALOG}.gold.regional_comparison WHERE product = 'EPD2DXL0')
)
SELECT
    z.duoarea,
    z.zone_name,
    z.padd_region,
    p.area_name AS region_name,
    z.deliveries_per_week,
    z.avg_miles_per_delivery,
    z.revenue_per_delivery,
    z.base_cost_per_delivery,
    z.fleet_mpg,
    z.latitude,
    z.longitude,
    p.price_per_gallon AS diesel_price,
    p.wow_change AS diesel_wow_change,
    p.price_date,
    ROUND((z.avg_miles_per_delivery / z.fleet_mpg) * p.price_per_gallon, 2) AS fuel_cost_per_delivery,
    ROUND(z.revenue_per_delivery - z.base_cost_per_delivery - (z.avg_miles_per_delivery / z.fleet_mpg) * p.price_per_gallon, 2) AS margin_per_delivery,
    ROUND((z.revenue_per_delivery - z.base_cost_per_delivery - (z.avg_miles_per_delivery / z.fleet_mpg) * p.price_per_gallon) / z.revenue_per_delivery * 100, 1) AS margin_pct,
    ROUND((z.avg_miles_per_delivery / z.fleet_mpg) * p.price_per_gallon * z.deliveries_per_week, 0) AS weekly_fuel_cost,
    ROUND((z.revenue_per_delivery - z.base_cost_per_delivery - (z.avg_miles_per_delivery / z.fleet_mpg) * p.price_per_gallon) * z.deliveries_per_week, 0) AS weekly_margin
FROM {CATALOG}.gold.delivery_zones z
JOIN latest_prices p ON z.padd_region = p.duoarea
""")

display(spark.table(MARGIN_VIEW).orderBy("margin_pct"))
