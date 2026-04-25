'use client'

import AlertsPanel from '@/components/dashboard/AlertsPanel'
import { getAuthHeaders } from '@/lib/authHeaders'
import CriticalFindingsTable from '@/components/dashboard/CriticalFindingsTable'
import ExecutiveKPIs from '@/components/dashboard/ExecutiveKPIs'
import RecentScansTable from '@/components/dashboard/RecentScansTable'
import RepositoryRiskRanking from '@/components/dashboard/RepositoryRiskRanking'
import RiskPieChart from '@/components/dashboard/RiskPieChart'
import RiskTrendChart from '@/components/dashboard/RiskTrendChart'
import LandingPage from '@/components/landing/LandingPage'
import Header from '@/components/layout/Header'
import Sidebar from '@/components/layout/Sidebar'
import { Button, Modal, Select } from '@/components/ui'
import { useAuth } from '@/contexts/AuthContext'
import { useToast } from '@/contexts/ToastContext'
import { DEMO_DASHBOARD_DATA, DEMO_REPOSITORIES, isDemoMode } from '@/lib/demoData'
import { waitForScanCompletion } from '@/lib/pollScan'
import { runPoliciesForScan } from '@/lib/runPoliciesForScan'
import { alertService, repositoryService, scanService, secretService } from '@/services/supabase'
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Clock,
  FolderGit2,
  Gauge,
  Loader2,
  Plus,
  Radar,
  ShieldCheck,
  TrendingUp,
} from 'lucide-react'
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
  stale_repositories: [] as { id: number | string; name: string; last_scan_at: string | null; days_since: number }[],
  running_scans: [] as { id: number | string; repository_name: string; branch?: string }[],
  top_secret_types: [] as { type: string; count: number }[],
  recent_alerts_count: 0,
  // 14-day trend series for the live secrets-detection graph.
  trend_data: [] as { date: string; secrets: number; scans: number; resolved: number; critical: number }[],
  // Raw ISO timestamps for the activity heatmap.
  scan_timestamps: [] as { started_at: string }[],
}

/* ------------------------------------------------------------------ */
/*  Real-time derivations from raw scan records                        */
/* ------------------------------------------------------------------ */

/** Build a 14-day `{date, secrets, scans, resolved, critical}` series by
 *  bucketing raw scan records by their `started_at` day. Missing days stay
 *  zero so the chart x-axis is always continuous. */
function buildTrendSeries(
  rawScans: Array<{ started_at?: string | null; secrets_found?: number; status?: string }>,
  criticalCount = 0,
) {
  const buckets: Record<string, { secrets: number; scans: number; resolved: number; critical: number }> = {}
  for (let i = 13; i >= 0; i--) {
    const d = new Date()
    d.setHours(0, 0, 0, 0)
    d.setDate(d.getDate() - i)
    buckets[d.toDateString()] = { secrets: 0, scans: 0, resolved: 0, critical: 0 }
  }
  const cutoff = Date.now() - 14 * 24 * 3600 * 1000
  for (const s of rawScans) {
    if (!s.started_at) continue
    const t = new Date(s.started_at).getTime()
    if (!Number.isFinite(t) || t < cutoff) continue
    const key = new Date(t).toDateString()
    const b = buckets[key]
    if (!b) continue
    b.scans += 1
    b.secrets += s.secrets_found || 0
    if (s.status === 'completed' && (s.secrets_found || 0) === 0) b.resolved += 1
  }
  // Distribute critical count onto the most recent day — best-effort since
  // the stats endpoint gives us totals, not per-day criticals.
  const lastKey = Object.keys(buckets).slice(-1)[0]
  if (lastKey) buckets[lastKey].critical = criticalCount

  return Object.entries(buckets).map(([dateStr, v]) => ({
    date: new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    ...v,
  }))
}

