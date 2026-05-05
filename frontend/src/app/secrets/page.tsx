'use client'

import Header from '@/components/layout/Header'
import Sidebar from '@/components/layout/Sidebar'
import { Badge, Button, Card, Modal, Select, Skeleton } from '@/components/ui'
import { useToast } from '@/contexts/ToastContext'
import { DEMO_SECRETS, isDemoMode } from '@/lib/demoData'
import type { Secret } from '@/lib/supabase/types'
import { secretService } from '@/services/supabase'
import { getAuthHeaders } from '@/lib/authHeaders'
import {
    AlertTriangle,
    CheckCircle,
    CheckSquare,
    ChevronDown,
    Clock,
    Copy,
    Download,
    Eye,
    EyeOff,
    FileText,
    Flag,
    FolderGit2,
    KeyRound,
    RefreshCw,
    Search,
    Shield,
    ShieldAlert,
    ShieldCheck,
    Square
} from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'

// Extended type with repository_name
type SecretWithRepo = Secret & { repository_name?: string; repository_url?: string }

const normalizeUrl = (u: string) =>
  (u || '').trim().toLowerCase().replace(/\.git$/, '').replace(/\/+$/, '')

const riskConfig = {
  critical: { color: 'bg-red-500', textColor: 'text-red-400', icon: ShieldAlert, label: 'Critical' },
  high: { color: 'bg-orange-500', textColor: 'text-orange-400', icon: AlertTriangle, label: 'High' },
  medium: { color: 'bg-yellow-500', textColor: 'text-yellow-400', icon: Shield, label: 'Medium' },
  low: { color: 'bg-green-500', textColor: 'text-green-400', icon: ShieldCheck, label: 'Low' },
  info: { color: 'bg-blue-500', textColor: 'text-blue-400', icon: ShieldCheck, label: 'Info' },
}

const statusConfig: Record<string, { color: string; label: string; icon: React.ElementType }> = {
  active: { color: 'critical', label: 'Active', icon: AlertTriangle },
  resolved: { color: 'success', label: 'Resolved', icon: CheckCircle },
  ignored: { color: 'info', label: 'Ignored', icon: EyeOff },
  false_positive: { color: 'info', label: 'False Positive', icon: Flag },
}

