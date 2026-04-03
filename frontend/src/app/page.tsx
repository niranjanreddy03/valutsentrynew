'use client'

import AlertsPanel from '@/components/dashboard/AlertsPanel'
import { getAuthHeaders } from '@/lib/authHeaders'
import CriticalFindingsTable from '@/components/dashboard/CriticalFindingsTable'
import ExecutiveKPIs from '@/components/dashboard/ExecutiveKPIs'
import IntegrationStatus from '@/components/dashboard/IntegrationStatus'
import MLInsightsPanel from '@/components/dashboard/MLInsightsPanel'
import RecentScansTable from '@/components/dashboard/RecentScansTable'
import RepositoryRiskRanking from '@/components/dashboard/RepositoryRiskRanking'
import RiskPieChart from '@/components/dashboard/RiskPieChart'
import RiskTrendChart from '@/components/dashboard/RiskTrendChart'
import ScanActivityChart from '@/components/dashboard/ScanActivityChart'
import SecretLifecycle from '@/components/dashboard/SecretLifecycle'
import { ActivityHeatmap, SeverityDistribution, TrendGraph } from '@/components/dashboard/TrendGraphs'
import Header from '@/components/layout/Header'
import Sidebar from '@/components/layout/Sidebar'
import { Button, Modal, Select } from '@/components/ui'
import { useAuth } from '@/contexts/AuthContext'
import { useToast } from '@/contexts/ToastContext'
import { DEMO_DASHBOARD_DATA, DEMO_REPOSITORIES, isDemoMode } from '@/lib/demoData'
import { alertService, repositoryService, scanService, secretService } from '@/services/supabase'
import { FolderGit2, Plus, Radar, Shield } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'

// Empty default data for new users
const emptyDashboardData = {
  kpiStats: {
    secrets_detected: 0,
    critical_issues: 0,
    mttr_hours: 0,
    repositories_monitored: 0,
    secrets_trend: 0,
    critical_trend: 0,
    mttr_trend: 0,
    repos_trend: 0,
  },
  risk_distribution: {
    critical: 0,
    high: 0,
    medium: 0,
    low: 0,
  },
  risk_trend: [] as { date: string; critical: number; high: number }[],
  scan_activity: [] as { date: string; scans: number; secrets_found: number }[],
  critical_findings: [] as any[],
  recent_scans: [] as any[],
  alerts: [] as any[],
  integrations: [] as any[],
  secret_lifecycle: {
    detected: 0,
    revoked: 0,
    rotated: 0,
    verified: 0,
  },
  lifecycle_metrics: {
    mttr_hours: 0,
    mttr_trend: 'stable' as const,
    sla_compliance_rate: 0,
    sla_breaches: 0,
    auto_rotated_count: 0,
    manual_resolved_count: 0,
    false_positive_count: 0,
    avg_age_days: 0,
    oldest_open_days: 0,
    by_priority: {
      critical: 0,
      high: 0,
      medium: 0,
      low: 0,
    },
  },
  ml_model: {
    model_type: 'ensemble' as const,
    version: '1.0.0',
    trained_at: new Date().toISOString(),
    accuracy: 0,
    precision: 0,
    recall: 0,
    f1_score: 0,
    samples_trained: 0,
    last_retrain: new Date().toISOString(),
  },
  feature_importance: [] as { feature: string; importance: number }[],
  ml_predictions: {
    total: 0,
    correct: 0,
    false_positives: 0,
    false_negatives: 0,
  },
  risky_repositories: [] as any[],
  recent_alerts_count: 0,
}

