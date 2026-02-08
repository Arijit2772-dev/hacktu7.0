import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { CheckCircleIcon } from '@heroicons/react/24/outline'
import FormInput from '../../components/common/FormInput'
import { useAuth } from '../../contexts/AuthContext'
import { useToast } from '../../contexts/ToastContext'
import { placeOrder } from '../../api/dealer'

export default function PlaceOrder() {
  const { user } = useAuth()
  const toast = useToast()
  const navigate = useNavigate()
  const [form, setForm] = useState({ sku_id: '', quantity: '' })
  const [saving, setSaving] = useState(false)
  const [success, setSuccess] = useState(null)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSaving(true)
    try {
      const res = await placeOrder({
        sku_id: parseInt(form.sku_id),
        quantity: parseInt(form.quantity),
      })
      setSuccess(res.data)
      toast.success('Order placed successfully!')
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to place order')
    } finally {
      setSaving(false)
    }
  }

  if (success) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <div className="glass rounded-2xl p-10 border border-emerald-500/30 text-center max-w-md">
          <CheckCircleIcon className="w-16 h-16 text-emerald-400 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-white mb-2">Order Placed!</h2>
          <p className="text-gray-400 mb-4">Order #{success.order_id} has been placed.</p>
          <div className="flex gap-3 justify-center">
            <button
              onClick={() => { setSuccess(null); setForm({ sku_id: '', quantity: '' }) }}
              className="px-4 py-2 bg-gray-800 text-gray-300 rounded-lg text-sm"
            >
              Place Another
            </button>
            <button
              onClick={() => navigate('/dealer/orders')}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-sm"
            >
              View Orders
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-lg">
      <h1 className="text-2xl font-bold text-white mb-2">Place Order</h1>
      <p className="text-sm text-gray-500 mb-6">Manually order paint SKUs for your store</p>

      <form onSubmit={handleSubmit} className="glass rounded-xl p-6 border border-gray-800 space-y-4">
        <FormInput
          label="SKU ID" type="number" required value={form.sku_id}
          onChange={e => setForm(f => ({ ...f, sku_id: e.target.value }))}
          placeholder="Enter SKU ID" min="1"
        />
        <FormInput
          label="Quantity" type="number" required value={form.quantity}
          onChange={e => setForm(f => ({ ...f, quantity: e.target.value }))}
          placeholder="Number of units" min="1"
        />
        <button
          type="submit" disabled={saving}
          className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded-lg font-medium transition-colors"
        >
          {saving ? 'Placing Order...' : 'Place Order'}
        </button>
      </form>
    </div>
  )
}
