const REGION_STATE_MAP = {
  North: new Set(['Delhi', 'Uttar Pradesh', 'Rajasthan', 'Punjab', 'Haryana', 'Uttarakhand']),
  South: new Set(['Tamil Nadu', 'Karnataka', 'Kerala', 'Andhra Pradesh', 'Telangana']),
  East: new Set(['West Bengal', 'Odisha', 'Bihar', 'Jharkhand', 'Assam']),
  West: new Set(['Maharashtra', 'Gujarat', 'Goa']),
  Central: new Set(['Madhya Pradesh', 'Chhattisgarh']),
}

const SHADE_FAMILY_BY_SCENARIO = {
  TRUCK_STRIKE: ['Reds', 'Neutrals'],
  HEATWAVE: ['Whites', 'Yellows', 'Neutrals'],
  EARLY_MONSOON: ['Blues', 'Greens', 'Neutrals'],
}

function getRegionByState(state) {
  for (const [region, states] of Object.entries(REGION_STATE_MAP)) {
    if (states.has(state)) return region
  }
  return null
}

function isAffectedRegion(state, scenarioData) {
  if (!scenarioData?.affected_regions?.length) return false
  const region = getRegionByState(state)
  return region ? scenarioData.affected_regions.includes(region) : false
}

function amplifyStatus(status, demandMultiplier, inventoryMultiplier, affected) {
  if (!affected) return status
  if (status === 'overstocked' && demandMultiplier > 1.2) return 'low'
  if (status === 'healthy' && (demandMultiplier > 1.2 || inventoryMultiplier < 0.8)) return 'low'
  if (status === 'low' && (demandMultiplier > 1.15 || inventoryMultiplier < 0.85)) return 'critical'
  return status
}

export function applyScenarioToWarehouses(warehouses = [], scenario, scenarioData) {
  if (scenario === 'NORMAL' || !scenarioData) return warehouses
  const demand = Number(scenarioData.demand_multiplier || 1)
  const inventory = Number(scenarioData.inventory_multiplier || 1)

  return warehouses.map((warehouse) => {
    const affected = isAffectedRegion(warehouse.state, scenarioData)
    const demandFactor = affected ? demand : 1 + ((demand - 1) * 0.35)
    const inventoryFactor = affected ? inventory : 1 - ((1 - inventory) * 0.2)
    const stock = Math.max(0, Math.round((warehouse.total_stock || 0) * inventoryFactor / demandFactor))
    const criticalSkus = Math.max(
      0,
      Math.round((warehouse.critical_skus || 0) + (affected ? 4 : 1) * (demandFactor - 0.9) + (1 - inventoryFactor) * 6)
    )
    const lowSkus = Math.max(
      0,
      Math.round((warehouse.low_skus || 0) + (affected ? 6 : 2) * (demandFactor - 1) + (1 - inventoryFactor) * 4)
    )
    const overstockSkus = Math.max(
      0,
      Math.round((warehouse.overstock_skus || 0) * (inventoryFactor < 1 ? 0.6 : 1.15))
    )
    const capacityPct = Math.max(1, Math.min(130, (stock / Math.max(warehouse.capacity || 1, 1)) * 100))
    const status = amplifyStatus(warehouse.status, demandFactor, inventoryFactor, affected)
    const revenueAtRisk = Math.max(
      0,
      Math.round((warehouse.revenue_at_risk || 0) * (affected ? demandFactor * (2 - inventoryFactor) : 1 + ((demandFactor - 1) * 0.35)))
    )

    return {
      ...warehouse,
      total_stock: stock,
      critical_skus: criticalSkus,
      low_skus: lowSkus,
      overstock_skus: overstockSkus,
      capacity_pct: Number(capacityPct.toFixed(1)),
      status,
      revenue_at_risk: revenueAtRisk,
      scenario_affected: affected,
    }
  })
}

