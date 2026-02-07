import { useState, useEffect } from 'react'
import LoadingSpinner from '../../components/common/LoadingSpinner'
import { useAuth } from '../../contexts/AuthContext'
import { fetchDealerProfile } from '../../api/dealer'
import { formatCurrency } from '../../utils/formatters'

export default function Profile() {
  const { user } = useAuth()
  const dealerId = user?.dealer_id || 1
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchDealerProfile(dealerId)
      .then(r => setProfile(r.data))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [dealerId])

  if (loading) return <LoadingSpinner />
  if (!profile) return <p className="text-gray-500">Profile not found</p>

  const tierColors = {
    Platinum: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
    Gold: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
    Silver: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
  }

  return (
    <div className="max-w-2xl space-y-6">
      <h1 className="text-2xl font-bold text-white">Dealer Profile</h1>

      <div className="glass rounded-xl p-6 border border-gray-800 space-y-6">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-full bg-emerald-600/20 flex items-center justify-center text-2xl font-bold text-emerald-400">
            {profile.name?.charAt(0)}
          </div>
          <div>
            <h2 className="text-xl font-bold text-white">{profile.name}</h2>
            <p className="text-sm text-gray-400">{profile.code} | {profile.city}, {profile.state}</p>
          </div>
          <span className={`ml-auto px-3 py-1 rounded-full text-xs font-medium border ${tierColors[profile.tier]}`}>
            {profile.tier}
          </span>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <div className="bg-gray-800/50 rounded-lg p-4">
            <span className="text-xs text-gray-500">Credit Limit</span>
            <p className="text-lg font-bold text-white">{formatCurrency(profile.credit_limit)}</p>
          </div>
          <div className="bg-gray-800/50 rounded-lg p-4">
            <span className="text-xs text-gray-500">Performance Score</span>
            <p className="text-lg font-bold text-emerald-400">{profile.performance_score?.toFixed(1)}</p>
          </div>
          <div className="bg-gray-800/50 rounded-lg p-4">
            <span className="text-xs text-gray-500">Region</span>
            <p className="text-lg font-bold text-white">Region #{profile.region_id}</p>
          </div>
        </div>

        <div className="border-t border-gray-800 pt-4">
          <p className="text-xs text-gray-600 mb-1">Account Email</p>
          <p className="text-sm text-gray-300">{user?.email}</p>
        </div>
      </div>
    </div>
  )
}
