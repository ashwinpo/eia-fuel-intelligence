import os
import time
import logging
from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, JSONResponse
from databricks.sdk import WorkspaceClient
from databricks.sdk.service.sql import StatementState

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI()

CATALOG = os.getenv("DATABRICKS_CATALOG", "siteone_eia")
WAREHOUSE_ID = os.getenv("DATABRICKS_SQL_WAREHOUSE_ID")
if not WAREHOUSE_ID:
    raise RuntimeError("DATABRICKS_SQL_WAREHOUSE_ID environment variable is required. Set it in app.yaml.")

_client = None

NUMERIC_TYPES = {"BYTE", "SHORT", "INT", "LONG", "FLOAT", "DOUBLE", "DECIMAL"}
BOOL_TYPES = {"BOOLEAN"}


def get_client() -> WorkspaceClient:
    global _client
    if _client is None:
        _client = WorkspaceClient()
    return _client


def _cast(value, type_name: str):
    """Cast string value from Statement Execution API to Python type."""
    if value is None:
        return None
    type_upper = (type_name or "").upper()
    if type_upper in NUMERIC_TYPES:
        try:
            return int(value) if type_upper in {"BYTE", "SHORT", "INT", "LONG"} else float(value)
        except (ValueError, TypeError):
            return value
    if type_upper in BOOL_TYPES:
        return value.lower() in ("true", "1")
    return value


def query(sql: str) -> list[dict]:
    """Execute SQL via Statement Execution API and return list of dicts."""
    w = get_client()
    try:
        resp = w.statement_execution.execute_statement(
            warehouse_id=WAREHOUSE_ID,
            statement=sql,
            wait_timeout="50s",
        )
        # Poll if still running
        while resp.status and resp.status.state in (
            StatementState.PENDING,
            StatementState.RUNNING,
        ):
            time.sleep(0.5)
            resp = w.statement_execution.get_statement(resp.statement_id)

        if resp.status and resp.status.state == StatementState.FAILED:
            error_msg = resp.status.error.message if resp.status.error else "Unknown error"
            logger.error(f"SQL failed: {error_msg}")
            raise RuntimeError(f"SQL execution failed: {error_msg}")

        if not resp.manifest or not resp.result:
            return []

        col_info = [(col.name, col.type_text) for col in resp.manifest.schema.columns]
        rows = []
        if resp.result.data_array:
            for row in resp.result.data_array:
                rows.append({name: _cast(val, typ) for (name, typ), val in zip(col_info, row)})
        return rows
    except Exception as e:
        logger.error(f"Query error: {e}")
        raise


# --- API Routes ---


@app.get("/api/health")
def health():
    """Health check — also tests DB connectivity."""
    try:
        result = query(f"SELECT 1 AS ok")
        return {"status": "ok", "db": "connected", "catalog": CATALOG, "warehouse": WAREHOUSE_ID}
    except Exception as e:
        return JSONResponse(status_code=500, content={"status": "error", "detail": str(e)})


@app.get("/api/snapshot")
def get_snapshot():
    """Latest week's prices — national, key products."""
    try:
        return query(f"""
            SELECT product_name, product_category, price_per_gallon,
                   wow_change, wow_pct_change, mom_change, avg_4wk, avg_12wk, price_date
            FROM {CATALOG}.gold.weekly_fuel_summary
            WHERE price_date = (SELECT MAX(price_date) FROM {CATALOG}.gold.weekly_fuel_summary)
            ORDER BY product_category, product_name
        """)
    except Exception as e:
        return JSONResponse(status_code=500, content={"error": str(e)})


@app.get("/api/trends")
def get_trends(product: str = "EPMR", weeks: int = 52):
    """Historical price trend for a product."""
    return query(f"""
        SELECT price_date, price_per_gallon, wow_change, wow_pct_change, avg_4wk, avg_12wk
        FROM {CATALOG}.gold.weekly_fuel_summary
        WHERE product = '{product}'
        ORDER BY price_date DESC
        LIMIT {weeks}
    """)


@app.get("/api/regional")
def get_regional(product: str = "EPD2DXL0"):
    """Latest regional price comparison for a product."""
    return query(f"""
        SELECT area_name, duoarea, price_per_gallon, wow_change, price_date
        FROM {CATALOG}.gold.regional_comparison
        WHERE product = '{product}'
          AND price_date = (SELECT MAX(price_date) FROM {CATALOG}.gold.regional_comparison WHERE product = '{product}')
          AND area_name != 'U.S.'
        ORDER BY price_per_gallon DESC
    """)


@app.get("/api/forecast")
def get_forecast(product: str = "EPMR"):
    """Actuals + forecast for a product (last 6 months + 8 weeks forward)."""
    return query(f"""
        SELECT price_date, actual_price, forecast_price, forecast_lower, forecast_upper, is_forecast, product_name
        FROM {CATALOG}.gold.fuel_price_forecast
        WHERE product = '{product}'
          AND price_date >= DATE_SUB(CURRENT_DATE(), 180)
        ORDER BY price_date
    """)


@app.get("/api/products")
def get_products():
    """Available products for dropdowns."""
    return query(f"""
        SELECT DISTINCT product, product_name, product_category
        FROM {CATALOG}.gold.weekly_fuel_summary
        ORDER BY product_category, product_name
    """)


@app.get("/api/margins")
def get_margins():
    """Delivery margins by zone — joins zones with real diesel prices."""
    return query(f"""
        SELECT * FROM {CATALOG}.gold.delivery_margins
        ORDER BY margin_pct
    """)


@app.get("/api/surcharge-config")
def get_surcharge_config():
    """Current surcharge configuration."""
    return query(f"""
        SELECT * FROM {CATALOG}.gold.surcharge_config
    """)


# Serve React frontend
app.mount("/assets", StaticFiles(directory="frontend/dist/assets"), name="assets")


@app.get("/{full_path:path}")
def serve_frontend(full_path: str):
    return FileResponse("frontend/dist/index.html")
