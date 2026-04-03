'use client'

import { DEMO_REPOSITORIES, DEMO_SCANS, DEMO_SECRETS, isDemoMode } from '@/lib/demoData'
import {
    ArrowRight,
    BarChart3,
    Bell,
    Command,
    FileText,
    FolderGit2,
    HelpCircle,
    Key,
    Scan,
    Search,
    Settings,
    Shield
} from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useRef, useState } from 'react'

interface SearchResult {
  id: string
  type: 'page' | 'repository' | 'secret' | 'scan' | 'action'
  title: string
  description?: string
  icon: React.ReactNode
  path?: string
  action?: () => void
}

const PAGES: SearchResult[] = [
  { id: 'dashboard', type: 'page', title: 'Dashboard', description: 'Overview and statistics', icon: <BarChart3 className="w-4 h-4" />, path: '/' },
  { id: 'repositories', type: 'page', title: 'Repositories', description: 'Manage repositories', icon: <FolderGit2 className="w-4 h-4" />, path: '/repositories' },
  { id: 'secrets', type: 'page', title: 'Secrets', description: 'View detected secrets', icon: <Key className="w-4 h-4" />, path: '/secrets' },
  { id: 'scans', type: 'page', title: 'Scans', description: 'Scan history', icon: <Scan className="w-4 h-4" />, path: '/scans' },
  { id: 'reports', type: 'page', title: 'Reports', description: 'Generate reports', icon: <FileText className="w-4 h-4" />, path: '/reports' },
  { id: 'alerts', type: 'page', title: 'Alerts', description: 'View alerts', icon: <Bell className="w-4 h-4" />, path: '/alerts' },
  { id: 'policies', type: 'page', title: 'Policies', description: 'Security policies', icon: <Shield className="w-4 h-4" />, path: '/policies' },
  { id: 'settings', type: 'page', title: 'Settings', description: 'App settings', icon: <Settings className="w-4 h-4" />, path: '/settings' },
  { id: 'help', type: 'page', title: 'Help', description: 'Documentation & FAQ', icon: <HelpCircle className="w-4 h-4" />, path: '/help' },
  { id: 'audit', type: 'page', title: 'Audit Logs', description: 'Activity history', icon: <FileText className="w-4 h-4" />, path: '/audit' },
  { id: 'teams', type: 'page', title: 'Team Management', description: 'Manage teams', icon: <FolderGit2 className="w-4 h-4" />, path: '/teams' },
  { id: 'api-keys', type: 'page', title: 'API Keys', description: 'Manage API keys', icon: <Key className="w-4 h-4" />, path: '/api-keys' },
]

interface GlobalSearchProps {
  isOpen: boolean
  onClose: () => void
}

