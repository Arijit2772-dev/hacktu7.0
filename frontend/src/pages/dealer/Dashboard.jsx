import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  ShoppingCartIcon,
  CurrencyRupeeIcon,
  SparklesIcon,
  ExclamationTriangleIcon,
  ClockIcon,
  CheckBadgeIcon,
  BellIcon,
  ArrowTrendingUpIcon,
} from '@heroicons/react/24/outline'
import {
  ShoppingCartIcon as ShoppingCartSolidIcon,
  CurrencyRupeeIcon as CurrencyRupeeSolidIcon,
  SparklesIcon as SparklesSolidIcon,
  ClockIcon as ClockSolidIcon,
  CheckBadgeIcon as CheckBadgeSolidIcon,
} from '@heroicons/react/24/solid'
import StatCard from '../../components/common/StatCard'
import HealthScoreGauge from '../../components/paint/HealthScoreGauge'
import LoadingSpinner from '../../components/common/LoadingSpinner'
import MetricDetailDrawer from '../../components/common/MetricDetailDrawer'
import {
  fetchDealerDashboard,
  fetchDealerAlerts,
  fetchDealerDashboardActivity,
  fetchDealerDashboardPipeline,
  fetchDealerDashboardTrends,
  fetchDealerTopSkus,
} from '../../api/dealer'
import { fetchNotifications } from '../../api/notifications'
import { formatCurrency, formatNumber } from '../../utils/formatters'
import { useAuth } from '../../contexts/AuthContext'
import { useSimulation } from '../../contexts/SimulationContext'
import {
  applyScenarioToAlerts,
  applyScenarioToDealerDashboard,
  applyScenarioToDealerPipeline,
  applyScenarioToDealerTopSkus,
  applyScenarioToDealerTrends,
  getScenarioVisuals,
} from '../../utils/scenarioEffects'

function timeAgo(iso) {
  if (!iso) return ''
  const diffMs = Date.now() - new Date(iso).getTime()
  const mins = Math.max(1, Math.floor(diffMs / 60000))
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}

function greeting() {
  const hr = new Date().getHours()
  if (hr < 12) return 'Good morning'
  if (hr < 18) return 'Good afternoon'
  return 'Good evening'
}

function statusPill(status) {
  if (status === 'critical') return 'text-red-300 bg-red-500/15 border border-red-500/30'
  if (status === 'low') return 'text-orange-300 bg-orange-500/15 border border-orange-500/30'
  if (status === 'overstock') return 'text-cyan-300 bg-cyan-500/15 border border-cyan-500/30'
  return 'text-emerald-300 bg-emerald-500/15 border border-emerald-500/30'
}

