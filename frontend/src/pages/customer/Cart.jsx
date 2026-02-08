import { useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import LoadingSpinner from '../../components/common/LoadingSpinner'
import { useToast } from '../../contexts/ToastContext'
import {
  fetchCart,
  updateCartItem,
  removeCartItem,
  fetchNearbyDealers,
  checkoutCart,
} from '../../api/customer'
import { formatCurrency } from '../../utils/formatters'
import {
  TrashIcon,
  MinusIcon,
  PlusIcon,
  ShoppingBagIcon,
} from '@heroicons/react/24/outline'
import { getBrowserLocation, readUserLocation } from '../../utils/location'

export default function Cart() {
  const navigate = useNavigate()
  const toast = useToast()

  const [cart, setCart] = useState(null)
  const [loading, setLoading] = useState(true)
  const [dealers, setDealers] = useState([])
  const [selectedDealerId, setSelectedDealerId] = useState('')
  const [checkingOut, setCheckingOut] = useState(false)
  const [locationMessage, setLocationMessage] = useState('')

  useEffect(() => {
    loadCart()
    loadNearbyDealers()
  }, [])

  function loadCart() {
    setLoading(true)
    fetchCart()
      .then(r => setCart(r.data))
      .catch(err => console.error('Failed to load cart:', err))
      .finally(() => setLoading(false))
  }

  async function loadNearbyDealers() {
    try {
      let coords = readUserLocation()
      if (!coords) coords = await getBrowserLocation()
      const res = await fetchNearbyDealers(coords.lat, coords.lng)
      setDealers(res.data || [])
      setLocationMessage('')
    } catch (err) {
      console.error('Failed to load dealers:', err)
      setDealers([])
      setLocationMessage('Enable location access to load nearby dealers.')
    }
  }

  async function handleUpdateQuantity(cartId, currentQty, delta) {
    const newQty = currentQty + delta
    if (newQty < 1) return
    try {
      await updateCartItem(cartId, newQty)
      loadCart()
    } catch (err) {
      toast.error('Failed to update quantity')
    }
  }

  async function handleRemoveItem(cartId) {
    try {
      await removeCartItem(cartId)
      toast.success('Item removed from cart')
      loadCart()
    } catch (err) {
      toast.error('Failed to remove item')
    }
  }

  async function handleCheckout() {
    if (!selectedDealerId) {
      toast.error('Please select a dealer')
      return
    }
    setCheckingOut(true)
    try {
      await checkoutCart(selectedDealerId)
      toast.success('Order placed successfully!')
      navigate('/customer/orders')
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Checkout failed. Please try again.')
    } finally {
      setCheckingOut(false)
    }
  }

  if (loading) return <LoadingSpinner text="Loading your cart..." />

  const items = cart?.items || []

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <ShoppingBagIcon className="w-16 h-16 text-gray-300 mb-4" />
        <h2 className="text-xl font-semibold text-gray-900 mb-1">Your cart is empty</h2>
        <p className="text-gray-500 mb-6">Looks like you haven't added any shades yet.</p>
        <Link
          to="/customer"
          className="px-6 py-2.5 bg-orange-600 hover:bg-orange-500 text-white font-medium rounded-lg transition-colors"
        >
          Browse Shades
        </Link>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Shopping Cart</h1>
        <p className="text-gray-500 mt-1">{items.length} item{items.length !== 1 ? 's' : ''} in your cart</p>
      </div>

      {/* Cart Items */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 divide-y divide-gray-100">
        {items.map(item => (
          <div key={item.cart_id} className="flex items-center gap-4 p-4">
            {/* Color Swatch */}
            <div
              className="w-14 h-14 rounded-lg border border-gray-200 flex-shrink-0"
              style={{ backgroundColor: item.hex_color || '#ccc' }}
            />

            {/* Item Details */}
            <div className="flex-1 min-w-0">
              <h3 className="text-sm font-semibold text-gray-900 truncate">
                {item.shade_name}
              </h3>
              <p className="text-xs text-gray-500 mt-0.5">
                {item.sku_code} &middot; {item.size}
              </p>
            </div>

            {/* Quantity Controls */}
            <div className="flex items-center gap-1">
              <button
                onClick={() => handleUpdateQuantity(item.cart_id, item.quantity, -1)}
                disabled={item.quantity <= 1}
                className="p-1.5 rounded-md bg-gray-100 hover:bg-gray-200 text-gray-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                <MinusIcon className="w-4 h-4" />
              </button>
              <span className="w-8 text-center text-sm font-medium text-gray-900">
                {item.quantity}
              </span>
              <button
                onClick={() => handleUpdateQuantity(item.cart_id, item.quantity, 1)}
                className="p-1.5 rounded-md bg-gray-100 hover:bg-gray-200 text-gray-600 transition-colors"
              >
                <PlusIcon className="w-4 h-4" />
              </button>
            </div>

            {/* Price */}
            <div className="w-24 text-right">
              <span className="text-sm font-semibold text-gray-900">
                {formatCurrency(item.mrp * item.quantity)}
              </span>
            </div>

            {/* Remove Button */}
            <button
              onClick={() => handleRemoveItem(item.cart_id)}
              className="p-1.5 rounded-md text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors"
            >
              <TrashIcon className="w-5 h-5" />
            </button>
          </div>
        ))}
      </div>

      {/* Total */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 flex items-center justify-between">
        <span className="text-gray-500 font-medium">Total</span>
        <span className="text-xl font-bold text-gray-900">
          {formatCurrency(cart.total)}
        </span>
      </div>

      {/* Checkout Section */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 space-y-4">
        <h2 className="text-lg font-semibold text-gray-900">Checkout</h2>
        <p className="text-sm text-gray-500">Select a nearby dealer to fulfill your order.</p>
        {locationMessage ? (
          <div className="flex items-center justify-between gap-3 rounded-lg border border-orange-200 bg-orange-50 px-3 py-2">
            <p className="text-xs text-orange-700">{locationMessage}</p>
            <button
              onClick={loadNearbyDealers}
              type="button"
              className="text-xs font-medium text-orange-700 hover:text-orange-800"
            >
              Retry
            </button>
          </div>
        ) : null}

        <select
          value={selectedDealerId}
          onChange={e => setSelectedDealerId(e.target.value)}
          className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm text-gray-700 bg-white outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
        >
          <option value="">Choose a dealer...</option>
          {dealers.map(d => (
            <option key={d.id} value={d.id}>
              {d.name} &mdash; {d.city}
            </option>
          ))}
        </select>

        <button
          onClick={handleCheckout}
          disabled={checkingOut || !selectedDealerId}
          className="w-full py-3 bg-orange-600 hover:bg-orange-500 text-white font-semibold rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {checkingOut ? 'Placing Order...' : 'Place Order'}
        </button>
      </div>
    </div>
  )
}
