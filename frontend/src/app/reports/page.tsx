'use client'

import Header from '@/components/layout/Header'
import Sidebar from '@/components/layout/Sidebar'
import { Badge, Button, Card } from '@/components/ui'
import { getAuthHeaders } from '@/lib/authHeaders'
import { useToast } from '@/contexts/ToastContext'
import {
  AlertTriangle,
  CheckCircle,
  Download,
  FileDown,
  FileJson,
  FileSpreadsheet,
  FileText,
  Loader2,
  RefreshCw,
  Shield,
  ShieldAlert,
  Target,
} from 'lucide-react'
import { useEffect, useState } from 'react'

interface ReportData {
  report_type: string
  generated_at: string
  summary: {
    total_repositories: number
    total_scans: number
    completed_scans: number
    total_secrets: number
    active_secrets: number
    by_severity: { critical: number; high: number; medium: number; low: number }
  }
  repositories: Array<{ name: string; url: string; branch: string; secrets_count: number; last_scan_at: string | null }>
  scans: Array<{ id: number; repository: string; status: string; branch: string; files_scanned: number; secrets_found: number; duration_seconds: number; started_at: string | null; completed_at: string | null }>
  findings: Array<{ id: number; repository: string; type: string; severity: string; file: string; line: number; description: string; masked_value: string; status: string; detected_at: string }>
}

const sevColors: Record<string, string> = {
  critical: 'bg-red-500/20 text-red-400 border-red-500/30',
  high: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
  medium: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  low: 'bg-green-500/20 text-green-400 border-green-500/30',
}
const sevIcons: Record<string, React.ElementType> = {
  critical: ShieldAlert, high: AlertTriangle, medium: Shield, low: CheckCircle,
}

