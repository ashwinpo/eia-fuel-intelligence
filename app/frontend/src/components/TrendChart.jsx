import React, { useState, useEffect } from 'react'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine
} from 'recharts'

const WEEK_OPTIONS = [
  { value: 13, label: '3 months' },
  { value: 26, label: '6 months' },
  { value: 52, label: '1 year' },
  { value: 104, label: '2 years' },
  { value: 260, label: '5 years' },
]

export default function TrendChart({ products, selectedProduct, onProductChange }) {
  const [data, setData] = useState([])
  const [weeks, setWeeks] = useState(52)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    setLoading(true)
    fetch(`/api/trends?product=${selectedProduct}&weeks=${weeks}`)
      .then(r => r.json())
      .then(d => {
        setData(d.reverse())
        setLoading(false)
      })
  }, [selectedProduct, weeks])

  return (
    <div className="chart-container">
      <div className="chart-header">
        <div className="chart-title">Price Trend</div>
        <div className="chart-controls">
          <select value={selectedProduct} onChange={e => onProductChange(e.target.value)}>
            {products.map(p => (
              <option key={p.product} value={p.product}>{p.product_name}</option>
            ))}
          </select>
          <select value={weeks} onChange={e => setWeeks(Number(e.target.value))}>
            {WEEK_OPTIONS.map(o => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>
      </div>

      {loading ? (
        <div className="loading"><div className="spinner" />Loading...</div>
      ) : (
        <ResponsiveContainer width="100%" height={360}>
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="#d4d6cf" />
            <XAxis
              dataKey="price_date"
              tick={{ fill: '#7a8278', fontSize: 11 }}
              tickFormatter={d => {
                const date = new Date(d)
                return date.toLocaleDateString('en-US', { month: 'short', year: '2-digit' })
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
                const labels = {
                  price_per_gallon: 'Price',
                  avg_4wk: '4wk Avg',
                  avg_12wk: '12wk Avg',
                }
                return [`$${Number(value).toFixed(3)}`, labels[name] || name]
              }}
            />
            <Line
              type="monotone"
              dataKey="price_per_gallon"
              stroke="#779A0B"
              strokeWidth={2}
              dot={false}
              name="price_per_gallon"
            />
            <Line
              type="monotone"
              dataKey="avg_4wk"
              stroke="#fbbf24"
              strokeWidth={1.5}
              strokeDasharray="4 4"
              dot={false}
              name="avg_4wk"
            />
            <Line
              type="monotone"
              dataKey="avg_12wk"
              stroke="#8fb310"
              strokeWidth={1.5}
              strokeDasharray="8 4"
              dot={false}
              name="avg_12wk"
            />
          </LineChart>
        </ResponsiveContainer>
      )}
    </div>
  )
}
