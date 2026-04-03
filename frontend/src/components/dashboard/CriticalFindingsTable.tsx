'use client'

import {
    AlertOctagon,
    Clock,
    ExternalLink,
    Eye,
    FileCode,
    GitBranch,
    MoreHorizontal,
    RotateCcw,
    Search,
    UserPlus,
    Users
} from 'lucide-react'
import { useState } from 'react'

interface Finding {
  id: number
  type: string
  severity: 'critical' | 'high' | 'medium' | 'low'
  repository: string
  file_path: string
  line_number: number
  environment: 'production' | 'staging' | 'development'
  detected_at: string
  assigned_team: string | null
  status: 'open' | 'in-progress' | 'fixed' | 'ignored'
  masked_value?: string
}

interface CriticalFindingsTableProps {
  findings: Finding[]
  loading?: boolean
  onViewFinding?: (id: number) => void
  onRotateSecret?: (id: number) => void
  onAssignOwner?: (id: number) => void
  onIgnore?: (id: number) => void
}

const severityConfig = {
  critical: {
    label: 'Critical',
    bg: 'bg-red-500/15',
    text: 'text-red-400',
    border: 'border-red-500/30',
    dot: 'bg-red-500',
  },
  high: {
    label: 'High',
    bg: 'bg-orange-500/15',
    text: 'text-orange-400',
    border: 'border-orange-500/30',
    dot: 'bg-orange-500',
  },
  medium: {
    label: 'Medium',
    bg: 'bg-amber-500/15',
    text: 'text-amber-400',
    border: 'border-amber-500/30',
    dot: 'bg-amber-500',
  },
  low: {
    label: 'Low',
    bg: 'bg-emerald-500/15',
    text: 'text-emerald-400',
    border: 'border-emerald-500/30',
    dot: 'bg-emerald-500',
  },
}

const statusConfig: Record<string, { label: string; bg: string; text: string }> = {
  open: {
    label: 'Open',
    bg: 'bg-red-500/15',
    text: 'text-red-400',
  },
  active: {
    label: 'Active',
    bg: 'bg-red-500/15',
    text: 'text-red-400',
  },
  'in-progress': {
    label: 'In Progress',
    bg: 'bg-amber-500/15',
    text: 'text-amber-400',
  },
  fixed: {
    label: 'Fixed',
    bg: 'bg-emerald-500/15',
    text: 'text-emerald-400',
  },
  resolved: {
    label: 'Resolved',
    bg: 'bg-emerald-500/15',
    text: 'text-emerald-400',
  },
  ignored: {
    label: 'Ignored',
    bg: 'bg-gray-500/15',
    text: 'text-gray-400',
  },
  false_positive: {
    label: 'False Positive',
    bg: 'bg-gray-500/15',
    text: 'text-gray-400',
  },
}

const envConfig: Record<string, { label: string; bg: string; text: string; border: string }> = {
  production: {
    label: 'PROD',
    bg: 'bg-red-500/10',
    text: 'text-red-400',
    border: 'border-red-500/20',
  },
  staging: {
    label: 'STG',
    bg: 'bg-amber-500/10',
    text: 'text-amber-400',
    border: 'border-amber-500/20',
  },
  development: {
    label: 'DEV',
    bg: 'bg-blue-500/10',
    text: 'text-blue-400',
    border: 'border-blue-500/20',
  },
}