export default function GlobalSearch({ isOpen, onClose }: GlobalSearchProps) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [selectedIndex, setSelectedIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const router = useRouter()

  // Focus input when modal opens
  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus()
      setQuery('')
      setResults(PAGES.slice(0, 6))
      setSelectedIndex(0)
    }
  }, [isOpen])

  // Search logic
  useEffect(() => {
    if (!query.trim()) {
      setResults(PAGES.slice(0, 6))
      return
    }

    const searchQuery = query.toLowerCase()
    const matchedResults: SearchResult[] = []

    // Search pages
    PAGES.forEach(page => {
      if (page.title.toLowerCase().includes(searchQuery) || 
          page.description?.toLowerCase().includes(searchQuery)) {
        matchedResults.push(page)
      }
    })

    // Search demo data if in demo mode
    if (isDemoMode()) {
      // Search repositories
      DEMO_REPOSITORIES.forEach(repo => {
        if (repo.name.toLowerCase().includes(searchQuery)) {
          matchedResults.push({
            id: `repo-${repo.id}`,
            type: 'repository',
            title: repo.name,
            description: `Repository • ${repo.secrets_count} secrets`,
            icon: <FolderGit2 className="w-4 h-4" />,
            path: '/repositories',
          })
        }
      })

      // Search secrets
      DEMO_SECRETS.forEach(secret => {
        if (secret.secret_type.toLowerCase().includes(searchQuery) ||
            secret.file_path.toLowerCase().includes(searchQuery)) {
          matchedResults.push({
            id: `secret-${secret.id}`,
            type: 'secret',
            title: secret.secret_type,
            description: `${secret.file_path} • ${secret.severity}`,
            icon: <Key className="w-4 h-4" />,
            path: '/secrets',
          })
        }
      })

      // Search scans
      DEMO_SCANS.forEach(scan => {
        if (scan.repository_name.toLowerCase().includes(searchQuery)) {
          matchedResults.push({
            id: `scan-${scan.id}`,
            type: 'scan',
            title: `Scan: ${scan.repository_name}`,
            description: `${scan.status} • ${scan.secrets_found} secrets found`,
            icon: <Scan className="w-4 h-4" />,
            path: '/scans',
          })
        }
      })
    }

    setResults(matchedResults.slice(0, 10))
    setSelectedIndex(0)
  }, [query])

  // Handle keyboard navigation
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        setSelectedIndex(prev => Math.min(prev + 1, results.length - 1))
        break
      case 'ArrowUp':
        e.preventDefault()
        setSelectedIndex(prev => Math.max(prev - 1, 0))
        break
      case 'Enter':
        e.preventDefault()
        if (results[selectedIndex]) {
          handleSelect(results[selectedIndex])
        }
        break
      case 'Escape':
        onClose()
        break
    }
  }, [results, selectedIndex, onClose])

  const handleSelect = (result: SearchResult) => {
    if (result.action) {
      result.action()
    } else if (result.path) {
      router.push(result.path)
    }
    onClose()
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center pt-[20vh]">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div 
        className="relative w-full max-w-xl mx-4 rounded-xl shadow-2xl overflow-hidden border"
        style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-color)' }}
      >
        {/* Search Input */}
        <div className="flex items-center gap-3 p-4 border-b" style={{ borderColor: 'var(--border-color)' }}>
          <Search className="w-5 h-5 text-[var(--text-muted)]" />
          <input
            ref={inputRef}
            type="text"
            placeholder="Search pages, repositories, secrets..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            className="flex-1 bg-transparent text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none text-base"
          />
          <div className="flex items-center gap-1 text-xs text-[var(--text-muted)]">
            <kbd className="px-1.5 py-0.5 rounded bg-[var(--bg-tertiary)] font-mono">esc</kbd>
            <span>to close</span>
          </div>
        </div>

        {/* Results */}
        <div className="max-h-[40vh] overflow-y-auto p-2">
          {results.length === 0 ? (
            <div className="py-8 text-center text-[var(--text-muted)]">
              No results found for "{query}"
            </div>
          ) : (
            <div className="space-y-1">
              {results.map((result, index) => (
                <button
                  key={result.id}
                  onClick={() => handleSelect(result)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-colors ${
                    index === selectedIndex 
                      ? 'bg-blue-500/20 text-[var(--text-primary)]' 
                      : 'hover:bg-[var(--bg-tertiary)] text-[var(--text-secondary)]'
                  }`}
                >
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                    result.type === 'page' ? 'bg-blue-500/20 text-blue-400' :
                    result.type === 'repository' ? 'bg-purple-500/20 text-purple-400' :
                    result.type === 'secret' ? 'bg-red-500/20 text-red-400' :
                    result.type === 'scan' ? 'bg-green-500/20 text-green-400' :
                    'bg-[var(--bg-tertiary)] text-[var(--text-muted)]'
                  }`}>
                    {result.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{result.title}</p>
                    {result.description && (
                      <p className="text-xs text-[var(--text-muted)] truncate">{result.description}</p>
                    )}
                  </div>
                  <ArrowRight className="w-4 h-4 text-[var(--text-muted)]" />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-4 py-2 border-t text-xs text-[var(--text-muted)]" style={{ borderColor: 'var(--border-color)' }}>
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 rounded bg-[var(--bg-tertiary)] font-mono">↑</kbd>
              <kbd className="px-1.5 py-0.5 rounded bg-[var(--bg-tertiary)] font-mono">↓</kbd>
              navigate
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 rounded bg-[var(--bg-tertiary)] font-mono">↵</kbd>
              select
            </span>
          </div>
          <span className="flex items-center gap-1">
            <Command className="w-3 h-3" />K to search
          </span>
        </div>
      </div>
    </div>
  )
}

// Hook to handle Ctrl+K shortcut
export function useGlobalSearch() {
  const [isOpen, setIsOpen] = useState(false)

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setIsOpen(true)
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [])

  return {
    isOpen,
    open: () => setIsOpen(true),
    close: () => setIsOpen(false),
  }
}
