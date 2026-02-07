import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { register, fetchDealersList } from '../../api/auth'

export default function RegisterPage() {
  const [form, setForm] = useState({
    full_name: '', email: '', phone: '', password: '', confirmPassword: '',
    role: 'customer', dealer_id: null,
  })
  const [dealers, setDealers] = useState([])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const { loginUser } = useAuth()
  const navigate = useNavigate()

  useEffect(() => {
    fetchDealersList().then(r => setDealers(r.data)).catch(() => {})
  }, [])

  const set = (key) => (e) => setForm(f => ({ ...f, [key]: e.target.value }))

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')

    if (form.password !== form.confirmPassword) {
      setError('Passwords do not match')
      return
    }
    if (form.password.length < 6) {
      setError('Password must be at least 6 characters')
      return
    }
    if (form.role === 'dealer' && !form.dealer_id) {
      setError('Please select your dealer')
      return
    }

    setLoading(true)
    try {
      const res = await register({
        email: form.email,
        password: form.password,
        full_name: form.full_name,
        phone: form.phone || null,
        role: form.role,
        dealer_id: form.role === 'dealer' ? parseInt(form.dealer_id) : null,
      })
      loginUser(res.data)
      const redirects = { admin: '/admin', dealer: '/dealer', customer: '/customer' }
      navigate(redirects[form.role] || '/')
    } catch (err) {
      setError(err.response?.data?.detail || 'Registration failed.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Link to="/" className="text-3xl font-bold text-white">
            Paint<span className="text-blue-400">Flow</span>.ai
          </Link>
          <p className="text-gray-500 mt-2">Create your account</p>
        </div>

        <form onSubmit={handleSubmit} className="bg-gray-900 rounded-2xl p-8 border border-gray-800 space-y-4">
          {error && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-lg px-4 py-3 text-sm text-red-400">
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm text-gray-400 mb-1.5">Full Name</label>
            <input
              type="text" required value={form.full_name} onChange={set('full_name')}
              className="w-full px-4 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
              placeholder="Your full name"
            />
          </div>

          <div>
            <label className="block text-sm text-gray-400 mb-1.5">Email</label>
            <input
              type="email" required value={form.email} onChange={set('email')}
              className="w-full px-4 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
              placeholder="you@example.com"
            />
          </div>

          <div>
            <label className="block text-sm text-gray-400 mb-1.5">Phone (optional)</label>
            <input
              type="tel" value={form.phone} onChange={set('phone')}
              className="w-full px-4 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
              placeholder="9876543210"
            />
          </div>

          <div>
            <label className="block text-sm text-gray-400 mb-1.5">Role</label>
            <div className="grid grid-cols-3 gap-2">
              {['customer', 'dealer', 'admin'].map(role => (
                <button
                  key={role} type="button"
                  onClick={() => setForm(f => ({ ...f, role, dealer_id: null }))}
                  className={`py-2 rounded-lg text-sm font-medium transition-colors border ${
                    form.role === role
                      ? 'bg-blue-600/20 border-blue-500 text-blue-400'
                      : 'bg-gray-800 border-gray-700 text-gray-400 hover:border-gray-600'
                  }`}
                >
                  {role.charAt(0).toUpperCase() + role.slice(1)}
                </button>
              ))}
            </div>
          </div>

          {form.role === 'dealer' && (
            <div>
              <label className="block text-sm text-gray-400 mb-1.5">Select Dealer</label>
              <select
                value={form.dealer_id || ''} onChange={set('dealer_id')}
                className="w-full px-4 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-blue-500"
              >
                <option value="">Choose dealer...</option>
                {dealers.map(d => (
                  <option key={d.id} value={d.id}>{d.name} ({d.code}) — {d.city}</option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label className="block text-sm text-gray-400 mb-1.5">Password</label>
            <input
              type="password" required value={form.password} onChange={set('password')}
              className="w-full px-4 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
              placeholder="Min 6 characters"
            />
          </div>

          <div>
            <label className="block text-sm text-gray-400 mb-1.5">Confirm Password</label>
            <input
              type="password" required value={form.confirmPassword} onChange={set('confirmPassword')}
              className="w-full px-4 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
              placeholder="Repeat password"
            />
          </div>

          <button
            type="submit" disabled={loading}
            className="w-full py-3 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded-lg font-medium transition-colors"
          >
            {loading ? 'Creating account...' : 'Create Account'}
          </button>

          <p className="text-center text-sm text-gray-500">
            Already have an account?{' '}
            <Link to="/login" className="text-blue-400 hover:text-blue-300">Sign in</Link>
          </p>
        </form>
      </div>
    </div>
  )
}