export default function Dashboard() {
  const [data, setData] = useState<typeof emptyDashboardData>(emptyDashboardData)
  const [loading, setLoading] = useState(true)
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [showNewScanModal, setShowNewScanModal] = useState(false)
  const [selectedRepo, setSelectedRepo] = useState('')
  const [scanBranch, setScanBranch] = useState('main')
  const [scanType, setScanType] = useState('full')
  const [repositories, setRepositories] = useState<{ value: string; label: string }[]>([])
  const router = useRouter()
  const toast = useToast()
  const { user, isAuthenticated } = useAuth()

  const handleNewScan = async () => {
    if (!selectedRepo) {
      toast.error('Please select a repository')
      return
    }
    toast.success('Security scan initiated', `Starting ${scanType} scan on ${selectedRepo}`)
    setShowNewScanModal(false)
    setSelectedRepo('')
    setScanBranch('main')
    setScanType('full')
  }

  const handleViewFinding = (id: number) => {
    router.push(`/secrets?id=${id}`)
  }

  const handleRotateSecret = (id: number) => {
    toast.warning('Secret rotation initiated', 'Please follow the rotation workflow')
  }

  const handleAssignOwner = (id: number) => {
    toast.info('Opening team assignment...')
  }

  const handleIgnoreFinding = (id: number) => {
    toast.info('Finding marked for review')
  }

  useEffect(() => {
    const fetchDashboardData = async () => {
      if (!isAuthenticated) {
        setLoading(false)
        return
      }

      try {
        try {
          const response = await fetch('/api/stats', { headers: getAuthHeaders() })
          if (response.ok) {
            const stats = await response.json()
            // Always use scanner API stats if available (even if all zeros for new users)
            console.log('[DASHBOARD] Loaded stats from scanner API', stats)
            
            const dashboardData = {
              ...emptyDashboardData,
              kpiStats: {
                secrets_detected: stats.totalSecrets || 0,
                critical_issues: stats.criticalSecrets || 0,
                mttr_hours: 0,
                repositories_monitored: stats.totalRepos || 0,
                secrets_trend: 0,
                critical_trend: 0,
                mttr_trend: 0,
                repos_trend: 0,
              },
              risk_distribution: stats.secretsBySeverity || { critical: 0, high: 0, medium: 0, low: 0 },
              recent_scans: (stats.recentScans || []).map((s: any) => ({
                id: s.id,
                repository_name: s.repository_name || 'Unknown',
                status: s.status,
                branch: s.branch || 'main',
                secrets_found: s.secrets_found || 0,
                duration: s.duration_seconds ? `${s.duration_seconds}s` : '--',
                started_at: s.started_at ? new Date(s.started_at).toLocaleString() : '--',
                triggered_by: s.trigger_type || 'Manual',
              })),
            }
            
            setData(dashboardData)
            setLoading(false)
            return
          }
        } catch (apiErr) {
          console.log('[DASHBOARD] Scanner API not available, using fallback')
        }

        // Fallback: demo data or Supabase
        if (isDemoMode()) {
          setData(DEMO_DASHBOARD_DATA)
          setRepositories(DEMO_REPOSITORIES.map(repo => ({
            value: repo.name,
            label: repo.name,
          })))
          setLoading(false)
          return
        }

        // Fetch real data from Supabase
        const [reposData, secretsData, scansData, alertsData] = await Promise.all([
          repositoryService.getAll(),
          secretService.getAll(),
          scanService.getAll(),
          alertService.getAll(),
        ])

        // Process repositories for dropdown
        const repoOptions = reposData.map((repo: any) => ({
          value: repo.name,
          label: repo.name,
        }))
        setRepositories(repoOptions)

        // Calculate statistics from real data
        const criticalSecrets = secretsData.filter((s: any) => s.severity === 'critical')
        const highSecrets = secretsData.filter((s: any) => s.severity === 'high')
        const mediumSecrets = secretsData.filter((s: any) => s.severity === 'medium')
        const lowSecrets = secretsData.filter((s: any) => s.severity === 'low')

        // Build dashboard data from real records
        const dashboardData = {
          ...emptyDashboardData,
          kpiStats: {
            secrets_detected: secretsData.length,
            critical_issues: criticalSecrets.length,
            mttr_hours: 0,
            repositories_monitored: reposData.length,
            secrets_trend: 0,
            critical_trend: 0,
            mttr_trend: 0,
            repos_trend: 0,
          },
          risk_distribution: {
            critical: criticalSecrets.length,
            high: highSecrets.length,
            medium: mediumSecrets.length,
            low: lowSecrets.length,
          },
          critical_findings: secretsData
            .filter((s: any) => s.severity === 'critical' || s.severity === 'high')
            .slice(0, 10)
            .map((s: any, idx: number) => ({
              id: s.id || idx + 1,
              type: s.secret_type || 'Unknown',
              severity: s.severity || 'medium',
              repository: s.repository?.name || 'Unknown',
              file_path: s.file_path || '',
              line_number: s.line_number || 0,
              environment: s.environment || 'development',
              detected_at: s.created_at ? new Date(s.created_at).toLocaleString() : 'Unknown',
              assigned_team: null,
              status: s.status || 'open',
              masked_value: s.masked_value || '***',
            })),
          recent_scans: scansData.slice(0, 5).map((scan: any, idx: number) => ({
            id: scan.id || idx + 1,
            repository_name: scan.repository?.name || 'Unknown',
            status: scan.status || 'completed',
            branch: scan.branch || 'main',
            secrets_found: scan.secrets_found || 0,
            duration: scan.duration || '--',
            started_at: scan.created_at ? new Date(scan.created_at).toLocaleString() : 'Unknown',
            triggered_by: scan.triggered_by || 'Manual',
          })),
          alerts: alertsData.slice(0, 5).map((alert: any) => ({
            id: alert.id,
            type: alert.severity || 'info',
            title: alert.title || 'Alert',
            message: alert.message || '',
            repository: alert.repository?.name || '',
            created_at: alert.created_at ? new Date(alert.created_at).toLocaleString() : 'Unknown',
            is_read: alert.is_read || false,
          })),
          risky_repositories: reposData
            .map((repo: any) => ({
              id: repo.id,
              name: repo.name,
              risk_score: repo.risk_score || 0,
              critical_count: 0,
              high_count: 0,
              medium_count: 0,
              low_count: 0,
              trend: 'stable' as const,
              last_scan: repo.last_scan_at ? new Date(repo.last_scan_at).toLocaleString() : 'Never',
            }))
            .sort((a: any, b: any) => b.risk_score - a.risk_score)
            .slice(0, 5),
          recent_alerts_count: alertsData.filter((a: any) => !a.is_read).length,
        }

        setData(dashboardData)
      } catch (err: any) {
        console.error('Failed to fetch dashboard data:', err)
        setData(emptyDashboardData)
      } finally {
        setLoading(false)
      }
    }

    fetchDashboardData()
  }, [isAuthenticated])

  // Check if this is a new/empty account
  const isNewAccount = data.kpiStats.repositories_monitored === 0 && data.kpiStats.secrets_detected === 0

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: 'var(--bg-primary)' }}>
      <Sidebar isOpen={sidebarOpen} onToggle={() => setSidebarOpen(!sidebarOpen)} />
      
      <div className="flex-1 flex flex-col min-w-0">
        <Header 
          alertCount={data?.recent_alerts_count || 0}
          onMenuClick={() => setSidebarOpen(!sidebarOpen)}
        />
        
        <main className="flex-1 overflow-y-auto overflow-x-hidden" style={{ background: 'var(--bg-primary)' }}>
          <div className="max-w-[1400px] mx-auto px-6 py-6 space-y-6">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
              <div>
                <h1 className="text-2xl font-bold text-[var(--text-primary)]">Security Dashboard</h1>
                <p className="text-[var(--text-muted)] mt-1">Monitor and remediate security vulnerabilities in real-time</p>
              </div>
              <div className="flex items-center gap-3">
                <button 
                  onClick={() => setShowNewScanModal(true)}
                  className="btn btn-primary"
                  disabled={repositories.length === 0}
                >
                  <Radar className="w-4 h-4" />
                  Run Security Scan
                </button>
              </div>
            </div>

            {/* Welcome Banner for New Users */}
            {isNewAccount && !loading && (
              <div className="card p-8 text-center border-2 border-dashed border-[var(--border-color)]">
                <div className="w-16 h-16 rounded-2xl bg-blue-500/20 flex items-center justify-center mx-auto mb-4">
                  <Shield className="w-8 h-8 text-blue-400" />
                </div>
                <h2 className="text-xl font-semibold text-[var(--text-primary)] mb-2">Welcome to Vault Sentry!</h2>
                <p className="text-[var(--text-muted)] mb-6 max-w-md mx-auto">
                  Get started by connecting your first repository. We'll automatically scan for exposed secrets and security vulnerabilities.
                </p>
                <div className="flex items-center justify-center gap-4">
                  <button 
                    onClick={() => router.push('/repositories')}
                    className="btn btn-primary"
                  >
                    <FolderGit2 className="w-4 h-4" />
                    Add Repository
                  </button>
                  <button 
                    onClick={() => router.push('/settings')}
                    className="btn btn-secondary"
                  >
                    <Plus className="w-4 h-4" />
                    Configure Integrations
                  </button>
                </div>
              </div>
            )}
            
            <ExecutiveKPIs 
              stats={data?.kpiStats || emptyDashboardData.kpiStats}
              loading={loading}
            />
            
            {!isNewAccount && (
              <>
                <div className="grid grid-cols-12 gap-6">
                  <div className="col-span-12 lg:col-span-7">
                    <div className="dashboard-card min-h-[360px] flex flex-col">
                      <SecretLifecycle 
                        stats={data?.secret_lifecycle || emptyDashboardData.secret_lifecycle}
                        metrics={data?.lifecycle_metrics || emptyDashboardData.lifecycle_metrics}
                        loading={loading}
                      />
                    </div>
                  </div>
                  
                  <div className="col-span-12 lg:col-span-5">
                    <div className="dashboard-card min-h-[360px] flex flex-col">
                      <MLInsightsPanel
                        modelInfo={data?.ml_model || emptyDashboardData.ml_model}
                        featureImportance={data?.feature_importance || emptyDashboardData.feature_importance}
                        recentPredictions={data?.ml_predictions || emptyDashboardData.ml_predictions}
                        loading={loading}
                        onRetrain={() => toast.info('Model retraining initiated...')}
                      />
                    </div>
                  </div>
                </div>

                <RepositoryRiskRanking 
                  repositories={data?.risky_repositories || emptyDashboardData.risky_repositories}
                  loading={loading}
                />

                <div className="grid grid-cols-12 gap-6">
                  <div className="col-span-12 lg:col-span-6">
                    <RiskPieChart 
                      data={[
                        { name: 'Critical', value: data?.risk_distribution.critical || 0, color: '#ef4444' },
                        { name: 'High', value: data?.risk_distribution.high || 0, color: '#f97316' },
                        { name: 'Medium', value: data?.risk_distribution.medium || 0, color: '#f59e0b' },
                        { name: 'Low', value: data?.risk_distribution.low || 0, color: '#22c55e' },
                      ]}
                      loading={loading}
                    />
                  </div>
                  
                  <div className="col-span-12 lg:col-span-6">
                    <RiskTrendChart 
                      data={data?.risk_trend || emptyDashboardData.risk_trend}
                      loading={loading}
                    />
                  </div>
                </div>
                
                <ScanActivityChart data={data?.scan_activity || emptyDashboardData.scan_activity} />
                
                {/* Trend Graphs Section */}
                <div className="grid grid-cols-12 gap-6">
                  <div className="col-span-12 lg:col-span-8">
                    <TrendGraph 
                      title="Secrets Detection Trend" 
                      type="area" 
                      height={280}
                    />
                  </div>
                  <div className="col-span-12 lg:col-span-4">
                    <SeverityDistribution />
                  </div>
                </div>

                <div className="grid grid-cols-12 gap-6">
                  <div className="col-span-12 lg:col-span-6">
                    <ActivityHeatmap />
                  </div>
                  <div className="col-span-12 lg:col-span-6">
                    <TrendGraph 
                      title="Weekly Comparison" 
                      type="bar" 
                      height={250}
                      showLegend={true}
                    />
                  </div>
                </div>

                <CriticalFindingsTable 
                  findings={data?.critical_findings || emptyDashboardData.critical_findings}
                  loading={loading}
                  onViewFinding={handleViewFinding}
                  onRotateSecret={handleRotateSecret}
                  onAssignOwner={handleAssignOwner}
                  onIgnore={handleIgnoreFinding}
                />
                
                <div className="grid grid-cols-12 gap-6">
                  <div className="col-span-12 lg:col-span-7">
                    <RecentScansTable scans={data?.recent_scans || emptyDashboardData.recent_scans} />
                  </div>
                  
                  <div className="col-span-12 lg:col-span-5 space-y-6">
                    <AlertsPanel alerts={data?.alerts || emptyDashboardData.alerts} />
                    <IntegrationStatus 
                      integrations={data?.integrations || emptyDashboardData.integrations}
                      loading={loading}
                      onSync={(id) => toast.info(`Syncing integration ${id}...`)}
                      onConfigure={(id) => toast.info('Opening configuration...')}
                      onTestWebhook={(id) => toast.info('Testing webhook...')}
                    />
                  </div>
                </div>
              </>
            )}
          </div>
        </main>

        <Modal
          isOpen={showNewScanModal}
          onClose={() => setShowNewScanModal(false)}
          title="Run Security Scan"
        >
          <div className="space-y-4">
            {repositories.length === 0 ? (
              <div className="text-center py-6">
                <FolderGit2 className="w-12 h-12 text-[var(--text-muted)] mx-auto mb-3" />
                <p className="text-[var(--text-muted)] mb-4">No repositories connected yet.</p>
                <button 
                  onClick={() => {
                    setShowNewScanModal(false)
                    router.push('/repositories')
                  }}
                  className="btn btn-primary"
                >
                  <Plus className="w-4 h-4" />
                  Add Repository
                </button>
              </div>
            ) : (
              <>
                <div>
                  <label className="block text-sm text-[var(--text-muted)] mb-2">Repository</label>
                  <Select 
                    className="w-full"
                    placeholder="Select a repository"
                    value={selectedRepo}
                    onChange={(value) => setSelectedRepo(value)}
                    options={repositories}
                  />
                </div>
                <div>
                  <label className="block text-sm text-[var(--text-muted)] mb-2">Branch</label>
                  <input
                    type="text"
                    placeholder="main"
                    value={scanBranch}
                    onChange={(e) => setScanBranch(e.target.value)}
                    className="input"
                  />
                </div>
                <div>
                  <label className="block text-sm text-[var(--text-muted)] mb-2">Scan Type</label>
                  <Select 
                    className="w-full"
                    value={scanType}
                    onChange={(value) => setScanType(value)}
                    options={[
                      { value: 'full', label: 'Full Scan - Deep analysis of all files' },
                      { value: 'quick', label: 'Quick Scan - Common patterns only' },
                      { value: 'incremental', label: 'Incremental - Changes since last scan' },
                    ]}
                  />
                </div>
                <div className="flex justify-end gap-3 pt-4 border-t border-[var(--border-color)]">
                  <Button variant="secondary" onClick={() => setShowNewScanModal(false)}>
                    Cancel
                  </Button>
                  <button onClick={handleNewScan} className="btn btn-primary">
                    <Radar className="w-4 h-4" />
                    Start Scan
                  </button>
                </div>
              </>
            )}
          </div>
        </Modal>
      </div>
    </div>
  )
}
