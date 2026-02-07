import { Navigate } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import LoadingSpinner from '../common/LoadingSpinner'

export default function ProtectedRoute({ role, children }) {
  const { user, loading, isAuthenticated } = useAuth()

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-950">
        <LoadingSpinner />
      </div>
    )
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />
  }

  if (role && user.role !== role) {
    // Redirect to user's own portal
    const roleRedirects = { admin: '/admin', dealer: '/dealer', customer: '/customer' }
    return <Navigate to={roleRedirects[user.role] || '/'} replace />
  }

  return children
}
