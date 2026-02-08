import { ArrowTrendingUpIcon, ArrowTrendingDownIcon } from '@heroicons/react/24/solid'
import { ArrowUpRightIcon } from '@heroicons/react/24/outline'

export default function StatCard({ title, value, subtitle, trend, icon: Icon, color = 'blue', onClick, delay = 0 }) {
  const tones = {
    blue: {
      card: 'from-blue-950/95 via-slate-900 to-blue-900/65 border-blue-400/35',
      topLine: 'from-blue-300/60 via-sky-300/20 to-transparent',
      glow: 'bg-blue-400/18',
      icon: 'border-blue-300/35 bg-gradient-to-br from-blue-300/25 via-sky-400/10 to-blue-700/30 text-blue-100 shadow-[0_0_24px_rgba(59,130,246,0.35)]',
      value: 'text-blue-50',
      subtitle: 'text-blue-100/60',
      trend: 'text-cyan-300',
    },
    green: {
      card: 'from-emerald-950/95 via-slate-900 to-emerald-900/65 border-emerald-400/35',
      topLine: 'from-emerald-300/60 via-teal-300/25 to-transparent',
      glow: 'bg-emerald-400/18',
      icon: 'border-emerald-300/35 bg-gradient-to-br from-emerald-300/25 via-teal-300/10 to-emerald-700/30 text-emerald-100 shadow-[0_0_24px_rgba(16,185,129,0.35)]',
      value: 'text-emerald-50',
      subtitle: 'text-emerald-100/60',
      trend: 'text-emerald-300',
    },
    red: {
      card: 'from-rose-950/95 via-slate-900 to-red-900/65 border-rose-400/35',
      topLine: 'from-rose-300/60 via-red-300/20 to-transparent',
      glow: 'bg-rose-400/18',
      icon: 'border-rose-300/35 bg-gradient-to-br from-rose-300/25 via-red-300/10 to-rose-700/35 text-rose-100 shadow-[0_0_24px_rgba(244,63,94,0.35)]',
      value: 'text-rose-50',
      subtitle: 'text-rose-100/60',
      trend: 'text-rose-300',
    },
    yellow: {
      card: 'from-amber-950/95 via-slate-900 to-yellow-900/55 border-amber-400/35',
      topLine: 'from-amber-300/60 via-yellow-300/25 to-transparent',
      glow: 'bg-amber-400/18',
      icon: 'border-amber-300/35 bg-gradient-to-br from-amber-200/25 via-yellow-200/10 to-amber-700/35 text-amber-100 shadow-[0_0_24px_rgba(245,158,11,0.35)]',
      value: 'text-amber-50',
      subtitle: 'text-amber-100/60',
      trend: 'text-amber-300',
    },
    purple: {
      card: 'from-violet-950/95 via-slate-900 to-fuchsia-900/60 border-fuchsia-400/35',
      topLine: 'from-fuchsia-300/60 via-violet-300/25 to-transparent',
      glow: 'bg-fuchsia-400/18',
      icon: 'border-fuchsia-300/35 bg-gradient-to-br from-fuchsia-300/20 via-violet-300/10 to-fuchsia-700/35 text-fuchsia-100 shadow-[0_0_24px_rgba(217,70,239,0.35)]',
      value: 'text-fuchsia-50',
      subtitle: 'text-fuchsia-100/60',
      trend: 'text-fuchsia-300',
    },
    cyan: {
      card: 'from-cyan-950/95 via-slate-900 to-sky-900/60 border-cyan-400/35',
      topLine: 'from-cyan-300/60 via-sky-300/25 to-transparent',
      glow: 'bg-cyan-400/18',
      icon: 'border-cyan-300/35 bg-gradient-to-br from-cyan-300/25 via-sky-300/10 to-cyan-700/35 text-cyan-100 shadow-[0_0_24px_rgba(6,182,212,0.35)]',
      value: 'text-cyan-50',
      subtitle: 'text-cyan-100/60',
      trend: 'text-cyan-300',
    },
    orange: {
      card: 'from-orange-950/95 via-slate-900 to-amber-900/60 border-orange-400/35',
      topLine: 'from-orange-300/60 via-amber-300/25 to-transparent',
      glow: 'bg-orange-400/18',
      icon: 'border-orange-300/35 bg-gradient-to-br from-orange-300/25 via-amber-300/10 to-orange-700/35 text-orange-100 shadow-[0_0_24px_rgba(249,115,22,0.35)]',
      value: 'text-orange-50',
      subtitle: 'text-orange-100/60',
      trend: 'text-orange-300',
    },
  }
  const tone = tones[color] || tones.blue
  const interactive = typeof onClick === 'function'

  return (
    <button
      type="button"
      onClick={onClick}
      style={{ animationDelay: `${delay}ms` }}
      className={`paint-card group relative isolate overflow-hidden rounded-2xl border bg-gradient-to-br p-5 text-left w-full transition-all ${
        tone.card
      } ${
        interactive
          ? 'cursor-pointer hover:-translate-y-1 hover:border-white/30 hover:shadow-[0_16px_34px_rgba(3,8,25,0.5)]'
          : 'cursor-default'
      }`}
    >
      <div className={`pointer-events-none absolute -right-8 -top-9 h-24 w-24 rounded-full blur-2xl ${tone.glow}`} />
      <div className={`pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r ${tone.topLine}`} />
      <div className="relative flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] text-white/65 uppercase tracking-[0.14em]">{title}</p>
          <p className={`text-3xl font-semibold mt-2 leading-tight ${tone.value}`}>{value}</p>
          {subtitle && <p className={`text-xs mt-2 ${tone.subtitle}`}>{subtitle}</p>}
        </div>
        <div className="flex flex-col items-end gap-2">
          {Icon && (
            <div className={`flex h-11 w-11 items-center justify-center rounded-xl border ${tone.icon}`}>
              <Icon className="w-5 h-5" />
            </div>
          )}
          {trend && (
            <span className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-[11px] border border-white/15 ${trend === 'up' ? tone.trend : 'text-rose-300'}`}>
              {trend === 'up' ? <ArrowTrendingUpIcon className="w-3 h-3" /> : <ArrowTrendingDownIcon className="w-3 h-3" />}
              {trend === 'up' ? '+8%' : '-3%'}
            </span>
          )}
        </div>
      </div>
      {interactive && (
        <p className="relative mt-4 inline-flex items-center gap-1 text-[11px] text-white/70">
          Explore details
          <ArrowUpRightIcon className="w-3 h-3 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
        </p>
      )}
    </button>
  )
}
