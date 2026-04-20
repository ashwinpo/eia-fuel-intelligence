import React, { useState, useEffect } from 'react'
import WeeklyReport from './components/WeeklyReport'
import MarginTracker from './components/MarginTracker'
import SurchargeSimulator from './components/SurchargeSimulator'

const TABS = [
  { id: 'report', label: 'Weekly Report' },
  { id: 'margins', label: 'Delivery Margins' },
  { id: 'surcharge', label: 'Surcharge Simulator' },
]

export default function App() {
  const [activeTab, setActiveTab] = useState('report')
  const [snapshot, setSnapshot] = useState(null)
  const [products, setProducts] = useState([])
  const [regional, setRegional] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      fetch('/api/snapshot').then(r => r.json()),
      fetch('/api/products').then(r => r.json()),
      fetch('/api/regional?product=EPD2DXL0').then(r => r.json()),
    ]).then(([snap, prods, reg]) => {
      setSnapshot(snap)
      setProducts(prods)
      setRegional(reg)
      setLoading(false)
    })
  }, [])

  const latestDate = snapshot?.[0]?.price_date

  return (
    <div className="app">
      <div className="header">
        <div className="header-left">
          <div>
            <h1>Fuel Price Intelligence</h1>
            <div className="header-subtitle">
              Weekly retail gasoline & diesel prices — EIA Open Data
            </div>
          </div>
        </div>
        <div className="header-meta">
          {latestDate && <>Data through {latestDate}<br/>Source: U.S. Energy Information Administration</>}
        </div>
      </div>

      <div className="tabs">
        {TABS.map(tab => (
          <button
            key={tab.id}
            className={`tab ${activeTab === tab.id ? 'active' : ''}`}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="loading"><div className="spinner" /> Loading data...</div>
      ) : (
        <>
          {activeTab === 'report' && (
            <WeeklyReport snapshot={snapshot} products={products} />
          )}
          {activeTab === 'margins' && (
            <MarginTracker />
          )}
          {activeTab === 'surcharge' && (
            <SurchargeSimulator regionalPrices={regional} />
          )}
        </>
      )}
    </div>
  )
}
