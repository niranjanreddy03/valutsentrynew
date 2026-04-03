/**
 * Demo Data for Vault Sentry
 * Used when logged in with demo account for presentations
 */

export const DEMO_REPOSITORIES = [
  {
    id: 1,
    name: 'frontend-app',
    url: 'https://github.com/acme-corp/frontend-app',
    provider: 'github',
    branch: 'main',
    status: 'active',
    last_scan_at: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
    secrets_count: 5,
    risk_score: 85,
    created_at: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 2,
    name: 'backend-api',
    url: 'https://github.com/acme-corp/backend-api',
    provider: 'github',
    branch: 'main',
    status: 'active',
    last_scan_at: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString(),
    secrets_count: 12,
    risk_score: 92,
    created_at: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 3,
    name: 'mobile-app',
    url: 'https://github.com/acme-corp/mobile-app',
    provider: 'github',
    branch: 'develop',
    status: 'active',
    last_scan_at: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
    secrets_count: 3,
    risk_score: 45,
    created_at: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 4,
    name: 'infrastructure',
    url: 'https://github.com/acme-corp/infrastructure',
    provider: 'github',
    branch: 'main',
    status: 'active',
    last_scan_at: new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString(),
    secrets_count: 8,
    risk_score: 78,
    created_at: new Date(Date.now() - 120 * 24 * 60 * 60 * 1000).toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 5,
    name: 'data-pipeline',
    url: 'https://github.com/acme-corp/data-pipeline',
    provider: 'github',
    branch: 'main',
    status: 'active',
    last_scan_at: new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString(),
    secrets_count: 2,
    risk_score: 35,
    created_at: new Date(Date.now() - 45 * 24 * 60 * 60 * 1000).toISOString(),
    updated_at: new Date().toISOString(),
  },
]

export const DEMO_SECRETS = [
  {
    id: 1,
    secret_type: 'AWS Access Key',
    severity: 'critical',
    status: 'active',
    repository: DEMO_REPOSITORIES[1],
    file_path: 'src/config/aws.py',
    line_number: 15,
    masked_value: 'AKIA****EXAMPLE',
    environment: 'production',
    created_at: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
    detected_at: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: 2,
    secret_type: 'GitHub Token',
    severity: 'critical',
    status: 'active',
    repository: DEMO_REPOSITORIES[0],
    file_path: '.env.production',
    line_number: 8,
    masked_value: 'ghp_****xxxx',
    environment: 'production',
    created_at: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString(),
    detected_at: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: 3,
    secret_type: 'Stripe API Key',
    severity: 'critical',
    status: 'active',
    repository: DEMO_REPOSITORIES[1],
    file_path: 'src/payments/stripe.js',
    line_number: 23,
    masked_value: 'demo_key_****',
    environment: 'production',
    created_at: new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString(),
    detected_at: new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: 4,
    secret_type: 'Database Password',
    severity: 'high',
    status: 'active',
    repository: DEMO_REPOSITORIES[3],
    file_path: 'terraform/variables.tf',
    line_number: 45,
    masked_value: 'postgres://admin:****@...',
    environment: 'staging',
    created_at: new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString(),
    detected_at: new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: 5,
    secret_type: 'JWT Secret',
    severity: 'high',
    status: 'resolved',
    repository: DEMO_REPOSITORIES[1],
    file_path: 'src/auth/jwt.py',
    line_number: 12,
    masked_value: 'super-secret-****',
    environment: 'production',
    created_at: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
    detected_at: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: 6,
    secret_type: 'Sendgrid API Key',
    severity: 'medium',
    status: 'active',
    repository: DEMO_REPOSITORIES[1],
    file_path: 'src/email/service.py',
    line_number: 7,
    masked_value: 'SG.****',
    environment: 'development',
    created_at: new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString(),
    detected_at: new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: 7,
    secret_type: 'Firebase Key',
    severity: 'medium',
    status: 'active',
    repository: DEMO_REPOSITORIES[2],
    file_path: 'android/app/google-services.json',
    line_number: 12,
    masked_value: 'AIza****',
    environment: 'production',
    created_at: new Date(Date.now() - 72 * 60 * 60 * 1000).toISOString(),
    detected_at: new Date(Date.now() - 72 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: 8,
    secret_type: 'Slack Webhook',
    severity: 'low',
    status: 'ignored',
    repository: DEMO_REPOSITORIES[4],
    file_path: 'scripts/notify.sh',
    line_number: 5,
    masked_value: 'https://hooks.slack.com/****',
    environment: 'development',
    created_at: new Date(Date.now() - 96 * 60 * 60 * 1000).toISOString(),
    detected_at: new Date(Date.now() - 96 * 60 * 60 * 1000).toISOString(),
  },
]

export const DEMO_REPORTS = [
  {
    id: 1,
    name: 'Weekly Security Report - Feb 10-16, 2026',
    type: 'weekly' as const,
    status: 'ready' as const,
    size: '2.4 MB',
    generated_at: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
    format: 'pdf',
    repositories_included: 5,
    secrets_count: 30,
  },
  {
    id: 2,
    name: 'Monthly Security Report - January 2026',
    type: 'monthly' as const,
    status: 'ready' as const,
    size: '5.8 MB',
    generated_at: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString(),
    format: 'pdf',
    repositories_included: 5,
    secrets_count: 85,
  },
  {
    id: 3,
    name: 'Weekly Security Report - Feb 3-9, 2026',
    type: 'weekly' as const,
    status: 'ready' as const,
    size: '2.1 MB',
    generated_at: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString(),
    format: 'pdf',
    repositories_included: 5,
    secrets_count: 25,
  },
  {
    id: 4,
    name: 'Custom Security Audit - Production',
    type: 'custom' as const,
    status: 'ready' as const,
    size: '3.2 MB',
    generated_at: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000).toISOString(),
    format: 'pdf',
    repositories_included: 2,
    secrets_count: 45,
  },
  {
    id: 5,
    name: 'Monthly Security Report - December 2025',
    type: 'monthly' as const,
    status: 'ready' as const,
    size: '4.9 MB',
    generated_at: new Date(Date.now() - 45 * 24 * 60 * 60 * 1000).toISOString(),
    format: 'pdf',
    repositories_included: 5,
    secrets_count: 72,
  },
]

