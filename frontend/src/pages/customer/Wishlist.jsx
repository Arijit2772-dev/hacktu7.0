import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import LoadingSpinner from '../../components/common/LoadingSpinner'
import { useToast } from '../../contexts/ToastContext'
import { fetchWishlist, removeFromWishlist, addToCart } from '../../api/customer'
import { HeartIcon } from '@heroicons/react/24/solid'
import { TrashIcon, ShoppingCartIcon } from '@heroicons/react/24/outline'

export default function Wishlist() {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const toast = useToast()

  const loadWishlist = () => {
    setLoading(true)
    fetchWishlist()
      .then(r => setItems(r.data))
      .catch(err => {
        console.error('Wishlist load failed:', err)
        toast.error('Failed to load wishlist')
      })
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    loadWishlist()
  }, [])

  const handleRemove = (wishlistId) => {
    removeFromWishlist(wishlistId)
      .then(() => {
        toast.success('Removed from wishlist')
        loadWishlist()
      })
      .catch(err => {
        console.error('Remove from wishlist failed:', err)
        toast.error('Failed to remove from wishlist')
      })
  }

  const handleAddToCart = (item) => {
    addToCart(item.sku_id)
      .then(() => {
        toast.success('Added to cart')
      })
      .catch(err => {
        console.error('Add to cart failed:', err)
        toast.error('Failed to add to cart')
      })
  }

  if (loading) return <LoadingSpinner text="Loading wishlist..." />

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">My Wishlist</h1>
        <p className="text-gray-500 mt-1">Shades you love, saved for later</p>
      </div>

      {items.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <HeartIcon className="w-16 h-16 text-gray-300 mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Your wishlist is empty</h2>
          <p className="text-gray-500 mb-6">Browse our shade catalog and save the colors you love.</p>
          <Link
            to="/customer"
            className="bg-orange-600 hover:bg-orange-500 text-white px-6 py-2.5 rounded-lg font-medium transition-colors"
          >
            Browse Shades
          </Link>
        </div>
      ) : (
        <>
          <p className="text-sm text-gray-400">{items.length} shade{items.length !== 1 ? 's' : ''} saved</p>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {items.map(item => (
              <div
                key={item.wishlist_id}
                className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden"
              >
                <div
                  className="h-32 rounded-t-xl"
                  style={{ backgroundColor: item.hex_color }}
                />
                <div className="p-3 space-y-3">
                  <div>
                    <h3 className="text-sm font-semibold text-gray-900 truncate">
                      {item.shade_name}
                    </h3>
                    <p className="text-xs text-gray-500">{item.shade_family}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleRemove(item.wishlist_id)}
                      className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-red-50 hover:bg-red-100 text-red-600 transition-colors"
                    >
                      <TrashIcon className="w-3.5 h-3.5" />
                      Remove
                    </button>
                    <Link
                      to={`/customer/shade/${item.shade_id}`}
                      className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-orange-600 hover:bg-orange-500 text-white transition-colors"
                    >
                      <ShoppingCartIcon className="w-3.5 h-3.5" />
                      View Shade
                    </Link>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
