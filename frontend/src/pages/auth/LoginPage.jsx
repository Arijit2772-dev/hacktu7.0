import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { login } from '../../api/auth'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const { loginUser } = useAuth()
  const navigate = useNavigate()

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const res = await login({ email, password })
      loginUser(res.data)
      const role = res.data.user.role
      const redirects = { admin: '/admin', dealer: '/dealer', customer: '/customer' }
      navigate(redirects[role] || '/')
    } catch (err) {
      setError(err.response?.data?.detail || 'Login failed. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Link to="/" className="text-3xl font-bold text-white">
            Paint<span className="text-blue-400">Flow</span>.ai
          </Link>
          <p className="text-gray-500 mt-2">Sign in to your account</p>
        </div>

        <form onSubmit={handleSubmit} className="bg-gray-900 rounded-2xl p-8 border border-gray-800 space-y-5">
          {error && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-lg px-4 py-3 text-sm text-red-400">
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm text-gray-400 mb-1.5">Email</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              className="w-full px-4 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 transition-colors"
              placeholder="you@example.com"
            />
          </div>

          <div>
            <label className="block text-sm text-gray-400 mb-1.5">Password</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              className="w-full px-4 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 transition-colors"
              placeholder="Enter your password"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg font-medium transition-colors"
          >
            {loading ? 'Signing in...' : 'Sign In'}
          </button>

          <p className="text-center text-sm text-gray-500">
            Don't have an account?{' '}
            <Link to="/register" className="text-blue-400 hover:text-blue-300">
              Register
            </Link>
          </p>

          {/* Demo credentials */}
          <div className="border-t border-gray-800 pt-4 mt-4">
            <p className="text-xs text-gray-600 mb-2 text-center">Demo Accounts</p>
            <div className="grid grid-cols-3 gap-2">
              {[
                { label: 'Admin', email: 'admin@paintflow.ai', pass: 'admin123' },
                { label: 'Dealer', email: 'dealer1@paintflow.ai', pass: 'dealer123' },
                { label: 'Customer', email: 'rahul@example.com', pass: 'customer123' },
              ].map(demo => (
                <button
                  key={demo.label}
                  type="button"
                  onClick={() => { setEmail(demo.email); setPassword(demo.pass) }}
                  className="px-2 py-1.5 bg-gray-800 hover:bg-gray-700 border border-gray-700 rounded text-xs text-gray-400 hover:text-white transition-colors"
                >
                  {demo.label}
                </button>
              ))}
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}
