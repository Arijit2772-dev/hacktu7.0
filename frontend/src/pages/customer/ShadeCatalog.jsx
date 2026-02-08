import { useState, useEffect } from 'react'
import { FireIcon, SparklesIcon, ShieldCheckIcon, SunIcon } from '@heroicons/react/24/outline'
import ShadeSwatchGrid from '../../components/paint/ShadeSwatchGrid'
import LoadingSpinner from '../../components/common/LoadingSpinner'
import { fetchShades } from '../../api/customer'
import { useSimulation } from '../../contexts/SimulationContext'
import { getScenarioVisuals } from '../../utils/scenarioEffects'

const families = ['All', 'Reds', 'Blues', 'Greens', 'Yellows', 'Neutrals', 'Whites']
const categories = ['All', 'Interior Wall', 'Exterior Wall', 'Wood & Metal', 'Waterproofing']
const familyPriorityByScenario = {
  TRUCK_STRIKE: ['Reds', 'Neutrals', 'Whites'],
  HEATWAVE: ['Whites', 'Yellows', 'Neutrals'],
  EARLY_MONSOON: ['Blues', 'Greens', 'Neutrals'],
}

export default function ShadeCatalog() {
  const [shades, setShades] = useState([])
  const [loading, setLoading] = useState(true)
  const [family, setFamily] = useState('All')
  const [category, setCategory] = useState('All')
  const [trending, setTrending] = useState(false)
  const { scenario, currentData } = useSimulation()
  const visuals = getScenarioVisuals(scenario)

  useEffect(() => {
    setLoading(true)
    const params = {}
    if (family !== 'All') params.family = family
    if (category !== 'All') params.category = category
    if (trending) params.trending = true

    fetchShades(params)
      .then(r => setShades(r.data))
      .catch(err => console.error('Shades load failed:', err))
      .finally(() => setLoading(false))
  }, [family, category, trending])

  const quickFilters = [
    {
      id: 'popular',
      label: 'Popular Now',
      caption: 'High engagement shades',
      icon: FireIcon,
      onClick: () => setTrending((prev) => !prev),
      active: trending,
      className: 'from-orange-500/35 via-amber-500/25 to-orange-100/30 border-orange-300/50',
    },
    {
      id: 'exterior',
      label: 'Exterior Focus',
      caption: 'Heat resistant suggestions',
      icon: SunIcon,
      onClick: () => setCategory(category === 'Exterior Wall' ? 'All' : 'Exterior Wall'),
      active: category === 'Exterior Wall',
      className: 'from-sky-500/35 via-cyan-500/25 to-sky-100/30 border-sky-300/50',
    },
    {
      id: 'monsoon',
      label: 'Monsoon Guard',
      caption: 'Waterproofing palette',
      icon: ShieldCheckIcon,
      onClick: () => setCategory(category === 'Waterproofing' ? 'All' : 'Waterproofing'),
      active: category === 'Waterproofing',
      className: 'from-emerald-500/35 via-teal-500/25 to-emerald-100/30 border-emerald-300/50',
    },
  ]
  const priorityFamilies = familyPriorityByScenario[scenario] || []
  const displayedShades = [...shades].sort((a, b) => {
    const aRank = priorityFamilies.includes(a.shade_family) ? priorityFamilies.indexOf(a.shade_family) : 99
    const bRank = priorityFamilies.includes(b.shade_family) ? priorityFamilies.indexOf(b.shade_family) : 99
    if (aRank !== bRank) return aRank - bRank
    if (a.is_trending !== b.is_trending) return a.is_trending ? -1 : 1
    return a.shade_name.localeCompare(b.shade_name)
  })

  return (
    <div className="space-y-6">
      <div className={`paint-banner relative isolate overflow-hidden rounded-3xl border border-orange-300/60 p-6 bg-gradient-to-r ${visuals.bannerClass.replaceAll('/50', '/20')}`}>
        <div className="absolute -left-6 -top-8 h-20 w-20 rounded-full bg-orange-400/25 blur-2xl" />
        <div className="absolute -right-6 -bottom-8 h-24 w-24 rounded-full bg-cyan-400/20 blur-2xl" />
        <div className="relative">
          <span className="inline-flex items-center gap-1 rounded-full bg-white/60 border border-orange-200 px-3 py-1 text-[11px] font-semibold text-orange-700 uppercase tracking-wide">
            <SparklesIcon className="w-3.5 h-3.5" />
            Curated Palette Studio
          </span>
          <h1 className="text-3xl font-bold text-gray-900 mt-3">Explore Shades</h1>
          <p className="text-gray-700 mt-1">Find the perfect color for your home</p>
        </div>
        {scenario !== 'NORMAL' ? (
          <p className={`text-xs mt-3 ${visuals.accentClass}`}>
            {currentData?.name || scenario} active: {currentData?.description || 'Palette demand has shifted for this scenario.'}
          </p>
        ) : null}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {quickFilters.map((filter, idx) => (
          <button
            key={filter.id}
            onClick={filter.onClick}
            style={{ animationDelay: `${80 + idx * 70}ms` }}
            className={`group relative overflow-hidden rounded-2xl border p-4 text-left transition-all bg-gradient-to-r ${filter.className} ${
              filter.active
                ? 'shadow-[0_14px_30px_rgba(249,115,22,0.25)] -translate-y-0.5'
                : 'hover:-translate-y-0.5 hover:shadow-[0_12px_26px_rgba(15,23,42,0.16)]'
            } paint-panel`}
          >
            <div className="absolute -right-4 -top-4 h-12 w-12 rounded-full bg-white/30 blur-xl" />
            <div className="relative flex items-start justify-between gap-2">
              <div>
                <p className="text-sm font-semibold text-gray-900">{filter.label}</p>
                <p className="text-xs text-gray-700 mt-1">{filter.caption}</p>
                <p className="text-[11px] text-orange-700 mt-2 font-medium">{filter.active ? 'Active' : 'Click to apply'}</p>
              </div>
              <div className="h-8 w-8 rounded-lg bg-white/45 border border-white/50 flex items-center justify-center">
                <filter.icon className="w-4 h-4 text-gray-800" />
              </div>
            </div>
          </button>
        ))}
      </div>

      {/* Filters */}
      <div className="paint-panel flex flex-wrap gap-3 items-center" style={{ animationDelay: '240ms' }}>
        <div className="flex gap-1">
          {families.map(f => (
            <button
              key={f}
              onClick={() => setFamily(f)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                family === f
                  ? 'bg-gradient-to-r from-orange-500 to-amber-500 text-white shadow-[0_8px_20px_rgba(249,115,22,0.35)]'
                  : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-100'
              }`}
            >
              {f}
            </button>
          ))}
        </div>

        <select
          value={category}
          onChange={e => setCategory(e.target.value)}
          className="bg-white border border-gray-200 text-gray-700 text-sm rounded-lg px-3 py-1.5 outline-none"
        >
          {categories.map(c => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>

        <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
          <input
            type="checkbox"
            checked={trending}
            onChange={e => setTrending(e.target.checked)}
            className="rounded border-gray-300"
          />
          Trending Only
        </label>
      </div>

      {loading ? (
        <LoadingSpinner text="Loading shades..." />
      ) : (
        <>
          <div className="paint-panel flex items-center justify-between" style={{ animationDelay: '280ms' }}>
            <p className="text-sm text-gray-500">{displayedShades.length} shades found</p>
            {scenario !== 'NORMAL' ? (
              <span className="text-xs px-2 py-1 rounded-full bg-orange-100 text-orange-700 border border-orange-200">
                Scenario-prioritized ranking
              </span>
            ) : null}
          </div>
          <ShadeSwatchGrid shades={displayedShades} />
        </>
      )}
    </div>
  )
}
