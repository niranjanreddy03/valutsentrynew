'use client'

import {
  Clock,
  CheckCircle2,
  XCircle,
  Loader2,
  AlertTriangle,
  GitBranch,
  Play,
  StopCircle,
  RefreshCw,
  ExternalLink,
  FolderGit2
} from 'lucide-react'
import { useState } from 'react'

interface Scan {
  id: number
  repository_name: string
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled'
  branch: string
  secrets_found: number
  duration: string
  started_at: string
  triggered_by: string
}

interface RecentScansTableProps {
  scans: Scan[]
  loading?: boolean
  onRescan?: (scan: Scan) => void
  onViewDetails?: (scan: Scan) => void
  onCancelScan?: (scan: Scan) => void
  onRefresh?: () => void
  onViewAll?: () => void
}

const statusConfig = {
  pending: {
    icon: Clock,
    color: 'text-yellow-400',
    bg: 'bg-yellow-400/10',
    label: 'Pending',
    animate: false
  },
  running: {
    icon: Loader2,
    color: 'text-blue-400',
    bg: 'bg-blue-400/10',
    label: 'Running',
    animate: true
  },
  completed: {
    icon: CheckCircle2,
    color: 'text-green-400',
    bg: 'bg-green-400/10',
    label: 'Completed',
    animate: false
  },
  failed: {
    icon: XCircle,
    color: 'text-red-400',
    bg: 'bg-red-400/10',
    label: 'Failed',
    animate: false
  },
  cancelled: {
    icon: StopCircle,
    color: 'text-gray-400',
    bg: 'bg-gray-400/10',
    label: 'Cancelled',
    animate: false
  }
}

