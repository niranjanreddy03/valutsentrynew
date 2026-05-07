'use client'

import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts'
import { ShieldAlert } from 'lucide-react'

interface RiskLevel {
  name: string
  value: number
  color: string
}

interface RiskPieChartProps {
  data: RiskLevel[]
  loading?: boolean
}

const COLORS: Record<string, string> = {
  Critical: '#ef4444',
  High: '#f97316',
  Medium: '#f59e0b',
  Low: '#22c55e',
}

export default function RiskPieChart({ data, loading }: RiskPieChartProps) {
  const total = data.reduce((sum, item) => sum + item.value, 0)
  const criticalHigh = data
    .filter((d) => ['Critical', 'High'].includes(d.name))
    .reduce((sum, d) => sum + d.value, 0)

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const item = payload[0].payload
      const percentage = total > 0 ? ((item.value / total) * 100).toFixed(1) : '0'
      return (
        <div className="bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-lg p-3 shadow-xl backdrop-blur-sm">
          <p className="text-[var(--text-primary)] font-medium">{item.name} Risk</p>
          <p className="text-[var(--text-muted)] text-sm mt-1">
            {item.value} secrets ({percentage}%)
          </p>
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
          <div className="h-4 w-16 skeleton" />
        </div>
        <div className="flex flex-col items-center gap-6">
          <div className="h-48 w-48 skeleton rounded-full" />
          <div className="w-full grid grid-cols-4 gap-3">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-16 skeleton rounded-lg" />
            ))}
          </div>
        </div>
      </div>
    )
  }

  if (total === 0) {
    return (
      <div className="card h-full flex flex-col">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-semibold text-[var(--text-primary)] flex items-center gap-2">
            <ShieldAlert className="w-5 h-5 text-blue-400" />
            Risk Distribution
          </h3>
          <span className="text-xs text-[var(--text-muted)] bg-[var(--bg-tertiary)] px-2.5 py-1 rounded-full">
            0 findings
          </span>
        </div>
        <div className="flex-1 flex flex-col items-center justify-center py-8">
          <ShieldAlert className="w-10 h-10 text-[var(--text-muted)] mb-3 opacity-40" />
          <p className="text-sm font-medium text-[var(--text-secondary)]">No findings yet</p>
          <p className="text-xs text-[var(--text-muted)] mt-1">Scan a repository to see risk distribution</p>
        </div>
      </div>
    )
  }

  return (
    <div className="card h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-base font-semibold text-[var(--text-primary)] flex items-center gap-2">
          <ShieldAlert className="w-5 h-5 text-blue-400" />
          Risk Distribution
        </h3>
        <span className="text-xs text-[var(--text-muted)] bg-[var(--bg-tertiary)] px-2.5 py-1 rounded-full">
          {total.toLocaleString()} findings
        </span>
      </div>

      {/* Chart — centered donut */}
      <div className="flex-1 flex items-center justify-center">
        <div className="relative w-[200px] h-[200px]">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data}
                cx="50%"
                cy="50%"
                labelLine={false}
                outerRadius={95}
                innerRadius={62}
                dataKey="value"
                animationBegin={0}
                animationDuration={800}
                strokeWidth={2}
                stroke="var(--bg-primary)"
              >
                {data.map((entry, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={COLORS[entry.name] || '#6b7280'}
                  />
                ))}
              </Pie>
              <Tooltip content={<CustomTooltip />} />
            </PieChart>
          </ResponsiveContainer>

          {/* Center label */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="text-center">
              <p className="text-2xl font-bold text-[var(--text-primary)] leading-none">{criticalHigh}</p>
              <p className="text-[10px] text-[var(--text-muted)] mt-1 uppercase tracking-wider">Critical + High</p>
            </div>
          </div>
        </div>
      </div>

      {/* Legend — horizontal grid */}
      <div className="grid grid-cols-2 gap-2 mt-4">
        {data.map((item) => {
          const percentage = total > 0 ? ((item.value / total) * 100).toFixed(1) : '0'
          const isCritical = item.name === 'Critical'
          return (
            <div
              key={item.name}
              className={`flex items-center justify-between px-3 py-2.5 rounded-lg border transition-colors ${
                isCritical
                  ? 'bg-red-500/10 border-red-500/30'
                  : 'bg-[var(--bg-tertiary)] border-[var(--border-color)]'
              }`}
            >
              <div className="flex items-center gap-2">
                <div
                  className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                  style={{ backgroundColor: COLORS[item.name] }}
                />
                <span className={`text-xs font-medium ${isCritical ? 'text-red-400' : 'text-[var(--text-secondary)]'}`}>
                  {item.name}
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className={`text-sm font-bold ${isCritical ? 'text-red-400' : 'text-[var(--text-primary)]'}`}>
                  {item.value}
                </span>
                <span className="text-[10px] text-[var(--text-muted)]">
                  {percentage}%
                </span>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
