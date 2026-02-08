import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import { getMe, logoutSession, refreshSession } from '../api/auth'
import api from '../api/client'

const ACCESS_TOKEN_KEY = 'pf_token'
const REFRESH_TOKEN_KEY = 'pf_refresh_token'

const AuthContext = createContext(null)

function isAuthEndpoint(url = '') {
  return (
    url.includes('/auth/login')
    || url.includes('/auth/register')
    || url.includes('/auth/refresh')
    || url.includes('/auth/logout')
  )
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [token, setToken] = useState(() => localStorage.getItem(ACCESS_TOKEN_KEY))
  const [refreshToken, setRefreshToken] = useState(() => localStorage.getItem(REFRESH_TOKEN_KEY))
  const [loading, setLoading] = useState(true)

  const authRef = useRef({ token, refreshToken })
  const refreshInFlightRef = useRef(null)

  useEffect(() => {
    authRef.current = { token, refreshToken }
  }, [token, refreshToken])

  useEffect(() => {
    if (token) {
      api.defaults.headers.common.Authorization = `Bearer ${token}`
      localStorage.setItem(ACCESS_TOKEN_KEY, token)
    } else {
      delete api.defaults.headers.common.Authorization
      localStorage.removeItem(ACCESS_TOKEN_KEY)
    }
  }, [token])

  useEffect(() => {
    if (refreshToken) localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken)
    else localStorage.removeItem(REFRESH_TOKEN_KEY)
  }, [refreshToken])

  const clearSession = useCallback(() => {
    setToken(null)
    setRefreshToken(null)
    setUser(null)
  }, [])

  const applyTokenData = useCallback((tokenData) => {
    if (tokenData?.access_token) setToken(tokenData.access_token)
    if (tokenData?.refresh_token) setRefreshToken(tokenData.refresh_token)
    if (tokenData?.user) setUser(tokenData.user)
  }, [])

  const refreshAccess = useCallback(async () => {
    const currentRefreshToken = authRef.current.refreshToken
    if (!currentRefreshToken) throw new Error('No refresh token')

    if (refreshInFlightRef.current) return refreshInFlightRef.current

    refreshInFlightRef.current = refreshSession({ refresh_token: currentRefreshToken })
      .then((res) => {
        applyTokenData(res.data)
        return res.data.access_token
      })
      .catch((err) => {
        clearSession()
        throw err
      })
      .finally(() => {
        refreshInFlightRef.current = null
      })

    return refreshInFlightRef.current
  }, [applyTokenData, clearSession])

  useEffect(() => {
    let mounted = true
    ;(async () => {
      const hasAccessToken = !!authRef.current.token
      const hasRefreshToken = !!authRef.current.refreshToken
      if (!hasAccessToken && !hasRefreshToken) {
        if (mounted) setLoading(false)
        return
      }

      try {
        if (!hasAccessToken && hasRefreshToken) {
          await refreshAccess()
        }
        const me = await getMe()
        if (mounted) setUser(me.data)
      } catch {
        clearSession()
      } finally {
        if (mounted) setLoading(false)
      }
    })()

    return () => { mounted = false }
  }, [clearSession, refreshAccess])

  const loginUser = useCallback((tokenData) => {
    applyTokenData(tokenData)
  }, [applyTokenData])

  const logout = useCallback(async () => {
    const currentRefreshToken = authRef.current.refreshToken
    if (currentRefreshToken) {
      try {
        await logoutSession({ refresh_token: currentRefreshToken })
      } catch {
        // Best-effort revoke only.
      }
    }
    clearSession()
  }, [clearSession])

  useEffect(() => {
    const interceptor = api.interceptors.response.use(
      (res) => res,
      async (err) => {
        const status = err.response?.status
        const original = err.config || {}
        if (status !== 401 || original._retry || isAuthEndpoint(original.url)) {
          return Promise.reject(err)
        }

        if (!authRef.current.refreshToken) {
          clearSession()
          return Promise.reject(err)
        }

        original._retry = true
        try {
          const newAccessToken = await refreshAccess()
          original.headers = original.headers || {}
          original.headers.Authorization = `Bearer ${newAccessToken}`
          return api.request(original)
        } catch (refreshErr) {
          return Promise.reject(refreshErr)
        }
      }
    )

    return () => api.interceptors.response.eject(interceptor)
  }, [clearSession, refreshAccess])

  return (
    <AuthContext.Provider value={{
      user,
      token,
      refreshToken,
      loading,
      isAuthenticated: !!user,
      loginUser,
      logout,
    }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
