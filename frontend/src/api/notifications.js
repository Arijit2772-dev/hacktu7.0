import api from './client'

export const fetchNotifications = (params) => api.get('/notifications', { params })
export const fetchUnreadCount = () => api.get('/notifications/unread-count')
export const markNotificationRead = (id) => api.put(`/notifications/${id}/read`)
export const markAllNotificationsRead = () => api.put('/notifications/read-all')
export const deleteNotification = (id) => api.delete(`/notifications/${id}`)
