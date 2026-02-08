import { useEffect, useMemo, useState } from 'react'
import {
  CubeIcon,
  BuildingOffice2Icon,
  UserGroupIcon,
  CurrencyRupeeIcon,
  ExclamationTriangleIcon,
  ArrowsRightLeftIcon,
  ArchiveBoxXMarkIcon,
  BanknotesIcon,
} from '@heroicons/react/24/solid'
import StatCard from '../../components/common/StatCard'
import LoadingSpinner from '../../components/common/LoadingSpinner'
import IndiaWarehouseMap from '../../components/maps/IndiaWarehouseMap'
import InventoryBarChart from '../../components/charts/InventoryBarChart'
import AICopilotChat from '../../components/copilot/AICopilotChat'
import MetricDetailDrawer from '../../components/common/MetricDetailDrawer'
import {
  fetchDashboardSummary,
  fetchInventoryMap,
  fetchTransfers,
  fetchTopSkus,
} from '../../api/admin'
import { useSimulation } from '../../contexts/SimulationContext'
import { formatCurrency, formatNumber } from '../../utils/formatters'
import {
  applyScenarioToTopSkus,
  applyScenarioToTransfers,
  applyScenarioToWarehouses,
  getScenarioVisuals,
} from '../../utils/scenarioEffects'

function metricDetail(metricKey, data) {
  const { summary, warehouses, transfers, topSkus } = data

  if (metricKey === 'revenue') {
    return {
      title: 'Revenue (MTD)',
      description: 'Sum of estimated realized revenue across active SKUs for this month.',
      highlights: [
        { label: 'Current Revenue', value: formatCurrency(summary.total_revenue_mtd || 0) },
        { label: 'Top SKU Revenue', value: formatCurrency(topSkus[0]?.total_revenue || 0) },
        { label: 'High Risk Exposure', value: formatCurrency(summary.revenue_at_risk || 0) },
      ],
      columns: [
        { key: 'shade_name', label: 'Shade' },
        { key: 'size', label: 'Pack' },
        { key: 'total_quantity', label: 'Qty', render: (v) => formatNumber(v || 0) },
        { key: 'total_revenue', label: 'Revenue', render: (v) => formatCurrency(v || 0) },
      ],
      rows: topSkus.slice(0, 8),
    }
  }

  if (metricKey === 'stockouts') {
    return {
      title: 'Stockout Alerts',
      description: 'Count of SKUs with under 3 days of cover aggregated at warehouse level.',
      highlights: [
        { label: 'Critical SKUs', value: formatNumber(summary.stockout_count || 0) },
        { label: 'Worst Warehouse', value: warehouses[0]?.city || 'N/A' },
        { label: 'At Risk', value: formatCurrency(summary.revenue_at_risk || 0) },
      ],
      columns: [
        { key: 'name', label: 'Warehouse' },
        { key: 'city', label: 'City' },
        { key: 'critical_skus', label: 'Critical', render: (v) => formatNumber(v || 0) },
        { key: 'low_skus', label: 'Low', render: (v) => formatNumber(v || 0) },
        { key: 'revenue_at_risk', label: 'Risk', render: (v) => formatCurrency(v || 0) },
      ],
      rows: [...warehouses].sort((a, b) => (b.critical_skus || 0) - (a.critical_skus || 0)),
    }
  }

  if (metricKey === 'risk') {
    return {
      title: 'Revenue at Risk',
      description: 'Estimated revenue exposed due to low cover inventory and delayed replenishment.',
      highlights: [
        { label: 'Total Exposure', value: formatCurrency(summary.revenue_at_risk || 0) },
        { label: 'Pending Transfers', value: formatNumber(summary.pending_transfers || 0) },
        { label: 'Hotspot Warehouses', value: formatNumber(warehouses.filter((w) => (w.revenue_at_risk || 0) > 100000).length) },
      ],
      columns: [
        { key: 'name', label: 'Warehouse' },
        { key: 'status', label: 'Status' },
        { key: 'critical_skus', label: 'Critical', render: (v) => formatNumber(v || 0) },
        { key: 'revenue_at_risk', label: 'At Risk', render: (v) => formatCurrency(v || 0) },
      ],
      rows: [...warehouses].sort((a, b) => (b.revenue_at_risk || 0) - (a.revenue_at_risk || 0)).slice(0, 8),
    }
  }

  if (metricKey === 'transfers') {
    return {
      title: 'Pending Transfers',
      description: 'Open transfer recommendations and in-transit rebalancing lanes.',
      highlights: [
        { label: 'Open Transfers', value: formatNumber(summary.pending_transfers || 0) },
        { label: 'Total Units', value: formatNumber(transfers.reduce((sum, t) => sum + Number(t.quantity || 0), 0)) },
        { label: 'Most Active Lane', value: transfers[0]?.from_warehouse?.city && transfers[0]?.to_warehouse?.city
            ? `${transfers[0].from_warehouse.city} → ${transfers[0].to_warehouse.city}`
            : 'N/A' },
      ],
      columns: [
        { key: 'id', label: 'ID' },
        {
          key: 'from_warehouse',
          label: 'From',
          render: (_, row) => row.from_warehouse?.city || 'N/A',
        },
        {
          key: 'to_warehouse',
          label: 'To',
          render: (_, row) => row.to_warehouse?.city || 'N/A',
        },
        { key: 'quantity', label: 'Qty', render: (v) => formatNumber(v || 0) },
        { key: 'status', label: 'Status' },
      ],
      rows: transfers,
    }
  }

  if (metricKey === 'dead_stock') {
    return {
      title: 'Dead Stock',
      description: 'SKUs sitting above 90 days of cover requiring liquidation or transfer.',
      highlights: [
        { label: 'Dead Stock Count', value: formatNumber(summary.dead_stock_count || 0) },
        { label: 'Overstock Hubs', value: formatNumber(warehouses.filter((w) => (w.overstock_skus || 0) > 0).length) },
        { label: 'Idle Capacity', value: `${Math.round(warehouses.reduce((sum, w) => sum + Number(w.overstock_skus || 0), 0))} SKUs` },
      ],
      columns: [
        { key: 'name', label: 'Warehouse' },
        { key: 'city', label: 'City' },
        { key: 'overstock_skus', label: 'Overstock', render: (v) => formatNumber(v || 0) },
        { key: 'capacity_pct', label: 'Utilization', render: (v) => `${Number(v || 0).toFixed(1)}%` },
        { key: 'status', label: 'Status' },
      ],
      rows: [...warehouses].sort((a, b) => (b.overstock_skus || 0) - (a.overstock_skus || 0)),
    }
  }

  return null
}

