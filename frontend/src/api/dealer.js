import api from './client'

export const fetchDealerDashboard = (id) => api.get(`/dealer/${id}/dashboard`)
export const fetchSmartOrders = (id) => api.get(`/dealer/${id}/smart-orders`)
export const placeOrder = (id, data) => api.post(`/dealer/${id}/orders`, data)
export const acceptBundle = (id) => api.post(`/dealer/${id}/orders/bundle`)
export const fetchOrders = (id) => api.get(`/dealer/${id}/orders`)
export const fetchDealerAlerts = (id) => api.get(`/dealer/${id}/alerts`)
export const fetchOrderDetail = (dealerId, orderId) => api.get(`/dealer/${dealerId}/orders/${orderId}`)
export const updateOrderStatus = (dealerId, orderId, status) =>
  api.put(`/dealer/${dealerId}/orders/${orderId}/status`, { status })
export const searchOrders = (dealerId, params) =>
  api.get(`/dealer/${dealerId}/orders/search`, { params })
export const fetchDealerProfile = (id) => api.get(`/dealer/${id}/profile`)
