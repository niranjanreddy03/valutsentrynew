'use client'

import { 
  Scan, 
  KeyRound, 
  AlertTriangle, 
  FolderGit2,
  BarChart3,
  Zap
} from 'lucide-react'

interface StatsCardsProps {
  stats: {
    total_scans: number
    secrets_found: number
    high_risk_issues: number
    repositories_monitored: number
    scans_this_week: number
    secrets_resolved: number
    average_risk_score: number
    scan_success_rate: number
  }
}

export default function StatsCards({ stats }: StatsCardsProps) {
  const cards = [
    {
      title: 'Total Scans',
      value: stats.total_scans.toLocaleString(),
      change: `+${stats.scans_this_week} this week`,
      changeType: 'positive' as const,
      icon: Scan,
    },
    {
      title: 'Secrets Found',
      value: stats.secrets_found.toLocaleString(),
      change: `${stats.secrets_resolved.toLocaleString()} resolved`,
      changeType: 'neutral' as const,
      icon: KeyRound,
    },
    {
      title: 'High Risk Issues',
      value: stats.high_risk_issues.toString(),
      change: 'Requires attention',
      changeType: 'negative' as const,
      icon: AlertTriangle,
    },
    {
      title: 'Repositories',
      value: stats.repositories_monitored.toString(),
      change: 'Active monitoring',
      changeType: 'positive' as const,
      icon: FolderGit2,
    },
  ]

  const secondaryStats = [
    {
      title: 'Avg Risk Score',
      value: `${stats.average_risk_score.toFixed(1)}%`,
      icon: BarChart3,
    },
    {
      title: 'Success Rate',
      value: `${stats.scan_success_rate.toFixed(1)}%`,
      icon: Zap,
    },
  ]

  return (
    <div className="space-y-4">
      {/* Primary Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {cards.map((card) => (
          <div 
            key={card.title}
            className="card"
          >
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <p className="text-[var(--text-muted)] text-xs">{card.title}</p>
                <p className="text-2xl font-semibold mt-1 text-[var(--text-primary)]">{card.value}</p>
                <p className={`
                  text-xs mt-2
                  ${card.changeType === 'positive' ? 'text-[#4ade80]' : 
                    card.changeType === 'negative' ? 'text-[#f87171]' : 'text-[var(--text-muted)]'}
                `}>
                  {card.change}
                </p>
              </div>
              <div className="w-8 h-8 rounded-md bg-[var(--bg-tertiary)] flex items-center justify-center">
                <card.icon className="w-4 h-4 text-[var(--text-muted)]" />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Secondary Stats Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {secondaryStats.map((stat) => (
          <div key={stat.title} className="card flex items-center gap-3 py-3">
            <div className="p-1.5 rounded-md bg-[var(--bg-tertiary)]">
              <stat.icon className="w-4 h-4 text-[var(--text-muted)]" />
            </div>
            <div>
              <p className="text-xs text-[var(--text-muted)]">{stat.title}</p>
              <p className="text-sm font-medium text-[var(--text-primary)]">{stat.value}</p>
            </div>
          </div>
        ))}
        
        {/* Quick Action Buttons */}
        <div className="card flex items-center justify-center py-3 col-span-2">
          <div className="flex gap-2">
            <button className="btn-secondary text-sm">
              <Scan className="w-4 h-4 mr-1.5" />
              Scan
            </button>
            <button className="btn-secondary text-sm">
              <FolderGit2 className="w-4 h-4 mr-1.5" />
              Add Repo
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
