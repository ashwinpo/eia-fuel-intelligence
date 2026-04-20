import React, { useState, useEffect } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell
} from 'recharts'

export default function RegionalComparison({ products }) {
  const [data, setData] = useState([])
  const [product, setProduct] = useState('EPD2DXL0')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    fetch(`/api/regional?product=${product}`)
      .then(r => r.json())
      .then(d => {
        setData(d)
        setLoading(false)
      })
  }, [product])

  const maxPrice = data.length > 0 ? Math.max(...data.map(d => d.price_per_gallon)) : 1
  const minPrice = data.length > 0 ? Math.min(...data.map(d => d.price_per_gallon)) : 0

  return (
    <>
      <div className="chart-container">
        <div className="chart-header">
          <div className="chart-title">Regional Price Comparison</div>
          <div className="chart-controls">
            <select value={product} onChange={e => setProduct(e.target.value)}>
              <option value="EPD2DXL0">Diesel (Ultra Low Sulfur)</option>
              <option value="EPMR">Regular Gasoline</option>
            </select>
          </div>
        </div>

        {loading ? (
          <div className="loading"><div className="spinner" />Loading...</div>
        ) : (
          <ResponsiveContainer width="100%" height={Math.max(400, data.length * 32)}>
            <BarChart data={data} layout="vertical" margin={{ left: 120 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#2a2d3a" horizontal={false} />
              <XAxis
                type="number"
                tick={{ fill: '#6b7280', fontSize: 11 }}
                tickFormatter={v => `$${v.toFixed(2)}`}
                domain={[minPrice * 0.9, maxPrice * 1.02]}
              />
              <YAxis
                type="category"
                dataKey="area_name"
                tick={{ fill: '#9aa0a6', fontSize: 11 }}
                width={110}
              />
              <Tooltip
                contentStyle={{ background: '#1a1d27', border: '1px solid #2a2d3a', borderRadius: 8, fontSize: 12 }}
                formatter={(value, name) => [`$${Number(value).toFixed(3)}`, 'Price/gal']}
              />
              <Bar dataKey="price_per_gallon" radius={[0, 4, 4, 0]}>
                {data.map((entry, i) => (
                  <Cell
                    key={i}
                    fill={entry.wow_change > 0 ? '#f87171' : entry.wow_change < 0 ? '#34d399' : '#4f8ff7'}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      <div className="chart-container">
        <div className="chart-title" style={{ marginBottom: 16 }}>Price Detail</div>
        <table className="region-table">
          <thead>
            <tr>
              <th>Region</th>
              <th>Price/Gallon</th>
              <th>WoW Change</th>
              <th>Relative</th>
            </tr>
          </thead>
          <tbody>
            {data.map((row, i) => {
              const pct = ((row.price_per_gallon - minPrice) / (maxPrice - minPrice)) * 100
              return (
                <tr key={i}>
                  <td>{row.area_name}</td>
                  <td style={{ fontWeight: 600 }}>${Number(row.price_per_gallon).toFixed(3)}</td>
                  <td>
                    <span className={`card-change ${row.wow_change > 0 ? 'up' : row.wow_change < 0 ? 'down' : 'flat'}`}>
                      {row.wow_change > 0 ? '\u2191' : row.wow_change < 0 ? '\u2193' : '\u2192'}
                      {' '}${Math.abs(row.wow_change).toFixed(3)}
                    </span>
                  </td>
                  <td style={{ width: '30%' }}>
                    <div className="region-bar" style={{ width: `${pct}%` }} />
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </>
  )
}
