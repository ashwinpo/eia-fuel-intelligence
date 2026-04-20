# Fuel Price Intelligence on Databricks

An end-to-end data engineering and analytics demo built on Databricks. Pulls weekly U.S. fuel prices from the EIA Open Data API, runs them through a medallion architecture (bronze/silver/gold), forecasts prices with Prophet, and serves an interactive dashboard as a Databricks App.

![Architecture: EIA API → Bronze → Silver → Gold → FastAPI + React App](https://img.shields.io/badge/architecture-medallion-blue)

## What You Get

- **5-notebook data pipeline** — Ingests EIA petroleum price data, cleans it, builds analytics (WoW/MoM trends, rolling averages, regional comparisons), trains Prophet forecasts, and generates synthetic delivery zone data
- **REST API** — FastAPI backend querying Delta tables via the Databricks SQL Statement Execution API
- **Interactive dashboard** — React frontend with price snapshots, trend charts, 8-week forecasts, regional comparison, delivery margin tracker, and a surcharge simulator
- **One-click setup** — A single notebook creates everything and deploys the app

## Prerequisites

1. **A Databricks workspace** with Unity Catalog enabled
2. **A free EIA API key** — register at [eia.gov/opendata/register.php](https://www.eia.gov/opendata/register.php) (takes 30 seconds)

That's it.

## Quickstart

### 1. Clone into your workspace

In your Databricks workspace:

**Workspace** → **Repos** → **Add Repo** → paste this repository URL → **Create**

### 2. Run the setup notebook

Open `00_setup` and fill in the two widgets at the top:

| Widget | Value |
|--------|-------|
| **Catalog Name** | Any name you want (default: `eia_fuel_prices`) |
| **EIA API Key** | Your key from step above |

Click **Run All**.

The notebook will:
1. Create the Unity Catalog catalog and bronze/silver/gold schemas
2. Store your API key in a Databricks secret scope
3. Find (or create) a SQL warehouse
4. Run all 5 pipeline notebooks
5. Deploy the Databricks App
6. Print the live app URL

**Total time: ~10 minutes.**

## Project Structure

```
├── 00_setup.py                  # One-click setup — start here
├── 01_ingest_bronze.py          # EIA API → bronze Delta table
├── 02_transform_silver.py       # Clean, type-cast → silver
├── 03_gold_analytics.py         # WoW/MoM trends, regional comparison → gold
├── 04_forecast.py               # Prophet 8-week price forecast → gold
├── 05_synthetic_internal.py     # Simulated delivery zones + surcharge config → gold
└── app/
    ├── app.yaml                 # Databricks App deployment config
    ├── requirements.txt         # Python backend dependencies
    ├── backend/
    │   └── main.py              # FastAPI server (8 API endpoints)
    └── frontend/
        ├── src/                 # React + Recharts source
        └── dist/                # Pre-built frontend (ready to deploy)
```

## Data Pipeline

```
EIA Open Data API (public, free)
    │
    ▼
┌─────────────────────┐
│  01 Bronze Layer     │  Raw JSON → Delta table
└─────────┬───────────┘
          ▼
┌─────────────────────┐
│  02 Silver Layer     │  Cleaned, typed, standardized
└─────────┬───────────┘
          ▼
┌─────────────────────┐
│  03 Gold Analytics   │  Weekly summaries, regional comparison,
│                      │  WoW/MoM change, rolling averages
└─────────┬───────────┘
          ▼
┌─────────────────────┐
│  04 Forecast         │  Prophet model → 8-week price forecast
└─────────┬───────────┘
          ▼
┌─────────────────────┐
│  05 Internal Data    │  Simulated delivery zones, surcharge
│                      │  config, margin calculations
└─────────────────────┘
```

## Dashboard Features

| View | Description |
|------|-------------|
| **Weekly Report** | Latest national prices, WoW/MoM changes, 4-week and 12-week rolling averages |
| **Trend Charts** | Historical price trends with configurable lookback (3 months to 5 years) |
| **Forecast** | 8-week Prophet forecast with confidence intervals |
| **Regional Comparison** | Price comparison across U.S. regions with bar chart and detail table |
| **Delivery Margins** | Interactive U.S. map showing margin per delivery zone based on real fuel costs |
| **Surcharge Simulator** | Model fuel surcharge scenarios with adjustable baseline and rate |

## API Endpoints

| Endpoint | Description |
|----------|-------------|
| `GET /api/snapshot` | Latest week's national prices |
| `GET /api/trends?product=EPMR&weeks=52` | Historical price trend |
| `GET /api/regional?product=EPD2DXL0` | Regional price comparison |
| `GET /api/forecast?product=EPMR` | Actuals + 8-week forecast |
| `GET /api/products` | Available products for dropdowns |
| `GET /api/margins` | Delivery margins by zone |
| `GET /api/surcharge-config` | Current surcharge configuration |
| `GET /api/health` | Health check + DB connectivity test |

## EIA Products Tracked

| Code | Product |
|------|---------|
| `EPM0` | Total Gasoline |
| `EPMR` | Regular Gasoline |
| `EPMP` | Premium Gasoline |
| `EPD2D` | No. 2 Diesel |
| `EPD2DXL0` | No. 2 Diesel Ultra Low Sulfur |

## Customization

**Change the catalog name** — Set it in the `00_setup` widget. All notebooks accept a `catalog` parameter.

**Add more products** — Edit the `PRODUCTS` list in `01_ingest_bronze.py`. The EIA API supports [many more petroleum series](https://www.eia.gov/opendata/browser/petroleum).

**Use real delivery data** — Replace `05_synthetic_internal.py` with your actual fleet/logistics data. The margin view expects columns: `duoarea`, `zone_name`, `deliveries_per_week`, `avg_miles_per_delivery`, `revenue_per_delivery`, `base_cost_per_delivery`, `fleet_mpg`, `latitude`, `longitude`.

**Schedule refreshes** — Create a Databricks Job that runs notebooks 01–05 weekly to keep data current.

## Local Development

To work on the frontend locally:

```bash
cd app
node mock-server.js &          # Starts a mock API on :8000
cd frontend
npm install
npm run dev                    # Vite dev server on :5173
```

## Tech Stack

- **Data:** Apache Spark, Delta Lake, Unity Catalog
- **ML:** Prophet (time-series forecasting)
- **Backend:** FastAPI, Databricks Python SDK
- **Frontend:** React, Recharts, React Simple Maps, Vite
- **Deployment:** Databricks Apps

## License

MIT
