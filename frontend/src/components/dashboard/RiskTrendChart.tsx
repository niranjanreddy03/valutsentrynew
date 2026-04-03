'use client'

import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  ReferenceLine
} from 'recharts'
import { TrendingDown, TrendingUp, AlertTriangle } from 'lucide-react'

interface RiskTrendDataPoint {
  date: string
  critical: number
  high?: number
}

interface RiskTrendChartProps {
  data: RiskTrendDataPoint[]
  loading?: boolean
}

export default function RiskTrendChart({ data, loading }: RiskTrendChartProps) {
  const latestValue = data[data.length - 1]?.critical || 0
  const previousValue = data[data.length - 8]?.critical || latestValue
  const trend = previousValue > 0 ? ((latestValue - previousValue) / previousValue) * 100 : 0
  const isImproving = trend < 0
  
  const avgCritical = data.length > 0 
    ? Math.round(data.reduce((sum, d) => sum + d.critical, 0) / data.length)
    : 0

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-lg p-3 shadow-xl backdrop-blur-sm">
          <p className="text-[var(--text-muted)] text-xs mb-2">{label}</p>
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-red-500" />
              <span className="text-[var(--text-secondary)] text-sm">
                Critical: <span className="text-red-400 font-semibold">{payload[0]?.value}</span>
              </span>
            </div>
            {payload[1] && (
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-orange-500" />
                <span className="text-[var(--text-secondary)] text-sm">
                  High: <span className="text-orange-400 font-semibold">{payload[1]?.value}</span>
                </span>
              </div>
            )}
          </div>
        </div>
      )
    }
    return null
  }

  if (loading) {
    return (
      <div className="card h-full animate-pulse">
        <div className="flex items-center justify-between mb-4">
          <div className="h-5 w-32 skeleton" />
          <div className="h-4 w-20 skeleton" />
        </div>
        <div className="flex gap-4 mb-4">
          <div className="h-10 w-20 skeleton" />
          <div className="h-10 w-16 skeleton" />
        </div>
        <div className="h-52 skeleton rounded-lg" />
      </div>
    )
  }

  return (
    <div className="card h-full flex flex-col">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-base font-semibold text-[var(--text-primary)] flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-red-400" />
            Critical Findings Trend
          </h3>
          <p className="text-sm text-[var(--text-muted)] mt-1">Last 30 days</p>
        </div>
        <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium ${
          isImproving 
            ? 'bg-emerald-500/15 text-emerald-400' 
            : 'bg-red-500/15 text-red-400'
        }`}>
          {isImproving ? (
            <TrendingDown className="w-4 h-4" />
          ) : (
            <TrendingUp className="w-4 h-4" />
          )}
          {Math.abs(trend).toFixed(1)}%
        </div>
      </div>

      {/* Quick Stats */}
      <div className="flex gap-6 mb-4">
        <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20">
          <span className="text-3xl font-bold text-red-400">{latestValue}</span>
          <span className="text-xs text-[var(--text-muted)] ml-2">Current</span>
        </div>
        <div className="p-3 rounded-xl bg-[var(--bg-tertiary)] border border-[var(--border-color)]">
          <span className="text-2xl font-semibold text-[var(--text-secondary)]">{avgCritical}</span>
          <span className="text-xs text-[var(--text-muted)] ml-2">Avg</span>
        </div>
      </div>

      <div className="flex-1 min-h-[160px]">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart
            data={data}
            margin={{ top: 5, right: 5, left: -20, bottom: 0 }}
          >
            <defs>
              <linearGradient id="criticalGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3}/>
                <stop offset="95%" stopColor="#ef4444" stopOpacity={0}/>
              </linearGradient>
            </defs>
            <CartesianGrid 
              strokeDasharray="3 3" 
              stroke="rgba(75, 85, 99, 0.3)" 
              vertical={false} 
            />
            <XAxis 
              dataKey="date" 
              stroke="#6b7280"
              fontSize={10}
              tickLine={false}
              axisLine={false}
              interval="preserveStartEnd"
            />
            <YAxis 
              stroke="#6b7280"
              fontSize={10}
              tickLine={false}
              axisLine={false}
            />
            <Tooltip content={<CustomTooltip />} />
            <ReferenceLine 
              y={avgCritical} 
              stroke="#6b7280" 
              strokeDasharray="3 3" 
              strokeOpacity={0.5}
            />
            <Line
              type="monotone"
              dataKey="critical"
              stroke="#ef4444"
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4, fill: '#ef4444', stroke: '#030712', strokeWidth: 2 }}
              animationDuration={1000}
            />
            {data[0]?.high !== undefined && (
              <Line
                type="monotone"
                dataKey="high"
                stroke="#f97316"
                strokeWidth={1.5}
                dot={false}
                strokeDasharray="4 4"
                animationDuration={1000}
              />
            )}
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Legend */}
      <div className="flex items-center justify-center gap-4 mt-3 pt-3 border-t border-[var(--border-color)]">
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-0.5 bg-red-500 rounded" />
          <span className="text-xs text-[var(--text-muted)]">Critical</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-0.5 bg-gray-500 rounded opacity-50" style={{ backgroundImage: 'repeating-linear-gradient(90deg, #6b7280, #6b7280 2px, transparent 2px, transparent 4px)' }} />
          <span className="text-xs text-[var(--text-muted)]">Average</span>
        </div>
      </div>
    </div>
  )
}
