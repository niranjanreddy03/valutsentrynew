'use client'

import { 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  Area,
  AreaChart,
  Bar,
  BarChart,
  ComposedChart,
  Line
} from 'recharts'
import { TrendingUp, BarChart3 } from 'lucide-react'

interface ScanDataPoint {
  date: string
  scans: number
  secrets_found: number
}

interface ScanActivityChartProps {
  data: ScanDataPoint[]
  loading?: boolean
}

export default function ScanActivityChart({ data, loading }: ScanActivityChartProps) {
  const totalScans = data.reduce((sum, item) => sum + item.scans, 0)
  const totalSecrets = data.reduce((sum, item) => sum + item.secrets_found, 0)
  const avgSecretsPerScan = totalScans > 0 ? (totalSecrets / totalScans).toFixed(1) : '0'

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-lg p-3 shadow-xl backdrop-blur-sm">
          <p className="text-[var(--text-primary)] font-medium text-sm mb-2">{label}</p>
          <div className="space-y-1.5">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-blue-500" />
                <span className="text-[var(--text-muted)] text-xs">Scans</span>
              </div>
              <span className="text-[var(--text-primary)] text-sm font-medium">{payload[0]?.value}</span>
            </div>
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-red-500" />
                <span className="text-[var(--text-muted)] text-xs">Secrets Found</span>
              </div>
              <span className="text-red-400 text-sm font-medium">{payload[1]?.value}</span>
            </div>
          </div>
        </div>
      )
    }
    return null
  }

  if (loading) {
    return (
      <div className="card animate-pulse">
        <div className="flex items-center justify-between mb-4">
          <div className="h-5 w-32 skeleton" />
          <div className="flex gap-4">
            <div className="h-4 w-16 skeleton" />
            <div className="h-4 w-16 skeleton" />
          </div>
        </div>
        <div className="grid grid-cols-3 gap-3 mb-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-16 skeleton rounded-lg" />
          ))}
        </div>
        <div className="h-52 skeleton rounded-lg" />
      </div>
    )
  }

  return (
    <div className="card">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-500/20 flex items-center justify-center">
            <BarChart3 className="w-5 h-5 text-blue-400" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-[var(--text-primary)]">Scan Activity</h3>
            <p className="text-sm text-[var(--text-muted)]">Scans vs Secrets Found - Last 7 Days</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded bg-blue-500" />
            <span className="text-sm text-[var(--text-muted)]">Scans</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded bg-red-500" />
            <span className="text-sm text-[var(--text-muted)]">Secrets Found</span>
          </div>
        </div>
      </div>

      {/* Quick Stats Row */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="p-4 rounded-xl bg-[var(--bg-tertiary)] border border-[var(--border-color)]">
          <div className="text-[var(--text-muted)] text-xs font-medium mb-1">Total Scans</div>
          <p className="text-2xl font-bold text-[var(--text-primary)]">{totalScans}</p>
        </div>
        <div className="p-4 rounded-xl bg-[var(--bg-tertiary)] border border-[var(--border-color)]">
          <div className="text-[var(--text-muted)] text-xs font-medium mb-1">Secrets Found</div>
          <p className="text-2xl font-bold text-red-400">{totalSecrets}</p>
        </div>
        <div className="p-4 rounded-xl bg-[var(--bg-tertiary)] border border-[var(--border-color)]">
          <div className="text-[var(--text-muted)] text-xs font-medium mb-1">Avg / Scan</div>
          <p className="text-2xl font-bold text-[var(--text-primary)]">{avgSecretsPerScan}</p>
        </div>
      </div>

      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart
            data={data}
            margin={{ top: 10, right: 10, left: -10, bottom: 0 }}
          >
            <defs>
              <linearGradient id="colorScans" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
            <XAxis 
              dataKey="date" 
              stroke="#6b7280"
              fontSize={11}
              tickLine={false}
              axisLine={false}
            />
            <YAxis 
              stroke="#6b7280"
              fontSize={11}
              tickLine={false}
              axisLine={false}
            />
            <Tooltip content={<CustomTooltip />} />
            <Area
              type="monotone"
              dataKey="scans"
              stroke="#3b82f6"
              strokeWidth={2}
              fillOpacity={1}
              fill="url(#colorScans)"
              animationDuration={800}
            />
            <Bar
              dataKey="secrets_found"
              fill="#ef4444"
              radius={[4, 4, 0, 0]}
              barSize={20}
              animationDuration={800}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* Trend Indicator */}
      <div className="mt-4 pt-4 border-t border-[var(--border-color)] flex items-center justify-between">
        <div className="flex items-center gap-2 text-emerald-400">
          <TrendingUp className="w-4 h-4" />
          <span className="text-sm font-medium">12% more scans this week</span>
        </div>
        <button className="text-sm text-blue-400 hover:text-blue-300 font-medium transition-colors">
          View All Scans →
        </button>
      </div>
    </div>
  )
}
