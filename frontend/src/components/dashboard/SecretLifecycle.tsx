'use client'

import { 
  Search, 
  XCircle, 
  RotateCcw, 
  CheckCircle2,
  ArrowRight,
  Clock,
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  Target,
  Zap,
  Users,
  Timer,
  Activity
} from 'lucide-react'

interface LifecycleMetrics {
  mttr_hours?: number
  mttr_trend?: 'up' | 'down' | 'stable'
  sla_compliance_rate?: number
  sla_breaches?: number
  auto_rotated_count?: number
  manual_resolved_count?: number
  false_positive_count?: number
  avg_age_days?: number
  oldest_open_days?: number
  by_priority?: {
    critical: number
    high: number
    medium: number
    low: number
  }
  by_team?: Record<string, number>
}

interface SecretLifecycleProps {
  stats: {
    detected: number
    revoked: number
    rotated: number
    verified: number
    open?: number
    in_progress?: number
    resolved?: number
  }
  metrics?: LifecycleMetrics
  loading?: boolean
}

export default function SecretLifecycle({ stats, metrics, loading }: SecretLifecycleProps) {
  const total = stats.detected
  
  const stages = [
    {
      name: 'Detected',
      count: stats.detected,
      icon: Search,
      color: 'bg-red-500',
      textColor: 'text-red-400',
      bgColor: 'bg-red-500/20',
      percentage: 100,
    },
    {
      name: 'Revoked',
      count: stats.revoked,
      icon: XCircle,
      color: 'bg-amber-500',
      textColor: 'text-amber-400',
      bgColor: 'bg-amber-500/20',
      percentage: total > 0 ? (stats.revoked / total) * 100 : 0,
    },
    {
      name: 'Rotated',
      count: stats.rotated,
      icon: RotateCcw,
      color: 'bg-blue-500',
      textColor: 'text-blue-400',
      bgColor: 'bg-blue-500/20',
      percentage: total > 0 ? (stats.rotated / total) * 100 : 0,
    },
    {
      name: 'Verified',
      count: stats.verified,
      icon: CheckCircle2,
      color: 'bg-emerald-500',
      textColor: 'text-emerald-400',
      bgColor: 'bg-emerald-500/20',
      percentage: total > 0 ? (stats.verified / total) * 100 : 0,
    },
  ]

  const completionRate = total > 0 ? Math.round((stats.verified / total) * 100) : 0

  if (loading) {
    return (
      <div className="card animate-pulse">
        <div className="flex items-center justify-between mb-4">
          <div className="h-5 w-32 skeleton" />
          <div className="h-4 w-16 skeleton" />
        </div>
        <div className="h-3 skeleton rounded-full mb-6" />
        <div className="grid grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="h-20 skeleton rounded-lg" />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-base font-semibold text-[var(--text-primary)]">Secret Lifecycle</h3>
          <p className="text-sm text-[var(--text-muted)] mt-1">Remediation pipeline progress</p>
        </div>
        <span className="text-sm bg-emerald-500/15 text-emerald-400 px-3 py-1.5 rounded-full font-medium">
          {completionRate}% complete
        </span>
      </div>

      {/* MTTR & SLA Metrics */}
      {metrics && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          {/* MTTR */}
          <div className="bg-[var(--bg-tertiary)] rounded-lg p-3 border border-[var(--border-color)]">
            <div className="flex items-center gap-2 mb-1">
              <Timer className="w-4 h-4 text-blue-400" />
              <span className="text-xs text-[var(--text-muted)]">MTTR</span>
            </div>
            <div className="flex items-center gap-2">
              <p className="text-lg font-bold text-[var(--text-primary)]">
                {metrics.mttr_hours !== undefined 
                  ? metrics.mttr_hours < 24 
                    ? `${metrics.mttr_hours.toFixed(1)}h` 
                    : `${(metrics.mttr_hours / 24).toFixed(1)}d`
                  : '-'}
              </p>
              {metrics.mttr_trend && (
                <span className={`flex items-center text-xs ${
                  metrics.mttr_trend === 'down' ? 'text-emerald-400' : 
                  metrics.mttr_trend === 'up' ? 'text-red-400' : 'text-gray-400'
                }`}>
                  {metrics.mttr_trend === 'down' ? <TrendingDown className="w-3 h-3" /> : 
                   metrics.mttr_trend === 'up' ? <TrendingUp className="w-3 h-3" /> : null}
                </span>
              )}
            </div>
          </div>

          {/* SLA Compliance */}
          <div className="bg-[var(--bg-tertiary)] rounded-lg p-3 border border-[var(--border-color)]">
            <div className="flex items-center gap-2 mb-1">
              <Target className="w-4 h-4 text-emerald-400" />
              <span className="text-xs text-[var(--text-muted)]">SLA Compliance</span>
            </div>
            <div className="flex items-center gap-2">
              <p className={`text-lg font-bold ${
                (metrics.sla_compliance_rate || 0) >= 90 ? 'text-emerald-400' :
                (metrics.sla_compliance_rate || 0) >= 70 ? 'text-amber-400' : 'text-red-400'
              }`}>
                {metrics.sla_compliance_rate !== undefined ? `${metrics.sla_compliance_rate.toFixed(0)}%` : '-'}
              </p>
              {metrics.sla_breaches !== undefined && metrics.sla_breaches > 0 && (
                <span className="text-xs text-red-400">({metrics.sla_breaches} breaches)</span>
              )}
            </div>
          </div>

          {/* Auto-Rotated */}
          <div className="bg-[var(--bg-tertiary)] rounded-lg p-3 border border-[var(--border-color)]">
            <div className="flex items-center gap-2 mb-1">
              <Zap className="w-4 h-4 text-purple-400" />
              <span className="text-xs text-[var(--text-muted)]">Auto-Rotated</span>
            </div>
            <p className="text-lg font-bold text-purple-400">
              {metrics.auto_rotated_count !== undefined ? metrics.auto_rotated_count : '-'}
            </p>
          </div>

          {/* Oldest Open */}
          <div className="bg-[var(--bg-tertiary)] rounded-lg p-3 border border-[var(--border-color)]">
            <div className="flex items-center gap-2 mb-1">
              <AlertTriangle className="w-4 h-4 text-amber-400" />
              <span className="text-xs text-[var(--text-muted)]">Oldest Open</span>
            </div>
            <p className={`text-lg font-bold ${
              (metrics.oldest_open_days || 0) > 30 ? 'text-red-400' :
              (metrics.oldest_open_days || 0) > 7 ? 'text-amber-400' : 'text-[var(--text-primary)]'
            }`}>
              {metrics.oldest_open_days !== undefined ? `${metrics.oldest_open_days}d` : '-'}
            </p>
          </div>
        </div>
      )}

      {/* Priority Breakdown */}
      {metrics?.by_priority && (
        <div className="mb-6">
          <h4 className="text-xs font-medium text-[var(--text-muted)] mb-2">By Priority</h4>
          <div className="flex gap-2">
            <div className="flex-1 bg-red-500/20 rounded-lg p-2 text-center border border-red-500/30">
              <p className="text-sm font-bold text-red-400">{metrics.by_priority.critical}</p>
              <p className="text-xs text-red-400/70">Critical</p>
            </div>
            <div className="flex-1 bg-orange-500/20 rounded-lg p-2 text-center border border-orange-500/30">
              <p className="text-sm font-bold text-orange-400">{metrics.by_priority.high}</p>
              <p className="text-xs text-orange-400/70">High</p>
            </div>
            <div className="flex-1 bg-amber-500/20 rounded-lg p-2 text-center border border-amber-500/30">
              <p className="text-sm font-bold text-amber-400">{metrics.by_priority.medium}</p>
              <p className="text-xs text-amber-400/70">Medium</p>
            </div>
            <div className="flex-1 bg-gray-500/20 rounded-lg p-2 text-center border border-gray-500/30">
              <p className="text-sm font-bold text-gray-400">{metrics.by_priority.low}</p>
              <p className="text-xs text-gray-400/70">Low</p>
            </div>
          </div>
        </div>
      )}

      {/* Progress Bar */}
      <div className="relative h-3 bg-[var(--bg-tertiary)] rounded-full overflow-hidden mb-6">
        <div className="absolute inset-0 flex">
          <div 
            className="h-full bg-red-500 transition-all duration-500"
            style={{ width: `${(stats.detected - stats.revoked) / total * 100}%` }}
          />
          <div 
            className="h-full bg-amber-500 transition-all duration-500"
            style={{ width: `${(stats.revoked - stats.rotated) / total * 100}%` }}
          />
          <div 
            className="h-full bg-blue-500 transition-all duration-500"
            style={{ width: `${(stats.rotated - stats.verified) / total * 100}%` }}
          />
          <div 
            className="h-full bg-emerald-500 transition-all duration-500"
            style={{ width: `${stats.verified / total * 100}%` }}
          />
        </div>
      </div>

      {/* Stage Cards */}
      <div className="grid grid-cols-4 gap-3">
        {stages.map((stage, index) => {
          const Icon = stage.icon
          return (
            <div key={stage.name} className="relative">
              <div className={`p-3 rounded-lg ${stage.bgColor} border border-[var(--border-color)]`}>
                <div className="flex items-center gap-2 mb-2">
                  <Icon className={`w-4 h-4 ${stage.textColor}`} />
                  <span className="text-xs font-medium text-[var(--text-muted)]">{stage.name}</span>
                </div>
                <p className={`text-xl font-bold ${stage.textColor}`}>{stage.count.toLocaleString()}</p>
                <p className="text-xs text-[var(--text-muted)] mt-1">{stage.percentage.toFixed(0)}%</p>
              </div>
              {index < stages.length - 1 && (
                <ArrowRight className="absolute -right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)] z-10 hidden lg:block" />
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
