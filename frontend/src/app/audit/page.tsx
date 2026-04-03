'use client'

import Header from '@/components/layout/Header'
import Sidebar from '@/components/layout/Sidebar'
import { Badge, Button, Card, Skeleton } from '@/components/ui'
import { isDemoMode } from '@/lib/demoData'
import {
    ChevronLeft,
    ChevronRight,
    Download,
    FileText,
    FolderGit2,
    Key,
    LogIn,
    RefreshCw,
    Scan,
    Search,
    Settings,
    Shield,
    User
} from 'lucide-react'
import { useEffect, useState } from 'react'

interface AuditLog {
  id: number
  action: string
  category: 'auth' | 'scan' | 'secret' | 'repository' | 'policy' | 'settings' | 'user' | 'api'
  description: string
  user_email: string
  user_name: string
  ip_address: string
  user_agent: string
  resource_type?: string
  resource_id?: string
  metadata?: Record<string, any>
  created_at: string
}

const DEMO_AUDIT_LOGS: AuditLog[] = [
  {
    id: 1,
    action: 'login',
    category: 'auth',
    description: 'User logged in successfully',
    user_email: 'demo@VaultSentry.io',
    user_name: 'Demo User',
    ip_address: '192.168.1.100',
    user_agent: 'Chrome/120.0 Windows',
    created_at: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
  },
  {
    id: 2,
    action: 'scan_started',
    category: 'scan',
    description: 'Initiated scan for repository backend-api',
    user_email: 'demo@VaultSentry.io',
    user_name: 'Demo User',
    ip_address: '192.168.1.100',
    user_agent: 'Chrome/120.0 Windows',
    resource_type: 'repository',
    resource_id: '2',
    created_at: new Date(Date.now() - 15 * 60 * 1000).toISOString(),
  },
  {
    id: 3,
    action: 'secret_resolved',
    category: 'secret',
    description: 'Marked AWS Access Key as resolved',
    user_email: 'admin@acme.com',
    user_name: 'Admin User',
    ip_address: '10.0.0.50',
    user_agent: 'Firefox/121.0 macOS',
    resource_type: 'secret',
    resource_id: '1',
    created_at: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
  },
  {
    id: 4,
    action: 'repository_added',
    category: 'repository',
    description: 'Added repository mobile-app',
    user_email: 'demo@VaultSentry.io',
    user_name: 'Demo User',
    ip_address: '192.168.1.100',
    user_agent: 'Chrome/120.0 Windows',
    resource_type: 'repository',
    resource_id: '3',
    created_at: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: 5,
    action: 'policy_updated',
    category: 'policy',
    description: 'Updated scanning policy for production',
    user_email: 'admin@acme.com',
    user_name: 'Admin User',
    ip_address: '10.0.0.50',
    user_agent: 'Safari/17.0 macOS',
    resource_type: 'policy',
    resource_id: 'prod-policy',
    created_at: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: 6,
    action: 'report_generated',
    category: 'settings',
    description: 'Generated weekly security report',
    user_email: 'demo@VaultSentry.io',
    user_name: 'Demo User',
    ip_address: '192.168.1.100',
    user_agent: 'Chrome/120.0 Windows',
    resource_type: 'report',
    resource_id: '5',
    created_at: new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: 7,
    action: 'api_key_created',
    category: 'api',
    description: 'Created new API key for CI/CD integration',
    user_email: 'admin@acme.com',
    user_name: 'Admin User',
    ip_address: '10.0.0.50',
    user_agent: 'Firefox/121.0 macOS',
    resource_type: 'api_key',
    resource_id: 'key_xxx',
    created_at: new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: 8,
    action: 'user_invited',
    category: 'user',
    description: 'Invited new team member dev@acme.com',
    user_email: 'admin@acme.com',
    user_name: 'Admin User',
    ip_address: '10.0.0.50',
    user_agent: 'Chrome/120.0 macOS',
    resource_type: 'user',
    resource_id: 'dev@acme.com',
    created_at: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: 9,
    action: 'secret_rotated',
    category: 'secret',
    description: 'Auto-rotated Stripe API key',
    user_email: 'system@VaultSentry.io',
    user_name: 'System',
    ip_address: 'internal',
    user_agent: 'VaultSentry/1.0',
    resource_type: 'secret',
    resource_id: '3',
    created_at: new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: 10,
    action: 'scan_completed',
    category: 'scan',
    description: 'Scan completed for infrastructure - 2 secrets found',
    user_email: 'system@VaultSentry.io',
    user_name: 'System',
    ip_address: 'internal',
    user_agent: 'VaultSentry/1.0',
    resource_type: 'scan',
    resource_id: '10',
    created_at: new Date(Date.now() - 72 * 60 * 60 * 1000).toISOString(),
  },
]

