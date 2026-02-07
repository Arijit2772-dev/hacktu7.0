import Modal from './Modal'

export default function ConfirmDialog({
  open, onClose, onConfirm, title = 'Confirm Action',
  message = 'Are you sure?', confirmLabel = 'Confirm',
  confirmColor = 'red', loading = false,
}) {
  const colors = {
    red: 'bg-red-600 hover:bg-red-500',
    blue: 'bg-blue-600 hover:bg-blue-500',
    green: 'bg-emerald-600 hover:bg-emerald-500',
  }

  return (
    <Modal open={open} onClose={onClose} title={title} size="sm">
      <p className="text-gray-400 text-sm mb-6">{message}</p>
      <div className="flex gap-3 justify-end">
        <button
          onClick={onClose}
          className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg text-sm transition-colors"
        >
          Cancel
        </button>
        <button
          onClick={onConfirm}
          disabled={loading}
          className={`px-4 py-2 text-white rounded-lg text-sm transition-colors disabled:opacity-50 ${colors[confirmColor]}`}
        >
          {loading ? 'Processing...' : confirmLabel}
        </button>
      </div>
    </Modal>
  )
}