export function applyScenarioToTopSkus(topSkus = [], scenario, scenarioData) {
  if (scenario === 'NORMAL' || !scenarioData) return topSkus
  const demand = Number(scenarioData.demand_multiplier || 1)
  const inventory = Number(scenarioData.inventory_multiplier || 1)
  const families = SHADE_FAMILY_BY_SCENARIO[scenario] || []

  return topSkus.map((sku, index) => {
    const family = sku.shade_family || ''
    const highlighted = families.includes(family)
    const ramp = highlighted ? demand * (1.05 + (index % 3) * 0.05) : (1 + (demand - 1) * 0.45)
    const squeeze = inventory < 1 ? (0.9 + inventory * 0.25) : 1
    const revenueFactor = ramp * squeeze

    return {
      ...sku,
      total_revenue: Math.max(0, Math.round((sku.total_revenue || 0) * revenueFactor)),
      total_quantity: Math.max(0, Math.round((sku.total_quantity || 0) * (highlighted ? demand : 1 + ((demand - 1) * 0.4)))),
      scenario_highlight: highlighted,
    }
  })
}

export function applyScenarioToTransfers(transfers = [], scenario, scenarioData) {
  if (scenario === 'NORMAL' || !scenarioData) return transfers
  const demand = Number(scenarioData.demand_multiplier || 1)
  const inventory = Number(scenarioData.inventory_multiplier || 1)

  return transfers.map((transfer, index) => {
    const fromAffected = isAffectedRegion(transfer.from_warehouse?.state, scenarioData)
    const toAffected = isAffectedRegion(transfer.to_warehouse?.state, scenarioData)
    const weight = (toAffected ? 1.3 : 1) * (fromAffected ? 0.9 : 1)
    const quantity = Math.max(10, Math.round((transfer.quantity || 0) * (1 + (demand - inventory) * 0.6) * weight))
    const priorityStatus = index < 2 || toAffected ? 'PENDING' : transfer.status

    return {
      ...transfer,
      quantity,
      status: priorityStatus,
      reason: transfer.reason
        ? `${transfer.reason} [${scenarioData.name} impact]`
        : `${scenarioData.name} impact adjustment`,
      scenario_affected: fromAffected || toAffected,
    }
  })
}

export function applyScenarioToDealerDashboard(data = {}, scenario, scenarioData) {
  if (scenario === 'NORMAL' || !scenarioData) return data
  const demand = Number(scenarioData.demand_multiplier || 1)
  const inventory = Number(scenarioData.inventory_multiplier || 1)
  const balance = demand * (2 - inventory)

  return {
    ...data,
    ai_recommendations_pending: Math.max(0, Math.round((data.ai_recommendations_pending || 0) * balance * 1.1)),
    revenue_this_month: Math.max(0, Math.round((data.revenue_this_month || 0) * (0.92 + demand * 0.25))),
    total_ai_savings: Math.max(0, Math.round((data.total_ai_savings || 0) * (1 + (demand - 1) * 0.8 + (1 - inventory) * 0.3))),
    fulfillment_rate: Math.max(35, Math.min(99, Number(data.fulfillment_rate || 0) - ((1 - inventory) * 24) + ((demand - 1) * 6))),
    avg_delivery_time_days: Math.max(1, Number(data.avg_delivery_time_days || 0) + ((1 - inventory) * 4.5) + ((demand - 1) * 2.2)),
    health_score: Math.max(15, Math.min(99, Number(data.health_score || 0) - ((1 - inventory) * 20) - ((demand - 1) * 9))),
  }
}

export function applyScenarioToDealerPipeline(pipeline = {}, scenario, scenarioData) {
  if (scenario === 'NORMAL' || !scenarioData) return pipeline
  const demand = Number(scenarioData.demand_multiplier || 1)
  const inventory = Number(scenarioData.inventory_multiplier || 1)
  const placedBoost = 1 + (demand - 1) * 1.1
  const deliveryDrop = Math.max(0.5, inventory * (2 - demand))

  const mtd = pipeline.mtd || {}
  const placed = Math.max(0, Math.round((mtd.placed || 0) * placedBoost + 2))
  const confirmed = Math.max(0, Math.round((mtd.confirmed || 0) * (0.95 + demand * 0.22)))
  const shipped = Math.max(0, Math.round((mtd.shipped || 0) * (0.9 + inventory * 0.35)))
  const delivered = Math.max(0, Math.round((mtd.delivered || 0) * deliveryDrop))
  const cancelled = Math.max(0, Math.round((mtd.cancelled || 0) + (1 - inventory) * 4 + (demand - 1) * 2))

  const mtdMutated = { ...mtd, placed, confirmed, shipped, delivered, cancelled }
  const totalMtd = Object.values(mtdMutated).reduce((sum, value) => sum + Number(value || 0), 0)
  return {
    ...pipeline,
    mtd: mtdMutated,
    total_mtd: totalMtd,
    fulfillment_rate_mtd: Number(((delivered / Math.max(totalMtd, 1)) * 100).toFixed(1)),
  }
}

