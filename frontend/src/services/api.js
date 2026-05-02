import axios from 'axios'

const api = axios.create({
  baseURL: '/api',
  headers: { 'Content-Type': 'application/json' },
})

// Attach access token to every request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('access_token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

// Auto-refresh token on 401
api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error.config
    if (error.response?.status === 401 && !original._retry) {
      original._retry = true
      const refresh = localStorage.getItem('refresh_token')
      if (refresh) {
        try {
          const res = await axios.post('/api/users/token/refresh/', { refresh })
          localStorage.setItem('access_token', res.data.access)
          original.headers.Authorization = `Bearer ${res.data.access}`
          return api(original)
        } catch {
          localStorage.removeItem('access_token')
          localStorage.removeItem('refresh_token')
          window.location.href = '/login'
        }
      }
    }
    return Promise.reject(error)
  }
)

// spatial_data app
export const ownersApi = {
  list: (params) => api.get('/owners/', { params }),
  get: (id) => api.get(`/owners/${id}/`),
  create: (data) => api.post('/owners/', data),
  update: (id, data) => api.put(`/owners/${id}/`, data),
  delete: (id) => api.delete(`/owners/${id}/`),
}

export const claimsApi = {
  list: (params) => api.get('/mine-claims/', { params }),
  get: (id) => api.get(`/mine-claims/${id}/`),
  create: (data) => api.post('/mine-claims/', data),
  update: (id, data) => api.put(`/mine-claims/${id}/`, data),
  delete: (id) => api.delete(`/mine-claims/${id}/`),
}

export const parcelsApi = {
  list: (params) => api.get('/farm-parcels/', { params }),
  get: (id) => api.get(`/farm-parcels/${id}/`),
  create: (data) => api.post('/farm-parcels/', data),
  update: (id, data) => api.put(`/farm-parcels/${id}/`, data),
  delete: (id) => api.delete(`/farm-parcels/${id}/`),
}

export const trigStationsApi = {
  list: () => api.get('/trig-stations/'),
  upload: (formData) => api.post('/trig-stations/upload/', formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  }),
  delete: (id) => api.delete(`/trig-stations/${id}/`),
}

export const boundariesApi = {
  list: (params) => api.get('/boundaries/', { params }),
  get: (id) => api.get(`/boundaries/${id}/`),
}

// disputes app
export const disputesApi = {
  list: (params) => api.get('/disputes/', { params }),
  get: (id) => api.get(`/disputes/${id}/`),
  update: (id, data) => api.put(`/disputes/${id}/`, data),
  delete: (id) => api.delete(`/disputes/${id}/`),
}

export const mineDisputesApi = {
  list: (params) => api.get('/mine-disputes/', { params }),
  get: (id) => api.get(`/mine-disputes/${id}/`),
  update: (id, data) => api.put(`/mine-disputes/${id}/`, data),
  delete: (id) => api.delete(`/mine-disputes/${id}/`),
}

export const hotspotsApi = {
  list: (params) => api.get('/hotspots/', { params }),
}

// analysis app
export const analysisApi = {
  runConflictDetection: () => api.post('/analysis/run-conflict-detection/'),
  bufferRisks: (threshold) => api.get('/analysis/buffer-risks/', { params: { threshold } }),
  runHotspotAnalysis: (gridSize) => api.post(`/analysis/run-hotspot-analysis/?grid_size=${gridSize || 0.01}`),
}

// reports app
export const reportsApi = {
  summary: () => api.get('/reports/summary/'),
  disputesCsv: () => '/api/reports/disputes/csv/',
  mineClaimsCsv: () => '/api/reports/mine-claims/csv/',
  farmParcelsCsv: () => '/api/reports/farm-parcels/csv/',
}

// users (admin)
export const usersApi = {
  list: () => api.get('/users/'),
  update: (id, data) => api.put(`/users/${id}/`, data),
  delete: (id) => api.delete(`/users/${id}/`),
}

export default api
