export default function FormInput({
  label, type = 'text', value, onChange, placeholder,
  required = false, error, className = '', ...props
}) {
  return (
    <div className={className}>
      {label && (
        <label className="block text-sm text-gray-400 mb-1.5">
          {label} {required && <span className="text-red-400">*</span>}
        </label>
      )}
      {type === 'textarea' ? (
        <textarea
          value={value} onChange={onChange} placeholder={placeholder} required={required}
          className="w-full px-4 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 resize-none"
          rows={3}
          {...props}
        />
      ) : type === 'select' ? (
        <select
          value={value} onChange={onChange} required={required}
          className="w-full px-4 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-blue-500"
          {...props}
        >
          {props.children}
        </select>
      ) : (
        <input
          type={type} value={value} onChange={onChange} placeholder={placeholder} required={required}
          className="w-full px-4 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
          {...props}
        />
      )}
      {error && <p className="text-xs text-red-400 mt-1">{error}</p>}
    </div>
  )
}