export default function CriticalFindingsTable({ 
  findings, 
  loading,
  onViewFinding,
  onRotateSecret,
  onAssignOwner,
  onIgnore
}: CriticalFindingsTableProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [severityFilter, setSeverityFilter] = useState<string>('all')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [selectedRows, setSelectedRows] = useState<number[]>([])
  const [showFilters, setShowFilters] = useState(false)

  const filteredFindings = findings.filter(finding => {
    if (severityFilter !== 'all' && finding.severity !== severityFilter) return false
    if (statusFilter !== 'all' && finding.status !== statusFilter) return false
    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      return (
        finding.type.toLowerCase().includes(query) ||
        finding.repository.toLowerCase().includes(query) ||
        finding.file_path.toLowerCase().includes(query)
      )
    }
    return true
  })

  const criticalCount = findings.filter(f => f.severity === 'critical' && f.status === 'open').length
  const highCount = findings.filter(f => f.severity === 'high' && f.status === 'open').length

  if (loading) {
    return (
      <div className="card animate-pulse">
        <div className="flex items-center justify-between mb-4">
          <div className="h-6 w-48 skeleton" />
          <div className="h-9 w-32 skeleton rounded-lg" />
        </div>
        <div className="space-y-3">
          {[1, 2, 3, 4, 5].map(i => (
            <div key={i} className="h-16 skeleton rounded-lg" />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="card p-0 overflow-hidden">
      {/* Header */}
      <div className="p-5 border-b border-[var(--border-color)]">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-red-500/20 flex items-center justify-center">
              <AlertOctagon className="w-5 h-5 text-red-400" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-[var(--text-primary)]">Critical Findings</h3>
              <p className="text-sm text-[var(--text-muted)]">
                Secrets requiring immediate attention
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            {/* Quick stats */}
            <div className="flex items-center gap-2">
              <span className="badge badge-critical">
                <span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse" />
                {criticalCount} Critical
              </span>
              <span className="badge badge-high">
                {highCount} High
              </span>
            </div>
          </div>
        </div>

        {/* Search and Filter Bar */}
        <div className="flex flex-col sm:flex-row gap-3 mt-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)]" />
            <input
              type="text"
              placeholder="Search by type, repository, or file path..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-[var(--bg-tertiary)] border border-[var(--border-color)] rounded-lg text-sm text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent)]/20 transition-all"
            />
          </div>
          
          <div className="flex gap-2">
            <select
              value={severityFilter}
              onChange={(e) => setSeverityFilter(e.target.value)}
              className="px-3 py-2.5 bg-[var(--bg-tertiary)] border border-[var(--border-color)] rounded-lg text-sm text-[var(--text-secondary)] focus:outline-none focus:border-[var(--accent)]"
            >
              <option value="all">All Severity</option>
              <option value="critical">Critical</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>
            
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-2.5 bg-[var(--bg-tertiary)] border border-[var(--border-color)] rounded-lg text-sm text-[var(--text-secondary)] focus:outline-none focus:border-[var(--accent)]"
            >
              <option value="all">All Status</option>
              <option value="open">Open</option>
              <option value="in-progress">In Progress</option>
              <option value="fixed">Fixed</option>
              <option value="ignored">Ignored</option>
            </select>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="bg-[var(--bg-tertiary)]">
              <th className="px-5 py-3 text-left text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider">Type</th>
              <th className="px-5 py-3 text-left text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider">Severity</th>
              <th className="px-5 py-3 text-left text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider">Repository</th>
              <th className="px-5 py-3 text-left text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider">Location</th>
              <th className="px-5 py-3 text-left text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider">Env</th>
              <th className="px-5 py-3 text-left text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider">Detected</th>
              <th className="px-5 py-3 text-left text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider">Team</th>
              <th className="px-5 py-3 text-left text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider">Status</th>
              <th className="px-5 py-3 text-right text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border-color)]">
            {filteredFindings.length === 0 ? (
              <tr>
                <td colSpan={9} className="px-5 py-12 text-center">
                  <div className="empty-state">
                    <AlertOctagon className="w-12 h-12 text-[var(--text-muted)] opacity-50 mb-3" />
                    <p className="text-[var(--text-muted)]">No findings match your filters</p>
                  </div>
                </td>
              </tr>
            ) : (
              filteredFindings.map((finding) => {
                const severity = severityConfig[finding.severity] || severityConfig.medium
                const status = statusConfig[finding.status] || statusConfig.open
                const env = envConfig[finding.environment] || envConfig.development
                
                return (
                  <tr 
                    key={finding.id}
                    className="group hover:bg-[var(--bg-tertiary)] transition-colors"
                  >
                    {/* Type */}
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-lg ${severity.bg} flex items-center justify-center`}>
                          <FileCode className={`w-4 h-4 ${severity.text}`} />
                        </div>
                        <span className="font-medium text-[var(--text-primary)]">{finding.type}</span>
                      </div>
                    </td>
                    
                    {/* Severity */}
                    <td className="px-5 py-4">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${severity.bg} ${severity.text} border ${severity.border}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${severity.dot}`} />
                        {severity.label}
                      </span>
                    </td>
                    
                    {/* Repository */}
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-2">
                        <GitBranch className="w-4 h-4 text-[var(--text-muted)]" />
                        <span className="text-[var(--text-secondary)]">{finding.repository}</span>
                      </div>
                    </td>
                    
                    {/* Location */}
                    <td className="px-5 py-4">
                      <div className="flex flex-col">
                        <span className="text-sm text-[var(--text-secondary)] font-mono truncate max-w-[200px]">
                          {finding.file_path}
                        </span>
                        <span className="text-xs text-[var(--text-muted)]">Line {finding.line_number}</span>
                      </div>
                    </td>
                    
                    {/* Environment */}
                    <td className="px-5 py-4">
                      <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${env.bg} ${env.text} border ${env.border}`}>
                        {env.label}
                      </span>
                    </td>
                    
                    {/* Detected */}
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-1.5 text-[var(--text-muted)]">
                        <Clock className="w-3.5 h-3.5" />
                        <span className="text-sm">{finding.detected_at}</span>
                      </div>
                    </td>
                    
                    {/* Assigned Team */}
                    <td className="px-5 py-4">
                      {finding.assigned_team ? (
                        <div className="flex items-center gap-1.5">
                          <Users className="w-3.5 h-3.5 text-[var(--text-muted)]" />
                          <span className="text-sm text-[var(--text-secondary)]">{finding.assigned_team}</span>
                        </div>
                      ) : (
                        <span className="text-sm text-[var(--text-muted)] italic">Unassigned</span>
                      )}
                    </td>
                    
                    {/* Status */}
                    <td className="px-5 py-4">
                      <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-medium ${status.bg} ${status.text}`}>
                        {status.label}
                      </span>
                    </td>
                    
                    {/* Actions */}
                    <td className="px-5 py-4">
                      <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button 
                          onClick={() => onViewFinding?.(finding.id)}
                          className="action-btn action-btn-view"
                          title="View Finding"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                        <button 
                          onClick={() => onRotateSecret?.(finding.id)}
                          className="action-btn action-btn-rotate"
                          title="Rotate Secret"
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                        </button>
                        <button 
                          onClick={() => onAssignOwner?.(finding.id)}
                          className="action-btn action-btn-view"
                          title="Assign Owner"
                        >
                          <UserPlus className="w-3.5 h-3.5" />
                        </button>
                        <button 
                          onClick={() => onIgnore?.(finding.id)}
                          className="action-btn action-btn-ignore"
                          title="Ignore"
                        >
                          <MoreHorizontal className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Footer */}
      {filteredFindings.length > 0 && (
        <div className="px-5 py-3 border-t border-[var(--border-color)] flex items-center justify-between">
          <span className="text-sm text-[var(--text-muted)]">
            Showing {filteredFindings.length} of {findings.length} findings
          </span>
          <button className="text-sm text-[var(--accent)] hover:underline flex items-center gap-1">
            View All Findings
            <ExternalLink className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
    </div>
  )
}
