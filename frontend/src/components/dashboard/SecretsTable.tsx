'use client'

import { useState } from 'react'
import {
  KeyRound,
  Eye,
  EyeOff,
  Copy,
  CheckCircle2,
  AlertTriangle,
  Shield,
  ExternalLink,
  FileCode,
  Filter,
  Search,
  RotateCcw,
  Brain,
  Clock,
  Users,
  Zap,
  AlertOctagon,
  ExternalLinkIcon,
  MoreVertical
} from 'lucide-react'

interface Secret {
  id: number
  type: string
  risk_level: 'critical' | 'high' | 'medium' | 'low'
  file_path: string
  line_number: number
  repository_name: string
  detected_at: string
  status: 'open' | 'in_progress' | 'resolved' | 'false_positive' | 'ignored'
  masked_value: string
  // New ML and lifecycle fields
  ml_risk_score?: number
  confidence?: number
  business_impact_score?: number
  environment?: 'production' | 'staging' | 'development' | 'test'
  assigned_team?: string
  priority?: number
  days_open?: number
  sla_due_at?: string
  jira_issue_key?: string
  auto_rotated?: boolean
}

interface SecretsTableProps {
  secrets: Secret[]
  onRotate?: (id: number) => void
  onCreateJira?: (id: number) => void
  onAssign?: (id: number, team: string) => void
  onResolve?: (id: number) => void
}

const riskConfig = {
  critical: {
    label: 'Critical',
    bg: 'bg-red-500/10',
    text: 'text-red-400',
    border: 'border-red-500/30'
  },
  high: {
    label: 'High',
    bg: 'bg-orange-500/10',
    text: 'text-orange-400',
    border: 'border-orange-500/30'
  },
  medium: {
    label: 'Medium',
    bg: 'bg-yellow-500/10',
    text: 'text-yellow-400',
    border: 'border-yellow-500/30'
  },
  low: {
    label: 'Low',
    bg: 'bg-green-500/10',
    text: 'text-green-400',
    border: 'border-green-500/30'
  }
}

const statusConfig = {
  open: {
    label: 'Open',
    bg: 'bg-red-500/10',
    text: 'text-red-400'
  },
  in_progress: {
    label: 'In Progress',
    bg: 'bg-blue-500/10',
    text: 'text-blue-400'
  },
  resolved: {
    label: 'Resolved',
    bg: 'bg-green-500/10',
    text: 'text-green-400'
  },
  false_positive: {
    label: 'False Positive',
    bg: 'bg-gray-500/10',
    text: 'text-gray-400'
  },
  ignored: {
    label: 'Ignored',
    bg: 'bg-gray-500/10',
    text: 'text-gray-400'
  }
}

const envConfig: Record<string, { label: string; bg: string; text: string; border: string }> = {
  production: { label: 'Prod', bg: 'bg-red-500/20', text: 'text-red-400', border: 'border-red-500/30' },
  staging: { label: 'Stage', bg: 'bg-amber-500/20', text: 'text-amber-400', border: 'border-amber-500/30' },
  development: { label: 'Dev', bg: 'bg-blue-500/20', text: 'text-blue-400', border: 'border-blue-500/30' },
  test: { label: 'Test', bg: 'bg-gray-500/20', text: 'text-gray-400', border: 'border-gray-500/30' },
}

