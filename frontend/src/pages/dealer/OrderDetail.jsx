import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { ArrowLeftIcon } from '@heroicons/react/24/outline'
import LoadingSpinner from '../../components/common/LoadingSpinner'
import AlertBadge from '../../components/common/AlertBadge'
import ConfirmDialog from '../../components/common/ConfirmDialog'
import { useAuth } from '../../contexts/AuthContext'
import { useToast } from '../../contexts/ToastContext'
import { fetchOrderDetail, updateOrderStatus } from '../../api/dealer'
import { formatCurrency, formatDate } from '../../utils/formatters'

const STATUS_STEPS = ['placed', 'confirmed', 'shipped', 'delivered']

export default function OrderDetail() {
  const { orderId } = useParams()
  const { user } = useAuth()
  const toast = useToast()
  const dealerId = user?.dealer_id || 1
  const [order, setOrder] = useState(null)
  const [loading, setLoading] = useState(true)
  const [confirmAction, setConfirmAction] = useState(null)

  const load = () => {
    fetchOrderDetail(dealerId, orderId)
      .then(r => setOrder(r.data))
      .catch(err => toast.error('Failed to load order'))
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [orderId])

  const handleStatusChange = async () => {
    try {
      const res = await updateOrderStatus(dealerId, orderId, confirmAction)
      toast.success(res.data.message)
      setConfirmAction(null)
      load()
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Status update failed')
      setConfirmAction(null)
    }
  }

  if (loading) return <LoadingSpinner />
  if (!order) return <p className="text-gray-500">Order not found</p>

  const currentStep = STATUS_STEPS.indexOf(order.status)

  return (
    <div className="space-y-6 max-w-3xl">
      <Link to="/dealer/orders" className="flex items-center gap-2 text-sm text-gray-400 hover:text-white">
        <ArrowLeftIcon className="w-4 h-4" /> Back to Orders
      </Link>

      <div className="glass rounded-xl p-6 border border-gray-800">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-xl font-bold text-white">Order #{order.id}</h1>
            <p className="text-sm text-gray-500">{formatDate(order.order_date)}</p>
          </div>
          <AlertBadge status={order.status?.toUpperCase()} />
        </div>

        {/* Shade info */}
        <div className="flex items-center gap-4 mb-6">
          <div className="w-16 h-16 rounded-xl" style={{ backgroundColor: order.shade_hex }} />
          <div>
            <p className="text-white font-semibold text-lg">{order.shade_name}</p>
            <p className="text-sm text-gray-400">{order.sku_code} | {order.size}</p>
          </div>
        </div>

        {/* Details grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div>
            <span className="text-xs text-gray-500">Quantity</span>
            <p className="text-white font-mono">{order.quantity}</p>
          </div>
          <div>
            <span className="text-xs text-gray-500">Total Value</span>
            <p className="text-emerald-400 font-mono">{formatCurrency(order.total_value)}</p>
          </div>
          <div>
            <span className="text-xs text-gray-500">Source</span>
            <p className="text-white">{order.is_ai_suggested ? 'AI Recommended' : 'Manual'}</p>
          </div>
          <div>
            <span className="text-xs text-gray-500">Savings</span>
            <p className="text-emerald-400 font-mono">
              {order.savings_amount > 0 ? formatCurrency(order.savings_amount) : '-'}
            </p>
          </div>
        </div>

        {/* Status stepper */}
        <div className="mb-6">
          <p className="text-xs text-gray-500 mb-3">Order Progress</p>
          <div className="flex items-center gap-1">
            {STATUS_STEPS.map((step, i) => (
              <div key={step} className="flex items-center flex-1">
                <div className={`w-full h-2 rounded-full ${
                  i <= currentStep
                    ? order.status === 'cancelled' ? 'bg-red-500' : 'bg-emerald-500'
                    : 'bg-gray-800'
                }`} />
              </div>
            ))}
          </div>
          <div className="flex justify-between mt-1">
            {STATUS_STEPS.map(step => (
              <span key={step} className={`text-xs ${
                step === order.status ? 'text-emerald-400 font-medium' : 'text-gray-600'
              }`}>
                {step.charAt(0).toUpperCase() + step.slice(1)}
              </span>
            ))}
          </div>
        </div>

        {/* Actions */}
        {order.allowed_transitions?.length > 0 && (
          <div className="flex gap-3">
            {order.allowed_transitions.map(nextStatus => (
              <button
                key={nextStatus}
                onClick={() => setConfirmAction(nextStatus)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  nextStatus === 'cancelled'
                    ? 'bg-red-600/20 text-red-400 hover:bg-red-600/30'
                    : 'bg-emerald-600 hover:bg-emerald-500 text-white'
                }`}
              >
                {nextStatus === 'confirmed' ? 'Confirm Order' :
                 nextStatus === 'shipped' ? 'Mark Shipped' :
                 nextStatus === 'delivered' ? 'Mark Delivered' :
                 'Cancel Order'}
              </button>
            ))}
          </div>
        )}
      </div>

      <ConfirmDialog
        open={!!confirmAction}
        onClose={() => setConfirmAction(null)}
        onConfirm={handleStatusChange}
        title="Update Order Status"
        message={`Are you sure you want to change the status to "${confirmAction}"?`}
        confirmLabel={confirmAction === 'cancelled' ? 'Cancel Order' : 'Update Status'}
        confirmColor={confirmAction === 'cancelled' ? 'red' : 'green'}
      />
    </div>
  )
}