function metricDetail(metricKey, source) {
  const { dashboard, pipeline, topSkus, activity, trends } = source

  if (metricKey === 'orders') {
    return {
      title: 'Total Orders (MTD)',
      description: 'Total dealer orders placed in this month across all fulfillment stages.',
      highlights: [
        { label: 'MTD Orders', value: formatNumber(dashboard.total_orders_mtd || 0) },
        { label: 'Placed', value: formatNumber(pipeline?.mtd?.placed || 0) },
        { label: 'Delivered', value: formatNumber(pipeline?.mtd?.delivered || 0) },
      ],
      columns: [
        { key: 'title', label: 'Activity' },
        { key: 'message', label: 'Detail' },
        { key: 'created_at', label: 'When', render: (v) => timeAgo(v) },
      ],
      rows: (activity || []).filter((item) => item.type?.includes('order')).slice(0, 12),
    }
  }

  if (metricKey === 'revenue') {
    return {
      title: 'Revenue MTD',
      description: 'Delivered order value this month based on SKU MRP and fulfilled quantity.',
      highlights: [
        { label: 'Revenue', value: formatCurrency(dashboard.revenue_this_month || 0) },
        { label: 'Peak Month', value: formatCurrency(trends.max_revenue || 0) },
        { label: 'Avg Health', value: `${Number(trends.avg_health || 0).toFixed(1)}` },
      ],
      columns: [
        { key: 'month', label: 'Month' },
        { key: 'orders', label: 'Orders', render: (v) => formatNumber(v || 0) },
        { key: 'revenue', label: 'Revenue', render: (v) => formatCurrency(v || 0) },
        { key: 'health_score', label: 'Health' },
      ],
      rows: trends.points || [],
    }
  }

  if (metricKey === 'ai') {
    return {
      title: 'AI Recommendations',
      description: 'Recommendations are generated from low cover SKUs and regional demand forecasts.',
      highlights: [
        { label: 'Pending', value: formatNumber(dashboard.ai_recommendations_pending || 0) },
        { label: 'AI Savings', value: formatCurrency(dashboard.total_ai_savings || 0) },
        { label: 'Critical SKUs', value: formatNumber(topSkus.filter((item) => item.stock_status === 'critical').length) },
      ],
      columns: [
        { key: 'shade_name', label: 'Shade' },
        { key: 'stock_status', label: 'Status' },
        { key: 'days_of_cover', label: 'Cover', render: (v) => `${Number(v || 0).toFixed(1)}d` },
        { key: 'sold_qty', label: 'Sold', render: (v) => formatNumber(v || 0) },
      ],
      rows: topSkus.slice(0, 10),
    }
  }

  if (metricKey === 'fulfillment') {
    return {
      title: 'Fulfillment Rate',
      description: 'Delivered orders divided by total orders for current lifecycle window.',
      highlights: [
        { label: 'All-time', value: `${Number(dashboard.fulfillment_rate || 0).toFixed(1)}%` },
        { label: 'MTD', value: `${Number(pipeline?.fulfillment_rate_mtd || 0).toFixed(1)}%` },
        { label: 'Avg Delivery', value: `${Number(dashboard.avg_delivery_time_days || 0).toFixed(1)} days` },
      ],
      columns: [
        { key: 'stage', label: 'Stage' },
        { key: 'count', label: 'Count', render: (v) => formatNumber(v || 0) },
      ],
      rows: [
        { stage: 'Placed', count: pipeline?.mtd?.placed || 0 },
        { stage: 'Confirmed', count: pipeline?.mtd?.confirmed || 0 },
        { stage: 'Shipped', count: pipeline?.mtd?.shipped || 0 },
        { stage: 'Delivered', count: pipeline?.mtd?.delivered || 0 },
        { stage: 'Cancelled', count: pipeline?.mtd?.cancelled || 0 },
      ],
    }
  }

  return null
}

