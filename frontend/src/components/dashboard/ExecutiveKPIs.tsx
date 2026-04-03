'use client'

import { 
  ShieldAlert, 
  AlertOctagon, 
  Clock, 
  FolderGit2,
  TrendingUp,
  TrendingDown,
  Minus
} from 'lucide-react'

interface ExecutiveKPIsProps {
  stats: {
    secrets_detected: number
    critical_issues: number
    mttr_hours: number
    repositories_monitored: number
    secrets_trend?: number
    critical_trend?: number
    mttr_trend?: number
    repos_trend?: number
  }
  loading?: boolean
}

export default function ExecutiveKPIs({ stats, loading }: ExecutiveKPIsProps) {
  const kpis = [
    {
      title: 'Secrets Detected',
      value: stats.secrets_detected,
      trend: stats.secrets_trend || 0,
      trendLabel: 'vs last week',
      icon: ShieldAlert,
      iconBg: 'bg-blue-500/20',
      iconColor: 'text-blue-400',
      format: 'number',
    },
    {
      title: 'Critical Issues',
      value: stats.critical_issues,
      trend: stats.critical_trend || 0,
      trendLabel: 'requiring action',
      icon: AlertOctagon,
      iconBg: 'bg-red-500/20',
      iconColor: 'text-red-400',
      format: 'number',
      highlight: stats.critical_issues > 0,
    },
    {
      title: 'Mean Time To Remediate',
      value: stats.mttr_hours,
      trend: stats.mttr_trend || 0,
      trendLabel: 'vs last month',
      icon: Clock,
      iconBg: 'bg-amber-500/20',
      iconColor: 'text-amber-400',
      format: 'hours',
      invertTrend: true, // Lower is better
    },
    {
      title: 'Repositories Monitored',
      value: stats.repositories_monitored,
      trend: stats.repos_trend || 0,
      trendLabel: 'active monitoring',
      icon: FolderGit2,
      iconBg: 'bg-emerald-500/20',
      iconColor: 'text-emerald-400',
      format: 'number',
    },
  ]

  const formatValue = (value: number, format: string) => {
    if (format === 'hours') {
      if (value < 1) return `${Math.round(value * 60)}m`
      if (value < 24) return `${value.toFixed(1)}h`
      return `${(value / 24).toFixed(1)}d`
    }
    return value.toLocaleString()
  }

  const getTrendIcon = (trend: number, invertTrend?: boolean) => {
    const isPositive = invertTrend ? trend < 0 : trend > 0
    const isNegative = invertTrend ? trend > 0 : trend < 0
    
    if (trend === 0) return <Minus className="w-3 h-3" />
    if (isPositive) return <TrendingUp className="w-3 h-3" />
    return <TrendingDown className="w-3 h-3" />
  }

  const getTrendColor = (trend: number, invertTrend?: boolean) => {
    const isPositive = invertTrend ? trend < 0 : trend > 0
    const isNegative = invertTrend ? trend > 0 : trend < 0
    
    if (trend === 0) return 'text-gray-400'
    if (isPositive) return 'text-emerald-400'
    return 'text-red-400'
  }

  if (loading) {
    return (
      <div className="grid grid-cols-12 gap-6">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="col-span-6 lg:col-span-3">
            <div className="kpi-card h-[110px] animate-pulse">
              <div className="flex items-start justify-between h-full">
                <div className="flex-1 space-y-3">
                  <div className="h-4 w-24 skeleton" />
                  <div className="h-8 w-20 skeleton" />
                  <div className="h-3 w-32 skeleton" />
                </div>
                <div className="w-10 h-10 skeleton rounded-xl" />
              </div>
            </div>
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className="grid grid-cols-12 gap-6">
      {kpis.map((kpi) => {
        const Icon = kpi.icon
        return (
          <div 
            key={kpi.title}
            className="col-span-6 lg:col-span-3"
          >
            <div className={`kpi-card h-[110px] p-5 group ${kpi.highlight ? 'ring-1 ring-red-500/30' : ''}`}>
              <div className="flex items-start justify-between h-full">
                <div className="flex-1 min-w-0 flex flex-col justify-between h-full">
                  <p className="text-sm text-[var(--text-secondary)] font-semibold">
                    {kpi.title}
                  </p>
                  <p className={`text-3xl font-bold tracking-tight ${kpi.highlight ? 'text-red-400' : 'text-[var(--text-primary)]'}`}>
                    {formatValue(kpi.value, kpi.format)}
                  </p>
                  <div className="flex items-center gap-2">
                    <span className={`flex items-center gap-1 text-xs font-medium ${getTrendColor(kpi.trend, kpi.invertTrend)}`}>
                      {getTrendIcon(kpi.trend, kpi.invertTrend)}
                      {Math.abs(kpi.trend)}%
                    </span>
                    <span className="text-xs text-[var(--text-muted)] truncate">
                      {kpi.trendLabel}
                    </span>
                  </div>
                </div>
                <div className={`w-10 h-10 rounded-xl ${kpi.iconBg} flex items-center justify-center flex-shrink-0 transition-transform group-hover:scale-110`}>
                  <Icon className={`w-5 h-5 ${kpi.iconColor}`} />
                </div>
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
