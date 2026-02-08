import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  deleteNotification,
  fetchNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from '../../api/notifications'
import { useAuth } from '../../contexts/AuthContext'

function formatTimeAgo(iso) {
  if (!iso) return ''
  const created = new Date(iso).getTime()
  const now = Date.now()
  const diffMin = Math.max(1, Math.floor((now - created) / 60000))
  if (diffMin < 60) return `${diffMin}m ago`
  const diffHr = Math.floor(diffMin / 60)
  if (diffHr < 24) return `${diffHr}h ago`
  const diffDay = Math.floor(diffHr / 24)
  return `${diffDay}d ago`
}

const TYPE_STYLES = {
  info: 'text-blue-400 bg-blue-500/10 border-blue-500/20',
  warning: 'text-yellow-400 bg-yellow-500/10 border-yellow-500/20',
  success: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
  alert: 'text-red-400 bg-red-500/10 border-red-500/20',
}

export default function NotificationsPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState('all')
  const [typeFilter, setTypeFilter] = useState('all')
  const [categoryFilter, setCategoryFilter] = useState('all')

  const isLight = user?.role === 'customer'

  const loadNotifications = async () => {
    setLoading(true)
    try {
      const res = await fetchNotifications({ limit: 200, offset: 0 })
      setItems(res.data?.items || [])
    } catch {
      setItems([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadNotifications()
  }, [])

  const categories = useMemo(() => {
    const set = new Set(items.map((item) => item.category).filter(Boolean))
    return Array.from(set)
  }, [items])

  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      if (statusFilter === 'unread' && item.is_read) return false
      if (statusFilter === 'read' && !item.is_read) return false
      if (typeFilter !== 'all' && item.type !== typeFilter) return false
      if (categoryFilter !== 'all' && item.category !== categoryFilter) return false
      return true
    })
  }, [items, statusFilter, typeFilter, categoryFilter])

  const handleMarkAllRead = async () => {
    try {
      await markAllNotificationsRead()
      setItems((prev) => prev.map((item) => ({ ...item, is_read: true })))
    } catch {
      // Leave local state unchanged on failure.
    }
  }

  const handleMarkRead = async (id) => {
    try {
      await markNotificationRead(id)
      setItems((prev) => prev.map((item) => (item.id === id ? { ...item, is_read: true } : item)))
    } catch {
      // Retry from UI controls if request fails.
    }
  }

  const handleDelete = async (id) => {
    try {
      await deleteNotification(id)
      setItems((prev) => prev.filter((item) => item.id !== id))
    } catch {
      // Keep item if delete fails.
    }
  }

  const handleOpen = async (item) => {
    if (!item.is_read) {
      await handleMarkRead(item.id)
    }
    if (item.link) {
      navigate(item.link)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className={`text-xl font-semibold ${isLight ? 'text-gray-900' : 'text-white'}`}>Notifications</h1>
          <p className={`text-sm ${isLight ? 'text-gray-600' : 'text-gray-400'}`}>
            Track order, transfer, stock, and system updates.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={loadNotifications}
            className={`px-3 py-2 rounded-lg text-sm transition-colors ${
              isLight
                ? 'bg-white border border-gray-200 text-gray-700 hover:bg-gray-50'
                : 'bg-gray-800 text-gray-200 border border-gray-700 hover:bg-gray-700'
            }`}
          >
            Refresh
          </button>
          <button
            onClick={handleMarkAllRead}
            className={`px-3 py-2 rounded-lg text-sm transition-colors ${
              isLight
                ? 'bg-orange-600 text-white hover:bg-orange-500'
                : 'bg-blue-600 text-white hover:bg-blue-500'
            }`}
          >
            Mark all read
          </button>
        </div>
      </div>

      <div className={`p-3 rounded-xl border grid grid-cols-1 md:grid-cols-3 gap-3 ${
        isLight ? 'bg-white border-orange-100' : 'bg-gray-900 border-gray-800'
      }`}>
        <label className="text-sm">
          <span className={`block mb-1 ${isLight ? 'text-gray-600' : 'text-gray-400'}`}>Read Status</span>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className={`w-full px-3 py-2 rounded-lg border ${
              isLight
                ? 'bg-white border-gray-300 text-gray-900'
                : 'bg-gray-800 border-gray-700 text-white'
            }`}
          >
            <option value="all">All</option>
            <option value="unread">Unread</option>
            <option value="read">Read</option>
          </select>
        </label>
        <label className="text-sm">
          <span className={`block mb-1 ${isLight ? 'text-gray-600' : 'text-gray-400'}`}>Type</span>
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className={`w-full px-3 py-2 rounded-lg border ${
              isLight
                ? 'bg-white border-gray-300 text-gray-900'
                : 'bg-gray-800 border-gray-700 text-white'
            }`}
          >
            <option value="all">All</option>
            <option value="info">Info</option>
            <option value="warning">Warning</option>
            <option value="success">Success</option>
            <option value="alert">Alert</option>
          </select>
        </label>
        <label className="text-sm">
          <span className={`block mb-1 ${isLight ? 'text-gray-600' : 'text-gray-400'}`}>Category</span>
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className={`w-full px-3 py-2 rounded-lg border ${
              isLight
                ? 'bg-white border-gray-300 text-gray-900'
                : 'bg-gray-800 border-gray-700 text-white'
            }`}
          >
            <option value="all">All</option>
            {categories.map((category) => (
              <option key={category} value={category}>
                {category}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className={`rounded-xl border ${
        isLight ? 'bg-white border-orange-100' : 'bg-gray-900 border-gray-800'
      }`}>
        {loading ? (
          <p className={`px-4 py-8 text-sm ${isLight ? 'text-gray-500' : 'text-gray-400'}`}>Loading notifications...</p>
        ) : filteredItems.length === 0 ? (
          <p className={`px-4 py-8 text-sm ${isLight ? 'text-gray-500' : 'text-gray-400'}`}>No notifications match your filters.</p>
        ) : (
          <div className={`divide-y ${isLight ? 'divide-orange-100' : 'divide-gray-800'}`}>
            {filteredItems.map((item) => (
              <div key={item.id} className={`px-4 py-3 ${item.is_read ? 'opacity-75' : ''}`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-md border text-[11px] uppercase tracking-wider font-semibold ${TYPE_STYLES[item.type] || TYPE_STYLES.info}`}>
                        {item.type}
                      </span>
                      <span className={`text-xs uppercase tracking-wider ${isLight ? 'text-gray-500' : 'text-gray-500'}`}>
                        {item.category || 'system'}
                      </span>
                      {!item.is_read && (
                        <span className="text-[11px] font-semibold text-orange-500">Unread</span>
                      )}
                    </div>
                    <p className={`font-medium mt-1 ${isLight ? 'text-gray-900' : 'text-white'}`}>{item.title}</p>
                    <p className={`text-sm mt-1 ${isLight ? 'text-gray-600' : 'text-gray-400'}`}>{item.message}</p>
                  </div>
                  <span className={`text-xs whitespace-nowrap ${isLight ? 'text-gray-500' : 'text-gray-500'}`}>
                    {formatTimeAgo(item.created_at)}
                  </span>
                </div>
                <div className="mt-2 flex items-center gap-2">
                  {item.link ? (
                    <button
                      onClick={() => handleOpen(item)}
                      className={`text-xs font-medium transition-colors ${
                        isLight ? 'text-orange-600 hover:text-orange-700' : 'text-blue-400 hover:text-blue-300'
                      }`}
                    >
                      Open
                    </button>
                  ) : null}
                  {!item.is_read ? (
                    <button
                      onClick={() => handleMarkRead(item.id)}
                      className={`text-xs font-medium transition-colors ${
                        isLight ? 'text-emerald-600 hover:text-emerald-700' : 'text-emerald-400 hover:text-emerald-300'
                      }`}
                    >
                      Mark read
                    </button>
                  ) : null}
                  <button
                    onClick={() => handleDelete(item.id)}
                    className={`text-xs font-medium transition-colors ${
                      isLight ? 'text-red-600 hover:text-red-700' : 'text-red-400 hover:text-red-300'
                    }`}
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