export const DEMO_SCANS = [
  {
    id: 1,
    repository: DEMO_REPOSITORIES[1],
    repository_name: 'backend-api',
    status: 'completed',
    branch: 'main',
    secrets_found: 4,
    files_scanned: 1250,
    duration: '2m 34s',
    triggered_by: 'Webhook',
    created_at: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: 2,
    repository: DEMO_REPOSITORIES[0],
    repository_name: 'frontend-app',
    status: 'completed',
    branch: 'main',
    secrets_found: 1,
    files_scanned: 890,
    duration: '1m 45s',
    triggered_by: 'Manual',
    created_at: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: 3,
    repository: DEMO_REPOSITORIES[3],
    repository_name: 'infrastructure',
    status: 'completed',
    branch: 'main',
    secrets_found: 2,
    files_scanned: 320,
    duration: '45s',
    triggered_by: 'Scheduled',
    created_at: new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: 4,
    repository: DEMO_REPOSITORIES[2],
    repository_name: 'mobile-app',
    status: 'completed',
    branch: 'develop',
    secrets_found: 1,
    files_scanned: 654,
    duration: '1m 12s',
    triggered_by: 'Webhook',
    created_at: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: 5,
    repository: DEMO_REPOSITORIES[4],
    repository_name: 'data-pipeline',
    status: 'running',
    branch: 'main',
    secrets_found: 0,
    files_scanned: 156,
    duration: '--',
    triggered_by: 'Manual',
    created_at: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
  },
]

export const DEMO_ALERTS = [
  {
    id: 1,
    type: 'critical',
    severity: 'critical',
    title: 'AWS Access Key Exposed',
    message: 'Critical AWS credentials detected in backend-api repository',
    repository: DEMO_REPOSITORIES[1],
    is_read: false,
    created_at: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: 2,
    type: 'critical',
    severity: 'critical',
    title: 'GitHub Token in Code',
    message: 'Personal access token found in .env.production file',
    repository: DEMO_REPOSITORIES[0],
    is_read: false,
    created_at: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: 3,
    type: 'warning',
    severity: 'high',
    title: 'Database Credentials Found',
    message: 'PostgreSQL connection string with password in terraform config',
    repository: DEMO_REPOSITORIES[3],
    is_read: true,
    created_at: new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: 4,
    type: 'info',
    severity: 'medium',
    title: 'Scan Completed',
    message: 'Security scan completed for mobile-app with 1 finding',
    repository: DEMO_REPOSITORIES[2],
    is_read: true,
    created_at: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: 5,
    type: 'success',
    severity: 'low',
    title: 'Secret Rotated',
    message: 'JWT secret was successfully rotated in backend-api',
    repository: DEMO_REPOSITORIES[1],
    is_read: true,
    created_at: new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString(),
  },
]

export const DEMO_INTEGRATIONS = [
  {
    id: '1',
    name: 'GitHub',
    type: 'github',
    status: 'connected',
    last_sync: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
    repositories_count: 5,
  },
  {
    id: '2',
    name: 'Slack',
    type: 'slack',
    status: 'connected',
    last_sync: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
    channel: '#security-alerts',
  },
  {
    id: '3',
    name: 'AWS',
    type: 'aws',
    status: 'connected',
    last_sync: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
    region: 'us-east-1',
  },
  {
    id: '4',
    name: 'Jira',
    type: 'jira',
    status: 'disconnected',
    last_sync: null,
  },
]

// Generate risk trend data for the last 30 days
function generateRiskTrend() {
  const data = []
  for (let i = 29; i >= 0; i--) {
    const date = new Date(Date.now() - i * 24 * 60 * 60 * 1000)
    data.push({
      date: date.toISOString().split('T')[0],
      critical: Math.floor(Math.random() * 5) + (i < 10 ? 2 : 4),
      high: Math.floor(Math.random() * 8) + 3,
    })
  }
  return data
}

