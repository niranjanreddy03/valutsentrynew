import axios, { AxiosError, AxiosInstance } from 'axios'

// Types
export interface User {
  id: number
  email: string
  name: string
  avatar?: string
  role: 'admin' | 'user' | 'viewer'
  created_at: string
}

export interface AuthResponse {
  access_token: string
  refresh_token: string
  user: User
}

// Enhanced Repository type with criticality and risk
export interface Repository {
  id: number
  name: string
  full_name?: string
  url: string
  provider: 'github' | 'gitlab' | 'bitbucket' | 'azure'
  branch: string
  last_scan?: string
  secrets_count: number
  status: 'active' | 'inactive' | 'error' | 'archived'
  created_at: string
  // New fields
  criticality_tier: 'tier_1' | 'tier_2' | 'tier_3' | 'tier_4' | 'tier_5'
  environment?: 'production' | 'staging' | 'development' | 'test'
  data_classification?: 'pii' | 'pci' | 'hipaa' | 'public'
  assigned_team?: string
  risk_score: number
  open_findings_count: number
  critical_findings_count: number
  github_installation_id?: number
  slack_channel?: string
  jira_project_key?: string
  metadata?: Record<string, any>
}

// Enhanced Scan type with ML and PR integration
export interface Scan {
  id: number
  scan_id?: string
  repository_id: number
  repository_name: string
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled' | 'partial'
  branch: string
  trigger?: 'manual' | 'scheduled' | 'webhook' | 'ci_cd' | 'api' | 'pull_request'
  secrets_found: number
  files_scanned: number
  total_findings?: number
  high_risk_count?: number
  medium_risk_count?: number
  low_risk_count?: number
  risk_score?: number
  duration: string
  duration_seconds?: number | null
  started_at: string | null
  completed_at?: string | null
  error_message?: string | null
  triggered_by: string
  // New ML and PR fields
  scanners_used?: string[]
  ml_scored?: boolean
  ml_model_version?: string
  pr_number?: number
  pr_blocked?: boolean
  check_run_id?: number
  metadata?: Record<string, any>
}

// Enhanced Secret type with ML scoring and lifecycle
export interface Secret {
  id: number
  finding_id?: string
  type: string
  risk_level: 'critical' | 'high' | 'medium' | 'low' | 'info'
  file_path: string
  line_number: number
  repository_name: string
  repository_id: number
  scan_id?: string
  detected_at: string
  status: 'open' | 'in_progress' | 'resolved' | 'false_positive' | 'ignored'
  masked_value: string
  pattern_name?: string
  entropy_score?: number | null
  resolved_at?: string | null
  resolved_by?: string | null
  commit_hash?: string
  author?: string
  // New ML and lifecycle fields
  ml_risk_score?: number
  confidence: number
  business_impact_score: number
  environment?: 'production' | 'staging' | 'development' | 'test'
  branch?: string
  commit_date?: string
  assigned_team?: string
  assigned_user_id?: number
  priority: number
  sla_due_at?: string
  acknowledged_at?: string
  acknowledged_by?: number
  days_open: number
  rotation_count: number
  last_rotated_at?: string
  auto_rotated?: boolean
  jira_issue_key?: string
  jira_issue_url?: string
  slack_thread_ts?: string
  pr_number?: number
  metadata?: Record<string, any>
}

export interface Alert {
  id: number
  type: 'critical' | 'warning' | 'info' | 'success'
  title: string
  message: string
  repository?: string
  created_at: string
  is_read: boolean
}

export interface DashboardStats {
  total_repositories: number
  total_scans: number
  secrets_found: number
  high_risk_issues: number
  repositories_monitored: number
  scans_this_week: number
  secrets_resolved: number
  average_risk_score: number
  scan_success_rate: number
  last_scan?: string
}

export interface RiskDistribution {
  critical: number
  high: number
  medium: number
  low: number
  info: number
}

export interface ScanActivity {
  date: string
  scans: number
  secrets_found: number
}

export interface Report {
  id: number
  name: string
  type: 'weekly' | 'monthly' | 'custom'
  generated_at: string
  status: 'ready' | 'generating' | 'failed'
  size: string
  download_url?: string
}

