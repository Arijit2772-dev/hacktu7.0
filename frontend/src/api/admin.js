import api from './client'

// Dashboard
export const fetchDashboardSummary = () => api.get('/admin/dashboard/summary')
export const fetchInventoryMap = () => api.get('/admin/inventory/map')
export const fetchWarehouseInventory = (id) => api.get(`/admin/inventory/warehouse/${id}`)
export const fetchDeadStock = () => api.get('/admin/dead-stock')
export const fetchTopSkus = (limit = 10) => api.get('/admin/top-skus', { params: { limit } })

// Transfers
export const fetchTransfers = () => api.get('/admin/transfers/recommended')
export const approveTransfer = (id) => api.post(`/admin/transfers/${id}/approve`)
export const autoBalance = (id) => api.post(`/admin/transfers/${id}/auto-balance`)
export const createTransfer = (data) => api.post('/admin/transfers', data)
export const completeTransfer = (id) => api.post(`/admin/transfers/${id}/complete`)
export const rejectTransfer = (id) => api.post(`/admin/transfers/${id}/reject`)

// Dealers
export const fetchDealerPerformance = (regionId) =>
  api.get('/admin/dealers/performance', { params: regionId ? { region_id: regionId } : {} })
export const updateDealer = (id, data) => api.put(`/admin/dealers/${id}`, data)

// Products CRUD
export const fetchProducts = () => api.get('/admin/products')
export const createProduct = (data) => api.post('/admin/products', data)
export const updateProduct = (id, data) => api.put(`/admin/products/${id}`, data)
export const deleteProduct = (id) => api.delete(`/admin/products/${id}`)

// Shades CRUD
export const createShade = (data) => api.post('/admin/shades', data)
export const updateShade = (id, data) => api.put(`/admin/shades/${id}`, data)
export const deleteShade = (id) => api.delete(`/admin/shades/${id}`)

// SKUs
export const createSku = (data) => api.post('/admin/skus', data)

// Warehouses
export const fetchWarehouses = () => api.get('/admin/warehouses')
export const createWarehouse = (data) => api.post('/admin/warehouses', data)

// Inventory
export const adjustInventory = (data) => api.post('/admin/inventory/adjust', data)

// Analytics drill-down
export const fetchRevenueBreakdown = (days = 30) =>
  api.get('/admin/analytics/revenue-breakdown', { params: { days } })
export const fetchStockoutDetails = () => api.get('/admin/analytics/stockout-details')
export const fetchDealerDistribution = () => api.get('/admin/analytics/dealer-distribution')
export const fetchWarehouseUtilization = () => api.get('/admin/analytics/warehouse-utilization')

// Audit logs
export const fetchAuditLogs = (params) => api.get('/admin/audit/logs', { params })
