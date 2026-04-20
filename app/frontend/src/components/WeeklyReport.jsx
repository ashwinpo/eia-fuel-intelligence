import React, { useState, useEffect } from 'react'
import SnapshotCards from './SnapshotCards'
import TrendChart from './TrendChart'
import ForecastChart from './ForecastChart'

export default function WeeklyReport({ snapshot, products }) {
  const [selectedProduct, setSelectedProduct] = useState('EPMR')
  const forecastProducts = products.filter(p => ['EPMR', 'EPD2DXL0'].includes(p.product))

  return (
    <>
      <SnapshotCards data={snapshot} />
      <TrendChart
        products={products}
        selectedProduct={selectedProduct}
        onProductChange={setSelectedProduct}
      />
      <ForecastChart products={forecastProducts} />
    </>
  )
}