// Integration types
export interface Integration {
  id: string
  name: string
  type: 'github' | 'gitlab' | 'aws' | 'slack' | 'jira' | 'azure' | 'stripe'
  status: 'connected' | 'disconnected' | 'syncing' | 'error'
  lastSync?: string
  reposConnected?: number
  config?: Record<string, any>
}

// Policy types
export interface PolicyCondition {
  field: string
  operator: 'equals' | 'not_equals' | 'contains' | 'gt' | 'gte' | 'lt' | 'lte' | 'regex' | 'in' | 'not_in'
  value: any
}

export interface Policy {
  id: string
  name: string
  description: string
  enabled: boolean
  priority: number
  conditions: PolicyCondition[]
  actions: ('allow' | 'deny' | 'warn' | 'notify' | 'require_approval' | 'auto_rotate' | 'create_ticket' | 'block_pr' | 'quarantine')[]
  action_params?: Record<string, any>
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info'
  created_at?: string
  updated_at?: string
  created_by?: string
  tags: string[]
}

// ML types
export interface MLModelInfo {
  model_type: 'xgboost' | 'random_forest'
  version: string
  accuracy: number
  precision: number
  recall: number
  f1_score: number
  trained_at: string
  training_samples: number
  feature_importance: Record<string, number>
}

export interface RiskScoreResult {
  secret_id: number
  risk_score: number
  ml_risk_score: number
  confidence: number
  business_impact_score: number
  risk_factors: string[]
}

// Lifecycle types
export interface LifecycleStats {
  total_secrets: number
  open_count: number
  in_progress_count: number
  resolved_count: number
  false_positive_count: number
  mttr_hours: number
  mttr_trend: number
  sla_compliance_rate: number
  overdue_count: number
  aging_distribution: {
    '0-7_days': number
    '8-30_days': number
    '31-90_days': number
    '90+_days': number
  }
}

export interface RotationResult {
  secret_id: number
  secret_type: string
  status: 'pending' | 'success' | 'failed' | 'partial' | 'skipped'
  old_key_id?: string
  new_key_id?: string
  message: string
  rotated_at?: string
}

// API Client
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v1'

const api: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
})

// Request interceptor for JWT
api.interceptors.request.use((config) => {
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('access_token')
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
  }
  return config
})

// Response interceptor for token refresh
api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as any
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true
      try {
        const refreshToken = localStorage.getItem('refresh_token')
        const response = await axios.post(`${API_BASE_URL}/auth/refresh`, {
          refresh_token: refreshToken,
        })
        localStorage.setItem('access_token', response.data.access_token)
        originalRequest.headers.Authorization = `Bearer ${response.data.access_token}`
        return api(originalRequest)
      } catch (refreshError) {
        localStorage.removeItem('access_token')
        localStorage.removeItem('refresh_token')
        window.location.href = '/login'
      }
    }
    return Promise.reject(error)
  }
)

// Helper to handle API errors
const handleApiError = (error: any): never => {
  if (error.response?.data?.detail) {
    throw new Error(error.response.data.detail)
  }
  if (error.response?.data?.message) {
    throw new Error(error.response.data.message)
  }
  throw new Error(error.message || 'An unexpected error occurred')
}

// Auth Service
export const authService = {
  login: async (email: string, password: string): Promise<AuthResponse> => {
    try {
      const response = await api.post('/auth/login', { email, password })
      return response.data
    } catch (error) {
      handleApiError(error)
    }
  },

  register: async (name: string, email: string, password: string): Promise<AuthResponse> => {
    try {
      const response = await api.post('/auth/register', {
        email,
        username: email.split('@')[0],
        password,
        full_name: name,
      })
      return response.data
    } catch (error) {
      handleApiError(error)
    }
  },

  forgotPassword: async (email: string): Promise<void> => {
    try {
      await api.post('/auth/forgot-password', { email })
    } catch (error) {
      handleApiError(error)
    }
  },

  getCurrentUser: async (): Promise<User> => {
    try {
      const response = await api.get('/auth/me')
      return response.data
    } catch (error) {
      handleApiError(error)
    }
  },

  logout: async (): Promise<void> => {
    try {
      await api.post('/auth/logout')
    } catch (error) {
      // Ignore logout errors
    }
    localStorage.removeItem('access_token')
    localStorage.removeItem('refresh_token')
  },

  refreshToken: async (refreshToken: string): Promise<{ access_token: string }> => {
    try {
      const response = await api.post('/auth/refresh', { refresh_token: refreshToken })
      return response.data
    } catch (error) {
      handleApiError(error)
    }
  },
}

