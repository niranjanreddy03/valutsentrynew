'use client'

import Header from '@/components/layout/Header'
import Sidebar from '@/components/layout/Sidebar'
import { Badge, Button, Card, Input, Modal, Select, Skeleton } from '@/components/ui'
import { useToast } from '@/contexts/ToastContext'
import { DEMO_REPOSITORIES, isDemoMode } from '@/lib/demoData'
import type { Repository } from '@/lib/supabase/types'
import { repositoryService } from '@/services/supabase'
import { getAuthHeaders } from '@/lib/authHeaders'
import { waitForScanCompletion } from '@/lib/pollScan'
import { runPoliciesForScan } from '@/lib/runPoliciesForScan'
import {
    ExternalLink,
    FileDown,
    Filter,
    GitBranch,
    Github,
    Gitlab,
    Play,
    Plus,
    RefreshCw,
    Search,
    Trash2
} from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'

const providerIcons: Record<string, React.ReactNode> = {
  github: <Github className="w-5 h-5" />,
  gitlab: <Gitlab className="w-5 h-5" />,
  bitbucket: <GitBranch className="w-5 h-5" />,
  azure: <GitBranch className="w-5 h-5" />,
}

const providerColors: Record<string, string> = {
  github: 'bg-gray-600',
  gitlab: 'bg-orange-500',
  bitbucket: 'bg-blue-500',
  azure: 'bg-blue-600',
}