// Generate scan activity for the last 14 days
function generateScanActivity() {
  const data = []
  for (let i = 13; i >= 0; i--) {
    const date = new Date(Date.now() - i * 24 * 60 * 60 * 1000)
    data.push({
      date: date.toISOString().split('T')[0],
      scans: Math.floor(Math.random() * 10) + 5,
      secrets_found: Math.floor(Math.random() * 6),
    })
  }
  return data
}

export const DEMO_DASHBOARD_DATA = {
  kpiStats: {
    secrets_detected: 30,
    critical_issues: 3,
    mttr_hours: 4.2,
    repositories_monitored: 5,
    secrets_trend: 12,
    critical_trend: -25,
    mttr_trend: -15,
    repos_trend: 25,
  },
  risk_distribution: {
    critical: 3,
    high: 5,
    medium: 12,
    low: 10,
  },
  risk_trend: generateRiskTrend(),
  scan_activity: generateScanActivity(),
  critical_findings: DEMO_SECRETS
    .filter(s => s.severity === 'critical' || s.severity === 'high')
    .map((s, idx) => ({
      id: s.id,
      type: s.secret_type,
      severity: s.severity,
      repository: s.repository.name,
      file_path: s.file_path,
      line_number: s.line_number,
      environment: s.environment,
      detected_at: new Date(s.created_at).toLocaleString(),
      assigned_team: idx === 0 ? 'Platform Team' : null,
      status: s.status,
      masked_value: s.masked_value,
    })),
  recent_scans: DEMO_SCANS.map(scan => ({
    id: scan.id,
    repository_name: scan.repository_name,
    status: scan.status,
    branch: scan.branch,
    secrets_found: scan.secrets_found,
    duration: scan.duration,
    started_at: new Date(scan.created_at).toLocaleString(),
    triggered_by: scan.triggered_by,
  })),
  alerts: DEMO_ALERTS.map(alert => ({
    id: alert.id,
    type: alert.type,
    title: alert.title,
    message: alert.message,
    repository: alert.repository.name,
    created_at: formatTimeAgo(new Date(alert.created_at)),
    is_read: alert.is_read,
  })),
  integrations: DEMO_INTEGRATIONS,
  secret_lifecycle: {
    detected: 30,
    revoked: 8,
    rotated: 15,
    verified: 5,
  },
  lifecycle_metrics: {
    mttr_hours: 4.2,
    mttr_trend: 'stable' as const,
    sla_compliance_rate: 94,
    sla_breaches: 2,
    auto_rotated_count: 12,
    manual_resolved_count: 11,
    false_positive_count: 2,
    avg_age_days: 3.5,
    oldest_open_days: 12,
    by_priority: {
      critical: 3,
      high: 5,
      medium: 12,
      low: 10,
    },
  },
  ml_model: {
    model_type: 'ensemble' as const,
    version: '2.1.0',
    trained_at: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
    accuracy: 0.967,
    precision: 0.954,
    recall: 0.978,
    f1_score: 0.966,
    samples_trained: 125000,
    last_retrain: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
  },
  feature_importance: [
    { feature: 'Entropy Score', importance: 0.28 },
    { feature: 'Pattern Match', importance: 0.24 },
    { feature: 'Context Keywords', importance: 0.18 },
    { feature: 'File Type', importance: 0.12 },
    { feature: 'Line Position', importance: 0.10 },
    { feature: 'Variable Name', importance: 0.08 },
  ],
  ml_predictions: {
    total: 1250,
    correct: 1208,
    false_positives: 28,
    false_negatives: 14,
  },
  risky_repositories: DEMO_REPOSITORIES
    .map(repo => ({
      id: repo.id,
      name: repo.name,
      risk_score: repo.risk_score,
      critical_count: repo.name === 'backend-api' ? 3 : repo.name === 'frontend-app' ? 1 : 0,
      high_count: repo.name === 'backend-api' ? 2 : repo.name === 'infrastructure' ? 1 : 0,
      medium_count: Math.floor(Math.random() * 4),
      low_count: Math.floor(Math.random() * 3),
      trend: repo.risk_score > 70 ? 'up' as const : repo.risk_score < 50 ? 'down' as const : 'stable' as const,
      last_scan: new Date(repo.last_scan_at!).toLocaleString(),
    }))
    .sort((a, b) => b.risk_score - a.risk_score),
  recent_alerts_count: DEMO_ALERTS.filter(a => !a.is_read).length,
}

function formatTimeAgo(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000)
  
  if (seconds < 60) return 'Just now'
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`
  return `${Math.floor(seconds / 86400)}d ago`
}

// Check if demo mode is active
export function isDemoMode(): boolean {
  if (typeof window === 'undefined') return false
  return localStorage.getItem('demo_mode') === 'true'
}