export default function DealerDashboard() {
  const { user } = useAuth()
  const { scenario, currentData } = useSimulation()
  const [dashboard, setDashboard] = useState(null)
  const [alerts, setAlerts] = useState({ stockout_alerts: [], trending: [] })
  const [activity, setActivity] = useState([])
  const [pipeline, setPipeline] = useState(null)
  const [trends, setTrends] = useState({ points: [] })
  const [topSkus, setTopSkus] = useState([])
  const [notifications, setNotifications] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedMetric, setSelectedMetric] = useState(null)

  useEffect(() => {
    let mounted = true
    const load = async () => {
      setLoading(true)
      const results = await Promise.allSettled([
        fetchDealerDashboard(),
        fetchDealerAlerts(),
        fetchDealerDashboardActivity({ limit: 20 }),
        fetchDealerDashboardPipeline(),
        fetchDealerDashboardTrends({ months: 6 }),
        fetchDealerTopSkus({ limit: 10 }),
        fetchNotifications({ limit: 5, unread_only: true }),
      ])
      if (!mounted) return
      setDashboard(results[0].status === 'fulfilled' ? results[0].value.data : null)
      setAlerts(results[1].status === 'fulfilled' ? results[1].value.data : { stockout_alerts: [], trending: [] })
      setActivity(results[2].status === 'fulfilled' ? (results[2].value.data?.items || []) : [])
      setPipeline(results[3].status === 'fulfilled' ? results[3].value.data : null)
      setTrends(results[4].status === 'fulfilled' ? results[4].value.data : { points: [] })
      setTopSkus(results[5].status === 'fulfilled' ? (results[5].value.data?.items || []) : [])
      setNotifications(results[6].status === 'fulfilled' ? (results[6].value.data?.items || []) : [])
      setLoading(false)
    }
    load()
    return () => { mounted = false }
  }, [])

  const scenarioVisuals = getScenarioVisuals(scenario)
  const simulatedDashboard = useMemo(
    () => applyScenarioToDealerDashboard(dashboard || {}, scenario, currentData),
    [dashboard, scenario, currentData]
  )
  const simulatedPipeline = useMemo(
    () => applyScenarioToDealerPipeline(pipeline || {}, scenario, currentData),
    [pipeline, scenario, currentData]
  )
  const simulatedTopSkus = useMemo(
    () => applyScenarioToDealerTopSkus(topSkus || [], scenario, currentData),
    [topSkus, scenario, currentData]
  )
  const simulatedTrends = useMemo(
    () => applyScenarioToDealerTrends(trends || { points: [] }, scenario, currentData),
    [trends, scenario, currentData]
  )
  const simulatedAlerts = useMemo(
    () => applyScenarioToAlerts(alerts || {}, scenario, currentData),
    [alerts, scenario, currentData]
  )

  const maxRevenue = useMemo(
    () => Math.max(...(simulatedTrends.points || []).map((point) => point.revenue || 0), 1),
    [simulatedTrends.points]
  )
  const pipelineStages = [
    { key: 'placed', label: 'Placed' },
    { key: 'confirmed', label: 'Confirmed' },
    { key: 'shipped', label: 'Shipped' },
    { key: 'delivered', label: 'Delivered' },
  ]
  const maxPipelineCount = useMemo(
    () => Math.max(
      1,
      ...pipelineStages.map((stage) => Number(simulatedPipeline?.mtd?.[stage.key] || 0))
    ),
    [simulatedPipeline]
  )

  const drawerMetric = useMemo(() => (
    metricDetail(selectedMetric, {
      dashboard: simulatedDashboard,
      pipeline: simulatedPipeline,
      topSkus: simulatedTopSkus,
      activity,
      trends: simulatedTrends,
    })
  ), [selectedMetric, simulatedDashboard, simulatedPipeline, simulatedTopSkus, activity, simulatedTrends])

  if (loading) return <LoadingSpinner />
  if (!dashboard) return <p className="text-gray-500">Dealer data unavailable</p>

  return (
    <div className="space-y-5">
      <div className={`paint-banner relative overflow-hidden rounded-2xl border border-emerald-400/30 bg-gradient-to-r ${scenarioVisuals.bannerClass} p-6`}>
        <div className="absolute -right-8 -top-8 h-28 w-28 rounded-full bg-emerald-400/15 blur-2xl" />
        <div className="absolute -left-8 -bottom-10 h-28 w-28 rounded-full bg-cyan-400/15 blur-2xl" />
        <div className="relative flex items-start justify-between gap-4">
          <div>
            <p className="text-sm text-emerald-300">{greeting()}, {user?.full_name?.split(' ')[0] || 'Dealer'}.</p>
            <h1 className="text-2xl font-bold text-white mt-1">{simulatedDashboard.dealer?.name}</h1>
            <p className="text-sm text-gray-400 mt-1">
              {simulatedDashboard.dealer?.city}, {simulatedDashboard.dealer?.state} | Tier:{' '}
              <span className="text-emerald-300 font-medium">{simulatedDashboard.dealer?.tier}</span>
            </p>
            {scenario !== 'NORMAL' ? (
              <p className={`text-xs mt-2 ${scenarioVisuals.accentClass}`}>
                {currentData?.name || scenario} active: {currentData?.impact || 'Demand and inventory balance shifted.'}
              </p>
            ) : null}
          </div>
          <Link
            to="/dealer/smart-orders"
            className="glow-btn px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-sm font-medium flex items-center gap-2 transition-all"
          >
            <SparklesIcon className="w-4 h-4" />
            View Smart Orders
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-6 md:grid-cols-3 gap-4">
        <StatCard
          title="Total Orders (MTD)"
          value={formatNumber(simulatedDashboard.total_orders_mtd || 0)}
          icon={ShoppingCartSolidIcon}
          color="cyan"
          delay={20}
          onClick={() => setSelectedMetric('orders')}
        />
        <StatCard
          title="Revenue MTD"
          value={formatCurrency(simulatedDashboard.revenue_this_month || 0)}
          icon={CurrencyRupeeSolidIcon}
          color="green"
          delay={80}
          onClick={() => setSelectedMetric('revenue')}
        />
        <StatCard
          title="AI Recommendations"
          value={formatNumber(simulatedDashboard.ai_recommendations_pending || 0)}
          icon={SparklesSolidIcon}
          color="purple"
          subtitle="Pending review"
          delay={140}
          onClick={() => setSelectedMetric('ai')}
        />
        <StatCard
          title="AI Savings Total"
          value={formatCurrency(simulatedDashboard.total_ai_savings || 0)}
          icon={CurrencyRupeeSolidIcon}
          color="orange"
          subtitle="Cumulative savings"
          delay={200}
          onClick={() => setSelectedMetric('ai')}
        />
        <StatCard
          title="Fulfillment Rate"
          value={`${Number(simulatedDashboard.fulfillment_rate || 0).toFixed(1)}%`}
          icon={CheckBadgeSolidIcon}
          color="blue"
          delay={260}
          onClick={() => setSelectedMetric('fulfillment')}
        />
        <StatCard
          title="Avg Delivery Time"
          value={`${Number(simulatedDashboard.avg_delivery_time_days || 0).toFixed(1)} days`}
          icon={ClockSolidIcon}
          color="yellow"
          subtitle="Current month estimate"
          delay={320}
          onClick={() => setSelectedMetric('fulfillment')}
        />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
        <div className="paint-panel xl:col-span-2 glass rounded-xl border border-cyan-900/40 bg-gradient-to-br from-cyan-950/20 via-slate-900/30 to-slate-900/20 p-5" style={{ animationDelay: '120ms' }}>
          <h2 className="text-sm font-semibold text-cyan-100 mb-3 uppercase tracking-wide">Recent Activity</h2>
          {activity.length === 0 ? (
            <p className="text-sm text-gray-500">No recent activity.</p>
          ) : (
            <div className="space-y-3">
              {activity.slice(0, 8).map((item, idx) => (
                <div key={`${item.type}-${idx}`} className="flex items-start gap-3">
                  <span className="mt-1 h-2.5 w-2.5 rounded-full bg-emerald-400" />
                  <div className="min-w-0">
                    <p className="text-sm text-white">{item.title}</p>
                    <p className="text-xs text-gray-400 truncate">{item.message}</p>
                  </div>
                  <span className="ml-auto whitespace-nowrap text-xs text-gray-500">
                    {timeAgo(item.created_at)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="paint-panel glass rounded-xl border border-emerald-900/40 bg-gradient-to-br from-emerald-950/20 via-slate-900/30 to-slate-900/20 p-5" style={{ animationDelay: '180ms' }}>
          <h2 className="text-sm font-semibold text-emerald-100 mb-3 uppercase tracking-wide">Order Pipeline (MTD)</h2>
          <div className="space-y-3">
            {pipelineStages.map((stage) => {
              const count = Number(simulatedPipeline?.mtd?.[stage.key] || 0)
              const width = Math.max(6, Math.round((count / maxPipelineCount) * 100))
              return (
              <div key={stage.key}>
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="text-emerald-100/70">{stage.label}</span>
                  <span className="text-white font-medium">{count}</span>
                </div>
                  <div className="h-2 w-full rounded-full bg-emerald-950/50">
                    <div
                      className="h-2 rounded-full bg-gradient-to-r from-emerald-600 to-emerald-400"
                      style={{ width: `${width}%` }}
                    />
                  </div>
                </div>
              )
            })}
          </div>
          <div className="mt-4 pt-3 border-t border-emerald-900/35">
            <p className="text-xs text-emerald-100/60">Fulfillment (all-time)</p>
            <p className="text-lg font-semibold text-white">{simulatedPipeline?.fulfillment_rate_all_time ?? 0}%</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
        <div className="paint-panel xl:col-span-2 glass rounded-xl border border-blue-900/35 bg-gradient-to-br from-blue-950/20 via-slate-900/30 to-slate-900/20 p-5" style={{ animationDelay: '220ms' }}>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-gray-200">Inventory Quick View (Top SKUs)</h2>
            <Link to="/dealer/place-order" className="text-xs text-emerald-400 hover:text-emerald-300">
              Reorder inventory
            </Link>
          </div>
          {simulatedTopSkus.length === 0 ? (
            <p className="text-sm text-gray-500">No inventory data available.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-gray-500 border-b border-gray-800">
                    <th className="pb-2 font-medium">SKU</th>
                    <th className="pb-2 font-medium">Sold</th>
                    <th className="pb-2 font-medium">Stock</th>
                    <th className="pb-2 font-medium">Days Cover</th>
                    <th className="pb-2 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {simulatedTopSkus.map((item) => (
                    <tr key={item.sku_id} className="border-b border-gray-900/80">
                      <td className="py-2.5">
                        <div className="flex items-center gap-2">
                          <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: item.shade_hex }} />
                          <div>
                            <p className="text-white">{item.shade_name}</p>
                            <p className="text-[11px] text-gray-500">{item.sku_code} • {item.size}</p>
                          </div>
                        </div>
                      </td>
                      <td className="py-2.5 text-gray-300">{formatNumber(item.sold_qty || 0)}</td>
                      <td className="py-2.5 text-gray-300">{formatNumber(item.current_stock || 0)}</td>
                      <td className="py-2.5 text-gray-300">{Number(item.days_of_cover || 0).toFixed(1)}d</td>
                      <td className="py-2.5">
                        <span className={`text-[11px] px-2 py-0.5 rounded-md uppercase tracking-wider ${statusPill(item.stock_status)}`}>
                          {item.stock_status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="paint-panel glass rounded-xl border border-emerald-900/35 bg-gradient-to-br from-emerald-950/20 via-slate-900/30 to-slate-900/20 p-5" style={{ animationDelay: '260ms' }}>
          <h2 className="text-sm font-semibold text-emerald-100 mb-3 flex items-center gap-2 uppercase tracking-wide">
            <BellIcon className="w-4 h-4 text-emerald-400" />
            Unread Notifications
          </h2>
          {notifications.length === 0 ? (
            <p className="text-sm text-gray-500">All caught up.</p>
          ) : (
            <div className="space-y-3">
              {notifications.map((note) => (
                <Link
                  key={note.id}
                  to={note.link || '/dealer/notifications'}
                  className="block rounded-lg border border-gray-800 p-3 hover:border-gray-700 transition-colors"
                >
                  <p className="text-xs uppercase tracking-wider text-emerald-400">{note.category || 'system'}</p>
                  <p className="text-sm text-white mt-1">{note.title}</p>
                  <p className="text-xs text-gray-400 mt-1 line-clamp-2">{note.message}</p>
                  <p className="text-[11px] text-gray-500 mt-2">{timeAgo(note.created_at)}</p>
                </Link>
              ))}
            </div>
          )}
          <Link to="/dealer/notifications" className="inline-block mt-3 text-xs text-emerald-400 hover:text-emerald-300">
            View all notifications
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
        <div className="paint-panel xl:col-span-2 glass rounded-xl border border-violet-900/35 bg-gradient-to-br from-violet-950/20 via-slate-900/30 to-slate-900/20 p-5" style={{ animationDelay: '300ms' }}>
          <h2 className="text-sm font-semibold text-violet-100 mb-1 flex items-center gap-2 uppercase tracking-wide">
            <ArrowTrendingUpIcon className="w-4 h-4 text-emerald-400" />
            Performance Trend (6 months)
          </h2>
          <p className="text-xs text-gray-500">Revenue trend and monthly health score estimate</p>
          <div className="grid grid-cols-6 gap-2 mt-4">
            {(simulatedTrends.points || []).map((point) => {
              const barHeight = Math.max(8, Math.round((point.revenue / maxRevenue) * 100))
              return (
                <div key={point.month_key} className="flex flex-col items-center">
                  <div className="h-24 w-full rounded-md bg-gray-900 border border-gray-800 flex items-end overflow-hidden">
                    <div
                      className="w-full rounded-md bg-gradient-to-t from-emerald-600 to-emerald-400"
                      style={{ height: `${barHeight}%` }}
                    />
                  </div>
                  <span className="mt-1 text-[11px] text-gray-500">{point.month.split(' ')[0]}</span>
                  <span className="text-[11px] text-gray-400">{point.health_score}</span>
                </div>
              )
            })}
          </div>
        </div>

        <div className="space-y-5">
          <div className="paint-panel glass rounded-xl p-5 border border-red-500/30 bg-gradient-to-br from-red-950/25 via-slate-900/30 to-slate-900/20" style={{ animationDelay: '340ms' }}>
            <h3 className="text-sm font-medium text-red-400 mb-3 flex items-center gap-2">
              <ExclamationTriangleIcon className="w-4 h-4" />
              Stockout Alerts
            </h3>
            {simulatedAlerts.stockout_alerts?.length === 0 && (
              <p className="text-xs text-gray-600">No critical stockouts.</p>
            )}
            <div className="space-y-2">
              {simulatedAlerts.stockout_alerts?.slice(0, 4).map((item, idx) => (
                <div key={idx} className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded" style={{ backgroundColor: item.shade_hex }} />
                    <span className="text-white">{item.shade_name}</span>
                  </div>
                  <span className="text-red-400 text-xs font-mono">{Number(item.days_remaining || 0).toFixed(1)}d</span>
                </div>
              ))}
            </div>
          </div>

          <div className="paint-panel glass rounded-xl p-5 border border-amber-500/30 bg-gradient-to-br from-amber-950/25 via-slate-900/30 to-slate-900/20" style={{ animationDelay: '380ms' }}>
            <h3 className="text-sm font-medium text-orange-400 mb-3">Trending Shades</h3>
            <div className="space-y-2">
              {simulatedAlerts.trending?.slice(0, 5).map((item, idx) => (
                <div key={idx} className="flex items-center gap-2 text-sm">
                  <span className="w-3 h-3 rounded" style={{ backgroundColor: item.shade_hex }} />
                  <span className="text-white">{item.shade_name}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div>
          <p className="text-xs text-emerald-100/65 uppercase tracking-wider">Health Score</p>
          <div className="paint-panel glass rounded-xl p-6 border border-emerald-900/35 bg-gradient-to-br from-emerald-950/20 via-slate-900/30 to-slate-900/20 flex items-center justify-center mt-2" style={{ animationDelay: '420ms' }}>
            <HealthScoreGauge score={simulatedDashboard.health_score || 0} />
          </div>
        </div>
        <div className="md:col-span-2 grid grid-cols-2 md:grid-cols-3 gap-4">
          <div className="paint-panel glass rounded-xl p-4 border border-cyan-900/35 bg-gradient-to-br from-cyan-950/20 via-slate-900/30 to-slate-900/20" style={{ animationDelay: '460ms' }}>
            <p className="text-xs text-cyan-100/65">Orders (All-time)</p>
            <p className="text-xl font-semibold text-white mt-1">{formatNumber(simulatedDashboard.total_orders || 0)}</p>
          </div>
          <div className="paint-panel glass rounded-xl p-4 border border-violet-900/35 bg-gradient-to-br from-violet-950/20 via-slate-900/30 to-slate-900/20" style={{ animationDelay: '500ms' }}>
            <p className="text-xs text-violet-100/65">Avg Health (6m)</p>
            <p className="text-xl font-semibold text-white mt-1">{Number(simulatedTrends.avg_health || 0).toFixed(1)}</p>
          </div>
          <div className="paint-panel glass rounded-xl p-4 border border-amber-900/35 bg-gradient-to-br from-amber-950/20 via-slate-900/30 to-slate-900/20" style={{ animationDelay: '540ms' }}>
            <p className="text-xs text-amber-100/65">Peak Revenue (6m)</p>
            <p className="text-xl font-semibold text-white mt-1">{formatCurrency(simulatedTrends.max_revenue || 0)}</p>
          </div>
        </div>
      </div>

      <MetricDetailDrawer
        open={!!drawerMetric}
        onClose={() => setSelectedMetric(null)}
        metric={drawerMetric}
      />
    </div>
  )
}
