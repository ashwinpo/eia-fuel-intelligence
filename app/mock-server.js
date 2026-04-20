import express from 'express';
import cors from 'cors';

const app = express();
const PORT = 8000;

app.use(cors());
app.use(express.json());

// Helper function to generate date strings
function addDays(date, days) {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

function formatDate(date) {
  return date.toISOString().split('T')[0];
}

// Base date for trends
const baseDate = new Date('2026-04-13');

// GET /api/snapshot
app.get('/api/snapshot', (req, res) => {
  res.json([
    {
      product_name: 'Regular Gasoline',
      product_category: 'Gasoline',
      price_per_gallon: 4.123,
      wow_change: -0.032,
      wow_pct_change: -0.8,
      mom_change: 0.145,
      avg_4wk: 4.155,
      avg_12wk: 4.089,
      price_date: '2026-04-13'
    },
    {
      product_name: 'No 2 Diesel Low Sulfur (0-15 ppm)',
      product_category: 'Diesel',
      price_per_gallon: 5.608,
      wow_change: -0.035,
      wow_pct_change: -0.6,
      mom_change: 0.098,
      avg_4wk: 5.645,
      avg_12wk: 5.512,
      price_date: '2026-04-13'
    },
    {
      product_name: 'Total Gasoline',
      product_category: 'Gasoline',
      price_per_gallon: 4.254,
      wow_change: 0.0,
      wow_pct_change: 0.0,
      mom_change: 0.132,
      avg_4wk: 4.267,
      avg_12wk: 4.198,
      price_date: '2026-04-13'
    },
    {
      product_name: 'Premium Gasoline',
      product_category: 'Gasoline',
      price_per_gallon: 5.088,
      wow_change: 0.012,
      wow_pct_change: 0.2,
      mom_change: 0.201,
      avg_4wk: 5.076,
      avg_12wk: 4.99,
      price_date: '2026-04-13'
    }
  ]);
});

// GET /api/products
app.get('/api/products', (req, res) => {
  res.json([
    {
      product: 'EPD2DXL0',
      product_name: 'No 2 Diesel Low Sulfur (0-15 ppm)',
      product_category: 'Diesel'
    },
    {
      product: 'EPM0',
      product_name: 'Total Gasoline',
      product_category: 'Gasoline'
    },
    {
      product: 'EPMP',
      product_name: 'Premium Gasoline',
      product_category: 'Gasoline'
    },
    {
      product: 'EPMR',
      product_name: 'Regular Gasoline',
      product_category: 'Gasoline'
    }
  ]);
});

// GET /api/trends - 52 weeks of historical data
app.get('/api/trends', (req, res) => {
  const trends = [];

  // Generate 52 weeks back from baseDate
  for (let i = 51; i >= 0; i--) {
    const weekDate = addDays(baseDate, -i * 7);
    const dateStr = formatDate(weekDate);

    // Generate realistic price fluctuations
    const baseGasPrice = 4.0 + Math.sin(i / 52 * Math.PI * 2) * 0.4 + Math.random() * 0.2;
    const baseDieselPrice = 5.4 + Math.sin(i / 52 * Math.PI * 2) * 0.5 + Math.random() * 0.25;

    // Weekly change
    const wowChange = (Math.random() - 0.5) * 0.08;
    const dieselWowChange = (Math.random() - 0.5) * 0.1;

    // 4-week and 12-week averages (simplified)
    const avg4wk = baseGasPrice + (Math.random() - 0.5) * 0.05;
    const avg12wk = baseGasPrice + (Math.random() - 0.5) * 0.03;

    trends.push({
      price_date: dateStr,
      product_name: 'Regular Gasoline',
      price_per_gallon: parseFloat(baseGasPrice.toFixed(3)),
      wow_change: parseFloat(wowChange.toFixed(3)),
      wow_pct_change: parseFloat((wowChange / baseGasPrice * 100).toFixed(1)),
      avg_4wk: parseFloat(avg4wk.toFixed(3)),
      avg_12wk: parseFloat(avg12wk.toFixed(3))
    });

    trends.push({
      price_date: dateStr,
      product_name: 'No 2 Diesel Low Sulfur (0-15 ppm)',
      price_per_gallon: parseFloat(baseDieselPrice.toFixed(3)),
      wow_change: parseFloat(dieselWowChange.toFixed(3)),
      wow_pct_change: parseFloat((dieselWowChange / baseDieselPrice * 100).toFixed(1)),
      avg_4wk: parseFloat((baseDieselPrice + (Math.random() - 0.5) * 0.06).toFixed(3)),
      avg_12wk: parseFloat((baseDieselPrice + (Math.random() - 0.5) * 0.04).toFixed(3))
    });
  }

  res.json(trends);
});

// GET /api/regional
app.get('/api/regional', (req, res) => {
  res.json([
    {
      area_name: 'CALIFORNIA',
      duoarea: 'SCA',
      price_per_gallon: 6.234,
      wow_change: -0.045,
      price_date: '2026-04-13'
    },
    {
      area_name: 'SAN FRANCISCO',
      duoarea: 'Y05SF',
      price_per_gallon: 6.189,
      wow_change: -0.038,
      price_date: '2026-04-13'
    },
    {
      area_name: 'LOS ANGELES',
      duoarea: 'Y05LA',
      price_per_gallon: 6.156,
      wow_change: -0.042,
      price_date: '2026-04-13'
    },
    {
      area_name: 'NEW YORK CITY',
      duoarea: 'Y35NY',
      price_per_gallon: 5.89,
      wow_change: -0.021,
      price_date: '2026-04-13'
    },
    {
      area_name: 'BOSTON',
      duoarea: 'YBOS',
      price_per_gallon: 5.823,
      wow_change: -0.018,
      price_date: '2026-04-13'
    },
    {
      area_name: 'WASHINGTON',
      duoarea: 'SWA',
      price_per_gallon: 5.756,
      wow_change: 0.012,
      price_date: '2026-04-13'
    },
    {
      area_name: 'MIAMI',
      duoarea: 'YMIA',
      price_per_gallon: 5.678,
      wow_change: -0.032,
      price_date: '2026-04-13'
    },
    {
      area_name: 'SEATTLE',
      duoarea: 'Y48SE',
      price_per_gallon: 5.645,
      wow_change: -0.015,
      price_date: '2026-04-13'
    },
    {
      area_name: 'DENVER',
      duoarea: 'YDEN',
      price_per_gallon: 5.534,
      wow_change: 0.008,
      price_date: '2026-04-13'
    },
    {
      area_name: 'CHICAGO',
      duoarea: 'YORD',
      price_per_gallon: 5.489,
      wow_change: -0.028,
      price_date: '2026-04-13'
    },
    {
      area_name: 'CLEVELAND',
      duoarea: 'YCLE',
      price_per_gallon: 5.423,
      wow_change: -0.019,
      price_date: '2026-04-13'
    },
    {
      area_name: 'HOUSTON',
      duoarea: 'Y44HO',
      price_per_gallon: 5.312,
      wow_change: -0.041,
      price_date: '2026-04-13'
    },
    {
      area_name: 'MINNESOTA',
      duoarea: 'SMN',
      price_per_gallon: 5.278,
      wow_change: 0.005,
      price_date: '2026-04-13'
    },
    {
      area_name: 'TEXAS',
      duoarea: 'STX',
      price_per_gallon: 5.198,
      wow_change: -0.033,
      price_date: '2026-04-13'
    },
    {
      area_name: 'COLORADO',
      duoarea: 'SCO',
      price_per_gallon: 5.145,
      wow_change: 0.011,
      price_date: '2026-04-13'
    }
  ]);
});

// GET /api/forecast - 26 weeks actuals + 8 weeks forecast
app.get('/api/forecast', (req, res) => {
  const forecast = [];
  const product = 'Regular Gasoline';

  // 26 weeks of actuals going back
  for (let i = 25; i >= 0; i--) {
    const weekDate = addDays(baseDate, -i * 7);
    const dateStr = formatDate(weekDate);
    const basePrice = 4.0 + Math.sin(i / 52 * Math.PI * 2) * 0.4 + Math.random() * 0.15;

    forecast.push({
      price_date: dateStr,
      product_name: product,
      actual_price: parseFloat(basePrice.toFixed(3)),
      forecast_price: null,
      forecast_lower: null,
      forecast_upper: null,
      is_forecast: false
    });
  }

  // 8 weeks of forecast going forward
  const lastActual = forecast[forecast.length - 1].actual_price;
  for (let i = 1; i <= 8; i++) {
    const weekDate = addDays(baseDate, i * 7);
    const dateStr = formatDate(weekDate);

    // Forecast with confidence interval
    const trendComponent = (Math.random() - 0.5) * 0.1;
    const forecastPrice = lastActual + trendComponent + (Math.random() - 0.5) * 0.08;
    const forecastLower = forecastPrice - 0.15;
    const forecastUpper = forecastPrice + 0.15;

    forecast.push({
      price_date: dateStr,
      product_name: product,
      actual_price: null,
      forecast_price: parseFloat(forecastPrice.toFixed(3)),
      forecast_lower: parseFloat(forecastLower.toFixed(3)),
      forecast_upper: parseFloat(forecastUpper.toFixed(3)),
      is_forecast: true
    });
  }

  res.json(forecast);
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', port: PORT });
});

app.listen(PORT, () => {
  console.log(`Mock API server running on http://localhost:${PORT}`);
});
