import React, { useState, useEffect, useMemo } from 'react'
import {
  ComposedChart, Line, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceArea
} from 'recharts'

// Fleet assumptions (would come from internal systems in production)
const TOTAL_WEEKLY_DELIVERIES = 5410
const AVG_MILES_PER_DELIVERY = 39
const FLEET_MPG = 6.2
const GALLONS_PER_DELIVERY = AVG_MILES_PER_DELIVERY / FLEET_MPG // ~6.29 gal

export default function SurchargeSimulator({ regionalPrices }) {
  const [baselineFuel, setBaselineFuel] = useState(4.50)
  const [surchargeRate, setSurchargeRate] = useState(0.35)
  const [forecastData, setForecastData] = useState([])

  useEffect(() => {
    fetch('/api/forecast?product=EPD2DXL0')
      .then(r => r.json())
      .then(d => {
        const processed = d.map((row, i) => {
          const next = d[i + 1]
          if (row.actual_price != null && next && next.is_forecast) {
            return { ...row, forecast_price: row.actual_price }
          }
          return row
        })
        setForecastData(processed)
      })
  }, [])

  // Current national diesel average
  const nationalAvg = regionalPrices.length > 0
    ? regionalPrices.reduce((s, r) => s + r.price_per_gallon, 0) / regionalPrices.length
    : 5.50

  const aboveBaseline = Math.max(0, nationalAvg - baselineFuel)

  // Per-delivery math
  const extraFuelCostPerDelivery = aboveBaseline * GALLONS_PER_DELIVERY
  const surchargePerDelivery = (aboveBaseline / 0.10) * surchargeRate

  // Weekly totals
  const weeklyExtraFuelCost = extraFuelCostPerDelivery * TOTAL_WEEKLY_DELIVERIES
  const weeklySurchargeRevenue = surchargePerDelivery * TOTAL_WEEKLY_DELIVERIES
  const weeklyGap = weeklySurchargeRevenue - weeklyExtraFuelCost
  const recoveryPct = weeklyExtraFuelCost > 0
    ? (weeklySurchargeRevenue / weeklyExtraFuelCost * 100)
    : 100

  // Break-even rate: what surcharge rate per $0.10 would fully cover fuel cost
  const breakEvenRate = GALLONS_PER_DELIVERY * 0.10 // ~$0.63
  const breakEvenPct = (breakEvenRate / 1.00) * 100 // position on slider (0-1.00 range)

  // Chart: weekly dollar amounts over time (extra fuel cost vs surcharge revenue)
  const chartData = useMemo(() => {
    return forecastData
      .filter(d => d.price_date && (d.actual_price || d.forecast_price))
      .map(d => {
        const price = d.actual_price || d.forecast_price
        const above = Math.max(0, price - baselineFuel)
        const extraCost = above * GALLONS_PER_DELIVERY * TOTAL_WEEKLY_DELIVERIES
        const surchargeRev = (above / 0.10) * surchargeRate * TOTAL_WEEKLY_DELIVERIES

        return {
          date: d.price_date,
          extraFuelCost: Math.round(extraCost),
          surchargeRevenue: Math.round(surchargeRev),
          isForecast: d.is_forecast,
        }
      })
  }, [forecastData, baselineFuel, surchargeRate])

  const forecastStartDate = chartData.find(d => d.isForecast)?.date

  return (
    <>
      {/* Hero metric */}
      <div className="chart-container" style={{ textAlign: 'center', padding: '32px 24px', marginBottom: 24 }}>
        <div style={{ fontSize: 13, fontWeight: 500, color: '#7a8278', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>
          Fuel Surcharge Recovery
        </div>
        <div style={{
          fontSize: 72, fontWeight: 700, letterSpacing: -2,
          color: recoveryPct >= 100 ? '#779A0B' : recoveryPct >= 70 ? '#d4a017' : '#e05252',
        }}>
          {aboveBaseline > 0 ? `${Math.round(recoveryPct)}%` : '---'}
        </div>
        <div style={{ fontSize: 14, color: '#4a5548', marginTop: 4 }}>
          {aboveBaseline > 0 ? (
            weeklyGap >= 0
              ? `Surcharge fully covers fuel cost increase (+$${weeklyGap.toLocaleString(undefined, { maximumFractionDigits: 0 })}/wk surplus)`
              : `Surcharge leaves $${Math.abs(weeklyGap).toLocaleString(undefined, { maximumFractionDigits: 0 })}/wk unrecovered`
          ) : (
            'Diesel is at or below your baseline — no surcharge needed'
          )}
        </div>
      </div>

      {/* Surcharge rate slider with break-even marker */}
      <div className="chart-container" style={{ marginBottom: 24 }}>
        <div className="chart-header">
          <div>
            <div className="chart-title">Surcharge Rate</div>
            <div style={{ fontSize: 12, color: '#7a8278', marginTop: 4 }}>
              Amount charged per delivery for every $0.10 diesel rises above baseline
            </div>
          </div>
          <div style={{ fontSize: 24, fontWeight: 700 }}>
            ${surchargeRate.toFixed(2)}<span style={{ fontSize: 13, fontWeight: 400, color: '#7a8278' }}> / $0.10</span>
          </div>
        </div>

        <div style={{ position: 'relative', padding: '16px 0 32px' }}>
          <input
            type="range" min="0.00" max="1.00" step="0.01" value={surchargeRate}
            onChange={e => setSurchargeRate(Number(e.target.value))}
            style={{ width: '100%', accentColor: '#779A0B' }}
          />
          {/* Break-even marker */}
          <div style={{
            position: 'absolute',
            left: `${(breakEvenRate / 1.00) * 100}%`,
            bottom: 4,
            transform: 'translateX(-50%)',
            fontSize: 11,
            fontWeight: 600,
            color: '#d4a017',
            textAlign: 'center',
            pointerEvents: 'none',
          }}>
            <div style={{ width: 2, height: 10, background: '#d4a017', margin: '0 auto 2px', borderRadius: 1 }} />
            Break-even ${breakEvenRate.toFixed(2)}
          </div>
        </div>

        {/* Per-delivery breakdown */}
        {aboveBaseline > 0 && (
          <div style={{ display: 'flex', gap: 24, fontSize: 13, color: '#4a5548', borderTop: '1px solid #d4d6cf', paddingTop: 16 }}>
            <div>Diesel above baseline: <strong style={{ color: '#273126' }}>+${aboveBaseline.toFixed(2)}/gal</strong></div>
            <div>Extra fuel cost/delivery: <strong style={{ color: '#e05252' }}>${extraFuelCostPerDelivery.toFixed(2)}</strong></div>
            <div>Surcharge collected/delivery: <strong style={{ color: '#779A0B' }}>${surchargePerDelivery.toFixed(2)}</strong></div>
          </div>
        )}
      </div>

      {/* Weekly summary cards */}
      {aboveBaseline > 0 && (
        <div className="snapshot-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)', marginBottom: 24 }}>
          <div className="card">
            <div className="card-label">Weekly Extra Fuel Cost</div>
            <div className="card-price" style={{ color: '#e05252' }}>
              ${weeklyExtraFuelCost.toLocaleString(undefined, { maximumFractionDigits: 0 })}
            </div>
            <div className="card-meta">Cost above baseline across {TOTAL_WEEKLY_DELIVERIES.toLocaleString()} deliveries</div>
          </div>
          <div className="card">
            <div className="card-label">Weekly Surcharge Revenue</div>
            <div className="card-price" style={{ color: '#779A0B' }}>
              ${weeklySurchargeRevenue.toLocaleString(undefined, { maximumFractionDigits: 0 })}
            </div>
            <div className="card-meta">Collected from customers</div>
          </div>
          <div className="card">
            <div className="card-label">Weekly Net Impact</div>
            <div className="card-price" style={{ color: weeklyGap >= 0 ? '#779A0B' : '#e05252' }}>
              {weeklyGap >= 0 ? '+' : '-'}${Math.abs(weeklyGap).toLocaleString(undefined, { maximumFractionDigits: 0 })}
            </div>
            <div className="card-meta">{weeklyGap >= 0 ? 'Surplus' : 'Shortfall'} per week</div>
          </div>
        </div>
      )}

      {/* Cost vs Revenue over time chart */}
      <div className="chart-container">
        <div className="chart-header">
          <div>
            <div className="chart-title">Surcharge Revenue vs. Extra Fuel Cost</div>
            <div style={{ fontSize: 12, color: '#7a8278', marginTop: 4 }}>
              When the green line is above the red area, the surcharge fully covers the fuel cost increase. Shaded region = forecast.
            </div>
          </div>
        </div>
        <ResponsiveContainer width="100%" height={340}>
          <ComposedChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#d4d6cf" />
            <XAxis
              dataKey="date"
              tick={{ fill: '#7a8278', fontSize: 11 }}
              tickFormatter={d => {
                const date = new Date(d)
                return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
              }}
              minTickGap={40}
            />
            <YAxis
              tick={{ fill: '#7a8278', fontSize: 11 }}
              tickFormatter={v => `$${(v / 1000).toFixed(0)}k`}
            />
            <Tooltip
              contentStyle={{ background: '#ffffff', border: '1px solid #d4d6cf', borderRadius: 8, fontSize: 12 }}
              formatter={(value, name) => {
                const labels = {
                  extraFuelCost: 'Extra Fuel Cost',
                  surchargeRevenue: 'Surcharge Revenue',
                }
                return [`$${Number(value).toLocaleString()}`, labels[name] || name]
              }}
              labelFormatter={d => {
                const date = new Date(d)
                return date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
              }}
            />

            {/* Forecast shading */}
            {forecastStartDate && (
              <ReferenceArea
                x1={forecastStartDate}
                x2={chartData[chartData.length - 1]?.date}
                fill="#779A0B"
                fillOpacity={0.05}
              />
            )}

            {/* Extra fuel cost as filled area */}
            <Area
              type="monotone"
              dataKey="extraFuelCost"
              stroke="#e05252"
              fill="#e05252"
              fillOpacity={0.12}
              strokeWidth={2}
              name="extraFuelCost"
            />

            {/* Surcharge revenue as line */}
            <Line
              type="monotone"
              dataKey="surchargeRevenue"
              stroke="#779A0B"
              strokeWidth={2.5}
              dot={false}
              name="surchargeRevenue"
            />
          </ComposedChart>
        </ResponsiveContainer>

        <div className="forecast-legend">
          <span><span className="legend-dot" style={{ background: '#e05252' }} />Extra Fuel Cost (above baseline)</span>
          <span><span className="legend-dot" style={{ background: '#779A0B' }} />Surcharge Revenue</span>
          <span><span className="legend-dot" style={{ background: 'rgba(119,154,11,0.15)' }} />Forecast Period</span>
        </div>
      </div>

      {/* Assumptions — baseline config lives here */}
      <div className="chart-container" style={{ borderColor: '#d4d6cf' }}>
        <div className="chart-title" style={{ marginBottom: 16 }}>Assumptions</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
          <div>
            <div style={{ fontSize: 12, color: '#7a8278', marginBottom: 8 }}>
              <strong style={{ color: '#273126' }}>Baseline Fuel Price</strong> — diesel price assumed when surcharge was last calibrated
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <input
                type="range" min="3.00" max="6.00" step="0.05" value={baselineFuel}
                onChange={e => setBaselineFuel(Number(e.target.value))}
                style={{ flex: 1, accentColor: '#779A0B' }}
              />
              <span style={{ fontSize: 18, fontWeight: 600, minWidth: 60 }}>${baselineFuel.toFixed(2)}</span>
            </div>
          </div>
          <div>
            <div style={{ fontSize: 12, color: '#7a8278', marginBottom: 8 }}>
              <strong style={{ color: '#273126' }}>Fleet & Delivery Parameters</strong>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, fontSize: 13, color: '#4a5548' }}>
              <div>Weekly deliveries: <strong>{TOTAL_WEEKLY_DELIVERIES.toLocaleString()}</strong></div>
              <div>Avg miles/delivery: <strong>{AVG_MILES_PER_DELIVERY}</strong></div>
              <div>Fleet MPG: <strong>{FLEET_MPG}</strong></div>
              <div>Gallons/delivery: <strong>{GALLONS_PER_DELIVERY.toFixed(1)}</strong></div>
            </div>
          </div>
        </div>
        <div style={{ fontSize: 11, color: '#7a8278', marginTop: 16, borderTop: '1px solid #d4d6cf', paddingTop: 12 }}>
          Current national avg diesel: <strong style={{ color: '#273126' }}>${nationalAvg.toFixed(3)}/gal</strong>
          {' '} | Forecast model: Prophet, 8-week horizon
          {' '} | In production, fleet data and surcharge policy would come from internal systems
        </div>
      </div>
    </>
  )
}
