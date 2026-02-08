import { Link } from 'react-router-dom'
import { FireIcon } from '@heroicons/react/24/solid'
import { ArrowUpRightIcon } from '@heroicons/react/24/outline'

export default function ShadeSwatchGrid({ shades = [] }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
      {shades.map((shade, idx) => (
        <Link
          key={shade.id}
          to={`/customer/shade/${shade.id}`}
          style={{ animationDelay: `${Math.min(idx, 11) * 35}ms` }}
          className="paint-panel group relative overflow-hidden rounded-2xl bg-white shadow-sm hover:shadow-[0_16px_34px_rgba(15,23,42,0.2)] transition-all hover:-translate-y-1.5 border border-gray-200"
        >
          <div
            className="relative h-28 w-full"
            style={{ backgroundColor: shade.hex_color }}
          >
            <div className="absolute inset-0 bg-gradient-to-b from-white/20 to-black/20 opacity-70" />
            <span className="absolute right-2 top-2 inline-flex h-6 w-6 items-center justify-center rounded-full bg-black/25 text-white/90 opacity-0 transition-all group-hover:opacity-100 group-hover:translate-x-0">
              <ArrowUpRightIcon className="w-3.5 h-3.5" />
            </span>
          </div>
          <div className="p-3 bg-gradient-to-b from-white to-gray-50">
            <div className="flex items-center gap-1">
              <p className="font-medium text-gray-800 text-sm truncate">{shade.shade_name}</p>
              {shade.is_trending && <FireIcon className="w-3.5 h-3.5 text-orange-500 flex-shrink-0" />}
            </div>
            <p className="text-xs text-gray-500">{shade.shade_code}</p>
            <p className="text-[10px] text-gray-400 mt-1">{shade.product_name}</p>
          </div>
        </Link>
      ))}
    </div>
  )
}