/** Repos whose last scan is older than `staleDays` (or never scanned). */
function deriveStaleRepos(repos: any[], staleDays = 7) {
  const now = Date.now()
  const threshold = staleDays * 24 * 3600 * 1000
  return repos
    .map((r) => {
      const ts = r.last_scan_at || r.last_scan || null
      const t = ts ? new Date(ts).getTime() : 0
      const days_since = t ? Math.floor((now - t) / (24 * 3600 * 1000)) : Infinity
      return { id: r.id, name: r.name, last_scan_at: ts, days_since }
    })
    .filter((r) => !r.last_scan_at || now - new Date(r.last_scan_at).getTime() > threshold)
    .sort((a, b) => (b.days_since === Infinity ? 1 : a.days_since === Infinity ? -1 : b.days_since - a.days_since))
    .slice(0, 5)
}

/** Top N secret types by count. */
function deriveTopSecretTypes(secrets: any[], n = 5) {
  const counts: Record<string, number> = {}
  for (const s of secrets) {
    const t = s.secret_type || s.type || 'Unknown'
    counts[t] = (counts[t] || 0) + 1
  }
  return Object.entries(counts)
    .map(([type, count]) => ({ type, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, n)
}

export default function Dashboard() {
  const [data, setData] = useState<typeof emptyDashboardData>(emptyDashboardData)
  const [loading, setLoading] = useState(true)
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [showNewScanModal, setShowNewScanModal] = useState(false)
  const [selectedRepo, setSelectedRepo] = useState('')
  const [scanBranch, setScanBranch] = useState('main')
  const [scanType, setScanType] = useState('full')
  const [repositories, setRepositories] = useState<{ value: string; label: string; id?: number; url?: string }[]>([])
  const router = useRouter()
  const toast = useToast()
  const { user, supabaseUser, isAuthenticated, isLoading: authLoading } = useAuth()

  // Time-of-day greeting for the welcome banner.
  const greeting = (() => {
    const h = new Date().getHours()
    if (h < 5) return 'Working late'
    if (h < 12) return 'Good morning'
    if (h < 17) return 'Good afternoon'
    if (h < 21) return 'Good evening'
    return 'Working late'
  })()
  const displayName =
    user?.full_name ||
    (supabaseUser?.user_metadata as any)?.full_name ||
    supabaseUser?.email?.split('@')[0] ||
    user?.email?.split('@')[0] ||
    'there'
  const firstName = String(displayName).split(' ')[0]
  const todayLabel = new Date().toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  })

  const handleNewScan = async () => {
    if (!selectedRepo) {
      toast.error('Please select a repository')
      return
    }

    const repo = repositories.find((r) => r.value === selectedRepo)
    if (!repo || !repo.id) {
      toast.error('Repository not found', 'Try refreshing the page')
      return
    }

    try {
      const response = await fetch('/api/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify({
          scan_id: repo.id,
          repository_id: repo.id,
          repository_url: repo.url,
          branch: scanBranch || 'main',
        }),
      })

      if (!response.ok) {
        const err = await response.json().catch(() => ({}))
        toast.error('Scan failed', err?.detail || err?.error || `Backend returned ${response.status}`)
        return
      }

      // Capture the scanner's real scan_id — we NEED this for polling, because
      // the scanner assigns its own internal repository_id that doesn't match
      // the Supabase repo id, so list-based matching would never hit.
      const triggerData = await response.json().catch(() => ({}))
      const scanId = triggerData?.scan_id

      toast.info('Scan started', `Scanning ${selectedRepo}…`)
      setShowNewScanModal(false)
      setSelectedRepo('')
      setScanBranch('main')
      setScanType('full')

      const repoName = repo.label
      const result = await waitForScanCompletion(repo.id, { scanId })
      console.log('[DASHBOARD SCAN] final result', result)

      if (result.status === 'completed') {
        if (result.secretsFound > 0) {
          toast.warning(
            `Scan complete · ${result.secretsFound} secret${result.secretsFound === 1 ? '' : 's'} found`,
            `${repoName} — review findings on the Secrets page`,
          )

          // Run any user-configured policies against the new findings.
          try {
            const outcome = await runPoliciesForScan({ repoName })
            if (outcome.firedPolicies > 0) {
              for (const alert of outcome.alerts) {
                toast.warning(
                  `Policy triggered · ${alert.policyName}`,
                  `${alert.findings.length} finding${alert.findings.length === 1 ? '' : 's'} in ${repoName}`,
                )
              }
              const failed = outcome.executions.filter((e) => e.status === 'failed').length
              if (failed > 0) {
                toast.error(
                  `${failed} policy action${failed === 1 ? '' : 's'} failed`,
                  'See the Policies page for details',
                )
              } else if (outcome.alerts.length === 0) {
                toast.info(
                  `${outcome.firedPolicies} polic${outcome.firedPolicies === 1 ? 'y' : 'ies'} fired`,
                  'View details on the Policies page',
                )
              }
            }
          } catch (policyErr) {
            console.warn('[POLICY] Dashboard evaluation failed:', policyErr)
          }
        } else {
          toast.success('Scan complete ✓', `${repoName} — no secrets found`)
        }
      } else if (result.status === 'failed') {
        toast.error('Scan failed', `${repoName} could not be scanned`)
      } else if (result.status === 'cancelled') {
        toast.info('Scan cancelled', repoName)
      } else {
        toast.info('Scan still running', `${repoName} — check the Scans page for progress`)
      }
    } catch (err) {
      console.error('[SCAN] trigger failed', err)
      toast.error('Scanner offline', 'Backend not reachable')
    }
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
              recent_scans: (stats.recentScans || []).slice(0, 5).map((s: any) => ({
                id: s.id,
                repository_name: s.repository_name || 'Unknown',
                status: s.status,
                branch: s.branch || 'main',
                secrets_found: s.secrets_found || 0,
                duration: s.duration_seconds ? `${s.duration_seconds}s` : '--',
                started_at: s.started_at ? new Date(s.started_at).toLocaleString() : '--',
                triggered_by: s.trigger_type || 'Manual',
              })),
              // Real-time series derived from raw scan timestamps.
              trend_data: buildTrendSeries(stats.recentScans || [], stats.criticalSecrets || 0),
              scan_timestamps: (stats.recentScans || [])
                .filter((s: any) => s.started_at)
                .map((s: any) => ({ started_at: s.started_at as string })),
              running_scans: (stats.recentScans || [])
                .filter((s: any) => s.status === 'running' || s.status === 'in_progress')
                .map((s: any) => ({
                  id: s.id,
                  repository_name: s.repository_name || 'Unknown',
                  branch: s.branch,
                })),
            }

            // Enrichment: stale repos + top secret types from Supabase.
            // Best-effort — silently skipped if unavailable.
            try {
              const [reposData, secretsData] = await Promise.all([
                repositoryService.getAll().catch(() => []),
                secretService.getAll().catch(() => []),
              ])
              dashboardData.stale_repositories = deriveStaleRepos(reposData || [])
              dashboardData.top_secret_types = deriveTopSecretTypes(secretsData || [])
            } catch {
              /* enrichment optional */
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

        // Process repositories for dropdown — keep id + url so scan can call backend
        const repoOptions = reposData.map((repo: any) => ({
          value: repo.name,
          label: repo.name,
          id: repo.id,
          url: repo.url || repo.clone_url,
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
              ml_confidence: s.ml_confidence ?? s.confidence ?? null,
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
          // Real-time trend + heatmap source, derived from every scan record
          // (not just the 5 most recent shown in the table).
          trend_data: buildTrendSeries(
            scansData.map((s: any) => ({
              started_at: s.created_at,
              secrets_found: s.secrets_found,
              status: s.status,
            })),
            criticalSecrets.length,
          ),
          scan_timestamps: scansData
            .filter((s: any) => s.created_at)
            .map((s: any) => ({ started_at: s.created_at as string })),
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
          stale_repositories: deriveStaleRepos(reposData),
          top_secret_types: deriveTopSecretTypes(secretsData),
          running_scans: scansData
            .filter((s: any) => s.status === 'running' || s.status === 'in_progress')
            .slice(0, 10)
            .map((s: any) => ({
              id: s.id,
              repository_name: s.repository?.name || 'Unknown',
              branch: s.branch,
            })),
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

    // Live refresh — re-pull every 30s while the tab is visible so
    // trend/heatmap/severity charts reflect recent scans without a manual
    // page reload. Skipping updates while hidden avoids pointless fetches
    // on background tabs.
    if (!isAuthenticated) return
    const interval = setInterval(() => {
      if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
        fetchDashboardData()
      }
    }, 30_000)
    return () => clearInterval(interval)
  }, [isAuthenticated])

  // Unauthenticated visitors see the marketing landing page
  if (!authLoading && !isAuthenticated) {
    return <LandingPage />
  }

  // Check if this is a new/empty account
  const isNewAccount = data.kpiStats.repositories_monitored === 0 && data.kpiStats.secrets_detected === 0

  // Security posture — quick heuristic so the hero card can give the user a
  // one-glance signal. 100 is clean; each critical costs 15, each high 5.
  const postureScore = Math.max(
    0,
    100 -
      (data?.risk_distribution?.critical ?? 0) * 15 -
      (data?.risk_distribution?.high ?? 0) * 5 -
      (data?.risk_distribution?.medium ?? 0) * 2,
  )
  const postureLabel =
    postureScore >= 90
      ? 'Excellent'
      : postureScore >= 75
      ? 'Healthy'
      : postureScore >= 50
      ? 'Needs attention'
      : 'At risk'
  const postureAccent =
    postureScore >= 90
      ? 'text-emerald-400'
      : postureScore >= 75
      ? 'text-blue-400'
      : postureScore >= 50
      ? 'text-amber-400'
      : 'text-red-400'
  const postureRing =
    postureScore >= 90
      ? 'from-emerald-500/40 to-emerald-500/0'
      : postureScore >= 75
      ? 'from-blue-500/40 to-blue-500/0'
      : postureScore >= 50
      ? 'from-amber-500/40 to-amber-500/0'
      : 'from-red-500/40 to-red-500/0'

  return (
    <div
      className="fixed inset-0 flex overflow-hidden"
      style={{ background: 'var(--bg-primary)' }}
    >
      <Sidebar isOpen={sidebarOpen} onToggle={() => setSidebarOpen(!sidebarOpen)} />
      
      <div className="flex-1 flex flex-col min-w-0">
        <Header 
          alertCount={data?.recent_alerts_count || 0}
          onMenuClick={() => setSidebarOpen(!sidebarOpen)}
        />
        
        <main className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden" style={{ background: 'var(--bg-primary)' }}>
          <div className="max-w-[1400px] mx-auto px-6 pt-5 pb-8 space-y-6">
            {/* ============================================================ */}
            {/*  Hero — greeting + security posture score + primary actions  */}
            {/* ============================================================ */}
            <section
              className="relative overflow-hidden rounded-3xl border border-[var(--border-color)] bg-gradient-to-br from-[var(--bg-secondary)] via-[var(--bg-secondary)] to-[var(--bg-tertiary)]"
            >
              {/* decorative accent glow */}
              <div
                aria-hidden
                className={`pointer-events-none absolute -top-32 -right-32 h-80 w-80 rounded-full bg-gradient-to-br ${postureRing} blur-3xl`}
              />
              <div
                aria-hidden
                className="pointer-events-none absolute -bottom-20 -left-20 h-64 w-64 rounded-full bg-blue-500/10 blur-3xl"
              />

              <div className="relative grid grid-cols-1 lg:grid-cols-3 gap-6 p-6 md:p-8">
                {/* Greeting + CTAs */}
                <div className="lg:col-span-2 min-w-0 flex flex-col justify-between gap-6">
                  <div>
                    <p className="text-xs font-medium uppercase tracking-[0.2em] text-[var(--text-muted)]">
                      {todayLabel}
                    </p>
                    <h1 className="mt-2 text-3xl md:text-4xl font-bold text-[var(--text-primary)] tracking-tight">
                      {greeting}, <span className="bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">{firstName}</span>
                    </h1>
                    <p className="mt-3 text-[var(--text-muted)] max-w-2xl leading-relaxed">
                      {(data?.kpiStats?.critical_issues ?? 0) > 0
                        ? `You have ${data.kpiStats.critical_issues} critical finding${
                            data.kpiStats.critical_issues === 1 ? '' : 's'
                          } that need attention. Review and rotate exposed secrets below.`
                        : repositories.length === 0
                        ? 'Welcome to VaultSentry. Connect your first repository to start scanning for exposed secrets.'
                        : 'All monitored repositories are clean. Run a fresh scan any time.'}
                    </p>

                    {(data?.running_scans?.length ?? 0) > 0 && (
                      <div className="mt-4 inline-flex items-center gap-2 rounded-full border border-blue-500/30 bg-blue-500/10 px-3 py-1.5 text-xs font-medium text-blue-300">
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        <span>
                          {data.running_scans.length} scan
                          {data.running_scans.length === 1 ? '' : 's'} running
                        </span>
                        <span className="text-blue-300/70">·</span>
                        <span className="truncate max-w-[260px] text-blue-200/80">
                          {data.running_scans
                            .slice(0, 3)
                            .map((s) => s.repository_name)
                            .join(', ')}
                          {data.running_scans.length > 3 ? ` +${data.running_scans.length - 3}` : ''}
                        </span>
                      </div>
                    )}
                  </div>

                  {!isNewAccount && (
                    <div className="flex flex-wrap items-center gap-3">
                      <button
                        onClick={() => setShowNewScanModal(true)}
                        className="btn btn-primary"
                        disabled={repositories.length === 0}
                      >
                        <Radar className="w-4 h-4" />
                        Run Security Scan
                      </button>
                      <button
                        onClick={() => router.push('/repositories')}
                        className="btn btn-secondary"
                      >
                        <FolderGit2 className="w-4 h-4" />
                        Repositories
                      </button>
                      <button
                        onClick={() => router.push('/secrets')}
                        className="inline-flex items-center gap-1.5 text-sm font-medium text-[var(--text-secondary)] hover:text-blue-400 transition-colors ml-1"
                      >
                        View all findings
                        <ArrowRight className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                </div>

                {/* Security posture card */}
                {!isNewAccount && (
                  <div className="relative rounded-2xl border border-[var(--border-color)] bg-[var(--bg-primary)]/60 backdrop-blur p-5">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <Gauge className="w-4 h-4 text-[var(--text-muted)]" />
                        <p className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                          Security Posture
                        </p>
                      </div>
                      <span className={`text-xs font-medium ${postureAccent}`}>{postureLabel}</span>
                    </div>
                    <div className="flex items-end gap-3">
                      <p className={`text-5xl font-bold leading-none ${postureAccent}`}>{postureScore}</p>
                      <p className="text-sm text-[var(--text-muted)] mb-1.5">/ 100</p>
                    </div>
                    <div className="mt-4 h-1.5 w-full rounded-full bg-[var(--bg-tertiary)] overflow-hidden">
                      <div
                        className={`h-full rounded-full bg-gradient-to-r ${
                          postureScore >= 90
                            ? 'from-emerald-500 to-emerald-400'
                            : postureScore >= 75
                            ? 'from-blue-500 to-blue-400'
                            : postureScore >= 50
                            ? 'from-amber-500 to-amber-400'
                            : 'from-red-500 to-red-400'
                        } transition-all duration-700`}
                        style={{ width: `${postureScore}%` }}
                      />
                    </div>
                    <div className="mt-4 grid grid-cols-3 gap-2 text-center">
                      <div>
                        <p className="text-xs text-[var(--text-muted)]">Repos</p>
                        <p className="text-sm font-semibold text-[var(--text-primary)] mt-0.5">
                          {data?.kpiStats?.repositories_monitored ?? 0}
                        </p>
                      </div>
                      <div className="border-x border-[var(--border-color)]">
                        <p className="text-xs text-[var(--text-muted)]">Critical</p>
                        <p className="text-sm font-semibold text-red-400 mt-0.5">
                          {data?.kpiStats?.critical_issues ?? 0}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-[var(--text-muted)]">Total</p>
                        <p className="text-sm font-semibold text-[var(--text-primary)] mt-0.5">
                          {data?.kpiStats?.secrets_detected ?? 0}
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </section>

            {/* ============================================================ */}
            {/*  Empty state for new users                                    */}
            {/* ============================================================ */}
            {isNewAccount && !loading && (
              <section className="card p-10 text-center border-2 border-dashed border-[var(--border-color)] relative overflow-hidden">
                <div
                  aria-hidden
                  className="absolute inset-0 pointer-events-none opacity-50"
                  style={{
                    background:
                      'radial-gradient(circle at 50% 0%, rgba(59,130,246,0.15), transparent 60%)',
                  }}
                />
                <div className="relative">
                  <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-blue-500/20 to-purple-500/20 flex items-center justify-center mx-auto mb-5 ring-1 ring-blue-500/30">
                    <ShieldCheck className="w-10 h-10 text-blue-400" />
                  </div>
                  <h2 className="text-2xl font-bold text-[var(--text-primary)] mb-2">
                    Welcome to VaultSentry
                  </h2>
                  <p className="text-[var(--text-muted)] mb-7 max-w-lg mx-auto leading-relaxed">
                    Connect your first repository and we will automatically scan for exposed API
                    keys, credentials, and security vulnerabilities.
                  </p>
                  <div className="flex items-center justify-center gap-3 flex-wrap">
                    <button
                      onClick={() => router.push('/repositories')}
                      className="btn btn-primary"
                    >
                      <FolderGit2 className="w-4 h-4" />
                      Add Repository
                    </button>
                    <button
                      onClick={() => router.push('/integrations')}
                      className="btn btn-secondary"
                    >
                      <Plus className="w-4 h-4" />
                      Configure Integrations
                    </button>
                  </div>
                </div>
              </section>
            )}

            {/* ============================================================ */}
            {/*  Stale-scan watchlist — repos not scanned in >7 days          */}
            {/* ============================================================ */}
            {!isNewAccount && (data?.stale_repositories?.length ?? 0) > 0 && (
              <section className="relative overflow-hidden rounded-2xl border border-amber-500/30 bg-amber-500/5 p-5">
                <div className="flex items-start gap-4">
                  <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-amber-500/15 text-amber-400">
                    <Clock className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-semibold text-amber-200">
                        {data.stale_repositories.length} repositor
                        {data.stale_repositories.length === 1 ? 'y' : 'ies'} need{data.stale_repositories.length === 1 ? 's' : ''} a fresh scan
                      </p>
                      <button
                        onClick={() => router.push('/repositories')}
                        className="inline-flex items-center gap-1 text-xs font-medium text-amber-300 hover:text-amber-200"
                      >
                        Review all
                        <ArrowRight className="h-3.5 w-3.5" />
                      </button>
                    </div>
                    <p className="mt-1 text-xs text-amber-200/70">
                      Coverage gaps are how leaks ship — these haven't been scanned in over a week.
                    </p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {data.stale_repositories.map((r) => (
                        <span
                          key={String(r.id)}
                          className="inline-flex items-center gap-1.5 rounded-md border border-amber-500/20 bg-[var(--bg-secondary)] px-2.5 py-1 text-xs"
                        >
                          <span className="font-medium text-[var(--text-primary)]">{r.name}</span>
                          <span className="text-[var(--text-muted)]">·</span>
                          <span className="text-amber-300">
                            {r.last_scan_at ? `${r.days_since}d ago` : 'never'}
                          </span>
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </section>
            )}

            {/* ============================================================ */}
            {/*  Executive KPIs (always shown — provides key metrics)         */}
            {/* ============================================================ */}
            <section>
              <SectionHeading
                icon={<TrendingUp className="w-4 h-4" />}
                title="Key metrics"
                subtitle="At-a-glance view of your security posture"
              />
              <ExecutiveKPIs
                stats={data?.kpiStats || emptyDashboardData.kpiStats}
                loading={loading}
              />
            </section>

            {!isNewAccount && (
              <>
                {/* ======================================================== */}
                {/*  Risk overview — severity + trend + top risky repos      */}
                {/* ======================================================== */}
                <section>
                  <SectionHeading
                    icon={<AlertTriangle className="w-4 h-4" />}
                    title="Risk overview"
                    subtitle="Where exposure sits today and how it's trending"
                  />
                  <div className="grid grid-cols-12 gap-6 items-stretch">
                    <div className="col-span-12 lg:col-span-5 [&>*]:h-full">
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
                    <div className="col-span-12 lg:col-span-7 [&>*]:h-full">
                      <RiskTrendChart
                        data={data?.risk_trend || emptyDashboardData.risk_trend}
                        loading={loading}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-12 gap-6 mt-6 items-stretch">
                    <div className="col-span-12 lg:col-span-7 [&>*]:h-full">
                      <RepositoryRiskRanking
                        repositories={data?.risky_repositories || emptyDashboardData.risky_repositories}
                        loading={loading}
                      />
                    </div>
                    <div className="col-span-12 lg:col-span-5 [&>*]:h-full">
                      <TopSecretTypesCard types={data?.top_secret_types || []} />
                    </div>
                  </div>
                </section>

                {/* ======================================================== */}
                {/*  Activity & findings — what needs action + what just ran */}
                {/* ======================================================== */}
                <section>
                  <SectionHeading
                    icon={<CheckCircle2 className="w-4 h-4" />}
                    title="Activity & findings"
                    subtitle="Critical findings to action, plus recent scans and alerts"
                  />
                  <CriticalFindingsTable
                    findings={data?.critical_findings || emptyDashboardData.critical_findings}
                    loading={loading}
                    onViewFinding={handleViewFinding}
                    onRotateSecret={handleRotateSecret}
                    onAssignOwner={handleAssignOwner}
                    onIgnore={handleIgnoreFinding}
                  />
                  <div className="grid grid-cols-12 gap-6 mt-6 items-stretch">
                    <div className="col-span-12 lg:col-span-7 [&>*]:h-full">
                      <RecentScansTable scans={data?.recent_scans || emptyDashboardData.recent_scans} />
                    </div>
                    <div className="col-span-12 lg:col-span-5 [&>*]:h-full">
                      <AlertsPanel alerts={data?.alerts || emptyDashboardData.alerts} />
                    </div>
                  </div>
                </section>
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

/* ================================================================== */
/*  Small helper: consistent section header with icon + subtitle.      */
/*  Keeps the dashboard scannable by giving each block a clear title.  */
/* ================================================================== */
function TopSecretTypesCard({ types }: { types: { type: string; count: number }[] }) {
  const max = types.reduce((m, t) => Math.max(m, t.count), 0) || 1
  return (
    <div className="dashboard-card h-full">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-[var(--text-primary)]">Top secret types</h3>
          <p className="text-xs text-[var(--text-muted)] mt-0.5">
            What patterns dominate your exposure
          </p>
        </div>
        <ShieldCheck className="h-4 w-4 text-[var(--text-muted)]" />
      </div>
      {types.length === 0 ? (
        <div className="py-10 text-center text-sm text-[var(--text-muted)]">
          No secrets detected yet.
        </div>
      ) : (
        <ul className="space-y-2.5">
          {types.map((t) => (
            <li key={t.type}>
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="truncate font-medium text-[var(--text-secondary)]" title={t.type}>
                  {t.type}
                </span>
                <span className="ml-2 font-semibold text-[var(--text-primary)] tabular-nums">
                  {t.count}
                </span>
              </div>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-[var(--bg-tertiary)]">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-blue-500 to-purple-500 transition-all duration-500"
                  style={{ width: `${(t.count / max) * 100}%` }}
                />
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function SectionHeading({
  icon,
  title,
  subtitle,
}: {
  icon: React.ReactNode
  title: string
  subtitle?: string
}) {
  return (
    <div className="flex items-start justify-between mb-4">
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border-color)] flex items-center justify-center text-blue-400">
          {icon}
        </div>
        <div>
          <h2 className="text-base font-semibold text-[var(--text-primary)]">{title}</h2>
          {subtitle && <p className="text-xs text-[var(--text-muted)] mt-0.5">{subtitle}</p>}
        </div>
      </div>
    </div>
  )
}
