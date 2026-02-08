import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useSimulation } from '../contexts/SimulationContext'
import { useAuth } from '../contexts/AuthContext'
import NotificationBell from '../components/common/NotificationBell'
import {
  HomeIcon, ChartBarIcon, ArchiveBoxXMarkIcon,
  ArrowsRightLeftIcon, UserGroupIcon, ArrowRightOnRectangleIcon,
  CubeIcon, BuildingStorefrontIcon, DocumentTextIcon,
} from '@heroicons/react/24/outline'

const nav = [
  {
    to: '/admin',
    icon: HomeIcon,
    label: 'Dashboard',
    end: true,
    activeClass: 'from-sky-500/30 via-blue-500/15 to-indigo-500/5 border-sky-400/35 shadow-[0_12px_30px_rgba(37,99,235,0.28)]',
    iconClass: 'from-sky-300/30 via-blue-400/15 to-sky-600/20 border-sky-300/35 text-sky-100',
  },
  {
    to: '/admin/forecast',
    icon: ChartBarIcon,
    label: 'Demand Forecast',
    activeClass: 'from-violet-500/30 via-fuchsia-500/15 to-indigo-500/5 border-violet-400/35 shadow-[0_12px_30px_rgba(139,92,246,0.28)]',
    iconClass: 'from-violet-300/30 via-fuchsia-400/15 to-violet-700/25 border-violet-300/35 text-violet-100',
  },
  {
    to: '/admin/dead-stock',
    icon: ArchiveBoxXMarkIcon,
    label: 'Dead Stock',
    activeClass: 'from-rose-500/30 via-red-500/15 to-rose-500/5 border-rose-400/35 shadow-[0_12px_30px_rgba(244,63,94,0.25)]',
    iconClass: 'from-rose-300/30 via-red-400/15 to-rose-700/25 border-rose-300/35 text-rose-100',
  },
  {
    to: '/admin/transfers',
    icon: ArrowsRightLeftIcon,
    label: 'Transfers',
    activeClass: 'from-amber-500/30 via-orange-500/15 to-amber-500/5 border-amber-400/35 shadow-[0_12px_30px_rgba(245,158,11,0.28)]',
    iconClass: 'from-amber-300/30 via-orange-400/15 to-amber-700/25 border-amber-300/35 text-amber-100',
  },
  {
    to: '/admin/dealers',
    icon: UserGroupIcon,
    label: 'Dealer Performance',
    activeClass: 'from-emerald-500/30 via-teal-500/15 to-emerald-500/5 border-emerald-400/35 shadow-[0_12px_30px_rgba(16,185,129,0.25)]',
    iconClass: 'from-emerald-300/30 via-teal-400/15 to-emerald-700/25 border-emerald-300/35 text-emerald-100',
  },
  {
    to: '/admin/products',
    icon: CubeIcon,
    label: 'Products',
    activeClass: 'from-cyan-500/30 via-sky-500/15 to-cyan-500/5 border-cyan-400/35 shadow-[0_12px_30px_rgba(6,182,212,0.25)]',
    iconClass: 'from-cyan-300/30 via-sky-400/15 to-cyan-700/25 border-cyan-300/35 text-cyan-100',
  },
  {
    to: '/admin/warehouses',
    icon: BuildingStorefrontIcon,
    label: 'Warehouses',
    activeClass: 'from-indigo-500/30 via-blue-500/15 to-indigo-500/5 border-indigo-400/35 shadow-[0_12px_30px_rgba(79,70,229,0.26)]',
    iconClass: 'from-indigo-300/30 via-blue-400/15 to-indigo-700/25 border-indigo-300/35 text-indigo-100',
  },
  {
    to: '/admin/audit',
    icon: DocumentTextIcon,
    label: 'Audit Logs',
    activeClass: 'from-slate-500/30 via-zinc-500/15 to-slate-500/5 border-slate-300/35 shadow-[0_12px_30px_rgba(148,163,184,0.2)]',
    iconClass: 'from-slate-300/30 via-zinc-400/15 to-slate-700/25 border-slate-300/35 text-slate-100',
  },
]

const scenarioColors = {
  NORMAL: 'bg-gray-700',
  TRUCK_STRIKE: 'bg-red-600',
  HEATWAVE: 'bg-orange-600',
  EARLY_MONSOON: 'bg-cyan-600',
}

export default function AdminLayout() {
  const { scenario, setScenario } = useSimulation()
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const todayLabel = new Date().toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  return (
    <div className="flex h-screen bg-gray-950 text-white">
      {/* Sidebar */}
      <aside className="w-64 bg-gradient-to-b from-[#081733] via-[#060f23] to-[#040a18] border-r border-blue-900/50 flex flex-col">
        <div className="p-6 border-b border-blue-900/40">
          <NavLink to="/app" className="text-xl font-bold">
            Paint<span className="text-cyan-300">Flow</span>.ai
          </NavLink>
          <p className="text-xs text-blue-100/60 mt-1 tracking-wide uppercase">Manufacturer Admin</p>
        </div>
        <nav className="flex-1 p-4 space-y-1">
          {nav.map(({ to, icon: Icon, label, end, activeClass, iconClass }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                `group flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm border transition-all ${
                  isActive
                    ? `bg-gradient-to-r ${activeClass} text-white`
                    : 'text-slate-300 border-transparent hover:border-white/10 hover:bg-white/[0.03]'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <span
                    className={`inline-flex h-9 w-9 items-center justify-center rounded-lg border transition-all ${
                      isActive
                        ? `bg-gradient-to-br ${iconClass}`
                        : 'bg-slate-900/85 border-slate-700/80 text-slate-500 group-hover:text-slate-200 group-hover:border-slate-500/80'
                    }`}
                  >
                    <Icon className="w-5 h-5" />
                  </span>
                  <span className="font-medium">{label}</span>
                </>
              )}
            </NavLink>
          ))}
        </nav>
        <div className="p-4 border-t border-blue-900/40 space-y-2">
          <div className="text-xs text-blue-100/60">
            {user?.full_name || 'Admin'} | {todayLabel}
          </div>
          <button
            onClick={handleLogout}
            className="flex items-center gap-2 text-xs text-slate-400 hover:text-red-300 transition-colors w-full"
          >
            <ArrowRightOnRectangleIcon className="w-4 h-4" />
            Sign Out
          </button>
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Scenario toggle bar */}
        <header className="bg-[#071532]/88 backdrop-blur-md border-b border-blue-900/40 px-6 py-3 flex items-center gap-3">
          <span className="text-xs text-blue-100/60 mr-2 uppercase tracking-wide">Simulate:</span>
          {['NORMAL', 'TRUCK_STRIKE', 'HEATWAVE', 'EARLY_MONSOON'].map(s => (
            <button
              key={s}
              onClick={() => setScenario(s)}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-all ${
                scenario === s
                  ? `${scenarioColors[s]} text-white shadow-[0_8px_24px_rgba(2,6,23,0.45)]`
                  : 'bg-slate-800/80 border border-slate-700/80 text-slate-300 hover:bg-slate-700/80'
              }`}
            >
              {s === 'NORMAL' ? 'Normal' : s === 'TRUCK_STRIKE' ? 'Truck Strike' : s === 'HEATWAVE' ? 'Heatwave' : 'Early Monsoon'}
            </button>
          ))}
          <div className="ml-auto flex items-center gap-3">
            {scenario !== 'NORMAL' && (
              <span className="text-xs text-amber-300 animate-pulse">
                Simulation Active
              </span>
            )}
            <NotificationBell />
          </div>
        </header>

        <main className="flex-1 overflow-auto p-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
