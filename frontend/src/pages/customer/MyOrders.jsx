import { useState, useEffect } from 'react'
import LoadingSpinner from '../../components/common/LoadingSpinner'
import AlertBadge from '../../components/common/AlertBadge'
import { fetchMyOrders } from '../../api/customer'
import { formatCurrency } from '../../utils/formatters'
import { ClipboardDocumentListIcon } from '@heroicons/react/24/outline'
import { Link } from 'react-router-dom'

export default function MyOrders() {
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchMyOrders()
      .then(r => setOrders(r.data))
      .catch(err => console.error('Orders load failed:', err))
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <LoadingSpinner text="Loading your orders..." />

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">My Orders</h1>
        <p className="text-gray-500 mt-1">Track and manage your paint orders</p>
      </div>

      {orders.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <ClipboardDocumentListIcon className="w-16 h-16 text-gray-300 mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 mb-1">No orders yet</h2>
          <p className="text-gray-500 mb-4">You haven't placed any orders. Start by browsing our shade collection.</p>
          <Link
            to="/customer"
            className="px-5 py-2 bg-orange-500 text-white rounded-lg text-sm font-medium hover:bg-orange-600 transition-colors"
          >
            Browse Shades
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          {orders.map(order => (
            <div
              key={order.order_id}
              className={`bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden ${
                ['placed', 'requested'].includes(order.status?.toLowerCase()) ? 'border-l-4 border-l-orange-400' : ''
              }`}
            >
              {/* Order header */}
              <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
                <div className="flex items-center gap-4">
                  <div>
                    <span className="text-sm font-semibold text-gray-900">#{order.order_id}</span>
                    <span className="text-gray-400 mx-2">·</span>
                    <span className="text-sm text-gray-500">
                      {new Date(order.created_at).toLocaleDateString('en-IN', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                      })}
                    </span>
                  </div>
                  <AlertBadge status={order.status?.toUpperCase()} />
                </div>
                <span className="text-sm font-semibold text-gray-900">
                  {formatCurrency(order.total_amount)}
                </span>
              </div>

              {/* Order items */}
              {order.items && order.items.length > 0 && (
                <ul className="divide-y divide-gray-50">
                  {order.items.map((item, idx) => (
                    <li key={idx} className="flex items-center gap-3 px-5 py-3">
                      <span
                        className="w-5 h-5 rounded-full border border-gray-200 flex-shrink-0"
                        style={{ backgroundColor: item.hex_color || '#ccc' }}
                      />
                      <span className="text-sm font-medium text-gray-900 flex-1 truncate">
                        {item.shade_name}
                      </span>
                      <span className="text-xs text-gray-500">{item.size}</span>
                      <span className="text-xs text-gray-500">x{item.quantity}</span>
                      <span className="text-sm font-medium text-gray-700 w-20 text-right">
                        {formatCurrency(item.subtotal)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
