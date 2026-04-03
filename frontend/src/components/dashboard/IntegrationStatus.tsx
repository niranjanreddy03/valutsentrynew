'use client'

import { useState } from 'react'
import { 
  Github, 
  Gitlab, 
  Cloud, 
  Slack, 
  CheckCircle2, 
  XCircle, 
  RefreshCw,
  Settings,
  Activity,
  Zap,
  Bell,
  ExternalLink,
  AlertTriangle,
  Clock,
  RotateCcw,
  Webhook
} from 'lucide-react'

interface IntegrationMetrics {
  total_repos?: number
  last_scan_at?: string
  alerts_sent?: number
  secrets_found?: number
  rotation_count?: number
  webhook_active?: boolean
  api_health?: 'healthy' | 'degraded' | 'down'
}

interface Integration {
  id: string
  name: string
  type: 'github' | 'gitlab' | 'aws' | 'slack' | 'jira' | 'azure'
  status: 'connected' | 'disconnected' | 'syncing' | 'error'
  lastSync?: string
  reposConnected?: number
  config?: Record<string, any>
  metrics?: IntegrationMetrics
}

interface IntegrationStatusProps {
  integrations: Integration[]
  loading?: boolean
  onSync?: (integrationId: string) => void
  onConfigure?: (integrationId: string) => void
  onDisconnect?: (integrationId: string) => void
  onTestWebhook?: (integrationId: string) => void
}

const integrationIcons: Record<string, any> = {
  github: Github,
  gitlab: Gitlab,
  aws: Cloud,
  slack: Slack,
  jira: Settings,
  azure: Cloud,
}

const integrationColors: Record<string, string> = {
  github: 'text-white',
  gitlab: 'text-orange-400',
  aws: 'text-amber-400',
  slack: 'text-purple-400',
  jira: 'text-blue-400',
  azure: 'text-blue-500',
}

const statusConfig: Record<string, { label: string; icon: any; color: string; dot: string; animate: boolean }> = {
  connected: {
    label: 'Connected',
    icon: CheckCircle2,
    color: 'text-emerald-400',
    dot: 'bg-emerald-400',
    animate: false,
  },
  disconnected: {
    label: 'Disconnected',
    icon: XCircle,
    color: 'text-gray-400',
    dot: 'bg-gray-400',
    animate: false,
  },
  syncing: {
    label: 'Syncing',
    icon: RefreshCw,
    color: 'text-blue-400',
    dot: 'bg-blue-400',
    animate: true,
  },
  error: {
    label: 'Error',
    icon: XCircle,
    color: 'text-red-400',
    dot: 'bg-red-400',
    animate: false,
  },
}

const apiHealthConfig: Record<string, { label: string; color: string; icon: any }> = {
  healthy: { label: 'Healthy', color: 'text-emerald-400', icon: CheckCircle2 },
  degraded: { label: 'Degraded', color: 'text-amber-400', icon: AlertTriangle },
  down: { label: 'Down', color: 'text-red-400', icon: XCircle },
}

