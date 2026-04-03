import axios, { AxiosInstance, AxiosError } from 'axios'

// Types
export interface User {
  id: number
  email: string
  full_name: string
  role: 'admin' | 'developer' | 'viewer'
  is_active: boolean
  created_at: string
}

export interface Repository {
  id: number
  name: string
  url: string
  type: 'github' | 'gitlab' | 'bitbucket' | 'local' | 's3'
  branch: string
  is_active: boolean
  last_scanned_at: string | null
  total_scans: number
  secrets_found: number
}

export interface Scan {
  id: number
  repository_id: number
  repository_name: string
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled'
  branch: string
  commit_hash: string
  files_scanned: number
  secrets_found: number
  started_at: string
  completed_at: string | null
  duration: string
  triggered_by: string
}

export interface Secret {
  id: number
  scan_id: number
  type: string
  risk_level: 'critical' | 'high' | 'medium' | 'low'
  file_path: string
  line_number: number
  column_start: number
  column_end: number
  masked_value: string
  repository_name: string
  detected_at: string
  status: 'active' | 'resolved' | 'ignored'
  entropy_score: number
}

export interface Alert {
  id: number
  type: 'critical' | 'warning' | 'info' | 'success'
  title: string
  message: string
  repository: string
  created_at: string
  is_read: boolean
}

export interface DashboardStats {
  total_scans: number
  secrets_found: number
  high_risk_issues: number
  repositories_monitored: number
  scans_this_week: number
  secrets_resolved: number
  average_risk_score: number
  scan_success_rate: number
}

export interface RiskDistribution {
  name: string
  value: number
  color: string
}

export interface ScanActivity {
  date: string
  scans: number
  secrets_found: number
}

export interface RecentScan {
  id: number
  repository_name: string
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled'
  branch: string
  secrets_found: number
  duration: string
  started_at: string
  triggered_by: string
}

export interface TopSecret {
  id: number
  type: string
  risk_level: 'critical' | 'high' | 'medium' | 'low'
  file_path: string
  line_number: number
  repository_name: string
  detected_at: string
  status: 'active' | 'resolved' | 'ignored'
  masked_value: string
}

export interface DashboardAlert {
  id: number
  type: 'critical' | 'warning' | 'info' | 'success'
  title: string
  message: string
  repository: string
  created_at: string
  is_read: boolean
}

export interface DashboardData {
  stats: DashboardStats
  risk_distribution: {
    critical: number
    high: number
    medium: number
    low: number
    info: number
  }
  scan_activity: ScanActivity[]
  recent_scans: RecentScan[]
  top_secrets: TopSecret[]
  alerts: DashboardAlert[]
  recent_alerts_count: number
}

export async function getDashboardData(): Promise<DashboardData> {
  const response = await fetch('/api/v1/dashboard')
  if (!response.ok) {
    throw new Error('Failed to fetch dashboard data')
  }
  return response.json()
}

export interface LoginRequest {
  email: string
  password: string
}

export interface LoginResponse {
  access_token: string
  refresh_token: string
  token_type: string
}

export interface CreateRepositoryRequest {
  name: string
  url: string
  type: 'github' | 'gitlab' | 'bitbucket' | 'local' | 's3'
  branch?: string
  access_token?: string
}

export interface CreateScanRequest {
  repository_id: number
  branch?: string
}

// API Error handling
export class ApiError extends Error {
  status: number
  data: any

  constructor(message: string, status: number, data?: any) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.data = data
  }
}

// Create API Client
const createApiClient = (): AxiosInstance => {
  const client = axios.create({
    baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v1',
    headers: {
      'Content-Type': 'application/json',
    },
  })

  // Request interceptor - add auth token
  client.interceptors.request.use((config) => {
    if (typeof window !== 'undefined') {
      const token = localStorage.getItem('access_token')
      if (token) {
        config.headers.Authorization = `Bearer ${token}`
      }
    }
    return config
  })

  // Response interceptor - handle errors
  client.interceptors.response.use(
    (response) => response,
    async (error: AxiosError) => {
      const status = error.response?.status
      const data = error.response?.data

      // Handle 401 - try to refresh token
      if (status === 401 && typeof window !== 'undefined') {
        const refreshToken = localStorage.getItem('refresh_token')
        if (refreshToken) {
          try {
            const response = await axios.post(
              `${process.env.NEXT_PUBLIC_API_URL}/auth/refresh`,
              { refresh_token: refreshToken }
            )
            const { access_token, refresh_token } = response.data
            localStorage.setItem('access_token', access_token)
            localStorage.setItem('refresh_token', refresh_token)
            
            // Retry original request
            if (error.config) {
              error.config.headers.Authorization = `Bearer ${access_token}`
              return client.request(error.config)
            }
          } catch (refreshError) {
            // Refresh failed - clear tokens and redirect to login
            localStorage.removeItem('access_token')
            localStorage.removeItem('refresh_token')
            window.location.href = '/login'
          }
        } else {
          window.location.href = '/login'
        }
      }

      throw new ApiError(
        (data as any)?.detail || error.message || 'An error occurred',
        status || 500,
        data
      )
    }
  )

  return client
}

const api = createApiClient()

// Auth API
export const authApi = {
  login: async (credentials: LoginRequest): Promise<LoginResponse> => {
    const formData = new URLSearchParams()
    formData.append('username', credentials.email)
    formData.append('password', credentials.password)
    
    const response = await api.post('/auth/login', formData, {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
    })
    
    // Store tokens
    if (typeof window !== 'undefined') {
      localStorage.setItem('access_token', response.data.access_token)
      localStorage.setItem('refresh_token', response.data.refresh_token)
    }
    
    return response.data
  },

  logout: async (): Promise<void> => {
    await api.post('/auth/logout')
    if (typeof window !== 'undefined') {
      localStorage.removeItem('access_token')
      localStorage.removeItem('refresh_token')
    }
  },

  register: async (data: { email: string; password: string; full_name: string }): Promise<User> => {
    const response = await api.post('/auth/register', data)
    return response.data
  },

  getCurrentUser: async (): Promise<User> => {
    const response = await api.get('/users/me')
    return response.data
  },
}