// Dashboard Service
export const dashboardService = {
  getStats: async (): Promise<DashboardStats> => {
    try {
      const response = await api.get('/dashboard/stats')
      return response.data
    } catch (error) {
      handleApiError(error)
    }
  },

  getRiskDistribution: async (): Promise<RiskDistribution> => {
    try {
      const response = await api.get('/dashboard/risk-distribution')
      return response.data
    } catch (error) {
      handleApiError(error)
    }
  },

  getScanActivity: async (days: number = 7): Promise<ScanActivity[]> => {
    try {
      const response = await api.get(`/dashboard/scan-activity?days=${days}`)
      return response.data
    } catch (error) {
      handleApiError(error)
    }
  },

  getRecentAlerts: async (limit: number = 5): Promise<Alert[]> => {
    try {
      const response = await api.get(`/alerts?limit=${limit}`)
      return response.data
    } catch (error) {
      handleApiError(error)
    }
  },

  getTopSecrets: async (limit: number = 5): Promise<Secret[]> => {
    try {
      const response = await api.get(`/secrets?limit=${limit}&status=active`)
      return response.data
    } catch (error) {
      handleApiError(error)
    }
  },

  getAll: async (): Promise<any> => {
    try {
      const response = await api.get('/dashboard')
      return response.data
    } catch (error) {
      handleApiError(error)
    }
  },
}

// Repository Service
export const repositoryService = {
  getAll: async (): Promise<Repository[]> => {
    try {
      const response = await api.get('/repositories')
      // Handle paginated response from backend
      return response.data.items || response.data || []
    } catch (error) {
      handleApiError(error)
    }
  },

  getById: async (id: number): Promise<Repository | undefined> => {
    try {
      const response = await api.get(`/repositories/${id}`)
      return response.data
    } catch (error) {
      handleApiError(error)
    }
  },

  create: async (data: Partial<Repository>): Promise<Repository> => {
    try {
      // Map frontend fields to backend schema
      const response = await api.post('/repositories', {
        name: data.name,
        full_name: data.full_name || `${data.name}`, // Backend requires full_name
        url: data.url,
        type: data.provider || 'github', // Backend uses 'type' not 'provider'
        default_branch: data.branch || 'main', // Backend uses 'default_branch' not 'branch'
      })
      return response.data
    } catch (error) {
      handleApiError(error)
    }
  },

  update: async (id: number, data: Partial<Repository>): Promise<Repository> => {
    try {
      const response = await api.put(`/repositories/${id}`, data)
      return response.data
    } catch (error) {
      handleApiError(error)
    }
  },

  delete: async (id: number): Promise<void> => {
    try {
      await api.delete(`/repositories/${id}`)
    } catch (error) {
      handleApiError(error)
    }
  },

  scan: async (id: number): Promise<Scan> => {
    try {
      const response = await api.post(`/repositories/${id}/scan`)
      return response.data
    } catch (error) {
      handleApiError(error)
    }
  },

  sync: async (id: number): Promise<void> => {
    try {
      await api.post(`/repositories/${id}/sync`)
    } catch (error) {
      handleApiError(error)
    }
  },
}