export default function SecretsTable({ secrets, onRotate, onCreateJira, onAssign, onResolve }: SecretsTableProps) {
  const [showValues, setShowValues] = useState<Record<number, boolean>>({})
  const [copiedId, setCopiedId] = useState<number | null>(null)
  const [filter, setFilter] = useState<string>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [expandedRow, setExpandedRow] = useState<number | null>(null)

  const toggleValue = (id: number) => {
    setShowValues(prev => ({ ...prev, [id]: !prev[id] }))
  }

  const copyToClipboard = async (id: number, value: string) => {
    await navigator.clipboard.writeText(value)
    setCopiedId(id)
    setTimeout(() => setCopiedId(null), 2000)
  }

  const filteredSecrets = secrets.filter(secret => {
    if (filter !== 'all' && secret.risk_level !== filter) return false
    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      return (
        secret.type.toLowerCase().includes(query) ||
        secret.file_path.toLowerCase().includes(query) ||
        secret.repository_name.toLowerCase().includes(query)
      )
    }
    return true
  })

  return (
    <div className="card overflow-hidden">
      {/* Header with filters */}
      <div className="p-4 border-b border-[var(--border-color)]">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-semibold text-[var(--text-primary)]">Detected Secrets</h3>
            <p className="text-[var(--text-muted)] text-sm mt-1">
              {secrets.filter(s => s.status === 'open' || s.status === 'in_progress').length} active issues requiring attention
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="badge badge-critical">
              {secrets.filter(s => s.risk_level === 'critical').length} Critical
            </span>
            <span className="badge badge-warning">
              {secrets.filter(s => s.risk_level === 'high').length} High
            </span>
          </div>
        </div>

        {/* Search and Filter Bar */}
        <div className="flex items-center gap-4">
          <div className="relative flex-1 max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)]" />
            <input
              type="text"
              placeholder="Search secrets..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-[var(--bg-tertiary)]/50 border border-[var(--border-color)] rounded-lg text-sm text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none focus:border-[var(--accent)]/50"
            />
          </div>
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-[var(--text-muted)]" />
            <select
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className="bg-[var(--bg-tertiary)]/50 border border-[var(--border-color)] rounded-lg px-3 py-2 text-sm text-[var(--text-secondary)] focus:outline-none focus:border-[var(--accent)]/50"
            >
              <option value="all">All Risks</option>
              <option value="critical">Critical</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="table">
          <thead>
            <tr>
              <th>Type</th>
              <th>Risk</th>
              <th>ML Score</th>
              <th>Location</th>
              <th>Environment</th>
              <th>Status</th>
              <th>Age</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredSecrets.map((secret) => {
              const risk = riskConfig[secret.risk_level]
              const status = statusConfig[secret.status] || statusConfig.open
              const env = secret.environment ? envConfig[secret.environment] : null
              const isOverdue = secret.sla_due_at && new Date(secret.sla_due_at) < new Date()
              
              return (
                <tr key={secret.id} className="hover:bg-[var(--bg-tertiary)]/50 transition-colors">
                  <td>
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-lg bg-[var(--bg-tertiary)] flex items-center justify-center">
                        <KeyRound className="w-4 h-4 text-[var(--accent)]" />
                      </div>
                      <div>
                        <p className="font-medium text-[var(--text-primary)]">{secret.type}</p>
                        <p className="text-[var(--text-muted)] text-xs">{secret.repository_name}</p>
                      </div>
                    </div>
                  </td>
                  <td>
                    <span className={`
                      inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium border
                      ${risk.bg} ${risk.text} ${risk.border}
                    `}>
                      <Shield className="w-3 h-3" />
                      {risk.label}
                    </span>
                  </td>
                  <td>
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center gap-1.5">
                        <Brain className="w-3.5 h-3.5 text-purple-400" />
                        <span className="text-sm font-medium text-[var(--text-primary)]">
                          {secret.ml_risk_score?.toFixed(0) || secret.priority || 50}/100
                        </span>
                      </div>
                      {secret.confidence !== undefined && (
                        <div className="flex items-center gap-1">
                          <div className="w-12 h-1.5 bg-[var(--bg-tertiary)] rounded-full overflow-hidden">
                            <div 
                              className="h-full bg-purple-500 rounded-full"
                              style={{ width: `${secret.confidence}%` }}
                            />
                          </div>
                          <span className="text-xs text-[var(--text-muted)]">{secret.confidence}%</span>
                        </div>
                      )}
                    </div>
                  </td>
                  <td>
                    <div className="flex items-center gap-2 max-w-[180px]">
                      <FileCode className="w-4 h-4 text-[var(--text-muted)] flex-shrink-0" />
                      <div className="truncate">
                        <p className="text-[var(--text-secondary)] text-sm truncate" title={secret.file_path}>
                          {secret.file_path}
                        </p>
                        <p className="text-[var(--text-muted)] text-xs">Line {secret.line_number}</p>
                      </div>
                    </div>
                  </td>
                  <td>
                    {env ? (
                      <span className={`
                        inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium border
                        ${env.bg} ${env.text} ${env.border}
                      `}>
                        <Zap className="w-3 h-3" />
                        {env.label}
                      </span>
                    ) : (
                      <span className="text-[var(--text-muted)] text-xs">-</span>
                    )}
                  </td>
                  <td>
                    <div className="flex flex-col gap-1">
                      <span className={`
                        inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium
                        ${status.bg} ${status.text}
                      `}>
                        {secret.status === 'resolved' ? (
                          <CheckCircle2 className="w-3 h-3" />
                        ) : secret.status === 'in_progress' ? (
                          <Clock className="w-3 h-3" />
                        ) : secret.status === 'false_positive' ? (
                          <AlertOctagon className="w-3 h-3" />
                        ) : (
                          <AlertTriangle className="w-3 h-3" />
                        )}
                        {status.label}
                      </span>
                      {secret.jira_issue_key && (
                        <span className="text-xs text-blue-400 flex items-center gap-1">
                          <ExternalLink className="w-3 h-3" />
                          {secret.jira_issue_key}
                        </span>
                      )}
                    </div>
                  </td>
                  <td>
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5 text-[var(--text-muted)]" />
                        <span className={`text-sm ${isOverdue ? 'text-red-400 font-medium' : 'text-[var(--text-secondary)]'}`}>
                          {secret.days_open !== undefined ? `${secret.days_open}d` : secret.detected_at}
                        </span>
                      </div>
                      {secret.sla_due_at && (
                        <span className={`text-xs ${isOverdue ? 'text-red-400' : 'text-[var(--text-muted)]'}`}>
                          SLA: {new Date(secret.sla_due_at).toLocaleDateString()}
                        </span>
                      )}
                      {secret.assigned_team && (
                        <span className="text-xs text-[var(--text-muted)] flex items-center gap-1">
                          <Users className="w-3 h-3" />
                          {secret.assigned_team}
                        </span>
                      )}
                    </div>
                  </td>
                  <td>
                    <div className="flex items-center gap-1">
                      <button 
                        onClick={() => copyToClipboard(secret.id, secret.file_path)}
                        className="p-1.5 rounded hover:bg-[var(--bg-tertiary)] text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
                        title="Copy path"
                      >
                        {copiedId === secret.id ? (
                          <CheckCircle2 className="w-4 h-4 text-green-400" />
                        ) : (
                          <Copy className="w-4 h-4" />
                        )}
                      </button>
                      {onRotate && secret.status !== 'resolved' && (
                        <button 
                          onClick={() => onRotate(secret.id)}
                          className="p-1.5 rounded hover:bg-[var(--bg-tertiary)] text-[var(--text-muted)] hover:text-orange-400 transition-colors"
                          title="Auto-rotate secret"
                        >
                          <RotateCcw className="w-4 h-4" />
                        </button>
                      )}
                      {onCreateJira && !secret.jira_issue_key && secret.status !== 'resolved' && (
                        <button 
                          onClick={() => onCreateJira(secret.id)}
                          className="p-1.5 rounded hover:bg-[var(--bg-tertiary)] text-[var(--text-muted)] hover:text-blue-400 transition-colors"
                          title="Create Jira ticket"
                        >
                          <ExternalLink className="w-4 h-4" />
                        </button>
                      )}
                      {onResolve && secret.status !== 'resolved' && (
                        <button 
                          onClick={() => onResolve(secret.id)}
                          className="p-1.5 rounded hover:bg-[var(--bg-tertiary)] text-[var(--text-muted)] hover:text-green-400 transition-colors"
                          title="Mark as resolved"
                        >
                          <CheckCircle2 className="w-4 h-4" />
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

      {/* Empty State */}
      {filteredSecrets.length === 0 && (
        <div className="p-12 text-center">
          <Shield className="w-12 h-12 text-[var(--text-muted)] mx-auto mb-4" />
          <p className="text-[var(--text-muted)]">No secrets found matching your criteria</p>
        </div>
      )}

      {/* Footer */}
      <div className="px-4 py-3 border-t border-[var(--border-color)] flex items-center justify-between">
        <span className="text-[var(--text-muted)] text-sm">
          Showing {filteredSecrets.length} of {secrets.length} secrets
        </span>
        <button className="text-[var(--accent)] text-sm hover:underline">
          View All Secrets →
        </button>
      </div>
    </div>
  )
}