// Users API
export const usersApi = {
  list: async (params?: { skip?: number; limit?: number }): Promise<User[]> => {
    const response = await api.get('/users', { params })
    return response.data
  },

  get: async (id: number): Promise<User> => {
    const response = await api.get(`/users/${id}`)
    return response.data
  },

  update: async (id: number, data: Partial<User>): Promise<User> => {
    const response = await api.put(`/users/${id}`, data)
    return response.data
  },

  delete: async (id: number): Promise<void> => {
    await api.delete(`/users/${id}`)
  },
}

// Repositories API
export const repositoriesApi = {
  list: async (params?: { skip?: number; limit?: number; type?: string }): Promise<Repository[]> => {
    const response = await api.get('/repositories', { params })
    return response.data
  },

  get: async (id: number): Promise<Repository> => {
    const response = await api.get(`/repositories/${id}`)
    return response.data
  },

  create: async (data: CreateRepositoryRequest): Promise<Repository> => {
    const response = await api.post('/repositories', data)
    return response.data
  },

  update: async (id: number, data: Partial<CreateRepositoryRequest>): Promise<Repository> => {
    const response = await api.put(`/repositories/${id}`, data)
    return response.data
  },

  delete: async (id: number): Promise<void> => {
    await api.delete(`/repositories/${id}`)
  },

  sync: async (id: number): Promise<void> => {
    await api.post(`/repositories/${id}/sync`)
  },
}

// Scans API
export const scansApi = {
  list: async (params?: { 
    skip?: number
    limit?: number
    repository_id?: number
    status?: string 
  }): Promise<Scan[]> => {
    const response = await api.get('/scans', { params })
    return response.data
  },

  get: async (id: number): Promise<Scan> => {
    const response = await api.get(`/scans/${id}`)
    return response.data
  },

  create: async (data: CreateScanRequest): Promise<Scan> => {
    const response = await api.post('/scans', data)
    return response.data
  },

  cancel: async (id: number): Promise<void> => {
    await api.post(`/scans/${id}/cancel`)
  },

  getProgress: async (id: number): Promise<{ progress: number; files_scanned: number; secrets_found: number }> => {
    const response = await api.get(`/scans/${id}/progress`)
    return response.data
  },
}

// Secrets API
export const secretsApi = {
  list: async (params?: { 
    skip?: number
    limit?: number
    scan_id?: number
    repository_id?: number
    risk_level?: string
    status?: string
  }): Promise<Secret[]> => {
    const response = await api.get('/secrets', { params })
    return response.data
  },

  get: async (id: number): Promise<Secret> => {
    const response = await api.get(`/secrets/${id}`)
    return response.data
  },

  resolve: async (id: number): Promise<Secret> => {
    const response = await api.post(`/secrets/${id}/resolve`)
    return response.data
  },

  ignore: async (id: number, reason?: string): Promise<Secret> => {
    const response = await api.post(`/secrets/${id}/ignore`, { reason })
    return response.data
  },

  reopen: async (id: number): Promise<Secret> => {
    const response = await api.post(`/secrets/${id}/reopen`)
    return response.data
  },
}

// Alerts API
export const alertsApi = {
  list: async (params?: { 
    skip?: number
    limit?: number
    type?: string
    is_read?: boolean 
  }): Promise<Alert[]> => {
    const response = await api.get('/alerts', { params })
    return response.data
  },

  get: async (id: number): Promise<Alert> => {
    const response = await api.get(`/alerts/${id}`)
    return response.data
  },

  markAsRead: async (id: number): Promise<Alert> => {
    const response = await api.post(`/alerts/${id}/read`)
    return response.data
  },

  markAllAsRead: async (): Promise<void> => {
    await api.post('/alerts/read-all')
  },

  delete: async (id: number): Promise<void> => {
    await api.delete(`/alerts/${id}`)
  },
}

// Dashboard API
export const dashboardApi = {
  getStats: async (): Promise<DashboardStats> => {
    const response = await api.get('/dashboard/stats')
    return response.data
  },

  getRiskDistribution: async (): Promise<RiskDistribution[]> => {
    const response = await api.get('/dashboard/risk-distribution')
    return response.data
  },

  getScanActivity: async (days?: number): Promise<ScanActivity[]> => {
    const response = await api.get('/dashboard/scan-activity', { params: { days } })
    return response.data
  },

  getRecentScans: async (limit?: number): Promise<Scan[]> => {
    const response = await api.get('/dashboard/recent-scans', { params: { limit } })
    return response.data
  },

  getTopSecrets: async (limit?: number): Promise<Secret[]> => {
    const response = await api.get('/dashboard/top-secrets', { params: { limit } })
    return response.data
  },
}

// Reports API
export const reportsApi = {
  generate: async (params: {
    type: 'scan' | 'repository' | 'security'
    format: 'json' | 'csv' | 'pdf'
    start_date?: string
    end_date?: string
    repository_id?: number
  }): Promise<Blob> => {
    const response = await api.get('/reports/generate', {
      params,
      responseType: 'blob'
    })
    return response.data
  },

  getScanReport: async (scanId: number): Promise<any> => {
    const response = await api.get(`/reports/scan/${scanId}`)
    return response.data
  },

  getSecuritySummary: async (): Promise<any> => {
    const response = await api.get('/reports/security-summary')
    return response.data
  },
}

export default api