// Scan Service
export const scanService = {
  getAll: async (): Promise<Scan[]> => {
    try {
      const response = await api.get('/scans')
      // Handle paginated response from backend
      return response.data.items || response.data || []
    } catch (error) {
      handleApiError(error)
    }
  },

  getById: async (id: number): Promise<Scan | undefined> => {
    try {
      const response = await api.get(`/scans/${id}`)
      return response.data
    } catch (error) {
      handleApiError(error)
    }
  },

  getByRepository: async (repoId: number): Promise<Scan[]> => {
    try {
      const response = await api.get(`/scans?repository_id=${repoId}`)
      // Handle paginated response from backend
      return response.data.items || response.data || []
    } catch (error) {
      handleApiError(error)
    }
  },

  start: async (repoId: number, branch?: string): Promise<Scan> => {
    try {
      const response = await api.post('/scans', {
        repository_id: repoId,
        branch: branch || 'main',
      })
      return response.data
    } catch (error) {
      handleApiError(error)
    }
  },

  cancel: async (id: number): Promise<void> => {
    try {
      await api.post(`/scans/${id}/cancel`)
    } catch (error) {
      handleApiError(error)
    }
  },

  getResults: async (id: number): Promise<Secret[]> => {
    try {
      const response = await api.get(`/scans/${id}/secrets`)
      // Handle paginated response from backend
      return response.data.items || response.data || []
    } catch (error) {
      handleApiError(error)
    }
  },

  getProgress: async (id: number): Promise<{ progress: number; status: string }> => {
    try {
      const response = await api.get(`/scans/${id}/progress`)
      return response.data
    } catch (error) {
      handleApiError(error)
    }
  },
}

// Secret Service
export const secretService = {
  getAll: async (filters?: { status?: string; risk_level?: string; repository_id?: number }): Promise<Secret[]> => {
    try {
      const params = new URLSearchParams()
      if (filters?.status) params.append('status', filters.status)
      if (filters?.risk_level) params.append('risk_level', filters.risk_level)
      if (filters?.repository_id) params.append('repository_id', filters.repository_id.toString())
      const response = await api.get(`/secrets?${params.toString()}`)
      // Handle paginated response from backend
      return response.data.items || response.data || []
    } catch (error) {
      handleApiError(error)
    }
  },

  getById: async (id: number): Promise<Secret | undefined> => {
    try {
      const response = await api.get(`/secrets/${id}`)
      return response.data
    } catch (error) {
      handleApiError(error)
    }
  },

  updateStatus: async (id: number, status: Secret['status'], notes?: string): Promise<Secret> => {
    try {
      const response = await api.patch(`/secrets/${id}`, { status, resolution_notes: notes })
      return response.data
    } catch (error) {
      handleApiError(error)
    }
  },

  resolve: async (id: number, notes?: string): Promise<Secret> => {
    try {
      const response = await api.post(`/secrets/${id}/resolve`, { notes })
      return response.data
    } catch (error) {
      handleApiError(error)
    }
  },

  ignore: async (id: number, notes?: string): Promise<Secret> => {
    try {
      const response = await api.post(`/secrets/${id}/ignore`, { notes })
      return response.data
    } catch (error) {
      handleApiError(error)
    }
  },

  markFalsePositive: async (id: number, notes?: string): Promise<Secret> => {
    try {
      const response = await api.post(`/secrets/${id}/false-positive`, { notes })
      return response.data
    } catch (error) {
      handleApiError(error)
    }
  },
}

// Alert Service
export const alertService = {
  getAll: async (filters?: { type?: string; is_read?: boolean }): Promise<Alert[]> => {
    try {
      const params = new URLSearchParams()
      if (filters?.type) params.append('type', filters.type)
      if (filters?.is_read !== undefined) params.append('is_read', filters.is_read.toString())
      const response = await api.get(`/alerts?${params.toString()}`)
      // Handle paginated response from backend
      return response.data.items || response.data || []
    } catch (error) {
      handleApiError(error)
    }
  },

  markAsRead: async (id: number): Promise<void> => {
    try {
      await api.patch(`/alerts/${id}`, { is_read: true })
    } catch (error) {
      handleApiError(error)
    }
  },

  markAllAsRead: async (): Promise<void> => {
    try {
      await api.post('/alerts/mark-all-read')
    } catch (error) {
      handleApiError(error)
    }
  },

  dismiss: async (id: number): Promise<void> => {
    try {
      await api.patch(`/alerts/${id}`, { is_dismissed: true })
    } catch (error) {
      handleApiError(error)
    }
  },

  getUnreadCount: async (): Promise<number> => {
    try {
      const response = await api.get('/alerts/unread-count')
      return response.data.count
    } catch (error) {
      handleApiError(error)
    }
  },
}

