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
  ExternalLink
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

export default function RecentScansTable({ scans }: RecentScansTableProps) {
  const [selectedScan, setSelectedScan] = useState<number | null>(null)

  const handleRescan = (id: number) => {
    console.log('Re-scanning:', id)
  }

  const handleViewDetails = (id: number) => {
    console.log('View details:', id)
  }

  return (
    <div className="card overflow-hidden">
      <div className="flex items-center justify-between p-4 border-b border-[var(--border-color)]">
        <div>
          <h3 className="text-lg font-semibold text-[var(--text-primary)]">Recent Scans</h3>
          <p className="text-[var(--text-muted)] text-sm mt-1">Latest scan activity across repositories</p>
        </div>
        <button className="btn-ghost text-sm">
          <RefreshCw className="w-4 h-4 mr-2" />
          Refresh
        </button>
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
                        onClick={() => handleViewDetails(scan.id)}
                        title="View Details"
                      >
                        <ExternalLink className="w-4 h-4" />
                      </button>
                      {scan.status !== 'running' && (
                        <button 
                          className="p-1.5 rounded hover:bg-[var(--bg-tertiary)] text-[var(--text-muted)] hover:text-[var(--accent)] transition-colors"
                          onClick={() => handleRescan(scan.id)}
                          title="Re-scan"
                        >
                          <Play className="w-4 h-4" />
                        </button>
                      )}
                      {scan.status === 'running' && (
                        <button 
                          className="p-1.5 rounded hover:bg-[var(--bg-tertiary)] text-[var(--text-muted)] hover:text-red-400 transition-colors"
                          title="Cancel"
                        >
                          <StopCircle className="w-4 h-4" />
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

      {/* Footer with pagination hint */}
      <div className="px-4 py-3 border-t border-[var(--border-color)] flex items-center justify-between">
        <span className="text-[var(--text-muted)] text-sm">
          Showing {scans.length} of {scans.length} scans
        </span>
        <button className="text-[var(--accent)] text-sm hover:underline">
          View All Scans →
        </button>
      </div>
    </div>
  )
}
