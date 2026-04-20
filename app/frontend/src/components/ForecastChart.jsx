import React, { useState, useEffect } from 'react'
import {
  ComposedChart, Line, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine
} from 'recharts'

export default function ForecastChart({ products }) {
  const [data, setData] = useState([])
  const [product, setProduct] = useState('EPMR')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    fetch(`/api/forecast?product=${product}`)
      .then(r => r.json())
      .then(d => {
        const processed = d.map((row, i) => {
          const next = d[i + 1]
          if (row.actual_price != null && next && next.is_forecast) {
            return { ...row, forecast_price: row.actual_price }
          }
          return row
        })
        setData(processed)
        setLoading(false)
      })
  }, [product])

  const forecastStart = data.find(d => d.is_forecast)?.price_date

  return (
    <div className="chart-container">
      <div className="chart-header">
        <div>
          <div className="chart-title">Price Forecast (8 weeks)</div>
          <div style={{ fontSize: 12, color: '#7a8278', marginTop: 4 }}>
            Prophet model — trained on full history
          </div>
        </div>
        <div className="chart-controls">
          <select value={product} onChange={e => setProduct(e.target.value)}>
            {products.map(p => (
              <option key={p.product} value={p.product}>{p.product_name}</option>
            ))}
          </select>
        </div>
      </div>

      {loading ? (
        <div className="loading"><div className="spinner" />Loading...</div>
      ) : (
        <>
          <ResponsiveContainer width="100%" height={400}>
            <ComposedChart data={data}>
              <CartesianGrid strokeDasharray="3 3" stroke="#d4d6cf" />
              <XAxis
                dataKey="price_date"
                tick={{ fill: '#7a8278', fontSize: 11 }}
                tickFormatter={d => {
                  const date = new Date(d)
                  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
                }}
                minTickGap={40}
              />
              <YAxis
                tick={{ fill: '#7a8278', fontSize: 11 }}
                tickFormatter={v => `$${v.toFixed(2)}`}
                domain={['auto', 'auto']}
              />
              <Tooltip
                contentStyle={{ background: '#ffffff', border: '1px solid #d4d6cf', borderRadius: 8, fontSize: 12 }}
                labelStyle={{ color: '#4a5548' }}
                formatter={(value, name) => {
                  if (value == null) return ['-', name]
                  const labels = {
                    actual_price: 'Actual',
                    forecast_price: 'Forecast',
                    forecast_lower: 'Lower Bound',
                    forecast_upper: 'Upper Bound',
                  }
                  return [`$${Number(value).toFixed(3)}`, labels[name] || name]
                }}
              />

              {/* Confidence interval band */}
              <Area
                type="monotone"
                dataKey="forecast_upper"
                stroke="none"
                fill="#779A0B"
                fillOpacity={0.1}
              />
              <Area
                type="monotone"
                dataKey="forecast_lower"
                stroke="none"
                fill="#ffffff"
                fillOpacity={1}
              />

              {/* Forecast line */}
              <Line
                type="monotone"
                dataKey="forecast_price"
                stroke="#779A0B"
                strokeWidth={2}
                strokeDasharray="6 3"
                dot={false}
                name="forecast_price"
              />

              {/* Actual price line */}
              <Line
                type="monotone"
                dataKey="actual_price"
                stroke="#273126"
                strokeWidth={2}
                dot={false}
                name="actual_price"
              />

              {/* Forecast boundary */}
              {forecastStart && (
                <ReferenceLine
                  x={forecastStart}
                  stroke="#d4a017"
                  strokeDasharray="4 4"
                  label={{ value: 'Forecast', fill: '#d4a017', fontSize: 11, position: 'top' }}
                />
              )}
            </ComposedChart>
          </ResponsiveContainer>

          <div className="forecast-legend">
            <span><span className="legend-dot" style={{ background: '#273126' }} />Actual</span>
            <span><span className="legend-dot" style={{ background: '#779A0B' }} />Forecast</span>
            <span><span className="legend-dot" style={{ background: 'rgba(119,154,11,0.25)' }} />Confidence Band</span>
          </div>
        </>
      )}
    </div>
  )
}
