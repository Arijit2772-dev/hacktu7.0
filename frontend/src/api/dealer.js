import api from './client'

// All dealer endpoints now use /dealer/me/ (JWT-based, no dealer_id in URL)
export const fetchDealerDashboard = () => api.get('/dealer/me/dashboard')
export const fetchDealerDashboardActivity = (params) =>
  api.get('/dealer/me/dashboard/activity', { params })
export const fetchDealerDashboardPipeline = () => api.get('/dealer/me/dashboard/pipeline')
export const fetchDealerDashboardTrends = (params) =>
  api.get('/dealer/me/dashboard/trends', { params })
export const fetchDealerTopSkus = (params) =>
  api.get('/dealer/me/inventory/top-skus', { params })
export const fetchDealerRevenueTrend = (params) =>
  api.get('/dealer/me/analytics/revenue-trend', { params })
export const fetchDealerAnalyticsTopSkus = (params) =>
  api.get('/dealer/me/analytics/top-skus', { params })
export const fetchDealerAnalyticsPipeline = () =>
  api.get('/dealer/me/analytics/order-pipeline')
export const fetchSmartOrders = () => api.get('/dealer/me/smart-orders')
export const placeOrder = (data) => api.post('/dealer/me/orders', data)
export const acceptBundle = () => api.post('/dealer/me/orders/bundle')
export const fetchOrders = () => api.get('/dealer/me/orders')
export const fetchDealerAlerts = () => api.get('/dealer/me/alerts')
export const fetchOrderDetail = (orderId) => api.get(`/dealer/me/orders/${orderId}`)
export const updateOrderStatus = (orderId, status) =>
  api.put(`/dealer/me/orders/${orderId}/status`, { status })
export const searchOrders = (params) =>
  api.get('/dealer/me/orders/search', { params })
export const fetchDealerProfile = () => api.get('/dealer/me/profile')
export const fetchCustomerRequests = (params) =>
  api.get('/dealer/me/customer-requests', { params })
export const updateCustomerRequestStatus = (orderId, status) =>
  api.put(`/dealer/me/customer-requests/${orderId}/status`, { status })
export const rejectCustomerRequest = (orderId) =>
  api.post(`/dealer/me/customer-requests/${orderId}/reject`)