export default function ReportsPage() {
  const [report, setReport] = useState<ReportData | null>(null)
  const [loading, setLoading] = useState(true)
  const [downloading, setDownloading] = useState<string | null>(null)
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const toast = useToast()

  const fetchReport = async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/reports?type=full', { headers: getAuthHeaders() })
      if (response.ok) {
        const data = await response.json()
        setReport(data)
      }
    } catch (err) {
      console.error('[REPORT] Error:', err)
      toast.error('Report service unavailable')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchReport() }, [])

  const handleDownloadJSON = async () => {
    setDownloading('json')
    try {
      const response = await fetch('/api/reports?type=full', { headers: getAuthHeaders() })
      const data = await response.json()
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `vaultsentry-report-${new Date().toISOString().split('T')[0]}.json`
      a.click()
      URL.revokeObjectURL(url)
      toast.success('Report downloaded', 'JSON report saved successfully')
    } catch { toast.error('Download failed') }
    finally { setDownloading(null) }
  }

  const handleDownloadCSV = async () => {
    setDownloading('csv')
    try {
      const response = await fetch('/api/reports?type=csv', { headers: getAuthHeaders() })
      const text = await response.text()
      const blob = new Blob([text], { type: 'text/csv' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `vaultsentry-report-${new Date().toISOString().split('T')[0]}.csv`
      a.click()
      URL.revokeObjectURL(url)
      toast.success('Report downloaded', 'CSV report saved successfully')
    } catch { toast.error('Download failed') }
    finally { setDownloading(null) }
  }

  const fmtDate = (d: string | null) => d ? new Date(d).toLocaleString() : '--'

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar isOpen={sidebarOpen} onToggle={() => setSidebarOpen(!sidebarOpen)} />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header alertCount={0} onMenuClick={() => setSidebarOpen(!sidebarOpen)} />
        <main className="flex-1 overflow-y-auto p-6 bg-[var(--bg-primary)]">
          <div className="max-w-[1400px] mx-auto space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-bold text-[var(--text-primary)]">Security Reports</h1>
                <p className="text-sm text-[var(--text-muted)] mt-1">View and download scan findings reports</p>
              </div>
              <div className="flex items-center gap-3">
                <Button variant="secondary" size="sm" leftIcon={<RefreshCw className="w-4 h-4" />} onClick={fetchReport} disabled={loading}>Refresh</Button>
                <Button variant="primary" size="sm" leftIcon={<FileDown className="w-4 h-4" />} onClick={() => window.open('/reports/pdf', '_blank')} disabled={!report}>Download PDF</Button>
                <Button variant="secondary" size="sm" leftIcon={downloading === 'json' ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileJson className="w-4 h-4" />} onClick={handleDownloadJSON} disabled={!report || downloading !== null}>JSON</Button>
                <Button variant="secondary" size="sm" leftIcon={downloading === 'csv' ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileSpreadsheet className="w-4 h-4" />} onClick={handleDownloadCSV} disabled={!report || downloading !== null}>CSV</Button>
              </div>
            </div>

            {loading ? (
              <div className="flex items-center justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-[var(--text-muted)]" /></div>
            ) : !report || report.summary.total_secrets === 0 ? (
              <Card className="text-center py-12">
                <Target className="w-12 h-12 text-[var(--text-muted)] mx-auto mb-4" />
                <h3 className="text-lg font-medium text-[var(--text-secondary)] mb-2">No Reports Available</h3>
                <p className="text-[var(--text-muted)]">Run a scan first from the Repositories page to generate reports</p>
              </Card>
            ) : (
              <>
                {/* Summary Cards */}
                <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
                  <Card className="p-4"><p className="text-xs text-[var(--text-muted)] mb-1">Repositories</p><p className="text-2xl font-bold text-[var(--text-primary)]">{report.summary.total_repositories}</p></Card>
                  <Card className="p-4"><p className="text-xs text-[var(--text-muted)] mb-1">Scans Completed</p><p className="text-2xl font-bold text-[var(--text-primary)]">{report.summary.completed_scans}</p></Card>
                  <Card className="p-4"><p className="text-xs text-[var(--text-muted)] mb-1">Total Findings</p><p className="text-2xl font-bold text-[var(--text-primary)]">{report.summary.total_secrets}</p></Card>
                  <Card className="p-4"><p className="text-xs text-[var(--text-muted)] mb-1">Critical</p><p className="text-2xl font-bold text-red-400">{report.summary.by_severity.critical}</p></Card>
                  <Card className="p-4"><p className="text-xs text-[var(--text-muted)] mb-1">High</p><p className="text-2xl font-bold text-orange-400">{report.summary.by_severity.high}</p></Card>
                </div>

                {/* Severity Breakdown */}
                <Card className="p-6">
                  <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-4 flex items-center gap-2"><Shield className="w-5 h-5" />Severity Distribution</h2>
                  <div className="grid grid-cols-4 gap-4">
                    {(['critical', 'high', 'medium', 'low'] as const).map((level) => {
                      const count = report.summary.by_severity[level]
                      const total = report.summary.total_secrets
                      const pct = total > 0 ? Math.round((count / total) * 100) : 0
                      const Icon = sevIcons[level]
                      return (<div key={level} className={`p-4 rounded-lg border ${sevColors[level]}`}><div className="flex items-center gap-2 mb-2"><Icon className="w-4 h-4" /><span className="text-sm font-medium capitalize">{level}</span></div><p className="text-2xl font-bold">{count}</p><p className="text-xs opacity-70">{pct}% of total</p></div>)
                    })}
                  </div>
                </Card>

                {/* Scan History */}
                <Card className="overflow-hidden" noPadding>
                  <div className="p-4 border-b border-[var(--border-color)]"><h2 className="text-lg font-semibold text-[var(--text-primary)] flex items-center gap-2"><Target className="w-5 h-5" />Scan History</h2></div>
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-[var(--bg-tertiary)]"><tr>
                        <th className="text-left px-4 py-3 text-xs font-medium text-[var(--text-muted)]">ID</th>
                        <th className="text-left px-4 py-3 text-xs font-medium text-[var(--text-muted)]">Repository</th>
                        <th className="text-left px-4 py-3 text-xs font-medium text-[var(--text-muted)]">Status</th>
                        <th className="text-left px-4 py-3 text-xs font-medium text-[var(--text-muted)]">Files</th>
                        <th className="text-left px-4 py-3 text-xs font-medium text-[var(--text-muted)]">Secrets</th>
                        <th className="text-left px-4 py-3 text-xs font-medium text-[var(--text-muted)]">Duration</th>
                        <th className="text-left px-4 py-3 text-xs font-medium text-[var(--text-muted)]">Completed</th>
                      </tr></thead>
                      <tbody className="divide-y divide-[var(--border-color)]">
                        {report.scans.map((s) => (
                          <tr key={s.id} className="hover:bg-[var(--bg-tertiary)] transition-colors">
                            <td className="px-4 py-3 text-sm text-[var(--text-primary)] font-mono">#{s.id}</td>
                            <td className="px-4 py-3 text-sm text-[var(--text-primary)]">{s.repository}</td>
                            <td className="px-4 py-3"><Badge variant={s.status === 'completed' ? 'success' : s.status === 'failed' ? 'critical' : 'info'}>{s.status}</Badge></td>
                            <td className="px-4 py-3 text-sm text-[var(--text-secondary)]">{s.files_scanned}</td>
                            <td className="px-4 py-3 text-sm font-medium text-[var(--text-primary)]">{s.secrets_found}</td>
                            <td className="px-4 py-3 text-sm text-[var(--text-secondary)]">{s.duration_seconds}s</td>
                            <td className="px-4 py-3 text-sm text-[var(--text-muted)]">{fmtDate(s.completed_at)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </Card>

                {/* Findings Table */}
                <Card className="overflow-hidden" noPadding>
                  <div className="p-4 border-b border-[var(--border-color)] flex items-center justify-between">
                    <h2 className="text-lg font-semibold text-[var(--text-primary)] flex items-center gap-2"><FileText className="w-5 h-5" />All Findings ({report.findings.length})</h2>
                    <Button variant="ghost" size="sm" leftIcon={<Download className="w-4 h-4" />} onClick={handleDownloadCSV}>Export CSV</Button>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-[var(--bg-tertiary)]"><tr>
                        <th className="text-left px-4 py-3 text-xs font-medium text-[var(--text-muted)]">Severity</th>
                        <th className="text-left px-4 py-3 text-xs font-medium text-[var(--text-muted)]">Type</th>
                        <th className="text-left px-4 py-3 text-xs font-medium text-[var(--text-muted)]">Repository</th>
                        <th className="text-left px-4 py-3 text-xs font-medium text-[var(--text-muted)]">File</th>
                        <th className="text-left px-4 py-3 text-xs font-medium text-[var(--text-muted)]">Line</th>
                        <th className="text-left px-4 py-3 text-xs font-medium text-[var(--text-muted)]">Status</th>
                        <th className="text-left px-4 py-3 text-xs font-medium text-[var(--text-muted)]">Detected</th>
                      </tr></thead>
                      <tbody className="divide-y divide-[var(--border-color)]">
                        {report.findings.map((f) => {
                          const Icon = sevIcons[f.severity] || Shield
                          return (
                            <tr key={f.id} className="hover:bg-[var(--bg-tertiary)] transition-colors">
                              <td className="px-4 py-3"><div className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-xs font-medium border ${sevColors[f.severity] || sevColors.medium}`}><Icon className="w-3 h-3" />{f.severity}</div></td>
                              <td className="px-4 py-3 text-sm text-[var(--text-primary)] font-medium">{f.type}</td>
                              <td className="px-4 py-3 text-sm text-[var(--text-secondary)]">{f.repository}</td>
                              <td className="px-4 py-3 text-sm text-[var(--text-secondary)] font-mono max-w-[300px] truncate">{f.file}</td>
                              <td className="px-4 py-3 text-sm text-[var(--text-muted)]">{f.line}</td>
                              <td className="px-4 py-3"><Badge variant={f.status === 'resolved' ? 'success' : 'warning'}>{f.status}</Badge></td>
                              <td className="px-4 py-3 text-sm text-[var(--text-muted)]">{fmtDate(f.detected_at)}</td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                </Card>
              </>
            )}
          </div>
        </main>
      </div>
    </div>
  )
}