export function applyScenarioToDealerTopSkus(items = [], scenario, scenarioData) {
  if (scenario === 'NORMAL' || !scenarioData) return items
  const demand = Number(scenarioData.demand_multiplier || 1)
  const inventory = Number(scenarioData.inventory_multiplier || 1)
  return items.map((item) => {
    const soldQty = Math.max(0, Math.round((item.sold_qty || 0) * (1 + (demand - 1) * 0.8)))
    const stock = Math.max(0, Math.round((item.current_stock || 0) * inventory / demand))
    const days = Math.max(0.2, Number(item.days_of_cover || 0) * inventory / demand)
    let status = item.stock_status
    if (days < 2.5) status = 'critical'
    else if (days < 7) status = 'low'
    return { ...item, sold_qty: soldQty, current_stock: stock, days_of_cover: Number(days.toFixed(1)), stock_status: status }
  })
}

export function applyScenarioToDealerTrends(trends = { points: [] }, scenario, scenarioData) {
  if (scenario === 'NORMAL' || !scenarioData) return trends
  const demand = Number(scenarioData.demand_multiplier || 1)
  const inventory = Number(scenarioData.inventory_multiplier || 1)
  const points = (trends.points || []).map((point, idx) => {
    const recentWeight = 1 + (idx / Math.max((trends.points || []).length - 1, 1)) * 0.25
    return {
      ...point,
      revenue: Math.max(0, Math.round((point.revenue || 0) * (0.9 + demand * 0.28) * recentWeight)),
      health_score: Math.max(10, Math.min(100, Number(point.health_score || 0) - ((1 - inventory) * 18) - ((demand - 1) * 6))),
    }
  })
  return {
    ...trends,
    points,
    max_revenue: Math.max(...points.map((p) => p.revenue || 0), 0),
    avg_health: Number((points.reduce((sum, p) => sum + Number(p.health_score || 0), 0) / Math.max(points.length, 1)).toFixed(1)),
  }
}

export function applyScenarioToAlerts(alerts = {}, scenario, scenarioData) {
  if (scenario === 'NORMAL' || !scenarioData) return alerts
  const demand = Number(scenarioData.demand_multiplier || 1)
  const stockoutAlerts = (alerts.stockout_alerts || []).map((alert) => ({
    ...alert,
    days_remaining: Number((Number(alert.days_remaining || 0) / Math.max(demand, 1)).toFixed(1)),
  }))
  return { ...alerts, stockout_alerts: stockoutAlerts }
}

export function getScenarioVisuals(scenario) {
  if (scenario === 'TRUCK_STRIKE') {
    return {
      bannerClass: 'from-red-700/30 via-rose-900/50 to-gray-900',
      chipClass: 'bg-red-500/20 text-red-300 border border-red-500/30',
      accentClass: 'text-red-300',
      title: 'Truck Strike Shockwave',
    }
  }
  if (scenario === 'HEATWAVE') {
    return {
      bannerClass: 'from-orange-700/30 via-amber-900/50 to-gray-900',
      chipClass: 'bg-orange-500/20 text-orange-300 border border-orange-500/30',
      accentClass: 'text-orange-300',
      title: 'Heatwave Demand Spike',
    }
  }
  if (scenario === 'EARLY_MONSOON') {
    return {
      bannerClass: 'from-cyan-700/30 via-blue-900/50 to-gray-900',
      chipClass: 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30',
      accentClass: 'text-cyan-300',
      title: 'Early Monsoon Surge',
    }
  }
  return {
    bannerClass: 'from-gray-800/40 via-gray-900 to-gray-900',
    chipClass: 'bg-gray-700/40 text-gray-300 border border-gray-700',
    accentClass: 'text-gray-300',
    title: 'Normal Operations',
  }
}