const categoryConfig: Record<string, { icon: React.ElementType; color: string; bg: string }> = {
  auth: { icon: LogIn, color: 'text-blue-400', bg: 'bg-blue-500/20' },
  scan: { icon: Scan, color: 'text-green-400', bg: 'bg-green-500/20' },
  secret: { icon: Key, color: 'text-red-400', bg: 'bg-red-500/20' },
  repository: { icon: FolderGit2, color: 'text-purple-400', bg: 'bg-purple-500/20' },
  policy: { icon: Shield, color: 'text-yellow-400', bg: 'bg-yellow-500/20' },
  settings: { icon: Settings, color: 'text-gray-400', bg: 'bg-gray-500/20' },
  user: { icon: User, color: 'text-cyan-400', bg: 'bg-cyan-500/20' },
  api: { icon: Key, color: 'text-orange-400', bg: 'bg-orange-500/20' },
}

export default function AuditLogsPage() {
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [logs, setLogs] = useState<AuditLog[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<string>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [page, setPage] = useState(1)
  const perPage = 10

  useEffect(() => {
    // Load demo data or fetch from API
    if (isDemoMode()) {
      setLogs(DEMO_AUDIT_LOGS)
    } else {
      setLogs(DEMO_AUDIT_LOGS) // Fallback to demo data
    }
    setLoading(false)
  }, [])

  const filteredLogs = logs.filter(log => {
    const matchesFilter = filter === 'all' || log.category === filter
    const matchesSearch = searchQuery === '' || 
      log.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      log.user_email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      log.action.toLowerCase().includes(searchQuery.toLowerCase())
    return matchesFilter && matchesSearch
  })

  const paginatedLogs = filteredLogs.slice((page - 1) * perPage, page * perPage)
  const totalPages = Math.ceil(filteredLogs.length / perPage)

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr)
    const now = new Date()
    const diff = now.getTime() - date.getTime()
    
    if (diff < 60000) return 'Just now'
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  }

  const exportLogs = () => {
    const csv = [
      ['ID', 'Action', 'Category', 'Description', 'User', 'IP Address', 'Date'].join(','),
      ...filteredLogs.map(log => [
        log.id,
        log.action,
        log.category,
        `"${log.description}"`,
        log.user_email,
        log.ip_address,
        log.created_at
      ].join(','))
    ].join('\n')

    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `audit-logs-${new Date().toISOString().split('T')[0]}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: 'var(--bg-primary)' }}>
      <Sidebar isOpen={sidebarOpen} onToggle={() => setSidebarOpen(!sidebarOpen)} />
      
      <div className="flex-1 flex flex-col min-w-0">
        <Header onMenuClick={() => setSidebarOpen(!sidebarOpen)} alertCount={0} />
        
        <main className="flex-1 overflow-y-auto overflow-x-hidden" style={{ background: 'var(--bg-primary)' }}>
          <div className="max-w-[1400px] mx-auto px-6 py-6 space-y-6">
            {/* Header */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
              <div>
                <h1 className="text-2xl font-bold text-[var(--text-primary)] flex items-center gap-3">
                  <FileText className="w-7 h-7 text-blue-400" />
                  Audit Logs
                </h1>
                <p className="text-[var(--text-muted)] mt-1">Track all activity and changes in your workspace</p>
              </div>
              <div className="flex items-center gap-3">
                <Button variant="ghost" leftIcon={<RefreshCw className="w-4 h-4" />} onClick={() => setLoading(true)}>
                  Refresh
                </Button>
                <Button variant="primary" leftIcon={<Download className="w-4 h-4" />} onClick={exportLogs}>
                  Export CSV
                </Button>
              </div>
            </div>

            {/* Filters */}
            <Card className="p-4">
              <div className="flex flex-col md:flex-row gap-4">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)]" />
                  <input
                    type="text"
                    placeholder="Search logs..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 rounded-lg bg-[var(--bg-tertiary)] border border-[var(--border-color)] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                  />
                </div>
                <div className="flex gap-2 flex-wrap">
                  {['all', 'auth', 'scan', 'secret', 'repository', 'policy', 'user', 'api'].map(cat => (
                    <button
                      key={cat}
                      onClick={() => setFilter(cat)}
                      className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                        filter === cat 
                          ? 'bg-blue-500 text-white' 
                          : 'bg-[var(--bg-tertiary)] text-[var(--text-secondary)] hover:bg-[var(--bg-secondary)]'
                      }`}
                    >
                      {cat.charAt(0).toUpperCase() + cat.slice(1)}
                    </button>
                  ))}
                </div>
              </div>
            </Card>

            {/* Logs Table */}
            <Card>
              {loading ? (
                <div className="p-6">
                  <Skeleton.Table rows={8} columns={5} />
                </div>
              ) : (
                <>
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-[var(--bg-secondary)]">
                        <tr>
                          <th className="px-4 py-3 text-left text-xs font-medium text-[var(--text-muted)] uppercase">Action</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-[var(--text-muted)] uppercase">Description</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-[var(--text-muted)] uppercase">User</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-[var(--text-muted)] uppercase">IP Address</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-[var(--text-muted)] uppercase">Time</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[var(--border-color)]">
                        {paginatedLogs.map(log => {
                          const config = categoryConfig[log.category] || categoryConfig.settings
                          const Icon = config.icon
                          return (
                            <tr key={log.id} className="hover:bg-[var(--bg-secondary)]/50 transition-colors">
                              <td className="px-4 py-4">
                                <div className="flex items-center gap-3">
                                  <div className={`w-8 h-8 rounded-lg ${config.bg} flex items-center justify-center`}>
                                    <Icon className={`w-4 h-4 ${config.color}`} />
                                  </div>
                                  <div>
                                    <p className="font-medium text-[var(--text-primary)]">{log.action.replace(/_/g, ' ')}</p>
                                    <Badge variant="default" size="sm">{log.category}</Badge>
                                  </div>
                                </div>
                              </td>
                              <td className="px-4 py-4 text-[var(--text-secondary)] max-w-xs truncate">
                                {log.description}
                              </td>
                              <td className="px-4 py-4">
                                <div>
                                  <p className="text-[var(--text-primary)] text-sm">{log.user_name}</p>
                                  <p className="text-[var(--text-muted)] text-xs">{log.user_email}</p>
                                </div>
                              </td>
                              <td className="px-4 py-4 text-[var(--text-muted)] text-sm font-mono">
                                {log.ip_address}
                              </td>
                              <td className="px-4 py-4 text-[var(--text-muted)] text-sm">
                                {formatDate(log.created_at)}
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>

                  {/* Pagination */}
                  <div className="flex items-center justify-between px-4 py-3 border-t border-[var(--border-color)]">
                    <p className="text-sm text-[var(--text-muted)]">
                      Showing {(page - 1) * perPage + 1} to {Math.min(page * perPage, filteredLogs.length)} of {filteredLogs.length} logs
                    </p>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        leftIcon={<ChevronLeft className="w-4 h-4" />}
                        onClick={() => setPage(p => Math.max(1, p - 1))}
                        disabled={page === 1}
                      >
                        Previous
                      </Button>
                      <span className="text-sm text-[var(--text-secondary)]">
                        Page {page} of {totalPages}
                      </span>
                      <Button
                        variant="ghost"
                        size="sm"
                        rightIcon={<ChevronRight className="w-4 h-4" />}
                        onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                        disabled={page === totalPages}
                      >
                        Next
                      </Button>
                    </div>
                  </div>
                </>
              )}
            </Card>
          </div>
        </main>
      </div>
    </div>
  )
}
