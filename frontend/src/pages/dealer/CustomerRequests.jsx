import { useEffect, useMemo, useState } from 'react'
import LoadingSpinner from '../../components/common/LoadingSpinner'
import AlertBadge from '../../components/common/AlertBadge'
import { useToast } from '../../contexts/ToastContext'
import {
  fetchCustomerRequests,
  updateCustomerRequestStatus,
  rejectCustomerRequest,
} from '../../api/dealer'
import { formatCurrency, formatDate } from '../../utils/formatters'

const STATUS_FILTERS = [
  { label: 'All', value: '' },
  { label: 'Requested', value: 'requested' },
  { label: 'Contacted', value: 'contacted' },
  { label: 'Fulfilled', value: 'fulfilled' },
  { label: 'Cancelled', value: 'cancelled' },
]

export default function CustomerRequests() {
  const toast = useToast()
  const [loading, setLoading] = useState(true)
  const [updatingId, setUpdatingId] = useState(null)
  const [statusFilter, setStatusFilter] = useState('')
  const [requests, setRequests] = useState([])

  const load = async (status = statusFilter) => {
    setLoading(true)
    try {
      const params = status ? { status, page: 1, per_page: 50 } : { page: 1, per_page: 50 }
      const res = await fetchCustomerRequests(params)
      setRequests(res.data?.requests || [])
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to load customer requests')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  const counts = useMemo(() => {
    return requests.reduce(
      (acc, req) => {
        acc.total += 1
        if (req.status === 'requested') acc.requested += 1
        if (req.status === 'contacted') acc.contacted += 1
        if (req.status === 'fulfilled') acc.fulfilled += 1
        return acc
      },
      { total: 0, requested: 0, contacted: 0, fulfilled: 0 },
    )
  }, [requests])

  const handleStatusUpdate = async (orderId, status) => {
    setUpdatingId(orderId)
    try {
      const res = await updateCustomerRequestStatus(orderId, status)
      toast.success(res.data?.message || 'Request updated')
      await load()
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to update request')
    } finally {
      setUpdatingId(null)
    }
  }

  const handleReject = async (orderId) => {
    setUpdatingId(orderId)
    try {
      const res = await rejectCustomerRequest(orderId)
      toast.success(res.data?.message || 'Request rejected')
      await load()
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to reject request')
    } finally {
      setUpdatingId(null)
    }
  }

  const onFilterChange = async (value) => {
    setStatusFilter(value)
    await load(value)
  }

  if (loading) return <LoadingSpinner text="Loading customer requests..." />

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white">Customer Requests</h1>
          <p className="text-sm text-gray-500 mt-1">Manage customer requests assigned to your dealership</p>
        </div>
        <div className="flex items-center gap-2 text-xs">
          <span className="px-2 py-1 rounded-lg bg-gray-800 text-gray-400">Total: {counts.total}</span>
          <span className="px-2 py-1 rounded-lg bg-orange-500/20 text-orange-400">Requested: {counts.requested}</span>
          <span className="px-2 py-1 rounded-lg bg-blue-500/20 text-blue-400">Contacted: {counts.contacted}</span>
          <span className="px-2 py-1 rounded-lg bg-emerald-500/20 text-emerald-400">Fulfilled: {counts.fulfilled}</span>
        </div>
      </div>

      <div className="flex items-center gap-2">
        {STATUS_FILTERS.map((filter) => (
          <button
            key={filter.value || 'all'}
            onClick={() => onFilterChange(filter.value)}
            className={`px-3 py-1.5 rounded-lg text-xs transition-colors ${
              statusFilter === filter.value
                ? 'bg-emerald-600 text-white'
                : 'bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-gray-200'
            }`}
          >
            {filter.label}
          </button>
        ))}
      </div>

      {requests.length === 0 ? (
        <div className="glass rounded-xl border border-gray-800 p-8 text-center text-gray-500 text-sm">
          No customer requests found for the selected filter.
        </div>
      ) : (
        <div className="space-y-4">
          {requests.map((req) => (
            <div key={req.order_id} className="glass rounded-xl border border-gray-800 p-4">
              <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
                <div>
                  <p className="text-white font-semibold">Request #{req.order_id}</p>
                  <p className="text-xs text-gray-500">
                    {formatDate(req.created_at)} | {req.customer?.name} ({req.customer?.phone || 'No phone'})
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <AlertBadge status={req.status?.toUpperCase()} />
                  <span className="text-emerald-400 text-sm font-semibold">{formatCurrency(req.total_amount || 0)}</span>
                </div>
              </div>

              <div className="space-y-2 mb-4">
                {req.items?.map((item) => (
                  <div key={item.item_id} className="flex items-center justify-between bg-gray-900/60 rounded-lg px-3 py-2">
                    <div className="flex items-center gap-2">
                      <span className="w-3 h-3 rounded" style={{ backgroundColor: item.hex_color }} />
                      <span className="text-sm text-white">{item.shade_name}</span>
                      <span className="text-xs text-gray-500">{item.size}</span>
                      <span className="text-xs text-gray-500">x{item.quantity}</span>
                    </div>
                    <span className="text-xs text-gray-400">{formatCurrency(item.subtotal || 0)}</span>
                  </div>
                ))}
              </div>

              <div className="flex flex-wrap gap-2">
                {req.allowed_transitions?.includes('contacted') && (
                  <button
                    onClick={() => handleStatusUpdate(req.order_id, 'contacted')}
                    disabled={updatingId === req.order_id}
                    className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-xs rounded-lg transition-colors"
                  >
                    Mark Contacted
                  </button>
                )}

                {req.allowed_transitions?.includes('fulfilled') && (
                  <button
                    onClick={() => handleStatusUpdate(req.order_id, 'fulfilled')}
                    disabled={updatingId === req.order_id}
                    className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs rounded-lg transition-colors"
                  >
                    Mark Fulfilled
                  </button>
                )}

                {req.allowed_transitions?.includes('cancelled') && (
                  <button
                    onClick={() => handleReject(req.order_id)}
                    disabled={updatingId === req.order_id}
                    className="px-3 py-1.5 bg-red-600/20 hover:bg-red-600/30 disabled:opacity-50 text-red-400 text-xs rounded-lg transition-colors"
                  >
                    Reject Request
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
