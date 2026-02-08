import api from './client'

export const login = (data) => api.post('/auth/login', data)
export const register = (data) => api.post('/auth/register', data)
export const refreshSession = (data) => api.post('/auth/refresh', data)
export const logoutSession = (data) => api.post('/auth/logout', data)
export const getMe = () => api.get('/auth/me')
export const updateMe = (data) => api.put('/auth/me', data)
export const fetchDealersList = () => api.get('/auth/dealers-list')
