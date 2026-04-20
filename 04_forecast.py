# Databricks notebook source
# MAGIC %md
# MAGIC # EIA Fuel Price Forecasting
# MAGIC Prophet model to forecast gasoline and diesel prices 8 weeks out.
# MAGIC Replaces the manual "eyeball the trendline" approach.

# COMMAND ----------

# MAGIC %md
# MAGIC ## Configuration

# COMMAND ----------

dbutils.widgets.text("catalog", "eia_fuel_prices", "Catalog Name")
CATALOG = dbutils.widgets.get("catalog").strip()

GOLD_WEEKLY = f"{CATALOG}.gold.weekly_fuel_summary"
FORECAST_TABLE = f"{CATALOG}.gold.fuel_price_forecast"
FORECAST_HORIZON_WEEKS = 8

# Products to forecast
FORECAST_PRODUCTS = ["EPMR", "EPD2DXL0"]  # Regular Gas, Ultra Low Sulfur Diesel

# COMMAND ----------

# MAGIC %md
# MAGIC ## Install Prophet

# COMMAND ----------

# MAGIC %pip install prophet
# MAGIC dbutils.library.restartPython()

# COMMAND ----------

# MAGIC %md
# MAGIC ## Build Forecasts

# COMMAND ----------

# Re-read widget after Python restart (widget definitions persist, but variables are cleared)
CATALOG = dbutils.widgets.get("catalog").strip()
GOLD_WEEKLY = f"{CATALOG}.gold.weekly_fuel_summary"
FORECAST_TABLE = f"{CATALOG}.gold.fuel_price_forecast"
FORECAST_HORIZON_WEEKS = 8
FORECAST_PRODUCTS = ["EPMR", "EPD2DXL0"]

import pandas as pd
from prophet import Prophet
from pyspark.sql import functions as F

df_weekly = spark.table(GOLD_WEEKLY)

all_forecasts = []

for product_code in FORECAST_PRODUCTS:
    # Get historical data for this product
    pdf = (
        df_weekly
        .filter(F.col("product") == product_code)
        .select("price_date", "price_per_gallon", "product_name")
        .orderBy("price_date")
        .toPandas()
    )

    product_name = pdf["product_name"].iloc[0]
    print(f"Forecasting: {product_name} ({len(pdf)} data points)")

    # Prophet requires columns named 'ds' and 'y'
    prophet_df = pdf.rename(columns={"price_date": "ds", "price_per_gallon": "y"})
    prophet_df["ds"] = pd.to_datetime(prophet_df["ds"])

    # Fit model
    model = Prophet(
        yearly_seasonality=True,
        weekly_seasonality=False,
        changepoint_prior_scale=0.05,
    )
    model.fit(prophet_df[["ds", "y"]])

    # Forecast
    future = model.make_future_dataframe(periods=FORECAST_HORIZON_WEEKS, freq="W")
    forecast = model.predict(future)

    # Combine actuals + forecast
    result = forecast[["ds", "yhat", "yhat_lower", "yhat_upper"]].copy()
    result = result.merge(prophet_df[["ds", "y"]], on="ds", how="left")
    result["product"] = product_code
    result["product_name"] = product_name
    result["is_forecast"] = result["y"].isna()

    result = result.rename(columns={
        "ds": "price_date",
        "y": "actual_price",
        "yhat": "forecast_price",
        "yhat_lower": "forecast_lower",
        "yhat_upper": "forecast_upper",
    })

    all_forecasts.append(result)

# Combine all products
df_all_forecasts = pd.concat(all_forecasts, ignore_index=True)

# Write to Delta
spark_forecast = spark.createDataFrame(df_all_forecasts)
spark_forecast.write.mode("overwrite").saveAsTable(FORECAST_TABLE)

print(f"Forecast table {FORECAST_TABLE} written: {spark_forecast.count()} rows")

# COMMAND ----------

# MAGIC %md
# MAGIC ## Preview — Forecasted Prices

# COMMAND ----------

display(
    spark.table(FORECAST_TABLE)
    .filter(F.col("is_forecast") == True)
    .orderBy("product_name", "price_date")
)

# COMMAND ----------

# MAGIC %md
# MAGIC ## Preview — Recent Actuals + Forecast Overlap

# COMMAND ----------

display(
    spark.table(FORECAST_TABLE)
    .filter(F.col("price_date") >= F.date_sub(F.current_date(), 90))
    .orderBy("product_name", "price_date")
)