export default function RecentScansTable({
  scans,
  loading,
  onRescan,
  onViewDetails,
  onCancelScan,
  onRefresh,
  onViewAll
}: RecentScansTableProps) {
  const [selectedScan, setSelectedScan] = useState<number | null>(null)
  const [rescanningId, setRescanningId] = useState<number | null>(null)
  const [cancellingId, setCancellingId] = useState<number | null>(null)

  const handleRescan = async (scan: Scan) => {
    if (rescanningId) return
    setRescanningId(scan.id)
    try {
      onRescan?.(scan)
    } finally {
      // Reset after a short delay so the spinner shows briefly
      setTimeout(() => setRescanningId(null), 1500)
    }
  }

  const handleCancel = async (scan: Scan) => {
    if (cancellingId) return
    setCancellingId(scan.id)
    try {
      onCancelScan?.(scan)
    } finally {
      setTimeout(() => setCancellingId(null), 1500)
    }
  }

  if (loading) {
    return (
      <div className="card overflow-hidden animate-pulse">
        <div className="flex items-center justify-between p-4 border-b border-[var(--border-color)]">
          <div className="h-5 w-32 skeleton" />
          <div className="h-4 w-20 skeleton" />
        </div>
        <div className="p-4 space-y-3">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="h-12 skeleton rounded-lg" />
          ))}
        </div>
      </div>
    )
  }

  if (scans.length === 0) {
    return (
      <div className="card overflow-hidden flex flex-col">
        <div className="flex items-center justify-between p-4 border-b border-[var(--border-color)]">
          <div>
            <h3 className="text-lg font-semibold text-[var(--text-primary)]">Recent Scans</h3>
            <p className="text-[var(--text-muted)] text-sm mt-1">Latest scan activity across repositories</p>
          </div>
          {onRefresh && (
            <button className="btn-ghost text-sm" onClick={onRefresh}>
              <RefreshCw className="w-4 h-4 mr-2" />
              Refresh
            </button>
          )}
        </div>
        <div className="flex-1 flex flex-col items-center justify-center py-12">
          <FolderGit2 className="w-10 h-10 text-[var(--text-muted)] mb-3 opacity-40" />
          <p className="text-sm font-medium text-[var(--text-secondary)]">No scans yet</p>
          <p className="text-xs text-[var(--text-muted)] mt-1">Run your first scan to see activity here</p>
        </div>
      </div>
    )
  }

  return (
    <div className="card overflow-hidden">
      <div className="flex items-center justify-between p-4 border-b border-[var(--border-color)]">
        <div>
          <h3 className="text-lg font-semibold text-[var(--text-primary)]">Recent Scans</h3>
          <p className="text-[var(--text-muted)] text-sm mt-1">Latest scan activity across repositories</p>
        </div>
        {onRefresh && (
          <button className="btn-ghost text-sm" onClick={onRefresh}>
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </button>
        )}
      </div>

      <div className="overflow-x-auto">
        <table className="table">
          <thead>
            <tr>
              <th>Repository</th>
              <th>Branch</th>
              <th>Status</th>
              <th>Secrets</th>
              <th>Duration</th>
              <th>Started</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {scans.map((scan) => {
              const status = statusConfig[scan.status]
              const StatusIcon = status.icon
              return (
                <tr
                  key={scan.id}
                  className={`
                    hover:bg-[var(--bg-tertiary)]/50 cursor-pointer transition-colors
                    ${selectedScan === scan.id ? 'bg-[var(--bg-tertiary)]/50' : ''}
                  `}
                  onClick={() => setSelectedScan(selectedScan === scan.id ? null : scan.id)}
                >
                  <td>
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-[var(--bg-tertiary)] flex items-center justify-center">
                        <GitBranch className="w-4 h-4 text-[var(--accent)]" />
                      </div>
                      <div>
                        <p className="font-medium text-[var(--text-primary)]">{scan.repository_name}</p>
                        <p className="text-[var(--text-muted)] text-xs">by {scan.triggered_by}</p>
                      </div>
                    </div>
                  </td>
                  <td>
                    <span className="inline-flex items-center gap-1 text-[var(--text-secondary)] text-sm">
                      <GitBranch className="w-3 h-3" />
                      {scan.branch}
                    </span>
                  </td>
                  <td>
                    <span className={`
                      inline-flex items-center gap-2 px-2.5 py-1 rounded-full text-xs font-medium
                      ${status.bg} ${status.color}
                    `}>
                      <StatusIcon className={`w-3 h-3 ${status.animate ? 'animate-spin' : ''}`} />
                      {status.label}
                    </span>
                  </td>
                  <td>
                    <span className={`
                      font-medium
                      ${scan.secrets_found > 0 ? 'text-red-400' : 'text-green-400'}
                    `}>
                      {scan.secrets_found > 0 ? (
                        <span className="flex items-center gap-1">
                          <AlertTriangle className="w-3 h-3" />
                          {scan.secrets_found}
                        </span>
                      ) : (
                        <span className="flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3" />
                          Clean
                        </span>
                      )}
                    </span>
                  </td>
                  <td>
                    <span className="text-[var(--text-muted)] text-sm">{scan.duration}</span>
                  </td>
                  <td>
                    <span className="text-[var(--text-muted)] text-sm">{scan.started_at}</span>
                  </td>
                  <td>
                    <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                      <button
                        className="p-1.5 rounded hover:bg-[var(--bg-tertiary)] text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
                        onClick={() => onViewDetails?.(scan)}
                        title="View Details"
                      >
                        <ExternalLink className="w-4 h-4" />
                      </button>
                      {scan.status !== 'running' && (
                        <button
                          className="p-1.5 rounded hover:bg-[var(--bg-tertiary)] text-[var(--text-muted)] hover:text-[var(--accent)] transition-colors disabled:opacity-50"
                          onClick={() => handleRescan(scan)}
                          disabled={rescanningId === scan.id}
                          title="Re-scan"
                        >
                          {rescanningId === scan.id ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <Play className="w-4 h-4" />
                          )}
                        </button>
                      )}
                      {scan.status === 'running' && (
                        <button
                          className="p-1.5 rounded hover:bg-[var(--bg-tertiary)] text-[var(--text-muted)] hover:text-red-400 transition-colors disabled:opacity-50"
                          onClick={() => handleCancel(scan)}
                          disabled={cancellingId === scan.id}
                          title="Cancel"
                        >
                          {cancellingId === scan.id ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <StopCircle className="w-4 h-4" />
                          )}
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

      {/* Footer */}
      <div className="px-4 py-3 border-t border-[var(--border-color)] flex items-center justify-between">
        <span className="text-[var(--text-muted)] text-sm">
          Showing {scans.length} of {scans.length} scans
        </span>
        <button
          className="text-[var(--accent)] text-sm hover:underline"
          onClick={() => onViewAll?.()}
        >
          View All Scans →
        </button>
      </div>
    </div>
  )
}