export default function SecretsPage() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const repoParam = searchParams.get('repo') || ''
  const [repoFilter, setRepoFilter] = useState<string>(repoParam)
  const [secrets, setSecrets] = useState<SecretWithRepo[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [riskFilter, setRiskFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')
  const [typeFilter, setTypeFilter] = useState('all')
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [selectedSecret, setSelectedSecret] = useState<SecretWithRepo | null>(null)
  const [showResolveModal, setShowResolveModal] = useState(false)
  const [resolveAction, setResolveAction] = useState<'resolved' | 'ignored' | 'false_positive'>('resolved')
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set())
  const [showBulkModal, setShowBulkModal] = useState(false)
  const [bulkAction, setBulkAction] = useState<'resolved' | 'ignored' | 'false_positive'>('resolved')
  const toast = useToast()

  const fetchSecrets = useCallback(async () => {
    try {
      try {
        const response = await fetch('/api/secrets', { cache: 'no-store', headers: getAuthHeaders() })
        if (response.ok) {
          const realSecrets = await response.json()
          if (realSecrets && realSecrets.length > 0) {
            console.log(`[FINDINGS] Loaded ${realSecrets.length} real findings from scanner API`)
            setSecrets(realSecrets as SecretWithRepo[])
            setLoading(false)
            return
          }
        }
      } catch (apiErr) {
        console.log('[FINDINGS] Scanner API not available, using fallback data')
      }

      if (isDemoMode()) {
        const demoSecrets = DEMO_SECRETS.map(s => ({
          ...s,
          type: s.secret_type,
          risk_level: s.severity,
          repository_name: s.repository.name,
        }))
        setSecrets(demoSecrets as unknown as SecretWithRepo[])
        setLoading(false)
        return
      }

      const data = await secretService.getAll()
      setSecrets(data as SecretWithRepo[])
    } catch (err) {
      console.error('Failed to fetch secrets:', err)
      toast.error('Failed to load secrets')
    } finally {
      setLoading(false)
    }
  }, [toast])

  useEffect(() => {
    fetchSecrets()
  }, [fetchSecrets])

  useEffect(() => {
    const onFocus = () => fetchSecrets()
    const onVisibility = () => {
      if (document.visibilityState === 'visible') fetchSecrets()
    }
    window.addEventListener('focus', onFocus)
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      window.removeEventListener('focus', onFocus)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [fetchSecrets])

  const filteredSecrets = secrets.filter((secret) => {
    const repoName = secret.repository_name || ''
    const matchesSearch =
      secret.type.toLowerCase().includes(searchQuery.toLowerCase()) ||
      secret.file_path.toLowerCase().includes(searchQuery.toLowerCase()) ||
      repoName.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesRisk = riskFilter === 'all' || secret.risk_level === riskFilter
    const matchesStatus = statusFilter === 'all' || secret.status === statusFilter
    const matchesType = typeFilter === 'all' || secret.type === typeFilter
    const filterIsUrl = /^https?:\/\//i.test(repoFilter) || repoFilter.startsWith('git@')
    const matchesRepo =
      !repoFilter ||
      (filterIsUrl
        ? normalizeUrl(secret.repository_url || '') === normalizeUrl(repoFilter)
        : repoName.toLowerCase() === repoFilter.toLowerCase())
    return matchesSearch && matchesRisk && matchesStatus && matchesType && matchesRepo
  })

  const groupedSecrets = useMemo(() => {
    const groups = new Map<string, { name: string; url: string; items: SecretWithRepo[] }>()
    for (const s of filteredSecrets) {
      const name = s.repository_name || 'Unknown repository'
      const url = s.repository_url || ''
      const key = (url ? normalizeUrl(url) : name.toLowerCase()) || 'unknown'
      const bucket = groups.get(key) ?? { name, url, items: [] }
      bucket.items.push(s)
      groups.set(key, bucket)
    }
    return Array.from(groups.values()).sort((a, b) => {
      const sevWeight = (g: { items: SecretWithRepo[] }) =>
        g.items.reduce(
          (acc, x) =>
            acc +
            (x.risk_level === 'critical'
              ? 10
              : x.risk_level === 'high'
              ? 6
              : x.risk_level === 'medium'
              ? 3
              : 1),
          0,
        )
      return sevWeight(b) - sevWeight(a) || b.items.length - a.items.length || a.name.localeCompare(b.name)
    })
  }, [filteredSecrets])

  const secretTypes = Array.from(new Set(secrets.map((s) => s.type)))
  const repoOptions = useMemo(() => {
    // Build (value=url, label=name) pairs from all known secret repos.
    const seen = new Map<string, { value: string; label: string }>()
    for (const s of secrets) {
      const url = s.repository_url || ''
      const name = s.repository_name || (url ? url.split('/').pop() || url : 'Unknown')
      const key = url ? normalizeUrl(url) : name.toLowerCase()
      if (!seen.has(key)) seen.set(key, { value: url || name, label: name })
    }
    if (repoFilter) {
      const key = /^https?:\/\//i.test(repoFilter) ? normalizeUrl(repoFilter) : repoFilter.toLowerCase()
      if (!seen.has(key)) seen.set(key, { value: repoFilter, label: repoFilter })
    }
    return [{ value: '', label: 'All Repositories' }, ...Array.from(seen.values())]
  }, [secrets, repoFilter])

  const updateRepoFilter = (value: string) => {
    setRepoFilter(value)
    const params = new URLSearchParams(Array.from(searchParams.entries()))
    if (value) params.set('repo', value)
    else params.delete('repo')
    const qs = params.toString()
    router.replace(qs ? `/secrets?${qs}` : '/secrets')
  }

  const generatePdfReport = () => {
    const url = repoFilter
      ? `/reports/pdf?repo=${encodeURIComponent(repoFilter)}`
      : '/reports/pdf'
    window.open(url, '_blank', 'noopener,noreferrer')
  }

  const handleResolveSecret = () => {
    if (selectedSecret) {
      setSecrets(
        secrets.map((s) =>
          s.id === selectedSecret.id ? { ...s, status: resolveAction, resolved_at: new Date().toISOString(), resolved_by: 'Current User' } : s
        )
      )
      toast.success('Secret updated', `Secret has been marked as ${resolveAction.replace('_', ' ')}`)
      setShowResolveModal(false)
      setSelectedSecret(null)
    }
  }

  const toggleSelectSecret = (id: number) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  const toggleSelectAll = () => {
    if (selectedIds.size === filteredSecrets.length) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(filteredSecrets.map(s => s.id)))
    }
  }

  const handleBulkAction = () => {
    setSecrets(secrets.map(s => 
      selectedIds.has(s.id) 
        ? { ...s, status: bulkAction, resolved_at: new Date().toISOString(), resolved_by: 'Current User' }
        : s
    ))
    toast.success('Bulk action completed', `${selectedIds.size} secrets marked as ${bulkAction.replace('_', ' ')}`)
    setSelectedIds(new Set())
    setShowBulkModal(false)
  }

  const exportCSV = () => {
    const csv = [
      ['ID', 'Type', 'Risk Level', 'File Path', 'Line', 'Repository', 'Status', 'Detected At'].join(','),
      ...filteredSecrets.map(s => [
        s.id,
        s.type,
        s.risk_level,
        `"${s.file_path}"`,
        s.line_number,
        s.repository_name || '',
        s.status,
        s.created_at || ''
      ].join(','))
    ].join('\n')

    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `secrets-${new Date().toISOString().split('T')[0]}.csv`
    a.click()
    URL.revokeObjectURL(url)
    toast.success('Export complete', 'CSV file downloaded')
  }

  const exportJSON = () => {
    const json = JSON.stringify(filteredSecrets, null, 2)
    const blob = new Blob([json], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `secrets-${new Date().toISOString().split('T')[0]}.json`
    a.click()
    URL.revokeObjectURL(url)
    toast.success('Export complete', 'JSON file downloaded')
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
    toast.info('Copied', 'Path copied to clipboard')
  }

  const getStats = () => ({
    total: secrets.length,
    active: secrets.filter((s) => s.status === 'active').length,
    critical: secrets.filter((s) => s.risk_level === 'critical' && s.status === 'active').length,
    resolved: secrets.filter((s) => s.status === 'resolved').length,
  })

  const stats = getStats()

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar isOpen={sidebarOpen} onToggle={() => setSidebarOpen(!sidebarOpen)} />

      <div className="flex-1 flex flex-col overflow-hidden">
        <Header alertCount={stats.critical} onMenuClick={() => setSidebarOpen(!sidebarOpen)} />

        <main className="flex-1 overflow-y-auto p-6 bg-[var(--bg-primary)]">
          <div className="max-w-[1800px] mx-auto space-y-6">
            {/* Page Header */}
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-bold text-[var(--text-primary)]">Findings</h1>
                <p className="text-[var(--text-muted)] mt-1">
                  All detected secrets across your repositories — triage, resolve, or mark as false positive.
                </p>
              </div>
              <div className="flex gap-3">
                <div className="relative group">
                  <Button variant="secondary">
                    <Download className="w-4 h-4 mr-2" />
                    Export
                    <ChevronDown className="w-4 h-4 ml-2" />
                  </Button>
                  <div className="absolute top-full right-0 mt-1 w-32 bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-lg shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-10">
                    <button onClick={exportCSV} className="w-full px-4 py-2 text-left text-sm text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)] rounded-t-lg">Export CSV</button>
                    <button onClick={exportJSON} className="w-full px-4 py-2 text-left text-sm text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)] rounded-b-lg">Export JSON</button>
                  </div>
                </div>
                <Button onClick={generatePdfReport}>
                  <FileText className="w-4 h-4 mr-2" />
                  {repoFilter ? `Report · ${repoFilter}` : 'Generate Report'}
                </Button>
              </div>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <Card className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-purple-500/10 rounded-lg">
                    <KeyRound className="w-5 h-5 text-purple-400" />
                  </div>
                  <div>
                    <p className="text-sm text-[var(--text-muted)]">Total Secrets</p>
                    <p className="text-2xl font-bold text-[var(--text-primary)]">{stats.total}</p>
                  </div>
                </div>
              </Card>
              <Card className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-red-500/10 rounded-lg">
                    <AlertTriangle className="w-5 h-5 text-red-400" />
                  </div>
                  <div>
                    <p className="text-sm text-[var(--text-muted)]">Active</p>
                    <p className="text-2xl font-bold text-[var(--text-primary)]">{stats.active}</p>
                  </div>
                </div>
              </Card>
              <Card className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-orange-500/10 rounded-lg">
                    <ShieldAlert className="w-5 h-5 text-orange-400" />
                  </div>
                  <div>
                    <p className="text-sm text-[var(--text-muted)]">Critical Risk</p>
                    <p className="text-2xl font-bold text-[var(--text-primary)]">{stats.critical}</p>
                  </div>
                </div>
              </Card>
              <Card className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-green-500/10 rounded-lg">
                    <CheckCircle className="w-5 h-5 text-green-400" />
                  </div>
                  <div>
                    <p className="text-sm text-[var(--text-muted)]">Resolved</p>
                    <p className="text-2xl font-bold text-[var(--text-primary)]">{stats.resolved}</p>
                  </div>
                </div>
              </Card>
            </div>

            {/* Filters */}
            <div className="flex flex-col lg:flex-row gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-[var(--text-muted)]" />
                <input
                  type="text"
                  placeholder="Search by type, file path, or repository..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-md text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none focus:border-[var(--accent)]"
                />
              </div>
              <Select 
                value={riskFilter} 
                onChange={(value) => setRiskFilter(value)} 
                className="w-full lg:w-40"
                options={[
                  { value: 'all', label: 'All Risk' },
                  { value: 'critical', label: 'Critical' },
                  { value: 'high', label: 'High' },
                  { value: 'medium', label: 'Medium' },
                  { value: 'low', label: 'Low' },
                ]}
              />
              <Select 
                value={statusFilter} 
                onChange={(value) => setStatusFilter(value)} 
                className="w-full lg:w-40"
                options={[
                  { value: 'all', label: 'All Status' },
                  { value: 'active', label: 'Active' },
                  { value: 'resolved', label: 'Resolved' },
                  { value: 'ignored', label: 'Ignored' },
                  { value: 'false_positive', label: 'False Positive' },
                ]}
              />
              <Select
                value={typeFilter}
                onChange={(value) => setTypeFilter(value)}
                className="w-full lg:w-48"
                options={[
                  { value: 'all', label: 'All Types' },
                  ...secretTypes.map((type) => ({ value: type, label: type })),
                ]}
              />
              <Select
                value={repoFilter}
                onChange={(value) => updateRepoFilter(value)}
                className="w-full lg:w-56"
                options={repoOptions}
              />
              <Button variant="secondary" onClick={() => setLoading(true)}>
                <RefreshCw className="w-4 h-4 mr-2" />
                Refresh
              </Button>
            </div>

            {/* Bulk Actions Bar */}
            {selectedIds.size > 0 && (
              <Card className="p-4 bg-blue-500/10 border-blue-500/30">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <CheckSquare className="w-5 h-5 text-blue-400" />
                    <span className="text-[var(--text-primary)] font-medium">
                      {selectedIds.size} secret{selectedIds.size !== 1 ? 's' : ''} selected
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button variant="ghost" size="sm" onClick={() => setSelectedIds(new Set())}>
                      Clear
                    </Button>
                    <Button 
                      variant="primary" 
                      size="sm"
                      leftIcon={<CheckCircle className="w-4 h-4" />}
                      onClick={() => { setBulkAction('resolved'); setShowBulkModal(true) }}
                    >
                      Resolve
                    </Button>
                    <Button 
                      variant="secondary" 
                      size="sm"
                      leftIcon={<EyeOff className="w-4 h-4" />}
                      onClick={() => { setBulkAction('ignored'); setShowBulkModal(true) }}
                    >
                      Ignore
                    </Button>
                    <Button 
                      variant="secondary" 
                      size="sm"
                      leftIcon={<Flag className="w-4 h-4" />}
                      onClick={() => { setBulkAction('false_positive'); setShowBulkModal(true) }}
                    >
                      False Positive
                    </Button>
                  </div>
                </div>
              </Card>
            )}

            {/* Secrets Table — grouped by repository */}
            {loading ? (
              <Card className="overflow-hidden">
                <div className="p-6 space-y-3">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Skeleton key={i} className="h-8 w-full" />
                  ))}
                </div>
              </Card>
            ) : filteredSecrets.length === 0 ? (
              <Card className="text-center py-12 text-[var(--text-muted)]">No secrets found</Card>
            ) : (
              groupedSecrets.map((group) => {
                const sevTotals = { critical: 0, high: 0, medium: 0, low: 0 } as Record<string, number>
                for (const item of group.items) {
                  const lvl = (item.risk_level || 'low') as keyof typeof sevTotals
                  if (lvl in sevTotals) sevTotals[lvl]++
                }
                return (
                  <Card key={group.url || group.name} className="overflow-hidden" noPadding>
                    <div className="px-6 py-4 border-b border-[var(--border-color)] bg-[var(--bg-secondary)] flex items-center justify-between gap-4 flex-wrap">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="p-2 bg-[var(--bg-tertiary)] rounded-lg shrink-0">
                          <FolderGit2 className="w-5 h-5 text-[var(--accent)]" />
                        </div>
                        <div className="min-w-0">
                          <h3 className="text-base font-semibold text-[var(--text-primary)] truncate">
                            {group.name}
                          </h3>
                          {group.url && (
                            <p className="text-xs text-[var(--text-muted)] font-mono truncate">{group.url}</p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 text-xs flex-wrap">
                        <span className="px-2 py-1 rounded bg-[var(--bg-tertiary)] text-[var(--text-secondary)] font-medium">
                          {group.items.length} finding{group.items.length === 1 ? '' : 's'}
                        </span>
                        {sevTotals.critical > 0 && (
                          <span className="px-2 py-1 rounded bg-red-500/10 text-red-400 font-medium">
                            {sevTotals.critical} critical
                          </span>
                        )}
                        {sevTotals.high > 0 && (
                          <span className="px-2 py-1 rounded bg-orange-500/10 text-orange-400 font-medium">
                            {sevTotals.high} high
                          </span>
                        )}
                        {sevTotals.medium > 0 && (
                          <span className="px-2 py-1 rounded bg-yellow-500/10 text-yellow-400 font-medium">
                            {sevTotals.medium} medium
                          </span>
                        )}
                        {sevTotals.low > 0 && (
                          <span className="px-2 py-1 rounded bg-green-500/10 text-green-400 font-medium">
                            {sevTotals.low} low
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead className="bg-[var(--bg-secondary)]/60 border-b border-[var(--border-color)]">
                          <tr>
                            <th className="w-12 px-4 py-3"></th>
                            <th className="text-left px-6 py-3 text-xs font-medium text-[var(--text-muted)] uppercase tracking-wide">Type</th>
                            <th className="text-left px-6 py-3 text-xs font-medium text-[var(--text-muted)] uppercase tracking-wide">Risk</th>
                            <th className="text-left px-6 py-3 text-xs font-medium text-[var(--text-muted)] uppercase tracking-wide">Location</th>
                            <th className="text-left px-6 py-3 text-xs font-medium text-[var(--text-muted)] uppercase tracking-wide">Value</th>
                            <th className="text-left px-6 py-3 text-xs font-medium text-[var(--text-muted)] uppercase tracking-wide">Status</th>
                            <th className="text-left px-6 py-3 text-xs font-medium text-[var(--text-muted)] uppercase tracking-wide">Detected</th>
                            <th className="text-left px-6 py-3 text-xs font-medium text-[var(--text-muted)] uppercase tracking-wide">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[var(--border-color)]">
                          {group.items.map((secret) => {
                        const risk = riskConfig[secret.risk_level as keyof typeof riskConfig] || riskConfig.medium
                        const status = statusConfig[secret.status] || statusConfig.active
                        const RiskIcon = risk.icon
                        const StatusIcon = status.icon
                        const isSelected = selectedIds.has(secret.id)

                        return (
                          <tr key={secret.id} className={`hover:bg-[var(--bg-secondary)]/50 transition-colors ${isSelected ? 'bg-blue-500/10' : ''}`}>
                            <td className="w-12 px-4 py-4">
                              <button
                                onClick={() => toggleSelectSecret(secret.id)}
                                className="p-1 rounded hover:bg-[var(--bg-tertiary)] transition-colors"
                              >
                                {isSelected ? (
                                  <CheckSquare className="w-5 h-5 text-blue-400" />
                                ) : (
                                  <Square className="w-5 h-5 text-[var(--text-muted)]" />
                                )}
                              </button>
                            </td>
                            <td className="px-6 py-4">
                              <div className="flex items-center gap-3">
                                <div className="p-2 bg-[var(--bg-tertiary)] rounded-lg">
                                  <KeyRound className="w-5 h-5 text-[var(--accent)]" />
                                </div>
                                <div>
                                  <p className="font-medium text-[var(--text-primary)]">{secret.type}</p>
                                  <p className="text-xs text-[var(--text-muted)]">{secret.description}</p>
                                </div>
                              </div>
                            </td>
                            <td className="px-6 py-4">
                              <div className="flex items-center gap-2">
                                <div className={`w-2 h-2 rounded-full ${risk.color}`} />
                                <span className={risk.textColor}>{risk.label}</span>
                              </div>
                            </td>
                            <td className="px-6 py-4">
                              <div className="flex items-center gap-2">
                                <div>
                                  <p className="text-[var(--text-primary)] font-mono text-sm">{secret.file_path}</p>
                                  <p className="text-xs text-[var(--text-muted)]">Line {secret.line_number}</p>
                                </div>
                                <button
                                  onClick={() => copyToClipboard(secret.file_path)}
                                  className="p-1 rounded hover:bg-[var(--bg-tertiary)] transition-colors"
                                >
                                  <Copy className="w-3 h-3 text-[var(--text-muted)]" />
                                </button>
                              </div>
                            </td>
                            <td className="px-6 py-4">
                              <code className="text-sm text-[var(--text-secondary)] bg-[var(--bg-tertiary)] px-2 py-1 rounded font-mono">
                                {secret.masked_value}
                              </code>
                            </td>
                            <td className="px-6 py-4">
                              <Badge variant={status.color as any}>
                                <StatusIcon className="w-3 h-3 mr-1" />
                                {status.label}
                              </Badge>
                            </td>
                            <td className="px-6 py-4">
                              <div className="flex items-center gap-1 text-[var(--text-muted)] text-sm">
                                <Clock className="w-3 h-3" />
                                {new Date(secret.created_at).toLocaleDateString()}
                              </div>
                            </td>
                            <td className="px-6 py-4">
                              <div className="flex items-center gap-2">
                                <button
                                  onClick={() => setSelectedSecret(secret)}
                                  className="p-2 rounded-lg hover:bg-[var(--bg-tertiary)] transition-colors"
                                  title="View Details"
                                >
                                  <Eye className="w-4 h-4 text-[var(--text-muted)] hover:text-[var(--accent)]" />
                                </button>
                                {secret.status === 'active' && (
                                  <button
                                    onClick={() => {
                                      setSelectedSecret(secret)
                                      setShowResolveModal(true)
                                    }}
                                    className="p-2 rounded-lg hover:bg-[var(--bg-tertiary)] transition-colors"
                                    title="Resolve"
                                  >
                                    <CheckCircle className="w-4 h-4 text-[var(--text-muted)] hover:text-green-400" />
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        )
                          })}
                        </tbody>
                      </table>
                    </div>
                  </Card>
                )
              })
            )}
          </div>
        </main>

        {/* Secret Details Modal */}
        {selectedSecret && !showResolveModal && (
          <Modal isOpen={!!selectedSecret} onClose={() => setSelectedSecret(null)} title="Secret Details">
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-[var(--text-muted)]">Type</p>
                  <p className="text-[var(--text-primary)] font-medium">{selectedSecret.type}</p>
                </div>
                <div>
                  <p className="text-sm text-[var(--text-muted)]">Risk Level</p>
                  <Badge variant={selectedSecret.risk_level === 'critical' ? 'critical' : selectedSecret.risk_level === 'high' ? 'warning' : 'info'}>
                    {selectedSecret.risk_level}
                  </Badge>
                </div>
                <div>
                  <p className="text-sm text-[var(--text-muted)]">Repository</p>
                  <p className="text-[var(--text-primary)]">{selectedSecret.repository_name}</p>
                </div>
                <div>
                  <p className="text-sm text-[var(--text-muted)]">Status</p>
                  <Badge variant={statusConfig[selectedSecret.status].color as any}>{statusConfig[selectedSecret.status].label}</Badge>
                </div>
                <div className="col-span-2">
                  <p className="text-sm text-[var(--text-muted)]">File Path</p>
                  <code className="text-[var(--text-primary)] font-mono text-sm bg-[var(--bg-tertiary)] px-2 py-1 rounded block mt-1">
                    {selectedSecret.file_path}:{selectedSecret.line_number}
                  </code>
                </div>
                <div className="col-span-2">
                  <p className="text-sm text-[var(--text-muted)]">Masked Value</p>
                  <code className="text-[var(--text-primary)] font-mono text-sm bg-[var(--bg-tertiary)] px-2 py-1 rounded block mt-1">{selectedSecret.masked_value}</code>
                </div>
                <div>
                  <p className="text-sm text-[var(--text-muted)]">Pattern</p>
                  <p className="text-[var(--text-primary)]">{selectedSecret.description}</p>
                </div>
                <div>
                  <p className="text-sm text-[var(--text-muted)]">Entropy Score</p>
                  <p className="text-[var(--text-primary)]">{selectedSecret.entropy_score?.toFixed(2) || 'N/A'}</p>
                </div>
                <div>
                  <p className="text-sm text-[var(--text-muted)]">Detected At</p>
                  <p className="text-[var(--text-primary)]">{new Date(selectedSecret.created_at).toLocaleString()}</p>
                </div>
                {selectedSecret.resolved_at && (
                  <div>
                    <p className="text-sm text-[var(--text-muted)]">Resolved By</p>
                    <p className="text-[var(--text-primary)]">{selectedSecret.resolved_by}</p>
                  </div>
                )}
              </div>

              <div className="flex justify-end gap-3 pt-4">
                <Button variant="secondary" onClick={() => setSelectedSecret(null)}>
                  Close
                </Button>
                {selectedSecret.status === 'active' && (
                  <Button
                    onClick={() => {
                      setShowResolveModal(true)
                    }}
                  >
                    <CheckCircle className="w-4 h-4 mr-2" />
                    Resolve Secret
                  </Button>
                )}
              </div>
            </div>
          </Modal>
        )}

        {/* Resolve Secret Modal */}
        <Modal isOpen={showResolveModal} onClose={() => setShowResolveModal(false)} title="Resolve Secret">
          <div className="space-y-4">
            <p className="text-[var(--text-secondary)]">How would you like to handle this secret?</p>

            <div className="space-y-3">
              <label className="flex items-center gap-3 p-4 bg-[var(--bg-secondary)] rounded-lg cursor-pointer border border-[var(--border-color)] hover:border-[var(--accent)] transition-colors">
                <input
                  type="radio"
                  name="resolve"
                  value="resolved"
                  checked={resolveAction === 'resolved'}
                  onChange={() => setResolveAction('resolved')}
                  className="w-4 h-4"
                />
                <div>
                  <p className="text-[var(--text-primary)] font-medium">Mark as Resolved</p>
                  <p className="text-[var(--text-muted)] text-sm">The secret has been rotated or removed from the codebase</p>
                </div>
              </label>

              <label className="flex items-center gap-3 p-4 bg-[var(--bg-secondary)] rounded-lg cursor-pointer border border-[var(--border-color)] hover:border-[var(--accent)] transition-colors">
                <input
                  type="radio"
                  name="resolve"
                  value="ignored"
                  checked={resolveAction === 'ignored'}
                  onChange={() => setResolveAction('ignored')}
                  className="w-4 h-4"
                />
                <div>
                  <p className="text-[var(--text-primary)] font-medium">Ignore</p>
                  <p className="text-[var(--text-muted)] text-sm">This is an acceptable risk or internal use only</p>
                </div>
              </label>

              <label className="flex items-center gap-3 p-4 bg-[var(--bg-secondary)] rounded-lg cursor-pointer border border-[var(--border-color)] hover:border-[var(--accent)] transition-colors">
                <input
                  type="radio"
                  name="resolve"
                  value="false_positive"
                  checked={resolveAction === 'false_positive'}
                  onChange={() => setResolveAction('false_positive')}
                  className="w-4 h-4"
                />
                <div>
                  <p className="text-[var(--text-primary)] font-medium">False Positive</p>
                  <p className="text-[var(--text-muted)] text-sm">This is not actually a secret</p>
                </div>
              </label>
            </div>

            <div className="flex justify-end gap-3 pt-4">
              <Button variant="secondary" onClick={() => setShowResolveModal(false)}>
                Cancel
              </Button>
              <Button onClick={handleResolveSecret}>Confirm</Button>
            </div>
          </div>
        </Modal>

        {/* Bulk Action Modal */}
        <Modal 
          isOpen={showBulkModal} 
          onClose={() => setShowBulkModal(false)} 
          title="Confirm Bulk Action"
        >
          <div className="space-y-4">
            <p className="text-[var(--text-secondary)]">
              Are you sure you want to mark <span className="font-semibold text-[var(--text-primary)]">{selectedIds.size}</span> secret{selectedIds.size !== 1 ? 's' : ''} as <span className="font-semibold text-[var(--text-primary)]">{bulkAction.replace('_', ' ')}</span>?
            </p>
            
            <div className="p-4 rounded-lg bg-[var(--bg-tertiary)]">
              <p className="text-sm text-[var(--text-muted)]">This action will:</p>
              <ul className="mt-2 space-y-1 text-sm text-[var(--text-secondary)]">
                <li>• Update the status of all selected secrets</li>
                <li>• Record your action in the audit log</li>
                {bulkAction === 'false_positive' && (
                  <li>• Help improve our ML detection accuracy</li>
                )}
              </ul>
            </div>

            <div className="flex justify-end gap-3 pt-4">
              <Button variant="secondary" onClick={() => setShowBulkModal(false)}>
                Cancel
              </Button>
              <Button variant="primary" onClick={handleBulkAction}>
                Confirm ({selectedIds.size} secrets)
              </Button>
            </div>
          </div>
        </Modal>
      </div>
    </div>
  )
}
