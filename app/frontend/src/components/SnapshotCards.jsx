import React from 'react'

function ChangeTag({ value, suffix = '' }) {
  if (value == null) return null
  const dir = value > 0 ? 'up' : value < 0 ? 'down' : 'flat'
  const arrow = value > 0 ? '\u2191' : value < 0 ? '\u2193' : '\u2192'
  const display = `${arrow} ${Math.abs(value).toFixed(suffix === '%' ? 1 : 3)}${suffix}`
  return <span className={`card-change ${dir}`}>{display}</span>
}

export default function SnapshotCards({ data }) {
  if (!data || data.length === 0) return null

  // Show key products: Regular Gas, Diesel, Total Gas, Premium
  const priority = ['EPMR', 'EPD2DXL0', 'EPM0', 'EPMP']
  const filtered = priority
    .map(code => data.find(d => d.product_name?.includes(
      code === 'EPMR' ? 'Regular' :
      code === 'EPD2DXL0' ? 'Low Sulfur' :
      code === 'EPM0' ? 'Total' : 'Premium'
    )))
    .filter(Boolean)

  return (
    <div className="snapshot-grid">
      {filtered.map((item, i) => (
        <div className="card" key={i}>
          <div className="card-label">{item.product_name}</div>
          <div className="card-price">${Number(item.price_per_gallon).toFixed(3)}</div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <ChangeTag value={item.wow_change} />
            <ChangeTag value={item.wow_pct_change} suffix="%" />
          </div>
          <div className="card-meta">
            4wk avg: ${Number(item.avg_4wk).toFixed(3)} &middot; 12wk avg: ${Number(item.avg_12wk).toFixed(3)}
            {item.mom_change != null && (
              <> &middot; MoM: {item.mom_change > 0 ? '+' : ''}{Number(item.mom_change).toFixed(3)}</>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}
