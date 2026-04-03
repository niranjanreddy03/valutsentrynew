'use client'

import { 
  FolderGit2, 
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  Minus,
  ExternalLink
} from 'lucide-react'

interface Repository {
  id: number
  name: string
  risk_score: number
  critical_count: number
  high_count: number
  medium_count: number
  low_count: number
  trend: 'up' | 'down' | 'stable'
  last_scan: string
}

interface RepositoryRiskRankingProps {
  repositories: Repository[]
  loading?: boolean
}

export default function RepositoryRiskRanking({ repositories, loading }: RepositoryRiskRankingProps) {
  const getRiskColor = (score: number) => {
    if (score >= 80) return 'bg-red-500'
    if (score >= 60) return 'bg-orange-500'
    if (score >= 40) return 'bg-amber-500'
    return 'bg-emerald-500'
  }

  const getRiskLabel = (score: number) => {
    if (score >= 80) return { text: 'Critical', color: 'text-red-400' }
    if (score >= 60) return { text: 'High', color: 'text-orange-400' }
    if (score >= 40) return { text: 'Medium', color: 'text-amber-400' }
    return { text: 'Low', color: 'text-emerald-400' }
  }

  const getTrendIcon = (trend: string) => {
    switch (trend) {
      case 'up': return <TrendingUp className="w-3.5 h-3.5 text-red-400" />
      case 'down': return <TrendingDown className="w-3.5 h-3.5 text-emerald-400" />
      default: return <Minus className="w-3.5 h-3.5 text-gray-400" />
    }
  }

  if (loading) {
    return (
      <div className="dashboard-card max-h-[260px] animate-pulse">
        <div className="flex items-center justify-between mb-4">
          <div className="h-5 w-28 skeleton" />
        </div>
        <div className="space-y-2 overflow-y-auto max-h-[160px]">
          {[1, 2, 3, 4, 5].map(i => (
            <div key={i} className="h-12 skeleton rounded-lg" />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="dashboard-card max-h-[260px] flex flex-col">
      <div className="flex items-center justify-between mb-4 flex-shrink-0">
        <div>
          <h3 className="text-base font-semibold text-[var(--text-primary)] flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-amber-400" />
            Repository Risk Ranking
          </h3>
          <p className="text-xs text-[var(--text-muted)] mt-1">Top repositories by risk score</p>
        </div>
      </div>

      <div className="space-y-2 overflow-y-auto flex-1 pr-1 scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
        {repositories.slice(0, 5).map((repo, index) => {
          const riskLabel = getRiskLabel(repo.risk_score)
          
          return (
            <div 
              key={repo.id}
              className="group flex items-center gap-2 p-2.5 rounded-lg bg-[var(--bg-tertiary)] border border-[var(--border-color)] hover:border-[var(--border-hover)] transition-all cursor-pointer"
            >
              {/* Rank */}
              <div className="w-5 h-5 rounded-full bg-[var(--bg-secondary)] flex items-center justify-center text-xs font-bold text-[var(--text-muted)] flex-shrink-0">
                {index + 1}
              </div>
              
              {/* Repo Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="text-sm font-medium text-[var(--text-primary)] truncate">
                    {repo.name}
                  </span>
                  {getTrendIcon(repo.trend)}
                </div>
                <div className="flex items-center gap-1 mt-0.5 text-xs">
                  <span className="text-red-400">{repo.critical_count}c</span>
                  <span className="text-[var(--text-muted)]">·</span>
                  <span className="text-orange-400">{repo.high_count}h</span>
                </div>
              </div>

              {/* Risk Score */}
              <div className="text-right flex-shrink-0">
                <span className={`text-lg font-bold ${riskLabel.color}`}>
                  {repo.risk_score}
                </span>
              </div>
            </div>
          )
        })}
      </div>

      <a href="/repositories" className="block w-full mt-3 py-2 text-xs text-center text-[var(--accent)] hover:underline flex-shrink-0">
        View All Repositories →
      </a>
    </div>
  )
}
