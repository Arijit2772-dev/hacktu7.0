import { useEffect, useState } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import {
  HomeIcon, SparklesIcon, ClipboardDocumentListIcon,
  PlusCircleIcon, UserCircleIcon, ArrowRightOnRectangleIcon, BellAlertIcon, BeakerIcon,
} from '@heroicons/react/24/outline'
import { useAuth } from '../contexts/AuthContext'
import { fetchCustomerRequests } from '../api/dealer'
import NotificationBell from '../components/common/NotificationBell'
import { useSimulation } from '../contexts/SimulationContext'

export default function DealerLayout() {
  const { user, logout } = useAuth()
  const { scenario, setScenario } = useSimulation()
  const navigate = useNavigate()
  const [pendingCustomerRequests, setPendingCustomerRequests] = useState(0)

  useEffect(() => {
    fetchCustomerRequests({ status: 'requested', page: 1, per_page: 100 })
      .then((res) => setPendingCustomerRequests(res.data?.total || 0))
      .catch((err) => {
        console.error('Failed to load pending customer requests:', err)
        setPendingCustomerRequests(0)
      })
  }, [])

  const nav = [
    {
      to: '/dealer',
      icon: HomeIcon,
      label: 'Dashboard',
      end: true,
      activeClass: 'from-emerald-500/30 via-teal-500/15 to-emerald-500/5 border-emerald-400/35 shadow-[0_12px_30px_rgba(16,185,129,0.28)]',
      iconClass: 'from-emerald-300/30 via-teal-400/15 to-emerald-700/20 border-emerald-300/35 text-emerald-100',
    },
    {
      to: '/dealer/smart-orders',
      icon: SparklesIcon,
      label: 'Smart Orders',
      activeClass: 'from-cyan-500/30 via-sky-500/15 to-cyan-500/5 border-cyan-400/35 shadow-[0_12px_30px_rgba(6,182,212,0.28)]',
      iconClass: 'from-cyan-300/30 via-sky-400/15 to-cyan-700/20 border-cyan-300/35 text-cyan-100',
    },
    {
      to: '/dealer/orders',
      icon: ClipboardDocumentListIcon,
      label: 'Order History',
      activeClass: 'from-blue-500/30 via-indigo-500/15 to-blue-500/5 border-blue-400/35 shadow-[0_12px_30px_rgba(59,130,246,0.28)]',
      iconClass: 'from-blue-300/30 via-indigo-400/15 to-blue-700/20 border-blue-300/35 text-blue-100',
    },
    {
      to: '/dealer/customer-requests',
      icon: BellAlertIcon,
      label: 'Customer Requests',
      badge: pendingCustomerRequests > 0 ? pendingCustomerRequests : null,
      activeClass: 'from-amber-500/30 via-orange-500/15 to-amber-500/5 border-amber-400/35 shadow-[0_12px_30px_rgba(245,158,11,0.28)]',
      iconClass: 'from-amber-300/30 via-orange-400/15 to-amber-700/20 border-amber-300/35 text-amber-100',
    },
    {
      to: '/dealer/place-order',
      icon: PlusCircleIcon,
      label: 'Place Order',
      activeClass: 'from-violet-500/30 via-fuchsia-500/15 to-violet-500/5 border-violet-400/35 shadow-[0_12px_30px_rgba(139,92,246,0.28)]',
      iconClass: 'from-violet-300/30 via-fuchsia-400/15 to-violet-700/20 border-violet-300/35 text-violet-100',
    },
    {
      to: '/dealer/profile',
      icon: UserCircleIcon,
      label: 'My Profile',
      activeClass: 'from-teal-500/30 via-emerald-500/15 to-teal-500/5 border-teal-400/35 shadow-[0_12px_30px_rgba(20,184,166,0.28)]',
      iconClass: 'from-teal-300/30 via-emerald-400/15 to-teal-700/20 border-teal-300/35 text-teal-100',
    },
  ]

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  return (
    <div className="flex h-screen bg-gray-950 text-white">
      <aside className="w-64 bg-gradient-to-b from-[#071c24] via-[#06131f] to-[#04101a] border-r border-emerald-900/45 flex flex-col">
        <div className="p-6 border-b border-emerald-900/35">
          <NavLink to="/app" className="text-xl font-bold">
            Paint<span className="text-emerald-300">Flow</span>.ai
          </NavLink>
          <p className="text-xs text-emerald-200/70 mt-1 tracking-wide uppercase">Dealer Portal</p>
        </div>
        <nav className="flex-1 p-4 space-y-1">
          {nav.map(({ to, icon: Icon, label, end, badge, activeClass, iconClass }) => (
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
                  {badge ? (
                    <span className="ml-auto inline-flex items-center justify-center min-w-5 h-5 px-1 rounded-full text-[10px] bg-red-500/20 text-red-300 border border-red-400/30">
                      {badge}
                    </span>
                  ) : null}
                </>
              )}
            </NavLink>
          ))}
        </nav>
        <div className="p-4 border-t border-emerald-900/35 space-y-2">
          <div className="text-xs text-emerald-100/60">
            {user?.full_name || 'Dealer'}
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

      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="bg-[#061923]/88 backdrop-blur-md border-b border-emerald-900/35 px-6 py-3 flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-sm text-emerald-100 font-medium">Dealer Workspace</p>
            <div className="flex items-center gap-2">
              <p className="text-xs text-emerald-100/60">{user?.full_name || 'Dealer'}</p>
              <span className="text-emerald-900">|</span>
              <div className="flex items-center gap-1 rounded-full border border-emerald-900/55 bg-emerald-900/15 px-2 py-0.5">
                <BeakerIcon className="w-3.5 h-3.5 text-emerald-200/70" />
                {['NORMAL', 'TRUCK_STRIKE', 'HEATWAVE', 'EARLY_MONSOON'].map((s) => (
                  <button
                    key={s}
                    onClick={() => setScenario(s)}
                    className={`px-2 py-0.5 rounded-full text-[10px] border transition-colors ${
                      scenario === s
                        ? s === 'TRUCK_STRIKE'
                          ? 'bg-red-500/20 text-red-200 border-red-400/40'
                          : s === 'HEATWAVE'
                            ? 'bg-orange-500/20 text-orange-200 border-orange-400/40'
                            : s === 'EARLY_MONSOON'
                              ? 'bg-cyan-500/20 text-cyan-200 border-cyan-400/40'
                              : 'bg-emerald-500/25 text-white border-emerald-300/30'
                        : 'bg-slate-950/65 text-slate-300 border-slate-600/70 hover:bg-slate-800'
                    }`}
                  >
                    {s === 'NORMAL' ? 'Normal' : s === 'TRUCK_STRIKE' ? 'Strike' : s === 'HEATWAVE' ? 'Heat' : 'Monsoon'}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <NotificationBell />
        </header>
        <main className="flex-1 overflow-auto p-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