// Report Service
export const reportService = {
  getAll: async (): Promise<Report[]> => {
    try {
      const response = await api.get('/reports')
      // Handle paginated response from backend
      return response.data.items || response.data || []
    } catch (error) {
      handleApiError(error)
    }
  },

  generate: async (type: Report['type'], options?: any): Promise<Report> => {
    try {
      const response = await api.post('/reports/generate', { type, ...options })
      return response.data
    } catch (error) {
      handleApiError(error)
    }
  },

  download: async (id: number): Promise<void> => {
    try {
      const response = await api.get(`/reports/${id}/download`, {
        responseType: 'blob',
      })
      // Create download link
      const url = window.URL.createObjectURL(new Blob([response.data]))
      const link = document.createElement('a')
      link.href = url
      link.setAttribute('download', `report-${id}.pdf`)
      document.body.appendChild(link)
      link.click()
      link.remove()
      window.URL.revokeObjectURL(url)
    } catch (error) {
      handleApiError(error)
    }
  },

  getById: async (id: number): Promise<Report> => {
    try {
      const response = await api.get(`/reports/${id}`)
      return response.data
    } catch (error) {
      handleApiError(error)
    }
  },
}

// Cloud Service (S3 Scanning & AWS Integration)
export const cloudService = {
  // S3 Scanning
  scanS3Bucket: async (bucketName: string, prefix?: string): Promise<Scan> => {
    try {
      const response = await api.post('/cloud/s3/scan', {
        bucket_name: bucketName,
        prefix: prefix || '',
      })
      return response.data
    } catch (error) {
      handleApiError(error)
    }
  },

  listS3Buckets: async (): Promise<{ buckets: S3Bucket[]; count: number }> => {
    try {
      const response = await api.get('/cloud/s3/buckets')
      return response.data
    } catch (error) {
      handleApiError(error)
    }
  },

  listS3Objects: async (bucketName: string, prefix?: string, maxKeys?: number): Promise<{ objects: S3Object[]; count: number }> => {
    try {
      const response = await api.get(`/cloud/s3/buckets/${bucketName}/objects`, {
        params: { prefix, max_keys: maxKeys }
      })
      return response.data
    } catch (error) {
      handleApiError(error)
    }
  },

  getS3BucketPolicy: async (bucketName: string): Promise<{ bucket: string; policy: string | null; has_policy: boolean }> => {
    try {
      const response = await api.get(`/cloud/s3/buckets/${bucketName}/policy`)
      return response.data
    } catch (error) {
      handleApiError(error)
    }
  },

  // AWS Credentials & IAM
  validateAWSCredentials: async (credentials?: { access_key_id?: string; secret_access_key?: string; region?: string }): Promise<{ valid: boolean; account_id: string; arn: string; region: string }> => {
    try {
      const response = await api.post('/cloud/aws/validate', credentials || {})
      return response.data
    } catch (error) {
      handleApiError(error)
    }
  },

  listIAMAccessKeys: async (username?: string): Promise<{ keys: IAMAccessKey[]; count: number }> => {
    try {
      const response = await api.get('/cloud/aws/iam/access-keys', {
        params: { username }
      })
      return response.data
    } catch (error) {
      handleApiError(error)
    }
  },

  // AWS Secrets Manager
  listAWSSecrets: async (): Promise<{ secrets: AWSSecret[]; count: number }> => {
    try {
      const response = await api.get('/cloud/aws/secrets')
      return response.data
    } catch (error) {
      handleApiError(error)
    }
  },

  storeAWSSecret: async (name: string, value: string, description?: string): Promise<{ success: boolean; name: string; arn: string }> => {
    try {
      const response = await api.post('/cloud/aws/secrets', { name, value, description })
      return response.data
    } catch (error) {
      handleApiError(error)
    }
  },

  // Environment Analysis
  analyzeEnvFile: async (content: string): Promise<any> => {
    try {
      const response = await api.post('/cloud/env/analyze', { content })
      return response.data
    } catch (error) {
      handleApiError(error)
    }
  },

  analyzeEnvDemo: async (): Promise<any> => {
    try {
      const response = await api.post('/cloud/env/analyze-demo')
      return response.data
    } catch (error) {
      handleApiError(error)
    }
  },
}

