import { useState, useEffect } from 'react'
import { PlusIcon, PencilIcon, TrashIcon } from '@heroicons/react/24/outline'
import DataTable from '../../components/common/DataTable'
import Modal from '../../components/common/Modal'
import ConfirmDialog from '../../components/common/ConfirmDialog'
import FormInput from '../../components/common/FormInput'
import LoadingSpinner from '../../components/common/LoadingSpinner'
import { useToast } from '../../contexts/ToastContext'
import {
  fetchProducts, createProduct, updateProduct, deleteProduct,
} from '../../api/admin'

const CATEGORIES = ['Interior Wall', 'Exterior Wall', 'Wood & Metal', 'Waterproofing']
const FINISHES = ['Matt', 'Soft Sheen', 'High Gloss', 'Satin']

export default function ProductManagement() {
  const [products, setProducts] = useState([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editProduct, setEditProduct] = useState(null)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [form, setForm] = useState({ name: '', category: 'Interior Wall', finish: 'Matt', price_per_litre: '' })
  const [saving, setSaving] = useState(false)
  const toast = useToast()

  const load = () => {
    fetchProducts()
      .then(r => setProducts(r.data))
      .catch(err => toast.error(err.response?.data?.detail || 'Failed to load products'))
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  const openAdd = () => {
    setEditProduct(null)
    setForm({ name: '', category: 'Interior Wall', finish: 'Matt', price_per_litre: '' })
    setShowModal(true)
  }

  const openEdit = (product) => {
    setEditProduct(product)
    setForm({
      name: product.name,
      category: product.category,
      finish: product.finish,
      price_per_litre: product.price_per_litre,
    })
    setShowModal(true)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSaving(true)
    try {
      const data = { ...form, price_per_litre: parseFloat(form.price_per_litre) }
      if (editProduct) {
        await updateProduct(editProduct.id, data)
        toast.success(`Product "${form.name}" updated`)
      } else {
        await createProduct(data)
        toast.success(`Product "${form.name}" created`)
      }
      setShowModal(false)
      load()
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Operation failed')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    try {
      await deleteProduct(deleteTarget.id)
      toast.success(`Product "${deleteTarget.name}" deleted`)
      setDeleteTarget(null)
      load()
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Delete failed')
    }
  }

  if (loading) return <LoadingSpinner />

  const columns = [
    { key: 'id', label: 'ID', render: v => <span className="text-gray-500 font-mono">#{v}</span> },
    { key: 'name', label: 'Product Name', render: v => <span className="text-white font-medium">{v}</span> },
    { key: 'category', label: 'Category' },
    { key: 'finish', label: 'Finish' },
    {
      key: 'price_per_litre', label: 'Price/L',
      render: v => <span className="font-mono text-emerald-400">{v?.toLocaleString('en-IN', { style: 'currency', currency: 'INR' })}</span>
    },
    { key: 'shade_count', label: 'Shades', render: v => v || 0 },
    {
      key: 'id', label: 'Actions',
      render: (_, row) => (
        <div className="flex gap-2">
          <button onClick={() => openEdit(row)} className="p-1 text-blue-400 hover:text-blue-300">
            <PencilIcon className="w-4 h-4" />
          </button>
          <button onClick={() => setDeleteTarget(row)} className="p-1 text-red-400 hover:text-red-300">
            <TrashIcon className="w-4 h-4" />
          </button>
        </div>
      ),
    },
  ]

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Product Management</h1>
          <p className="text-sm text-gray-500 mt-1">{products.length} products</p>
        </div>
        <button
          onClick={openAdd}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm font-medium transition-colors"
        >
          <PlusIcon className="w-4 h-4" />
          Add Product
        </button>
      </div>

      <DataTable columns={columns} data={products} />

      {/* Add/Edit Modal */}
      <Modal open={showModal} onClose={() => setShowModal(false)} title={editProduct ? 'Edit Product' : 'Add Product'}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <FormInput
            label="Product Name" required value={form.name}
            onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
            placeholder="e.g. Premium Interior Emulsion"
          />
          <FormInput label="Category" type="select" value={form.category}
            onChange={e => setForm(f => ({ ...f, category: e.target.value }))}>
            {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
          </FormInput>
          <FormInput label="Finish" type="select" value={form.finish}
            onChange={e => setForm(f => ({ ...f, finish: e.target.value }))}>
            {FINISHES.map(f => <option key={f} value={f}>{f}</option>)}
          </FormInput>
          <FormInput
            label="Price per Litre" type="number" required value={form.price_per_litre}
            onChange={e => setForm(f => ({ ...f, price_per_litre: e.target.value }))}
            placeholder="e.g. 350" min="0" step="0.01"
          />
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={() => setShowModal(false)}
              className="px-4 py-2 bg-gray-800 text-gray-300 rounded-lg text-sm">
              Cancel
            </button>
            <button type="submit" disabled={saving}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm disabled:opacity-50">
              {saving ? 'Saving...' : editProduct ? 'Update' : 'Create'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Delete Confirmation */}
      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Delete Product"
        message={`Are you sure you want to delete "${deleteTarget?.name}"? This will also remove all associated shades and SKUs.`}
        confirmLabel="Delete"
      />
    </div>
  )
}
