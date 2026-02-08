import { useCallback, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRightIcon, CpuChipIcon, CubeTransparentIcon, ShieldCheckIcon } from '@heroicons/react/24/outline'
import { useAuth } from '../contexts/AuthContext'
import RollerIntro from '../components/intro/RollerIntro'

const pillars = [
  {
    title: 'Predictive Demand Brain',
    description: 'Forecasts demand by shade, size, and region before stockouts happen.',
    icon: CpuChipIcon,
    accent: 'from-cyan-500/30 to-blue-500/10 border-cyan-400/30',
  },
  {
    title: 'Autonomous Rebalancing',
    description: 'Creates transfer lanes that protect revenue while reducing dead stock.',
    icon: CubeTransparentIcon,
    accent: 'from-emerald-500/30 to-teal-500/10 border-emerald-400/30',
  },
  {
    title: 'Role-Safe Operations',
    description: 'Single authentication with strict admin, dealer, and customer access routing.',
    icon: ShieldCheckIcon,
    accent: 'from-amber-500/30 to-orange-500/10 border-amber-400/30',
  },
]

export default function LandingPage() {
  const { isAuthenticated, user } = useAuth()
  const [showIntro, setShowIntro] = useState(() => {
    try {
      return window.sessionStorage.getItem('pf_intro_seen') !== '1'
    } catch {
      return true
    }
  })

  const handleIntroComplete = useCallback(() => {
    try {
      window.sessionStorage.setItem('pf_intro_seen', '1')
    } catch {
      // Ignore storage errors and proceed with normal UI flow.
    }
    setShowIntro(false)
  }, [])

  return (
    <>
      {showIntro ? <RollerIntro onComplete={handleIntroComplete} /> : null}
      <div className={`min-h-screen relative overflow-hidden bg-[#040816] text-white transition-opacity duration-700 ${showIntro ? 'opacity-0' : 'opacity-100'}`}>
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_15%_20%,rgba(34,211,238,0.18),transparent_40%),radial-gradient(circle_at_85%_10%,rgba(16,185,129,0.18),transparent_35%),radial-gradient(circle_at_60%_75%,rgba(249,115,22,0.14),transparent_40%)]" />
      <div className="absolute -top-24 -left-24 w-72 h-72 rounded-full bg-cyan-400/10 blur-3xl animate-float-slow" />
      <div className="absolute bottom-0 right-0 w-80 h-80 rounded-full bg-emerald-400/10 blur-3xl animate-float-slower" />

      <main className="relative max-w-6xl mx-auto px-6 py-12 md:py-20" style={{ fontFamily: '"Space Grotesk", "Poppins", sans-serif' }}>
        <header className="flex items-center justify-between">
          <p className="text-sm tracking-[0.22em] uppercase text-cyan-200/80">PaintFlow.ai</p>
          <div className="flex items-center gap-2">
            <Link to="/login" className="px-4 py-2 rounded-lg border border-white/15 text-sm text-white/85 hover:bg-white/10 transition-colors">
              Sign In
            </Link>
            <Link to="/register" className="px-4 py-2 rounded-lg bg-emerald-500 text-sm font-semibold text-white hover:bg-emerald-400 transition-colors">
              Create Account
            </Link>
          </div>
        </header>

        <section className="mt-16 md:mt-20 grid md:grid-cols-[1.3fr_1fr] gap-8 items-center">
          <div className="space-y-6">
            <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs border border-cyan-400/30 text-cyan-200 bg-cyan-500/10">
              Intelligence Layer for Paint Supply Chains
            </span>
            <h1 className="text-4xl md:text-6xl font-bold leading-tight">
              Turn volatile demand into <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-300 via-emerald-300 to-amber-300">predictable flow</span>.
            </h1>
            <p className="text-base md:text-lg text-slate-300 max-w-2xl">
              PaintFlow.ai combines demand forecasting, scenario simulations, and transfer orchestration
              to keep shelves full, warehouses balanced, and dealer fulfillment fast.
            </p>
            <div className="flex flex-wrap gap-3 pt-2">
              <Link
                to={isAuthenticated ? '/app' : '/login'}
                className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-gradient-to-r from-cyan-500 to-emerald-500 text-slate-950 font-semibold hover:opacity-95 transition-opacity shadow-[0_0_30px_rgba(34,211,238,0.35)]"
              >
                {isAuthenticated ? `Continue as ${user?.role || 'user'}` : 'Enter Platform'}
                <ArrowRightIcon className="w-4 h-4" />
              </Link>
              <Link
                to="/register"
                className="px-5 py-3 rounded-xl border border-white/20 text-white/90 hover:bg-white/10 transition-colors"
              >
                Start Free Access
              </Link>
            </div>
          </div>

          <div className="relative">
            <div className="rounded-2xl border border-white/15 bg-white/[0.06] backdrop-blur-md p-5 shadow-2xl animate-rise-in">
              <p className="text-xs uppercase tracking-wider text-slate-400">Live Snapshot</p>
              <div className="mt-4 space-y-4">
                <div className="rounded-xl border border-cyan-500/30 bg-cyan-500/10 p-3">
                  <p className="text-[11px] text-cyan-200 uppercase tracking-wider">Revenue Protected</p>
                  <p className="text-2xl font-semibold mt-1">₹1.8 Cr</p>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3">
                    <p className="text-[11px] uppercase tracking-wider text-amber-200">Stockouts</p>
                    <p className="text-xl font-semibold mt-1">-37%</p>
                  </div>
                  <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3">
                    <p className="text-[11px] uppercase tracking-wider text-emerald-200">AI Saves</p>
                    <p className="text-xl font-semibold mt-1">₹42L</p>
                  </div>
                </div>
                <p className="text-xs text-slate-400">Unified command center for Admin, Dealer, and Customer workflows.</p>
              </div>
            </div>
          </div>
        </section>

        <section className="mt-14 grid md:grid-cols-3 gap-4">
          {pillars.map((pillar) => {
            const Icon = pillar.icon
            return (
              <article
                key={pillar.title}
                className={`rounded-2xl border bg-gradient-to-br ${pillar.accent} p-5 backdrop-blur-sm hover:-translate-y-1 transition-transform`}
              >
                <div className="w-10 h-10 rounded-lg bg-white/10 border border-white/15 flex items-center justify-center">
                  <Icon className="w-5 h-5 text-white" />
                </div>
                <h2 className="mt-4 text-lg font-semibold">{pillar.title}</h2>
                <p className="mt-2 text-sm text-slate-300">{pillar.description}</p>
              </article>
            )
          })}
        </section>
      </main>
      </div>
    </>
  )
}
