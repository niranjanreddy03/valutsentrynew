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

const COLORS = {
  Critical: '#ef4444',
  High: '#f97316',
  Medium: '#f59e0b',
  Low: '#22c55e',
}

export default function RiskPieChart({ data, loading }: RiskPieChartProps) {
  const total = data.reduce((sum, item) => sum + item.value, 0)
  const criticalHigh = data.filter(d => ['Critical', 'High'].includes(d.name)).reduce((sum, d) => sum + d.value, 0)

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const item = payload[0].payload
      const percentage = ((item.value / total) * 100).toFixed(1)
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
        <div className="flex items-center gap-8">
          <div className="h-56 w-56 skeleton rounded-full" />
          <div className="flex-1 space-y-3">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="h-10 skeleton rounded-lg" />
            ))}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="card h-full">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-base font-semibold text-[var(--text-primary)] flex items-center gap-2">
          <ShieldAlert className="w-5 h-5 text-blue-400" />
          Risk Distribution
        </h3>
        <span className="text-sm text-[var(--text-muted)] bg-[var(--bg-tertiary)] px-3 py-1 rounded-full">
          {total.toLocaleString()} total findings
        </span>
      </div>

      <div className="flex items-center gap-8">
        {/* Larger Chart */}
        <div className="h-56 w-56 relative flex-shrink-0">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data}
                cx="50%"
                cy="50%"
                labelLine={false}
                outerRadius={100}
                innerRadius={65}
                fill="#8884d8"
                dataKey="value"
                animationBegin={0}
                animationDuration={800}
                strokeWidth={0}
              >
                {data.map((entry, index) => (
                  <Cell 
                    key={`cell-${index}`} 
                    fill={COLORS[entry.name as keyof typeof COLORS] || '#6b7280'} 
                    stroke="transparent"
                  />
                ))}
              </Pie>
              <Tooltip content={<CustomTooltip />} />
            </PieChart>
          </ResponsiveContainer>
          
          {/* Center Label */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="text-center">
              <p className="text-3xl font-bold text-[var(--text-primary)]">{criticalHigh}</p>
              <p className="text-xs text-[var(--text-muted)]">Critical + High</p>
            </div>
          </div>
        </div>

        {/* Expanded Legend */}
        <div className="flex-1 space-y-3">
          {data.map((item) => {
            const percentage = total > 0 ? ((item.value / total) * 100).toFixed(1) : '0'
            const isCritical = item.name === 'Critical'
            return (
              <div 
                key={item.name}
                className={`flex items-center justify-between p-3 rounded-xl border transition-colors ${
                  isCritical 
                    ? 'bg-red-500/10 border-red-500/30 hover:border-red-500/50' 
                    : 'bg-[var(--bg-tertiary)] border-[var(--border-color)] hover:border-[var(--border-hover)]'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div 
                    className="w-4 h-4 rounded"
                    style={{ backgroundColor: COLORS[item.name as keyof typeof COLORS] }}
                  />
                  <span className={`text-sm font-medium ${isCritical ? 'text-red-400' : 'text-[var(--text-secondary)]'}`}>
                    {item.name}
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <span className={`text-lg font-bold ${isCritical ? 'text-red-400' : 'text-[var(--text-primary)]'}`}>
                    {item.value}
                  </span>
                  <span className="text-xs text-[var(--text-muted)] w-12 text-right bg-[var(--bg-primary)] px-2 py-1 rounded">
                    {percentage}%
                  </span>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
