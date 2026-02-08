import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import NotificationBell from '../components/common/NotificationBell'
import { useSimulation } from '../contexts/SimulationContext'
import {
  SwatchIcon, MapPinIcon, CameraIcon,
  ArrowRightOnRectangleIcon, BeakerIcon,
  ShoppingCartIcon, HeartIcon, ClipboardDocumentListIcon,
} from '@heroicons/react/24/outline'

const nav = [
  {
    to: '/customer',
    icon: SwatchIcon,
    label: 'Shades',
    end: true,
    activeClass: 'from-white/35 via-amber-100/30 to-white/20 border-white/45 shadow-[0_10px_24px_rgba(255,255,255,0.2)]',
    iconClass: 'from-orange-300/40 via-amber-200/35 to-orange-200/20 border-orange-100/60 text-orange-950',
  },
  {
    to: '/customer/find-near-me',
    icon: MapPinIcon,
    label: 'Near Me',
    activeClass: 'from-white/35 via-amber-100/30 to-white/20 border-white/45 shadow-[0_10px_24px_rgba(255,255,255,0.2)]',
    iconClass: 'from-teal-300/35 via-cyan-200/30 to-teal-200/20 border-teal-100/60 text-teal-950',
  },
  {
    to: '/customer/snap-find',
    icon: CameraIcon,
    label: 'Snap & Find',
    activeClass: 'from-white/35 via-amber-100/30 to-white/20 border-white/45 shadow-[0_10px_24px_rgba(255,255,255,0.2)]',
    iconClass: 'from-violet-300/35 via-fuchsia-200/30 to-violet-200/20 border-violet-100/60 text-violet-950',
  },
  {
    to: '/customer/cart',
    icon: ShoppingCartIcon,
    label: 'Cart',
    activeClass: 'from-white/35 via-amber-100/30 to-white/20 border-white/45 shadow-[0_10px_24px_rgba(255,255,255,0.2)]',
    iconClass: 'from-sky-300/35 via-blue-200/30 to-sky-200/20 border-sky-100/60 text-sky-950',
  },
  {
    to: '/customer/wishlist',
    icon: HeartIcon,
    label: 'Wishlist',
    activeClass: 'from-white/35 via-amber-100/30 to-white/20 border-white/45 shadow-[0_10px_24px_rgba(255,255,255,0.2)]',
    iconClass: 'from-rose-300/35 via-pink-200/30 to-rose-200/20 border-rose-100/60 text-rose-950',
  },
  {
    to: '/customer/orders',
    icon: ClipboardDocumentListIcon,
    label: 'Orders',
    activeClass: 'from-white/35 via-amber-100/30 to-white/20 border-white/45 shadow-[0_10px_24px_rgba(255,255,255,0.2)]',
    iconClass: 'from-lime-300/35 via-emerald-200/30 to-lime-200/20 border-lime-100/60 text-emerald-950',
  },
]

export default function CustomerLayout() {
  const { user, logout } = useAuth()
  const { scenario, setScenario } = useSimulation()
  const navigate = useNavigate()

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-orange-50 to-white">
      {/* Top header */}
      <header className="bg-gradient-to-r from-[#f97316] via-[#ff8f1f] to-[#ffb114] text-white px-6 py-4 shadow-[0_14px_35px_rgba(249,115,22,0.4)]">
        <div className="max-w-6xl mx-auto flex items-center justify-between gap-4">
          <NavLink to="/app" className="text-xl font-bold tracking-tight">
            Paint<span className="text-white">Flow</span>.ai
          </NavLink>
          <div className="flex items-center gap-2 min-w-0">
            <nav className="flex gap-1">
              {nav.map(({ to, icon: Icon, label, end, activeClass, iconClass }) => (
                <NavLink
                  key={to}
                  to={to}
                  end={end}
                  className={({ isActive }) =>
                    `group flex items-center gap-2 px-3 py-1.5 rounded-xl text-sm border transition-all ${
                      isActive
                        ? `bg-gradient-to-r ${activeClass} text-slate-950`
                        : 'text-white/85 border-transparent hover:border-white/25 hover:bg-white/10 hover:text-white'
                    }`
                  }
                >
                  {({ isActive }) => (
                    <>
                      <span
                        className={`inline-flex h-7 w-7 items-center justify-center rounded-lg border ${
                          isActive
                            ? `bg-gradient-to-br ${iconClass}`
                            : 'bg-black/15 border-white/20 text-white/80 group-hover:bg-white/20 group-hover:text-white'
                        }`}
                      >
                        <Icon className="w-3.5 h-3.5" />
                      </span>
                      <span className="font-medium">{label}</span>
                    </>
                  )}
                </NavLink>
              ))}
            </nav>
            <div className="hidden xl:flex items-center gap-1 ml-2 px-2 py-1 rounded-lg bg-white/10 border border-white/15">
              <BeakerIcon className="w-3.5 h-3.5 text-white/80" />
              {['NORMAL', 'TRUCK_STRIKE', 'HEATWAVE', 'EARLY_MONSOON'].map((s) => (
                <button
                  key={s}
                  onClick={() => setScenario(s)}
                  className={`px-2 py-0.5 rounded-full text-[10px] transition-colors ${
                    scenario === s
                      ? 'bg-white/25 text-white'
                      : 'text-white/70 hover:bg-white/15 hover:text-white'
                  }`}
                >
                  {s === 'NORMAL' ? 'Normal' : s === 'TRUCK_STRIKE' ? 'Strike' : s === 'HEATWAVE' ? 'Heat' : 'Monsoon'}
                </button>
              ))}
            </div>
            <div className="ml-3 pl-3 border-l border-white/20 flex items-center gap-2">
              <NotificationBell variant="light" />
              <span className="text-xs text-white/70">{user?.full_name}</span>
              <button
                onClick={handleLogout}
                className="p-1.5 rounded-lg text-white/60 hover:bg-white/10 hover:text-white transition-colors"
                title="Sign out"
              >
                <ArrowRightOnRectangleIcon className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto p-6">
        <Outlet />
      </main>
    </div>
  )
}