export default function IntegrationStatus({ 
  integrations, 
  loading,
  onSync,
  onConfigure,
  onDisconnect,
  onTestWebhook
}: IntegrationStatusProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [syncing, setSyncing] = useState<Record<string, boolean>>({})

  const handleSync = async (id: string) => {
    if (onSync) {
      setSyncing(prev => ({ ...prev, [id]: true }))
      try {
        await onSync(id)
      } finally {
        setSyncing(prev => ({ ...prev, [id]: false }))
      }
    }
  }
  if (loading) {
    return (
      <div className="card animate-pulse">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-9 h-9 skeleton rounded-xl" />
          <div className="flex-1">
            <div className="h-4 w-32 skeleton mb-1" />
            <div className="h-3 w-20 skeleton" />
          </div>
        </div>
        <div className="space-y-2">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="h-12 skeleton rounded-lg" />
          ))}
        </div>
      </div>
    )
  }

  const connectedCount = integrations.filter(i => i.status === 'connected').length
  const syncingCount = integrations.filter(i => i.status === 'syncing').length

  return (
    <div className="card">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-purple-500/20 flex items-center justify-center">
            <Cloud className="w-4 h-4 text-purple-400" />
          </div>
          <div>
            <h3 className="text-base font-semibold text-[var(--text-primary)]">Integrations</h3>
            <p className="text-xs text-[var(--text-muted)]">
              {connectedCount} connected{syncingCount > 0 && `, ${syncingCount} syncing`}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1 px-2 py-1 rounded-full bg-emerald-500/15 text-emerald-400">
          <CheckCircle2 className="w-3 h-3" />
          <span className="text-xs font-medium">{connectedCount}/{integrations.length}</span>
        </div>
      </div>

      {/* Integration List */}
      <div className="space-y-2">
        {integrations.map((integration) => {
          const Icon = integrationIcons[integration.type] || Cloud
          const status = statusConfig[integration.status]
          const StatusIcon = status.icon
          const isActive = integration.status === 'connected' || integration.status === 'syncing'
          const isExpanded = expandedId === integration.id
          const isSyncing = syncing[integration.id] || integration.status === 'syncing'
          const apiHealth = integration.metrics?.api_health 
            ? apiHealthConfig[integration.metrics.api_health] 
            : null

          return (
            <div key={integration.id} className="space-y-0">
              <div 
                onClick={() => setExpandedId(isExpanded ? null : integration.id)}
                className={`
                  group flex items-center gap-3 p-3 rounded-xl border transition-all cursor-pointer
                  ${isActive 
                    ? 'bg-[var(--bg-tertiary)] border-[var(--border-color)] hover:border-[var(--border-hover)]' 
                    : 'bg-[var(--bg-tertiary)]/50 border-[var(--border-color)]/50 opacity-60 hover:opacity-100'
                  }
                  ${isExpanded ? 'rounded-b-none border-b-0' : ''}
                `}
              >
                {/* Integration Icon */}
                <div className={`
                  w-10 h-10 rounded-lg flex items-center justify-center
                  ${integration.type === 'github' ? 'bg-gray-800' : 
                    integration.type === 'gitlab' ? 'bg-orange-500/20' :
                    integration.type === 'aws' ? 'bg-amber-500/20' :
                    integration.type === 'slack' ? 'bg-purple-500/20' :
                    'bg-blue-500/20'}
                `}>
                  <Icon className={`w-5 h-5 ${integrationColors[integration.type]}`} />
                </div>
                
                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-[var(--text-primary)] truncate">
                      {integration.name}
                    </span>
                    {integration.metrics?.webhook_active && (
                      <span title="Webhook active"><Webhook className="w-3 h-3 text-emerald-400" /></span>
                    )}
                    {apiHealth && (
                      <span className={`flex items-center gap-1 ${apiHealth.color}`} title={`API: ${apiHealth.label}`}>
                        <Activity className="w-3 h-3" />
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 mt-0.5 text-xs text-[var(--text-muted)]">
                    {integration.reposConnected !== undefined && integration.reposConnected > 0 && (
                      <>
                        <span>{integration.reposConnected} repos</span>
                        <span>·</span>
                      </>
                    )}
                    {integration.metrics?.secrets_found !== undefined && (
                      <>
                        <span>{integration.metrics.secrets_found} secrets</span>
                        <span>·</span>
                      </>
                    )}
                    <span>{integration.lastSync || 'Never synced'}</span>
                  </div>
                </div>

                {/* Status Badge */}
                <div className={`
                  flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium
                  ${integration.status === 'connected' ? 'bg-emerald-500/15 text-emerald-400' :
                    integration.status === 'syncing' ? 'bg-blue-500/15 text-blue-400' :
                    integration.status === 'error' ? 'bg-red-500/15 text-red-400' :
                    'bg-gray-500/15 text-gray-400'}
                `}>
                  <StatusIcon className={`w-3 h-3 ${status.animate || isSyncing ? 'animate-spin' : ''}`} />
                  <span className="hidden sm:inline">{isSyncing ? 'Syncing' : status.label}</span>
                </div>

                {/* Action buttons */}
                <div className="flex items-center gap-1">
                  {onSync && isActive && (
                    <button 
                      onClick={(e) => { e.stopPropagation(); handleSync(integration.id) }}
                      disabled={isSyncing}
                      className="p-1.5 rounded-lg hover:bg-[var(--bg-secondary)] text-[var(--text-muted)] hover:text-blue-400 transition-all disabled:opacity-50"
                      title="Sync now"
                    >
                      <RefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin' : ''}`} />
                    </button>
                  )}
                  {onConfigure && (
                    <button 
                      onClick={(e) => { e.stopPropagation(); onConfigure(integration.id) }}
                      className="p-1.5 rounded-lg hover:bg-[var(--bg-secondary)] text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-all"
                      title="Configure"
                    >
                      <Settings className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>

              {/* Expanded Details */}
              {isExpanded && (
                <div className="bg-[var(--bg-tertiary)]/50 border border-t-0 border-[var(--border-color)] rounded-b-xl p-3 space-y-3">
                  {/* Metrics Grid */}
                  {integration.metrics && (
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      {integration.metrics.total_repos !== undefined && (
                        <div className="bg-[var(--bg-secondary)] rounded-lg p-2 text-center">
                          <p className="text-lg font-semibold text-[var(--text-primary)]">{integration.metrics.total_repos}</p>
                          <p className="text-xs text-[var(--text-muted)]">Repositories</p>
                        </div>
                      )}
                      {integration.metrics.secrets_found !== undefined && (
                        <div className="bg-[var(--bg-secondary)] rounded-lg p-2 text-center">
                          <p className="text-lg font-semibold text-amber-400">{integration.metrics.secrets_found}</p>
                          <p className="text-xs text-[var(--text-muted)]">Secrets Found</p>
                        </div>
                      )}
                      {integration.metrics.alerts_sent !== undefined && (
                        <div className="bg-[var(--bg-secondary)] rounded-lg p-2 text-center">
                          <p className="text-lg font-semibold text-blue-400">{integration.metrics.alerts_sent}</p>
                          <p className="text-xs text-[var(--text-muted)]">Alerts Sent</p>
                        </div>
                      )}
                      {integration.metrics.rotation_count !== undefined && (
                        <div className="bg-[var(--bg-secondary)] rounded-lg p-2 text-center">
                          <p className="text-lg font-semibold text-emerald-400">{integration.metrics.rotation_count}</p>
                          <p className="text-xs text-[var(--text-muted)]">Rotations</p>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Action Buttons */}
                  <div className="flex flex-wrap gap-2">
                    {onTestWebhook && integration.metrics?.webhook_active !== undefined && (
                      <button
                        onClick={() => onTestWebhook(integration.id)}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[var(--bg-secondary)] text-[var(--text-secondary)] hover:text-[var(--accent)] text-xs font-medium transition-colors"
                      >
                        <Webhook className="w-3.5 h-3.5" />
                        Test Webhook
                      </button>
                    )}
                    {onDisconnect && isActive && (
                      <button
                        onClick={() => onDisconnect(integration.id)}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 text-xs font-medium transition-colors"
                      >
                        <XCircle className="w-3.5 h-3.5" />
                        Disconnect
                      </button>
                    )}
                    <button
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[var(--bg-secondary)] text-[var(--text-secondary)] hover:text-[var(--accent)] text-xs font-medium transition-colors ml-auto"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      View Docs
                    </button>
                  </div>

                  {/* Last Scan Info */}
                  {integration.metrics?.last_scan_at && (
                    <div className="flex items-center gap-2 text-xs text-[var(--text-muted)] pt-2 border-t border-[var(--border-color)]">
                      <Clock className="w-3.5 h-3.5" />
                      <span>Last scan: {new Date(integration.metrics.last_scan_at).toLocaleString()}</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Footer */}
      <button className="w-full mt-4 py-2.5 text-sm text-[var(--accent)] hover:text-[var(--accent-hover)] font-medium flex items-center justify-center gap-1.5 rounded-lg border border-[var(--border-color)] hover:border-[var(--accent)] hover:bg-[var(--accent)]/5 transition-all">
        <Settings className="w-4 h-4" />
        Manage Integrations
      </button>
    </div>
  )
}
