import { useEffect, useMemo, useRef, useState } from 'react'
import LoadingSpinner from '../../components/common/LoadingSpinner'
import { fetchAuditLogs } from '../../api/admin'

const METHOD_OPTIONS = ['', 'POST', 'PUT', 'PATCH', 'DELETE']
const ROLE_OPTIONS = ['', 'admin', 'dealer', 'customer']

function formatAuditTime(value) {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleString()
}

export default function AuditLogs() {
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [rows, setRows] = useState([])
  const [total, setTotal] = useState(0)
  const [limit, setLimit] = useState(50)
  const [offset, setOffset] = useState(0)
  const [filters, setFilters] = useState({
    method: '',
    role: '',
    statusCode: '',
    path: '',
    action: '',
    requestId: '',
  })
  const [draftFilters, setDraftFilters] = useState(filters)
  const hasLoadedOnce = useRef(false)

  const pageNumber = useMemo(() => Math.floor(offset / limit) + 1, [offset, limit])
  const totalPages = useMemo(() => Math.max(1, Math.ceil(total / limit)), [total, limit])

  useEffect(() => {
    let mounted = true
    if (hasLoadedOnce.current) setRefreshing(true)

    const params = {
      limit,
      offset,
    }
    if (filters.method) params.method = filters.method
    if (filters.role) params.role = filters.role
    if (filters.statusCode) params.status_code = Number(filters.statusCode)
    if (filters.path.trim()) params.path = filters.path.trim()
    if (filters.action.trim()) params.action = filters.action.trim()
    if (filters.requestId.trim()) params.request_id = filters.requestId.trim()

    fetchAuditLogs(params)
      .then((res) => {
        if (!mounted) return
        setRows(res.data?.items || [])
        setTotal(res.data?.total || 0)
      })
      .catch((err) => {
        console.error('Audit log fetch failed:', err)
      })
      .finally(() => {
        if (!mounted) return
        setLoading(false)
        setRefreshing(false)
        hasLoadedOnce.current = true
      })

    return () => {
      mounted = false
    }
  }, [limit, offset, filters])

  if (loading) return <LoadingSpinner text="Loading audit logs..." />

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white">Audit Logs</h1>
          <p className="text-sm text-slate-400 mt-1">Tracks mutating API actions by user and route.</p>
        </div>
        <div className="text-xs text-slate-400">
          {refreshing ? 'Refreshing...' : `${total} record${total === 1 ? '' : 's'}`}
        </div>
      </div>

      <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-4 space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-3 xl:grid-cols-6 gap-2">
          <select
            value={draftFilters.method}
            onChange={(e) => setDraftFilters((prev) => ({ ...prev, method: e.target.value }))}
            className="bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100"
          >
            {METHOD_OPTIONS.map((value) => (
              <option key={value || 'all-methods'} value={value}>
                {value || 'All Methods'}
              </option>
            ))}
          </select>
          <select
            value={draftFilters.role}
            onChange={(e) => setDraftFilters((prev) => ({ ...prev, role: e.target.value }))}
            className="bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100"
          >
            {ROLE_OPTIONS.map((value) => (
              <option key={value || 'all-roles'} value={value}>
                {value || 'All Roles'}
              </option>
            ))}
          </select>
          <input
            type="number"
            min="100"
            max="599"
            value={draftFilters.statusCode}
            onChange={(e) => setDraftFilters((prev) => ({ ...prev, statusCode: e.target.value }))}
            className="bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100"
            placeholder="Status code"
          />
          <input
            type="text"
            value={draftFilters.path}
            onChange={(e) => setDraftFilters((prev) => ({ ...prev, path: e.target.value }))}
            className="bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100"
            placeholder="Path contains"
          />
          <input
            type="text"
            value={draftFilters.action}
            onChange={(e) => setDraftFilters((prev) => ({ ...prev, action: e.target.value }))}
            className="bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100"
            placeholder="Action contains"
          />
          <input
            type="text"
            value={draftFilters.requestId}
            onChange={(e) => setDraftFilters((prev) => ({ ...prev, requestId: e.target.value }))}
            className="bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100"
            placeholder="Request ID"
          />
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                setOffset(0)
                setFilters({ ...draftFilters })
              }}
              className="px-3 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium"
            >
              Apply Filters
            </button>
            <button
              type="button"
              onClick={() => {
                const empty = { method: '', role: '', statusCode: '', path: '', action: '', requestId: '' }
                setDraftFilters(empty)
                setFilters(empty)
                setOffset(0)
              }}
              className="px-3 py-2 rounded-lg border border-slate-700 text-slate-200 text-sm hover:bg-slate-800"
            >
              Reset
            </button>
          </div>
          <div className="flex items-center gap-2 text-sm text-slate-300">
            <span>Page size</span>
            <select
              value={limit}
              onChange={(e) => {
                setLimit(Number(e.target.value))
                setOffset(0)
              }}
              className="bg-slate-950 border border-slate-700 rounded-lg px-2 py-1 text-slate-100"
            >
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>
          </div>
        </div>
      </div>

      <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-900/50">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-slate-400 border-b border-slate-800">
              <th className="px-4 py-3 font-medium">Time</th>
              <th className="px-4 py-3 font-medium">User</th>
              <th className="px-4 py-3 font-medium">Method</th>
              <th className="px-4 py-3 font-medium">Path</th>
              <th className="px-4 py-3 font-medium">Action</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Request ID</th>
              <th className="px-4 py-3 font-medium">IP</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className="border-b border-slate-800/70 text-slate-200">
                <td className="px-4 py-3 whitespace-nowrap">{formatAuditTime(row.created_at)}</td>
                <td className="px-4 py-3 whitespace-nowrap">{row.user_id ? `#${row.user_id} (${row.role || 'n/a'})` : 'anonymous'}</td>
                <td className="px-4 py-3 font-mono text-xs">{row.method}</td>
                <td className="px-4 py-3 font-mono text-xs">{row.path}</td>
                <td className="px-4 py-3 font-mono text-xs">{row.action}</td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-1 rounded text-xs ${
                    row.status_code >= 500
                      ? 'bg-red-500/20 text-red-300'
                      : row.status_code >= 400
                        ? 'bg-amber-500/20 text-amber-300'
                        : 'bg-emerald-500/20 text-emerald-300'
                  }`}>
                    {row.status_code}
                  </span>
                </td>
                <td className="px-4 py-3 font-mono text-xs">{row.request_id || '-'}</td>
                <td className="px-4 py-3">{row.ip_address || '-'}</td>
              </tr>
            ))}
            {rows.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-6 text-center text-slate-500">No audit logs available.</td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between text-sm text-slate-300">
        <div>
          Showing {rows.length === 0 ? 0 : offset + 1} to {Math.min(offset + rows.length, total)} of {total}
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setOffset((prev) => Math.max(0, prev - limit))}
            disabled={offset === 0}
            className="px-3 py-2 rounded-lg border border-slate-700 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-800"
          >
            Previous
          </button>
          <span>Page {pageNumber} / {totalPages}</span>
          <button
            type="button"
            onClick={() => setOffset((prev) => prev + limit)}
            disabled={offset + rows.length >= total}
            className="px-3 py-2 rounded-lg border border-slate-700 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-800"
          >
            Next
          </button>
        </div>
      </div>
    </div>
  )
}
