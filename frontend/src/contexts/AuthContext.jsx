import { createContext, useContext, useState, useEffect } from 'react'
import { getMe } from '../api/auth'
import api from '../api/client'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [token, setToken] = useState(() => localStorage.getItem('pf_token'))
  const [loading, setLoading] = useState(true)

  // Set auth header on token change
  useEffect(() => {
    if (token) {
      api.defaults.headers.common['Authorization'] = `Bearer ${token}`
      localStorage.setItem('pf_token', token)
    } else {
      delete api.defaults.headers.common['Authorization']
      localStorage.removeItem('pf_token')
    }
  }, [token])

  // Validate token on mount
  useEffect(() => {
    if (!token) {
      setLoading(false)
      return
    }
    api.defaults.headers.common['Authorization'] = `Bearer ${token}`
    getMe()
      .then(res => setUser(res.data))
      .catch(() => {
        setToken(null)
        setUser(null)
      })
      .finally(() => setLoading(false))
  }, [])

  const loginUser = (tokenData) => {
    setToken(tokenData.access_token)
    setUser(tokenData.user)
  }

  const logout = () => {
    setToken(null)
    setUser(null)
  }

  // Interceptor: redirect on 401
  useEffect(() => {
    const interceptor = api.interceptors.response.use(
      res => res,
      err => {
        if (err.response?.status === 401 && token) {
          logout()
        }
        return Promise.reject(err)
      }
    )
    return () => api.interceptors.response.eject(interceptor)
  }, [token])

  return (
    <AuthContext.Provider value={{
      user,
      token,
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