export default function AdminDashboard() {
  const [summary, setSummary] = useState(null)
  const [warehouses, setWarehouses] = useState([])
  const [transfers, setTransfers] = useState([])
  const [topSkus, setTopSkus] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedMetric, setSelectedMetric] = useState(null)
  const { scenario, currentData } = useSimulation()

  useEffect(() => {
    setLoading(true)
    Promise.all([
      fetchDashboardSummary(),
      fetchInventoryMap(),
      fetchTransfers(),
      fetchTopSkus(),
    ])
      .then(([summaryRes, mapRes, transferRes, topSkuRes]) => {
        setSummary(summaryRes.data)
        setWarehouses(mapRes.data || [])
        setTransfers(transferRes.data || [])
        setTopSkus(topSkuRes.data || [])
      })
      .catch((err) => console.error('Dashboard load failed:', err))
      .finally(() => setLoading(false))
  }, [])

  const simulatedSummary = useMemo(() => {
    if (!summary) return null
    if (scenario !== 'NORMAL' && currentData?.dashboard_summary) {
      return { ...summary, ...currentData.dashboard_summary }
    }
    return summary
  }, [summary, scenario, currentData])

  const simulatedWarehouses = useMemo(
    () => applyScenarioToWarehouses(warehouses, scenario, currentData),
    [warehouses, scenario, currentData]
  )
  const simulatedTransfers = useMemo(
    () => applyScenarioToTransfers(transfers, scenario, currentData),
    [transfers, scenario, currentData]
  )
  const simulatedTopSkus = useMemo(
    () => applyScenarioToTopSkus(topSkus, scenario, currentData),
    [topSkus, scenario, currentData]
  )
  const visuals = getScenarioVisuals(scenario)

  const drawerMetric = useMemo(() => {
    if (!selectedMetric || !simulatedSummary) return null
    return metricDetail(selectedMetric, {
      summary: simulatedSummary,
      warehouses: simulatedWarehouses,
      transfers: simulatedTransfers,
      topSkus: simulatedTopSkus,
    })
  }, [selectedMetric, simulatedSummary, simulatedWarehouses, simulatedTransfers, simulatedTopSkus])

  if (loading) return <LoadingSpinner text="Loading dashboard..." />
  if (!simulatedSummary) return <p className="text-gray-400">Dashboard data unavailable.</p>

  return (
    <div className="space-y-6">
      <div className={`paint-banner relative isolate overflow-hidden rounded-2xl border border-blue-900/50 bg-gradient-to-r ${visuals.bannerClass} p-5`}>
        <div className="absolute -top-8 -left-6 h-20 w-20 rounded-full bg-cyan-400/15 blur-2xl" />
        <div className="absolute -right-8 -bottom-8 h-24 w-24 rounded-full bg-amber-400/15 blur-2xl" />
        <div className="relative flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-white tracking-tight">Command Center</h1>
            <p className="text-sm text-blue-100/80 mt-1">
              {scenario === 'NORMAL'
                ? 'All systems stable. Baseline operational view.'
                : `${currentData?.description || visuals.title} ${currentData?.impact ? `• ${currentData.impact}` : ''}`}
            </p>
          </div>
          <span className={`px-3 py-1.5 rounded-full text-xs font-semibold ${visuals.chipClass}`}>
            {scenario === 'NORMAL' ? 'NORMAL OPERATIONS' : visuals.title.toUpperCase()}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          title="Revenue (MTD)"
          value={formatCurrency(simulatedSummary.total_revenue_mtd || 0)}
          icon={CurrencyRupeeIcon}
          color="green"
          trend="up"
          delay={20}
          onClick={() => setSelectedMetric('revenue')}
        />
        <StatCard
          title="Stockout Alerts"
          value={formatNumber(simulatedSummary.stockout_count || 0)}
          icon={ExclamationTriangleIcon}
          color="orange"
          subtitle="SKUs below 3-day cover"
          delay={80}
          onClick={() => setSelectedMetric('stockouts')}
        />
        <StatCard
          title="Revenue at Risk"
          value={formatCurrency(simulatedSummary.revenue_at_risk || 0)}
          icon={BanknotesIcon}
          color="red"
          delay={140}
          onClick={() => setSelectedMetric('risk')}
        />
        <StatCard
          title="Pending Transfers"
          value={formatNumber(simulatedSummary.pending_transfers || 0)}
          icon={ArrowsRightLeftIcon}
          color="cyan"
          delay={200}
          onClick={() => setSelectedMetric('transfers')}
        />
        <StatCard
          title="Total SKUs"
          value={formatNumber(simulatedSummary.total_skus || 0)}
          icon={CubeIcon}
          color="blue"
          delay={260}
          onClick={() => setSelectedMetric('revenue')}
        />
        <StatCard
          title="Warehouses"
          value={formatNumber(simulatedSummary.total_warehouses || 0)}
          icon={BuildingOffice2Icon}
          color="cyan"
          delay={320}
          onClick={() => setSelectedMetric('stockouts')}
        />
        <StatCard
          title="Active Dealers"
          value={formatNumber(simulatedSummary.total_dealers || 0)}
          icon={UserGroupIcon}
          color="green"
          delay={380}
          onClick={() => setSelectedMetric('transfers')}
        />
        <StatCard
          title="Dead Stock"
          value={formatNumber(simulatedSummary.dead_stock_count || 0)}
          icon={ArchiveBoxXMarkIcon}
          color="purple"
          subtitle=">90 days cover"
          delay={440}
          onClick={() => setSelectedMetric('dead_stock')}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="paint-panel" style={{ animationDelay: '120ms' }}>
          <h2 className="text-sm font-semibold text-blue-100/80 mb-3 tracking-wide uppercase">Warehouse Network</h2>
          <IndiaWarehouseMap warehouses={simulatedWarehouses} transfers={simulatedTransfers} />
        </div>
        <div className="paint-panel" style={{ animationDelay: '180ms' }}>
          <h2 className="text-sm font-semibold text-blue-100/80 mb-3 tracking-wide uppercase">Top SKUs by Revenue</h2>
          <div className="glass rounded-xl p-4 border border-blue-900/45 bg-gradient-to-br from-blue-950/35 via-slate-900/30 to-emerald-950/15">
            <InventoryBarChart data={simulatedTopSkus} />
          </div>
        </div>
      </div>

      <div className="paint-panel" style={{ animationDelay: '220ms' }}>
        <AICopilotChat />
      </div>

      <MetricDetailDrawer
        open={!!drawerMetric}
        onClose={() => setSelectedMetric(null)}
        metric={drawerMetric}
      />
    </div>
  )
}
