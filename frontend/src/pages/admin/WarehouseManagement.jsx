import { useState, useEffect } from 'react'
import { PlusIcon, AdjustmentsHorizontalIcon } from '@heroicons/react/24/outline'
import DataTable from '../../components/common/DataTable'
import Modal from '../../components/common/Modal'
import FormInput from '../../components/common/FormInput'
import LoadingSpinner from '../../components/common/LoadingSpinner'
import { useToast } from '../../contexts/ToastContext'
import { fetchWarehouses, createWarehouse, adjustInventory } from '../../api/admin'

export default function WarehouseManagement() {
  const [warehouses, setWarehouses] = useState([])
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [showAdjust, setShowAdjust] = useState(null)
  const [createForm, setCreateForm] = useState({
    name: '', code: '', region_id: 1, city: '', state: '',
    latitude: '', longitude: '', capacity_litres: 500000,
  })
  const [adjustForm, setAdjustForm] = useState({ sku_id: '', adjustment: '', reason: '' })
  const [saving, setSaving] = useState(false)
  const toast = useToast()

  const load = () => {
    fetchWarehouses()
      .then(r => setWarehouses(r.data))
      .catch(err => toast.error('Failed to load warehouses'))
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  const handleCreate = async (e) => {
    e.preventDefault()
    setSaving(true)
    try {
      await createWarehouse({
        ...createForm,
        latitude: parseFloat(createForm.latitude),
        longitude: parseFloat(createForm.longitude),
        capacity_litres: parseInt(createForm.capacity_litres),
      })
      toast.success('Warehouse created')
      setShowCreate(false)
      load()
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to create warehouse')
    } finally {
      setSaving(false)
    }
  }

  const handleAdjust = async (e) => {
    e.preventDefault()
    setSaving(true)
    try {
      const res = await adjustInventory({
        warehouse_id: showAdjust.id,
        sku_id: parseInt(adjustForm.sku_id),
        adjustment: parseInt(adjustForm.adjustment),
        reason: adjustForm.reason,
      })
      toast.success(res.data.message)
      setShowAdjust(null)
      setAdjustForm({ sku_id: '', adjustment: '', reason: '' })
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Adjustment failed')
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <LoadingSpinner />

  const columns = [
    { key: 'id', label: 'ID', render: v => <span className="text-gray-500 font-mono">#{v}</span> },
    { key: 'name', label: 'Warehouse', render: v => <span className="text-white font-medium">{v}</span> },
    { key: 'code', label: 'Code', render: v => <span className="font-mono text-xs text-gray-400">{v}</span> },
    { key: 'city', label: 'City' },
    { key: 'state', label: 'State' },
    {
      key: 'capacity_litres', label: 'Capacity',
      render: v => <span className="font-mono">{(v / 1000).toLocaleString()}K L</span>
    },
    { key: 'sku_count', label: 'SKUs', render: v => v || 0 },
    {
      key: 'id', label: 'Actions',
      render: (_, row) => (
        <button
          onClick={() => { setShowAdjust(row); setAdjustForm({ sku_id: '', adjustment: '', reason: '' }) }}
          className="flex items-center gap-1 px-3 py-1 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded text-xs transition-colors"
        >
          <AdjustmentsHorizontalIcon className="w-3 h-3" />
          Adjust
        </button>
      ),
    },
  ]

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Warehouse Management</h1>
          <p className="text-sm text-gray-500 mt-1">{warehouses.length} warehouses</p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm font-medium transition-colors"
        >
          <PlusIcon className="w-4 h-4" />
          Add Warehouse
        </button>
      </div>

      <DataTable columns={columns} data={warehouses} />

      {/* Create Warehouse Modal */}
      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="Add Warehouse" size="lg">
        <form onSubmit={handleCreate} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <FormInput label="Name" required value={createForm.name}
              onChange={e => setCreateForm(f => ({ ...f, name: e.target.value }))}
              placeholder="e.g. Delhi Hub" />
            <FormInput label="Code" required value={createForm.code}
              onChange={e => setCreateForm(f => ({ ...f, code: e.target.value }))}
              placeholder="e.g. WH-DEL-02" />
            <FormInput label="City" required value={createForm.city}
              onChange={e => setCreateForm(f => ({ ...f, city: e.target.value }))} />
            <FormInput label="State" required value={createForm.state}
              onChange={e => setCreateForm(f => ({ ...f, state: e.target.value }))} />
            <FormInput label="Latitude" type="number" required value={createForm.latitude}
              onChange={e => setCreateForm(f => ({ ...f, latitude: e.target.value }))} step="0.01" />
            <FormInput label="Longitude" type="number" required value={createForm.longitude}
              onChange={e => setCreateForm(f => ({ ...f, longitude: e.target.value }))} step="0.01" />
            <FormInput label="Region ID" type="number" required value={createForm.region_id}
              onChange={e => setCreateForm(f => ({ ...f, region_id: parseInt(e.target.value) }))} min="1" />
            <FormInput label="Capacity (litres)" type="number" value={createForm.capacity_litres}
              onChange={e => setCreateForm(f => ({ ...f, capacity_litres: e.target.value }))} />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={() => setShowCreate(false)}
              className="px-4 py-2 bg-gray-800 text-gray-300 rounded-lg text-sm">Cancel</button>
            <button type="submit" disabled={saving}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm disabled:opacity-50">
              {saving ? 'Creating...' : 'Create Warehouse'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Inventory Adjustment Modal */}
      <Modal open={!!showAdjust} onClose={() => setShowAdjust(null)}
        title={`Adjust Inventory — ${showAdjust?.name}`}>
        <form onSubmit={handleAdjust} className="space-y-4">
          <FormInput label="SKU ID" type="number" required value={adjustForm.sku_id}
            onChange={e => setAdjustForm(f => ({ ...f, sku_id: e.target.value }))}
            placeholder="Enter SKU ID" min="1" />
          <FormInput label="Adjustment (+/-)" type="number" required value={adjustForm.adjustment}
            onChange={e => setAdjustForm(f => ({ ...f, adjustment: e.target.value }))}
            placeholder="e.g. +100 or -50" />
          <FormInput label="Reason" type="textarea" required value={adjustForm.reason}
            onChange={e => setAdjustForm(f => ({ ...f, reason: e.target.value }))}
            placeholder="Reason for adjustment" />
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={() => setShowAdjust(null)}
              className="px-4 py-2 bg-gray-800 text-gray-300 rounded-lg text-sm">Cancel</button>
            <button type="submit" disabled={saving}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-sm disabled:opacity-50">
              {saving ? 'Adjusting...' : 'Apply Adjustment'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