export default function RepositoriesPage() {
  const [repositories, setRepositories] = useState<Repository[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [filterStatus, setFilterStatus] = useState('all')
  const [isAddModalOpen, setIsAddModalOpen] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [scanningRepoId, setScanningRepoId] = useState<number | null>(null)
  const [isAddingRepo, setIsAddingRepo] = useState(false)
  const [urlError, setUrlError] = useState<string | null>(null)
  const demoReposLoadedRef = useRef(false)
  const toast = useToast()
  const router = useRouter()

  // New repository form
  const [newRepo, setNewRepo] = useState<{
    name: string
    url: string
    provider: 'github' | 'gitlab' | 'bitbucket' | 'azure'
    branch: string
  }>({
    name: '',
    url: '',
    provider: 'github',
    branch: 'main',
  })

  // URL validation patterns
  const validateRepositoryUrl = (url: string, provider: string): string | null => {
    if (!url) return 'Repository URL is required'
    
    const patterns: Record<string, RegExp[]> = {
      github: [
        /^https?:\/\/github\.com\/[\w\-\.]+\/[\w\-\.]+(?:\.git)?$/i,
        /^git@github\.com:[\w\-\.]+\/[\w\-\.]+(?:\.git)?$/i,
      ],
      gitlab: [
        /^https?:\/\/gitlab\.com\/[\w\-\.]+\/[\w\-\.]+(?:\.git)?$/i,
        /^git@gitlab\.com:[\w\-\.]+\/[\w\-\.]+(?:\.git)?$/i,
      ],
      bitbucket: [
        /^https?:\/\/bitbucket\.org\/[\w\-\.]+\/[\w\-\.]+(?:\.git)?$/i,
        /^git@bitbucket\.org:[\w\-\.]+\/[\w\-\.]+(?:\.git)?$/i,
      ],
      azure: [
        /^https?:\/\/dev\.azure\.com\/[\w\-\.]+\/[\w\-\.]+\/_git\/[\w\-\.]+$/i,
      ],
    }
    
    const providerPatterns = patterns[provider] || []
    const isValid = providerPatterns.some(pattern => pattern.test(url.trim()))
    
    if (!isValid) {
      const examples: Record<string, string> = {
        github: 'https://github.com/owner/repo',
        gitlab: 'https://gitlab.com/owner/repo',
        bitbucket: 'https://bitbucket.org/owner/repo',
        azure: 'https://dev.azure.com/org/project/_git/repo',
      }
      return `Invalid ${provider} URL format. Expected: ${examples[provider]}`
    }
    
    return null
  }

  // Extract repo name from URL
  const extractRepoName = (url: string): string => {
    const match = url.match(/\/([^\/]+?)(?:\.git)?$/)
    return match ? match[1] : ''
  }

  // Handle URL change with validation
  const handleUrlChange = (url: string) => {
    setNewRepo({ ...newRepo, url })
    
    // Auto-extract name if not set
    if (!newRepo.name && url) {
      const extractedName = extractRepoName(url)
      if (extractedName) {
        setNewRepo(prev => ({ ...prev, url, name: extractedName }))
      }
    }
    
    // Validate URL
    if (url) {
      const error = validateRepositoryUrl(url, newRepo.provider)
      setUrlError(error)
    } else {
      setUrlError(null)
    }
  }

  const fetchRepositories = useCallback(async () => {
    try {
      // Demo mode: seed with the demo list once.
      if (isDemoMode()) {
        if (!demoReposLoadedRef.current) {
          setRepositories(DEMO_REPOSITORIES as unknown as Repository[])
          demoReposLoadedRef.current = true
        }
        return
      }

      // Supabase is the source of truth — RLS scopes rows to the signed-in user,
      // so each account only sees its own repos and they persist across sessions.
      const data = await repositoryService.getAll()

      // Overlay the most recent scan result from the scanner so the cards
      // reflect real secret counts even when the scanner wrote to its own
      // store (not Supabase). Best-effort — ignore if the scanner is offline.
      try {
        const scansRes = await fetch('/api/scans', {
          cache: 'no-store',
          headers: getAuthHeaders(),
        })
        if (scansRes.ok) {
          const scans = (await scansRes.json()) as any[]
          const enriched = data.map((r: Repository) => {
            // Match by URL (scanner stores its own repo id, which won't
            // equal the Supabase id).
            const repoScans = scans
              .filter(
                (s) =>
                  s.repository_url &&
                  s.repository_url.replace(/\.git$/, '') ===
                    (r.url || '').replace(/\.git$/, ''),
              )
              .sort(
                (a, b) =>
                  new Date(b.created_at).getTime() -
                  new Date(a.created_at).getTime(),
              )
            const latest = repoScans.find((s) => s.status === 'completed')
            if (!latest) return r
            return {
              ...r,
              secrets_count: latest.secrets_found ?? r.secrets_count,
              last_scan_at: latest.completed_at || latest.created_at || r.last_scan_at,
            }
          })
          setRepositories(enriched)
        } else {
          setRepositories(data)
        }
      } catch {
        setRepositories(data)
      }
    } catch (error) {
      console.error('[REPOS] Failed to load:', error)
      toast.error('Failed to load repositories')
    } finally {
      setLoading(false)
    }
  }, [toast])

  useEffect(() => {
    fetchRepositories()
  }, [fetchRepositories])

  const handleAddRepository = async () => {
    // Validate required fields
    if (!newRepo.name || !newRepo.url) {
      toast.error('Missing fields', 'Please fill in all required fields')
      return
    }

    // Validate URL format
    const urlValidationError = validateRepositoryUrl(newRepo.url, newRepo.provider)
    if (urlValidationError) {
      setUrlError(urlValidationError)
      toast.error('Invalid URL', urlValidationError)
      return
    }

    setIsAddingRepo(true)
    setUrlError(null)

    try {
      // Persist to Supabase — source of truth, scoped to user via RLS.
      console.log('[REPO ADD] Persisting to Supabase:', newRepo)
      let savedRepo: Repository
      try {
        savedRepo = await repositoryService.create(newRepo)
        console.log('[REPO ADD] Saved to Supabase, id:', savedRepo.id)
      } catch (supabaseErr: any) {
        console.error('[REPO ADD] Supabase insert failed:', supabaseErr)
        toast.error(
          'Failed to save repository',
          supabaseErr?.message || 'Check your Supabase configuration and RLS policies',
        )
        return
      }

      setRepositories((prev) => [savedRepo, ...prev])
      setIsAddModalOpen(false)
      setNewRepo({ name: '', url: '', provider: 'github', branch: 'main' })
      toast.success('Repository added', `${savedRepo.name} saved to your account`)

      // Auto-trigger initial scan using the real Supabase repo id.
      toast.info('Scan started', `Scanning ${savedRepo.name}…`)
      try {
        const response = await fetch('/api/scan', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
          body: JSON.stringify({
            scan_id: savedRepo.id,
            repository_id: savedRepo.id,
            repository_url: savedRepo.url,
            branch: savedRepo.branch || 'main',
          }),
        })
        if (!response.ok) {
          const errData = await response.json().catch(() => ({}))
          toast.error(
            'Scan failed to start',
            errData?.detail || errData?.error || `Backend returned ${response.status}`,
          )
          return
        }

        // Capture scan_id so we poll the right scan record.
        const triggerData = await response.json().catch(() => ({}))
        const result = await waitForScanCompletion(savedRepo.id, { scanId: triggerData?.scan_id })
        announceScanResult(savedRepo.id, savedRepo.name, result)
      } catch (scanErr) {
        console.error('[SCAN] Auto-scan failed:', scanErr)
        toast.error('Scanner offline', 'Repo saved, but the scanner is unreachable')
      }
    } catch (error) {
      console.error('[REPO ADD] Failed to add repository:', error)
      const errorMessage = error instanceof Error ? error.message : 'Please try again'
      toast.error('Failed to add repository', errorMessage)
    } finally {
      setIsAddingRepo(false)
    }
  }

  /**
   * Centralized, prominent completion notification used by every scan entry
   * point. Also updates the card's `secrets_count` + `last_scan_at` in
   * local state (and persists to Supabase so the card survives a refresh).
   */
  const announceScanResult = async (
    repoId: number,
    repoName: string,
    result: { status: 'completed' | 'failed' | 'cancelled' | 'timeout'; secretsFound: number },
  ) => {
    console.log('[SCAN] Result for', repoName, result)

    if (result.status === 'completed') {
      const nowIso = new Date().toISOString()
      // Optimistic local update so the card reflects the fresh scan immediately.
      setRepositories((prev) =>
        prev.map((r) =>
          r.id === repoId
            ? { ...r, secrets_count: result.secretsFound, last_scan_at: nowIso, status: 'active' }
            : r,
        ),
      )
      // Persist to Supabase (best effort — non-fatal if it fails).
      try {
        await repositoryService.update(repoId, {
          secrets_count: result.secretsFound,
          last_scan_at: nowIso,
          status: 'active',
        } as any)
      } catch (e) {
        console.warn('[SCAN] Could not persist scan result to Supabase:', e)
      }

      if (result.secretsFound > 0) {
        toast.warning(
          `Scan complete · ${result.secretsFound} secret${result.secretsFound === 1 ? '' : 's'} found`,
          `${repoName} — open the Secrets page to review`,
        )

        // Evaluate user-defined policies against this scan's findings and
        // fire their actions (toasts, Slack, generic webhook, …). Best
        // effort — a failure here must never block the scan flow.
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
                'Check browser console or the Policies page for details',
              )
            } else if (outcome.alerts.length === 0) {
              toast.info(
                `${outcome.firedPolicies} polic${outcome.firedPolicies === 1 ? 'y' : 'ies'} fired`,
                'View details on the Policies page',
              )
            }
          }
        } catch (policyErr) {
          console.warn('[POLICY] Evaluation failed:', policyErr)
        }
      } else {
        toast.success('Scan complete ✓', `${repoName} — no secrets found`)
      }
    } else if (result.status === 'failed') {
      setRepositories((prev) =>
        prev.map((r) => (r.id === repoId ? { ...r, status: 'error' } : r)),
      )
      toast.error('Scan failed', `${repoName} could not be scanned`)
    } else if (result.status === 'cancelled') {
      toast.info('Scan cancelled', repoName)
    } else {
      toast.info('Scan still running', `${repoName} — check the Scans page for progress`)
    }
  }

  const handleScanRepository = async (repoId: number) => {
    console.log('[SCAN] handleScanRepository called with repoId:', repoId)
    const repo = repositories.find((r) => r.id === repoId)

    if (!repo) {
      toast.error('Repository not found')
      return
    }

    // Reject obviously-fake demo URLs so we don't waste time calling the scanner.
    if (repo.url && repo.url.includes('acme-corp')) {
      toast.warning(
        'Demo repository',
        'This is a demo repo with a fake URL. Add a real GitHub repo to scan.',
      )
      return
    }

    setScanningRepoId(repoId)
    // Immediate feedback so the user knows the click registered.
    toast.info('Scan started', `Scanning ${repo.name}…`)

    try {
      // Always call the real scanner API — the old "demo vs non-demo" branch
      // was silently routing non-demo users to a no-op Supabase call.
      const response = await fetch('/api/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify({
          scan_id: repoId,
          repository_id: repoId,
          repository_url: repo.url,
          branch: repo.branch || 'main',
        }),
      })

      console.log('[SCAN] Response status:', response.status)

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}))
        console.error('[SCAN] Backend error:', response.status, errData)
        toast.error(
          'Scan failed to start',
          errData?.error || errData?.detail || `Backend returned ${response.status}`,
        )
        return
      }

      const data = await response.json().catch(() => ({}))
      console.log('[SCAN] Triggered:', data)

      // Poll the scanner's own store until finished, then announce result.
      const result = await waitForScanCompletion(repoId, { scanId: data?.scan_id })
      announceScanResult(repoId, repo.name, result)
    } catch (error) {
      console.error('[SCAN] Failed to start scan:', error)
      toast.error(
        'Scanner offline',
        'Could not reach the scanner backend. Make sure it is running.',
      )
    } finally {
      setScanningRepoId(null)
    }
  }

  const handleDeleteRepository = async (repoId: number) => {
    try {
      // Handle demo mode
      if (isDemoMode()) {
        setRepositories(prev => prev.filter(r => r.id !== repoId))
        toast.success('Repository removed')
        return
      }
      
      await repositoryService.delete(repoId)
      setRepositories(prev => prev.filter(r => r.id !== repoId))
      toast.success('Repository removed')
    } catch (error) {
      console.error('Failed to delete repository:', error)
      toast.error('Failed to delete repository', error instanceof Error ? error.message : 'Please try again')
    }
  }

  const filteredRepositories = repositories.filter(repo => {
    const matchesSearch = repo.name.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesFilter = filterStatus === 'all' || repo.status === filterStatus
    return matchesSearch && matchesFilter
  })

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar isOpen={sidebarOpen} onToggle={() => setSidebarOpen(!sidebarOpen)} />
      
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header 
          alertCount={5}
          onMenuClick={() => setSidebarOpen(!sidebarOpen)}
        />
        
        <main className="flex-1 overflow-y-auto p-6 bg-[var(--bg-primary)]">
          <div className="max-w-[1800px] mx-auto">
            {/* Page Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
              <div>
                <h1 className="text-2xl font-bold text-[var(--text-primary)]">Repositories</h1>
                <p className="text-[var(--text-muted)] mt-1">Manage and monitor your connected repositories</p>
              </div>
              <Button
                variant="primary"
                leftIcon={<Plus className="w-5 h-5" />}
                onClick={() => setIsAddModalOpen(true)}
              >
                Add Repository
              </Button>
            </div>

            {/* Filters */}
            <div className="flex flex-col sm:flex-row gap-4 mb-6">
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[var(--text-muted)]" />
                <input
                  type="text"
                  placeholder="Search repositories..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-md text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none focus:border-[var(--accent)]"
                />
              </div>
              <div className="flex items-center gap-2">
                <Filter className="w-5 h-5 text-[var(--text-muted)]" />
                <Select
                  options={[
                    { value: 'all', label: 'All Status' },
                    { value: 'active', label: 'Active' },
                    { value: 'inactive', label: 'Inactive' },
                    { value: 'error', label: 'Error' },
                  ]}
                  value={filterStatus}
                  onChange={setFilterStatus}
                  className="w-40"
                />
              </div>
            </div>

            {/* Repository Grid */}
            {loading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                {[...Array(6)].map((_, i) => (
                  <Skeleton.Card key={i} />
                ))}
              </div>
            ) : filteredRepositories.length === 0 ? (
              <Card className="text-center py-12">
                <GitBranch className="w-12 h-12 text-[var(--text-muted)] mx-auto mb-4" />
                <h3 className="text-lg font-medium text-[var(--text-secondary)] mb-2">No repositories found</h3>
                <p className="text-[var(--text-muted)] mb-6">
                  {searchQuery ? 'Try adjusting your search' : 'Add your first repository to start scanning'}
                </p>
                <Button
                  variant="primary"
                  leftIcon={<Plus className="w-5 h-5" />}
                  onClick={() => setIsAddModalOpen(true)}
                >
                  Add Repository
                </Button>
              </Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                {filteredRepositories.map((repo) => (
                  <Card key={repo.id} hover className="relative group">
                    {/* Status Indicator */}
                    <div className="absolute top-4 right-4">
                      <Badge
                        variant={
                          repo.status === 'active' ? 'success' :
                          repo.status === 'error' ? 'critical' : 'default'
                        }
                        dot
                      >
                        {repo.status}
                      </Badge>
                    </div>

                    {/* Provider Icon & Name */}
                    <div className="flex items-start gap-3 mb-4">
                      <div className={`w-10 h-10 rounded-lg ${providerColors[repo.provider]} flex items-center justify-center text-white`}>
                        {providerIcons[repo.provider]}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-[var(--text-primary)] truncate">{repo.name}</h3>
                        <p className="text-sm text-[var(--text-muted)] truncate">{repo.url}</p>
                      </div>
                    </div>

                    {/* Scan result summary row */}
                    {repo.last_scan_at && (
                      <div className="mb-3">
                        {repo.secrets_count > 0 ? (
                          <div className="flex items-center gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2">
                            <span className="inline-flex h-2 w-2 rounded-full bg-amber-500" />
                            <p className="text-sm text-amber-200 font-medium">
                              {repo.secrets_count} secret{repo.secrets_count === 1 ? '' : 's'} found
                            </p>
                            <button
                              onClick={() => router.push(`/secrets?repo=${repo.id}`)}
                              className="ml-auto text-xs text-amber-200 hover:text-amber-100 underline underline-offset-2"
                            >
                              View findings →
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2">
                            <span className="inline-flex h-2 w-2 rounded-full bg-emerald-500" />
                            <p className="text-sm text-emerald-200 font-medium">
                              Scan clean — no secrets found
                            </p>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Stats */}
                    <div className="grid grid-cols-3 gap-4 mb-4 py-4 border-y border-[var(--border-color)]/50">
                      <div className="text-center">
                        <p className="text-lg font-semibold text-[var(--text-primary)]">{repo.secrets_count}</p>
                        <p className="text-xs text-[var(--text-muted)]">Secrets</p>
                      </div>
                      <div className="text-center border-x border-[var(--border-color)]/50">
                        <p className="text-lg font-semibold text-[var(--text-primary)]">{repo.branch}</p>
                        <p className="text-xs text-[var(--text-muted)]">Branch</p>
                      </div>
                      <div className="text-center">
                        <p className="text-sm font-medium text-[var(--text-primary)]">
                          {repo.last_scan_at ? new Date(repo.last_scan_at).toLocaleDateString() : 'Never'}
                        </p>
                        <p className="text-xs text-[var(--text-muted)]">Last Scan</p>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2">
                      <Button
                        variant="primary"
                        size="sm"
                        leftIcon={scanningRepoId === repo.id ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
                        onClick={() => handleScanRepository(repo.id)}
                        disabled={scanningRepoId === repo.id}
                        className="flex-1"
                      >
                        {scanningRepoId === repo.id ? 'Scanning...' : 'Scan Now'}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        title="Download PDF report for this repo"
                        disabled={!repo.last_scan_at}
                        onClick={() => {
                          if (!repo.last_scan_at) {
                            toast.info('No scan yet', 'Run a scan on this repository first.')
                            return
                          }
                          window.open(
                            `/reports/pdf?repo=${encodeURIComponent(repo.name)}`,
                            '_blank',
                            'noopener,noreferrer',
                          )
                        }}
                      >
                        <FileDown className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        title="Open repository"
                        onClick={() => {
                          if (repo.url) {
                            window.open(repo.url, '_blank', 'noopener,noreferrer')
                          } else {
                            toast.error('No URL', 'This repository has no URL set')
                          }
                        }}
                      >
                        <ExternalLink className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-red-400 hover:text-red-300 hover:bg-red-500/10"
                        onClick={() => handleDeleteRepository(repo.id)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </main>
      </div>

      {/* Add Repository Modal */}
      <Modal
        isOpen={isAddModalOpen}
        onClose={() => {
          setIsAddModalOpen(false)
          setUrlError(null)
          setNewRepo({ name: '', url: '', provider: 'github', branch: 'main' })
        }}
        title="Add Repository"
        description="Connect a new repository for secret scanning"
      >
        <div className="space-y-4">
          <Input
            label="Repository Name"
            placeholder="my-awesome-project"
            value={newRepo.name}
            onChange={(e) => setNewRepo({ ...newRepo, name: e.target.value })}
            disabled={isAddingRepo}
          />
          <div>
            <Input
              label="Repository URL"
              placeholder="https://github.com/username/repo"
              value={newRepo.url}
              onChange={(e) => handleUrlChange(e.target.value)}
              disabled={isAddingRepo}
              error={urlError || undefined}
            />
            {urlError && (
              <p className="mt-1 text-sm text-red-400">{urlError}</p>
            )}
            <p className="mt-1 text-xs text-[var(--text-muted)]">
              Enter the full repository URL (HTTPS or SSH format)
            </p>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Select
              label="Provider"
              options={[
                { value: 'github', label: 'GitHub' },
                { value: 'gitlab', label: 'GitLab' },
                { value: 'bitbucket', label: 'Bitbucket' },
                { value: 'azure', label: 'Azure DevOps' },
              ]}
              value={newRepo.provider}
              onChange={(value) => {
                setNewRepo({ ...newRepo, provider: value as any })
                // Re-validate URL when provider changes
                if (newRepo.url) {
                  const error = validateRepositoryUrl(newRepo.url, value)
                  setUrlError(error)
                }
              }}
              disabled={isAddingRepo}
            />
            <Input
              label="Branch"
              placeholder="main"
              value={newRepo.branch}
              onChange={(e) => setNewRepo({ ...newRepo, branch: e.target.value })}
              disabled={isAddingRepo}
            />
          </div>

          <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-[var(--border-color)]">
            <Button 
              type="button" 
              variant="ghost" 
              onClick={() => {
                setIsAddModalOpen(false)
                setUrlError(null)
                setNewRepo({ name: '', url: '', provider: 'github', branch: 'main' })
              }}
              disabled={isAddingRepo}
            >
              Cancel
            </Button>
            <Button 
              type="button" 
              variant="primary" 
              onClick={() => {
                console.log('Add Repository clicked', newRepo)
                handleAddRepository()
              }}
              disabled={isAddingRepo || !!urlError}
              leftIcon={isAddingRepo ? <RefreshCw className="w-4 h-4 animate-spin" /> : undefined}
            >
              {isAddingRepo ? 'Adding...' : 'Add Repository'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
