'use client'

import Header from '@/components/layout/Header'
import Sidebar from '@/components/layout/Sidebar'
import { Badge, Button, Card, Input, Modal, Select, Skeleton } from '@/components/ui'
import { useToast } from '@/contexts/ToastContext'
import { DEMO_REPOSITORIES, isDemoMode } from '@/lib/demoData'
import type { Repository } from '@/lib/supabase/types'
import { repositoryService } from '@/services/supabase'
import { getAuthHeaders } from '@/lib/authHeaders'
import {
    ExternalLink,
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
      // Try loading persisted repos from backend first
      try {
        const response = await fetch('/api/repositories', { headers: getAuthHeaders() })
        if (response.ok) {
          const backendRepos = await response.json()
          if (backendRepos && backendRepos.length > 0) {
            console.log(`[REPOS] Loaded ${backendRepos.length} repos from backend`)
            setRepositories(backendRepos as Repository[])
            setLoading(false)
            return
          }
        }
      } catch (err) {
        console.log('[REPOS] Backend not available, using local data')
      }

      // Fallback: demo or Supabase
      if (isDemoMode()) {
        if (!demoReposLoadedRef.current) {
          setRepositories(DEMO_REPOSITORIES as unknown as Repository[])
          demoReposLoadedRef.current = true
        }
        setLoading(false)
        return
      }

      const data = await repositoryService.getAll()
      setRepositories(data)
    } catch (error) {
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
      // Save to backend for persistence + auto-scan
      console.log('[REPO] Saving repository to backend:', newRepo.name)
      
      // Save repo to backend
      let savedRepo: Repository | null = null
      try {
        const saveResponse = await fetch('/api/repositories', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
          body: JSON.stringify({
            name: newRepo.name,
            url: newRepo.url,
            provider: newRepo.provider,
            branch: newRepo.branch || 'main',
          }),
        })
        if (saveResponse.ok) {
          savedRepo = await saveResponse.json() as Repository
          console.log('[REPO] Saved to backend, id:', savedRepo.id)
        }
      } catch (err) {
        console.log('[REPO] Backend save failed, using local only')
      }

      // Use backend-saved repo or create local fallback
      const repoId = savedRepo?.id || Date.now()
      const finalRepo: Repository = savedRepo || {
        id: repoId,
        user_id: 'demo-user-id-12345',
        name: newRepo.name,
        url: newRepo.url,
        provider: newRepo.provider,
        branch: newRepo.branch,
        status: 'active',
        last_scan_at: null,
        secrets_count: 0,
        webhook_secret: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      } as Repository

      setRepositories(prev => [finalRepo, ...prev])
      setIsAddModalOpen(false)
      setNewRepo({ name: '', url: '', provider: 'github', branch: 'main' })
      toast.success('Repository added', `${finalRepo.name} has been saved`)
      
      // Auto-trigger scan
      console.log('[SCAN] Auto-triggering scan for:', finalRepo.name)
      toast.info('Scan started', `Scanning ${finalRepo.name}...`)
      
      fetch('/api/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify({
          scan_id: repoId,
          repository_id: repoId,
          repository_url: newRepo.url,
          branch: newRepo.branch || 'main',
        }),
      }).then(async (response) => {
        console.log('[SCAN] Auto-scan response:', response.status)
        if (response.ok) {
          const data = await response.json()
          console.log('[SCAN] Auto-scan result:', data)
          toast.success('Scan queued', `${finalRepo.name} is being scanned`)
        } else {
          toast.error('Scan failed', `Backend returned ${response.status}`)
        }
      }).catch((err) => {
        console.error('[SCAN] Auto-scan failed:', err)
        toast.error('Scanner offline', 'Backend not reachable')
      })
      
      if (isDemoMode()) return

      console.log('[REPO ADD] Submitting repository:', newRepo)
      const repo = await repositoryService.create(newRepo)
      console.log('[REPO ADD] Repository created:', repo)
      
      setRepositories(prev => [repo, ...prev])
      setIsAddModalOpen(false)
      setNewRepo({ name: '', url: '', provider: 'github', branch: 'main' })
      toast.success('Repository added', `${repo.name} has been added successfully`)
      
      // Auto-trigger scan for the new repository
      toast.info('Scan queued', 'Initial scan will start automatically')
      
      // Trigger scan in background
      setTimeout(async () => {
        try {
          console.log('[REPO ADD] Auto-triggering scan for repository:', repo.id)
          await repositoryService.scan(repo.id)
          toast.success('Scan started', 'Repository scan is now running')
        } catch (scanError) {
          console.error('[REPO ADD] Auto-scan failed:', scanError)
          toast.warning('Scan delayed', 'Initial scan will retry shortly')
        }
      }, 2000)
      
    } catch (error) {
      console.error('[REPO ADD] Failed to add repository:', error)
      const errorMessage = error instanceof Error ? error.message : 'Please try again'
      toast.error('Failed to add repository', errorMessage)
    } finally {
      setIsAddingRepo(false)
    }
  }

  const handleScanRepository = async (repoId: number) => {
    console.log('[SCAN] handleScanRepository called with repoId:', repoId)
    setScanningRepoId(repoId)
    try {
      // Find the repository to get its URL
      const repo = repositories.find(r => r.id === repoId)
      console.log('[SCAN] Found repo:', repo ? { name: repo.name, url: repo.url, branch: repo.branch } : 'NOT FOUND')
      console.log('[SCAN] isDemoMode:', isDemoMode())
      
      // In demo mode OR when Supabase auth isn't available, call the scanner API directly
      if (isDemoMode() || !repo) {
        if (!repo) {
          console.error('[SCAN] Repository not found for id:', repoId)
          toast.error('Repository not found')
          return
        }
        
        // Check if the repo URL is a fake demo URL
        if (repo.url.includes('acme-corp')) {
          console.log('[SCAN] Demo repo with fake URL, skipping')
          toast.warning('Demo repository', 'This is a demo repo with a fake URL. Add a real GitHub repo to scan.')
          return
        }
        
        console.log('[SCAN] Calling /api/scan with:', { scan_id: repoId, repository_url: repo.url, branch: repo.branch })
        toast.info('Scan started', `Scanning ${repo.name}...`)
        
        try {
          // Use Next.js API proxy to avoid CORS issues
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
          
          if (response.ok) {
            const data = await response.json()
            console.log('[SCAN] Success:', data)
            toast.success('Scan queued', `${repo.name} is being scanned by the Node.js engine`)
            setTimeout(() => {
              toast.info('Scan running', 'Check the Detection page for results')
            }, 3000)
          } else {
            const errData = await response.json().catch(() => ({ error: 'Unknown error' }))
            console.error('[SCAN] Backend error:', response.status, errData)
            toast.error('Scan failed', errData.error || `Backend returned ${response.status}`)
          }
        } catch (fetchErr) {
          console.error('[SCAN] Cannot reach scanner API:', fetchErr)
          toast.error('Scanner offline', 'Make sure the backend is running (npm run dev)')
        }
        return
      }
      
      console.log('[SCAN] Using repositoryService.scan (non-demo mode)')
      await repositoryService.scan(repoId)
      toast.success('Scan started', 'Repository scan has been initiated')
    } catch (error) {
      console.error('[SCAN] Failed to start scan:', error)
      toast.error('Failed to start scan', error instanceof Error ? error.message : 'Please try again')
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
                        onClick={() => window.open(repo.url, '_blank')}
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
