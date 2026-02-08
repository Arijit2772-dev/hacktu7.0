import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { BellIcon, CheckIcon } from '@heroicons/react/24/outline'
import {
  fetchNotifications,
  fetchUnreadCount,
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
  info: 'text-blue-400',
  warning: 'text-yellow-400',
  success: 'text-emerald-400',
  alert: 'text-red-400',
}

export default function NotificationBell({ variant = 'dark' }) {
  const navigate = useNavigate()
  const { user } = useAuth()
  const wrapperRef = useRef(null)
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [unreadCount, setUnreadCount] = useState(0)
  const [notifications, setNotifications] = useState([])

  const isLight = variant === 'light'
  const viewAllPath = user?.role ? `/${user.role}/notifications` : '/login'

  const loadUnreadCount = async () => {
    try {
      const res = await fetchUnreadCount()
      setUnreadCount(res.data?.count || 0)
    } catch {
      setUnreadCount(0)
    }
  }

  const loadNotifications = async () => {
    setLoading(true)
    try {
      const res = await fetchNotifications({ limit: 12, offset: 0 })
      setNotifications(res.data?.items || [])
    } catch {
      setNotifications([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadUnreadCount()
    const interval = setInterval(loadUnreadCount, 30000)
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    if (!open) return
    loadNotifications()
  }, [open])

  useEffect(() => {
    const onClickOutside = (event) => {
      if (!wrapperRef.current) return
      if (!wrapperRef.current.contains(event.target)) setOpen(false)
    }
    document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [])

  const handleMarkAll = async () => {
    try {
      await markAllNotificationsRead()
      await Promise.all([loadUnreadCount(), loadNotifications()])
    } catch {
      // Intentionally ignore; panel can be retried.
    }
  }

  const handleNotificationClick = async (notification) => {
    try {
      if (!notification.is_read) {
        await markNotificationRead(notification.id)
      }
    } catch {
      // No-op
    }
    await loadUnreadCount()
    if (notification.link) {
      navigate(notification.link)
      setOpen(false)
    }
  }

  return (
    <div className="relative" ref={wrapperRef}>
      <button
        onClick={() => setOpen((prev) => !prev)}
        className={`relative p-2 rounded-lg transition-colors ${
          isLight
            ? 'text-white/80 hover:text-white hover:bg-white/15'
            : 'text-gray-400 hover:text-white hover:bg-gray-800'
        }`}
        title="Notifications"
      >
        <BellIcon className="w-5 h-5" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 min-w-5 h-5 px-1 rounded-full text-[10px] font-semibold bg-red-500 text-white flex items-center justify-center">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className={`absolute right-0 mt-2 w-[22rem] max-w-[calc(100vw-2rem)] rounded-xl border shadow-2xl z-50 overflow-hidden ${
          isLight
            ? 'bg-white text-gray-900 border-orange-200'
            : 'bg-gray-900 border-gray-700 text-white'
        }`}>
          <div className={`px-4 py-3 border-b flex items-center justify-between ${
            isLight ? 'border-orange-100' : 'border-gray-800'
          }`}>
            <p className="text-sm font-semibold">Notifications</p>
            <button
              onClick={handleMarkAll}
              className={`inline-flex items-center gap-1 text-xs transition-colors ${
                isLight ? 'text-orange-600 hover:text-orange-700' : 'text-blue-400 hover:text-blue-300'
              }`}
            >
              <CheckIcon className="w-3.5 h-3.5" />
              Mark all read
            </button>
          </div>

          <div className="max-h-96 overflow-y-auto">
            {loading ? (
              <p className={`px-4 py-6 text-sm ${isLight ? 'text-gray-500' : 'text-gray-500'}`}>Loading...</p>
            ) : notifications.length === 0 ? (
              <p className={`px-4 py-6 text-sm ${isLight ? 'text-gray-500' : 'text-gray-500'}`}>No notifications yet.</p>
            ) : (
              <div className={`divide-y ${isLight ? 'divide-orange-100' : 'divide-gray-800'}`}>
                {notifications.map((notification) => (
                  <button
                    key={notification.id}
                    onClick={() => handleNotificationClick(notification)}
                    className={`w-full text-left px-4 py-3 transition-colors ${
                      isLight ? 'hover:bg-orange-50' : 'hover:bg-gray-800/80'
                    } ${notification.is_read ? 'opacity-75' : ''}`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <p className={`text-xs font-semibold uppercase tracking-wider ${TYPE_STYLES[notification.type] || TYPE_STYLES.info}`}>
                        {notification.category || 'system'}
                      </p>
                      <span className={`text-[11px] ${isLight ? 'text-gray-500' : 'text-gray-500'}`}>
                        {formatTimeAgo(notification.created_at)}
                      </span>
                    </div>
                    <p className="text-sm font-medium mt-1">{notification.title}</p>
                    <p className={`text-xs mt-1 ${isLight ? 'text-gray-600' : 'text-gray-400'}`}>
                      {notification.message}
                    </p>
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className={`px-4 py-3 border-t ${
            isLight ? 'border-orange-100' : 'border-gray-800'
          }`}>
            <button
              onClick={() => {
                navigate(viewAllPath)
                setOpen(false)
              }}
              className={`text-xs font-medium transition-colors ${
                isLight ? 'text-orange-600 hover:text-orange-700' : 'text-blue-400 hover:text-blue-300'
              }`}
            >
              View all notifications
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
