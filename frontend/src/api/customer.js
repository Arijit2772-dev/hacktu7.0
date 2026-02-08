import api from './client'

// Public endpoints
export const fetchShades = (params) => api.get('/customer/shades', { params })
export const fetchShadeDetail = (id) => api.get(`/customer/shades/${id}`)
export const fetchShadeAvailability = (id, lat, lng) =>
  api.get(`/customer/shades/${id}/availability`, { params: { lat, lng } })
export const fetchNearbyDealers = (lat, lng) =>
  api.get('/customer/dealers/nearby', { params: { lat, lng } })
export const snapAndFind = (hexColor) =>
  api.post('/customer/snap-find', null, { params: { hex_color: hexColor } })
export const createOrderRequest = (data) => api.post('/customer/order-request', data)

// Authenticated endpoints (cart, wishlist, orders)
export const fetchCart = () => api.get('/customer/me/cart')
export const addToCart = (skuOrPayload, quantity = 1) => {
  const payload = typeof skuOrPayload === 'object'
    ? skuOrPayload
    : { sku_id: skuOrPayload, quantity }
  return api.post('/customer/me/cart', payload)
}
export const updateCartItem = (cartId, quantityOrPayload) => {
  const payload = typeof quantityOrPayload === 'object'
    ? quantityOrPayload
    : { quantity: quantityOrPayload }
  return api.put(`/customer/me/cart/${cartId}`, payload)
}
export const removeCartItem = (cartId) =>
  api.delete(`/customer/me/cart/${cartId}`)

export const fetchWishlist = () => api.get('/customer/me/wishlist')
export const addToWishlist = (shadeId) =>
  api.post(`/customer/me/wishlist/${shadeId}`)
export const removeFromWishlist = (wishlistId) =>
  api.delete(`/customer/me/wishlist/${wishlistId}`)

export const checkoutCart = (dealerIdOrPayload) => {
  const payload = typeof dealerIdOrPayload === 'object'
    ? dealerIdOrPayload
    : { dealer_id: dealerIdOrPayload }
  return api.post('/customer/me/checkout', payload)
}
export const fetchMyOrders = () => api.get('/customer/me/orders')
export const fetchMyOrderDetail = (orderId) =>
  api.get(`/customer/me/orders/${orderId}`)
