import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { useAuth } from './AuthContext'
import { useToast } from './ToastContext'
import * as customerApi from '../api/customer'

const CartContext = createContext(null)

export function CartProvider({ children }) {
  const { user } = useAuth()
  const toast = useToast()
  const [cart, setCart] = useState({ items: [], total: 0, count: 0 })
  const [loading, setLoading] = useState(false)

  const refreshCart = useCallback(async () => {
    if (!user || user.role !== 'customer') {
      setCart({ items: [], total: 0, count: 0 })
      return
    }
    setLoading(true)
    try {
      const res = await customerApi.fetchCart()
      setCart(res.data || { items: [], total: 0, count: 0 })
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to load cart')
    } finally {
      setLoading(false)
    }
  }, [user, toast])

  useEffect(() => { refreshCart() }, [refreshCart])

  const cartItems = cart.items || []
  const cartCount = cartItems.reduce((sum, item) => sum + item.quantity, 0)
  const cartTotal = cart.total || cartItems.reduce((sum, item) => sum + (item.mrp * item.quantity), 0)

  const addToCart = async (sku_id, quantity = 1) => {
    try {
      await customerApi.addToCart({ sku_id, quantity })
      toast.success('Added to cart!')
      await refreshCart()
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to add to cart')
    }
  }

  const updateQuantity = async (cartId, quantity) => {
    try {
      await customerApi.updateCartItem(cartId, { quantity })
      await refreshCart()
    } catch (err) {
      toast.error('Failed to update quantity')
    }
  }

  const removeItem = async (cartId) => {
    try {
      await customerApi.removeCartItem(cartId)
      toast.success('Removed from cart')
      await refreshCart()
    } catch (err) {
      toast.error('Failed to remove item')
    }
  }

  const checkout = async (dealerId) => {
    try {
      const res = await customerApi.checkoutCart({ dealer_id: dealerId })
      toast.success('Order placed successfully!')
      setCart({ items: [], total: 0, count: 0 })
      return res.data
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Checkout failed')
      throw err
    }
  }

  return (
    <CartContext.Provider value={{
      cart,
      cartItems,
      cartCount,
      cartTotal,
      addToCart,
      updateQuantity,
      removeItem,
      checkout,
      refreshCart,
      loading,
    }}>
      {children}
    </CartContext.Provider>
  )
}

export const useCart = () => useContext(CartContext)