// Types for cloud service
export interface S3Bucket {
  name: string
  region: string
  creation_date?: string
  owner?: string
  encryption_enabled: boolean
  public_access_blocked: boolean
  versioning_enabled: boolean
}

export interface S3Object {
  key: string
  bucket: string
  size: number
  last_modified: string
  etag: string
  storage_class: string
}

export interface IAMAccessKey {
  access_key_id: string
  status: string
  created_at: string
  username: string
}

export interface AWSSecret {
  name: string
  arn: string
  description?: string
  created_at?: string
  last_accessed?: string
  last_rotated?: string
  rotation_enabled: boolean
}

// Integration Service
export const integrationService = {
  getAll: async (): Promise<Integration[]> => {
    try {
      const response = await api.get('/integrations')
      return response.data.items || response.data || []
    } catch (error) {
      handleApiError(error)
    }
  },

  getById: async (id: string): Promise<Integration> => {
    try {
      const response = await api.get(`/integrations/${id}`)
      return response.data
    } catch (error) {
      handleApiError(error)
    }
  },

  connect: async (type: Integration['type'], config: Record<string, any>): Promise<Integration> => {
    try {
      const response = await api.post('/integrations/connect', { type, config })
      return response.data
    } catch (error) {
      handleApiError(error)
    }
  },

  disconnect: async (id: string): Promise<void> => {
    try {
      await api.delete(`/integrations/${id}`)
    } catch (error) {
      handleApiError(error)
    }
  },

  sync: async (id: string): Promise<Integration> => {
    try {
      const response = await api.post(`/integrations/${id}/sync`)
      return response.data
    } catch (error) {
      handleApiError(error)
    }
  },

  testConnection: async (type: Integration['type'], config: Record<string, any>): Promise<{ success: boolean; message: string }> => {
    try {
      const response = await api.post('/integrations/test', { type, config })
      return response.data
    } catch (error) {
      handleApiError(error)
    }
  },

  // Slack-specific
  sendSlackAlert: async (secretId: number, channel?: string): Promise<{ ok: boolean }> => {
    try {
      const response = await api.post('/integrations/slack/send', { secret_id: secretId, channel })
      return response.data
    } catch (error) {
      handleApiError(error)
    }
  },

  // Jira-specific
  createJiraIssue: async (secretId: number, projectKey?: string): Promise<{ key: string; url: string }> => {
    try {
      const response = await api.post('/integrations/jira/create-issue', { secret_id: secretId, project_key: projectKey })
      return response.data
    } catch (error) {
      handleApiError(error)
    }
  },
}

// Policy Service
export const policyService = {
  getAll: async (): Promise<Policy[]> => {
    try {
      const response = await api.get('/policies')
      return response.data.items || response.data || []
    } catch (error) {
      handleApiError(error)
    }
  },

  getById: async (id: string): Promise<Policy> => {
    try {
      const response = await api.get(`/policies/${id}`)
      return response.data
    } catch (error) {
      handleApiError(error)
    }
  },

  create: async (policy: Omit<Policy, 'id' | 'created_at' | 'updated_at'>): Promise<Policy> => {
    try {
      const response = await api.post('/policies', policy)
      return response.data
    } catch (error) {
      handleApiError(error)
    }
  },

  update: async (id: string, policy: Partial<Policy>): Promise<Policy> => {
    try {
      const response = await api.put(`/policies/${id}`, policy)
      return response.data
    } catch (error) {
      handleApiError(error)
    }
  },

  delete: async (id: string): Promise<void> => {
    try {
      await api.delete(`/policies/${id}`)
    } catch (error) {
      handleApiError(error)
    }
  },

  toggle: async (id: string, enabled: boolean): Promise<Policy> => {
    try {
      const response = await api.patch(`/policies/${id}/toggle`, { enabled })
      return response.data
    } catch (error) {
      handleApiError(error)
    }
  },

  evaluate: async (secretId: number): Promise<{ matching_policies: Policy[]; required_actions: string[] }> => {
    try {
      const response = await api.post(`/policies/evaluate`, { secret_id: secretId })
      return response.data
    } catch (error) {
      handleApiError(error)
    }
  },
}

