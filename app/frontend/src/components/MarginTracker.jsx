import React, { useState, useEffect, useMemo } from 'react'
import { ComposableMap, Geographies, Geography, Marker, ZoomableGroup } from 'react-simple-maps'

const GEO_URL = 'https://cdn.jsdelivr.net/npm/us-atlas@3/states-10m.json'

// Map zone duoarea to state FIPS for coloring states on map
const DUOAREA_TO_STATES = {
  STX:   ['48'],
  SFL:   ['12'],
  SCA:   ['06'],
  YORD:  ['17'],
  Y44HO: ['48'],
  YMIA:  ['12'],
  YBOS:  ['25'],
  Y35NY: ['36'],
  YDEN:  ['08'],
  SWA:   ['11', '51', '24'],
  YCLE:  ['39'],
  SMN:   ['27'],
  Y48SE: ['53'],
  SCO:   ['08'],
  Y05LA: ['06'],
}

const STATUS_COLORS = {
  healthy: '#779A0B',
  watch: '#8fb310',
  warning: '#d4a017',
  critical: '#e05252',
}

function getStatus(marginPct) {
  if (marginPct > 25) return 'healthy'
  if (marginPct > 15) return 'watch'
  if (marginPct > 5) return 'warning'
  return 'critical'
}

export default function MarginTracker() {
  const [marginsRaw, setMarginsRaw] = useState([])
  const [selectedZone, setSelectedZone] = useState(null)
  const [hoveredZone, setHoveredZone] = useState(null)

  useEffect(() => {
    fetch('/api/margins')
      .then(r => r.json())
      .then(d => { if (Array.isArray(d)) setMarginsRaw(d) })
      .catch(() => {})
  }, [])

  const margins = useMemo(() =>
    marginsRaw.map(m => ({
      duoarea: m.duoarea,
      zone: m.zone_name,
      lat: m.latitude,
      lng: m.longitude,
      dieselPrice: Number(m.diesel_price),
      fuelCostPerDelivery: Number(m.fuel_cost_per_delivery),
      marginPerDelivery: Number(m.margin_per_delivery),
      marginPct: Number(m.margin_pct),
      weeklyFuelCost: Number(m.weekly_fuel_cost),
      weeklyMargin: Number(m.weekly_margin),
      deliveriesPerWeek: Number(m.deliveries_per_week),
      regionName: m.region_name,
      status: getStatus(Number(m.margin_pct)),
    })).sort((a, b) => a.marginPct - b.marginPct)
  , [marginsRaw])

  // Build a FIPS → margin lookup for state coloring
  const stateColorMap = useMemo(() => {
    const map = {}
    margins.forEach(m => {
      const fipsList = DUOAREA_TO_STATES[m.duoarea] || []
      fipsList.forEach(fips => {
        if (!map[fips] || m.marginPct < map[fips].marginPct) {
          map[fips] = m
        }
      })
    })
    return map
  }, [margins])

  const totalWeeklyFuel = margins.reduce((s, m) => s + m.weeklyFuelCost, 0)
  const totalWeeklyMargin = margins.reduce((s, m) => s + m.weeklyMargin, 0)
  const zonesAtRisk = margins.filter(m => m.status === 'warning' || m.status === 'critical').length

  const detail = selectedZone ? margins.find(m => m.duoarea === selectedZone) : null
  const hovered = hoveredZone ? margins.find(m => m.duoarea === hoveredZone) : null

  return (
    <>
      {/* Summary cards */}
      <div className="snapshot-grid" style={{ marginBottom: 24 }}>
        <div className="card">
          <div className="card-label">Weekly Fleet Fuel Cost</div>
          <div className="card-price">${totalWeeklyFuel.toLocaleString()}</div>
          <div className="card-meta">Across {margins.length} delivery zones</div>
        </div>
        <div className="card">
          <div className="card-label">Weekly Delivery Margin</div>
          <div className="card-price">${totalWeeklyMargin.toLocaleString()}</div>
          <div className="card-meta">After fuel + base costs</div>
        </div>
        <div className="card">
          <div className="card-label">Zones at Risk</div>
          <div className="card-price" style={{ color: zonesAtRisk > 0 ? '#d4a017' : '#779A0B' }}>
            {zonesAtRisk} / {margins.length}
          </div>
          <div className="card-meta">Below 25% delivery margin</div>
        </div>
        <div className="card">
          <div className="card-label">Zones</div>
          <div className="card-price">{margins.length}</div>
          <div className="card-meta">Regional delivery zones</div>
        </div>
      </div>

      {/* Map + detail layout */}
      <div style={{ display: 'grid', gridTemplateColumns: selectedZone ? '1fr 380px' : '1fr', gap: 16, marginBottom: 24 }}>
        <div className="chart-container" style={{ padding: 16 }}>
          <div className="chart-header" style={{ marginBottom: 8 }}>
            <div>
              <div className="chart-title">Delivery Margin by Zone</div>
              <div style={{ fontSize: 12, color: '#7a8278', marginTop: 4 }}>
                {hovered ? `${hovered.zone}: ${hovered.marginPct}% margin — $${hovered.dieselPrice.toFixed(3)}/gal diesel (${hovered.regionName})` : 'Hover over a zone for details. Click to drill in.'}
              </div>
            </div>
            <div style={{ display: 'flex', gap: 16, fontSize: 11, color: '#4a5548' }}>
              {Object.entries(STATUS_COLORS).map(([k, v]) => (
                <span key={k} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <span style={{ width: 10, height: 10, borderRadius: 3, background: v, display: 'inline-block' }} />
                  {k === 'healthy' ? '>25%' : k === 'watch' ? '15-25%' : k === 'warning' ? '5-15%' : '<5%'}
                </span>
              ))}
            </div>
          </div>

          <ComposableMap
            projection="geoAlbersUsa"
            style={{ width: '100%', height: 'auto' }}
            projectionConfig={{ scale: 1000 }}
          >
            <Geographies geography={GEO_URL}>
              {({ geographies }) =>
                geographies.map(geo => {
                  const fips = geo.id
                  const zoneData = stateColorMap[fips]
                  const fill = zoneData
                    ? STATUS_COLORS[zoneData.status]
                    : '#dddfd9'
                  const isSelected = zoneData && selectedZone === zoneData.duoarea
                  return (
                    <Geography
                      key={geo.rsmKey}
                      geography={geo}
                      fill={fill}
                      stroke="#d4d6cf"
                      strokeWidth={isSelected ? 2 : 0.5}
                      style={{
                        default: { outline: 'none', opacity: zoneData ? 0.85 : 0.4 },
                        hover: { outline: 'none', opacity: 1, cursor: zoneData ? 'pointer' : 'default' },
                        pressed: { outline: 'none' },
                      }}
                      onClick={() => {
                        if (zoneData) setSelectedZone(zoneData.duoarea)
                      }}
                      onMouseEnter={() => {
                        if (zoneData) setHoveredZone(zoneData.duoarea)
                      }}
                      onMouseLeave={() => setHoveredZone(null)}
                    />
                  )
                })
              }
            </Geographies>

            {/* Zone markers with delivery volume */}
            {margins.map(m => (
              <Marker
                key={m.duoarea}
                coordinates={[m.lng, m.lat]}
                onClick={() => setSelectedZone(m.duoarea)}
                onMouseEnter={() => setHoveredZone(m.duoarea)}
                onMouseLeave={() => setHoveredZone(null)}
                style={{ cursor: 'pointer' }}
              >
                <circle
                  r={Math.max(4, Math.sqrt(m.deliveriesPerWeek / 15))}
                  fill={STATUS_COLORS[m.status]}
                  stroke="#f5f6f2"
                  strokeWidth={1.5}
                  opacity={0.9}
                />
                <text
                  textAnchor="middle"
                  y={-Math.max(4, Math.sqrt(m.deliveriesPerWeek / 15)) - 4}
                  style={{ fontSize: 9, fill: '#273126', fontWeight: 600 }}
                >
                  {m.zone}
                </text>
              </Marker>
            ))}
          </ComposableMap>
        </div>

        {/* Detail panel */}
        {detail && (
          <div className="chart-container" style={{ borderColor: STATUS_COLORS[detail.status], alignSelf: 'start' }}>
            <div className="chart-header">
              <div className="chart-title">{detail.zone}</div>
              <button
                onClick={() => setSelectedZone(null)}
                style={{ background: 'none', border: '1px solid #d4d6cf', color: '#4a5548', borderRadius: 6, padding: '4px 12px', cursor: 'pointer', fontSize: 12 }}
              >
                Close
              </button>
            </div>
            <div style={{
              display: 'inline-block', padding: '3px 10px', borderRadius: 4, fontSize: 11, fontWeight: 600,
              color: STATUS_COLORS[detail.status], background: `${STATUS_COLORS[detail.status]}18`, marginBottom: 16,
            }}>
              {detail.status.toUpperCase()} — {detail.marginPct}% margin
            </div>
            <div style={{ fontSize: 11, color: '#7a8278', marginBottom: 12 }}>
              Diesel price from {detail.regionName}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              {[
                ['Diesel', `$${detail.dieselPrice.toFixed(3)}/gal`],
                ['Fuel/Delivery', `$${detail.fuelCostPerDelivery.toFixed(2)}`],
                ['Margin/Delivery', `$${detail.marginPerDelivery.toFixed(2)}`],
                ['Deliveries/Wk', detail.deliveriesPerWeek.toLocaleString()],
                ['Wk Fuel Cost', `$${detail.weeklyFuelCost.toLocaleString()}`],
                ['Wk Margin', `$${detail.weeklyMargin.toLocaleString()}`],
              ].map(([label, val]) => (
                <div key={label} style={{ padding: '10px 12px', background: '#f5f6f2', borderRadius: 8 }}>
                  <div style={{ fontSize: 10, color: '#7a8278', textTransform: 'uppercase', marginBottom: 3 }}>{label}</div>
                  <div style={{ fontSize: 16, fontWeight: 600 }}>{val}</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Zone table */}
      <div className="chart-container">
        <div className="chart-title" style={{ marginBottom: 16 }}>All Zones</div>
        <table className="region-table">
          <thead>
            <tr>
              <th>Zone</th>
              <th>Region</th>
              <th>Diesel $/gal</th>
              <th>Fuel/Delivery</th>
              <th>Margin/Delivery</th>
              <th>Margin %</th>
              <th>Wk Fuel Cost</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {margins.map((m, i) => (
              <tr key={i} onClick={() => setSelectedZone(m.duoarea)} style={{ cursor: 'pointer' }}>
                <td style={{ fontWeight: 500 }}>{m.zone}</td>
                <td style={{ fontSize: 12, color: '#7a8278' }}>{m.regionName}</td>
                <td>${m.dieselPrice.toFixed(3)}</td>
                <td>${m.fuelCostPerDelivery.toFixed(2)}</td>
                <td style={{ fontWeight: 600 }}>${m.marginPerDelivery.toFixed(2)}</td>
                <td style={{ fontWeight: 600 }}>{m.marginPct}%</td>
                <td>${m.weeklyFuelCost.toLocaleString()}</td>
                <td>
                  <span style={{
                    display: 'inline-block', padding: '2px 10px', borderRadius: 4, fontSize: 11, fontWeight: 600,
                    color: STATUS_COLORS[m.status], background: `${STATUS_COLORS[m.status]}18`,
                  }}>
                    {m.status.toUpperCase()}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  )
}
