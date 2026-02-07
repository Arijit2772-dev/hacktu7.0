import axios from 'axios'

const api = axios.create({
  baseURL: '/api',
  timeout: 10000,
})

// Global error handler — shows console error for silent catches
api.interceptors.response.use(
  res => res,
  err => {
    const msg = err.response?.data?.detail || err.message || 'Something went wrong'
    // Log to console so silent catches still surface errors
    if (err.response?.status !== 401) {
      console.error(`[API Error] ${err.config?.method?.toUpperCase()} ${err.config?.url}: ${msg}`)
    }
    return Promise.reject(err)
  }
)

export default api
