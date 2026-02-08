import { XMarkIcon } from '@heroicons/react/24/outline'
import DataTable from './DataTable'

export default function MetricDetailDrawer({ open, onClose, metric }) {
  if (!open || !metric) return null

  const rows = metric.rows || []
  const columns = metric.columns || []
  const highlights = metric.highlights || []

  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/55 backdrop-blur-sm" onClick={onClose} />
      <aside className="absolute right-0 top-0 h-full w-full max-w-2xl bg-gray-950 border-l border-gray-800 shadow-2xl flex flex-col">
        <div className="px-6 py-4 border-b border-gray-800 flex items-center justify-between">
          <div>
            <p className="text-xs uppercase tracking-wider text-gray-500">Metric Details</p>
            <h2 className="text-xl font-semibold text-white">{metric.title}</h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg text-gray-400 hover:text-white hover:bg-gray-800 transition-colors"
          >
            <XMarkIcon className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {metric.description ? (
            <div className="rounded-xl border border-gray-800 bg-gray-900/60 p-4">
              <p className="text-xs uppercase tracking-wider text-gray-500">How It Is Calculated</p>
              <p className="text-sm text-gray-300 mt-1">{metric.description}</p>
            </div>
          ) : null}

          {highlights.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {highlights.map((highlight, idx) => (
                <div key={idx} className="rounded-xl border border-gray-800 bg-gray-900/50 p-3">
                  <p className="text-[11px] uppercase tracking-wider text-gray-500">{highlight.label}</p>
                  <p className="text-lg font-semibold text-white mt-1">{highlight.value}</p>
                  {highlight.caption ? <p className="text-[11px] text-gray-500 mt-1">{highlight.caption}</p> : null}
                </div>
              ))}
            </div>
          ) : null}

          <div>
            <h3 className="text-sm font-semibold text-gray-200 mb-2">Underlying Data</h3>
            {rows.length > 0 ? (
              <DataTable columns={columns} data={rows} />
            ) : (
              <div className="rounded-xl border border-gray-800 bg-gray-900/40 p-4 text-sm text-gray-500">
                No detail rows available for this metric yet.
              </div>
            )}
          </div>
        </div>
      </aside>
    </div>
  )
}