// ML Service
export const mlService = {
  getModelInfo: async (): Promise<MLModelInfo> => {
    try {
      const response = await api.get('/ml/model-info')
      return response.data
    } catch (error) {
      handleApiError(error)
    }
  },

  retrainModel: async (): Promise<{ task_id: string; message: string }> => {
    try {
      const response = await api.post('/ml/retrain')
      return response.data
    } catch (error) {
      handleApiError(error)
    }
  },

  scoreSecret: async (secretId: number): Promise<RiskScoreResult> => {
    try {
      const response = await api.post(`/ml/score/${secretId}`)
      return response.data
    } catch (error) {
      handleApiError(error)
    }
  },

  batchScore: async (secretIds: number[]): Promise<RiskScoreResult[]> => {
    try {
      const response = await api.post('/ml/score/batch', { secret_ids: secretIds })
      return response.data
    } catch (error) {
      handleApiError(error)
    }
  },

  getFeatureImportance: async (): Promise<Record<string, number>> => {
    try {
      const response = await api.get('/ml/feature-importance')
      return response.data
    } catch (error) {
      handleApiError(error)
    }
  },

  submitFeedback: async (secretId: number, isFalsePositive: boolean, notes?: string): Promise<void> => {
    try {
      await api.post('/ml/feedback', { secret_id: secretId, is_false_positive: isFalsePositive, notes })
    } catch (error) {
      handleApiError(error)
    }
  },
}

// Lifecycle Service
export const lifecycleService = {
  getStats: async (): Promise<LifecycleStats> => {
    try {
      const response = await api.get('/lifecycle/stats')
      return response.data
    } catch (error) {
      handleApiError(error)
    }
  },

  getAgingReport: async (): Promise<any> => {
    try {
      const response = await api.get('/lifecycle/aging-report')
      return response.data
    } catch (error) {
      handleApiError(error)
    }
  },

  getSLAStatus: async (): Promise<any> => {
    try {
      const response = await api.get('/lifecycle/sla-status')
      return response.data
    } catch (error) {
      handleApiError(error)
    }
  },

  getMTTR: async (days?: number): Promise<{ mttr_hours: number; trend: number }> => {
    try {
      const response = await api.get('/lifecycle/mttr', { params: { days } })
      return response.data
    } catch (error) {
      handleApiError(error)
    }
  },

  acknowledge: async (secretId: number): Promise<Secret> => {
    try {
      const response = await api.post(`/lifecycle/acknowledge/${secretId}`)
      return response.data
    } catch (error) {
      handleApiError(error)
    }
  },

  assignTeam: async (secretId: number, team: string): Promise<Secret> => {
    try {
      const response = await api.patch(`/lifecycle/assign/${secretId}`, { team })
      return response.data
    } catch (error) {
      handleApiError(error)
    }
  },

  setSLA: async (secretId: number, dueAt: string): Promise<Secret> => {
    try {
      const response = await api.patch(`/lifecycle/sla/${secretId}`, { due_at: dueAt })
      return response.data
    } catch (error) {
      handleApiError(error)
    }
  },
}

// Auto-Rotation Service
export const rotationService = {
  getSupportedTypes: async (): Promise<string[]> => {
    try {
      const response = await api.get('/rotation/supported-types')
      return response.data
    } catch (error) {
      handleApiError(error)
    }
  },

  canRotate: async (secretId: number): Promise<{ can_rotate: boolean; reason?: string }> => {
    try {
      const response = await api.get(`/rotation/can-rotate/${secretId}`)
      return response.data
    } catch (error) {
      handleApiError(error)
    }
  },

  rotate: async (secretId: number): Promise<RotationResult> => {
    try {
      const response = await api.post(`/rotation/rotate/${secretId}`)
      return response.data
    } catch (error) {
      handleApiError(error)
    }
  },

  getRotationHistory: async (secretId: number): Promise<RotationResult[]> => {
    try {
      const response = await api.get(`/rotation/history/${secretId}`)
      return response.data
    } catch (error) {
      handleApiError(error)
    }
  },
}

export default api
