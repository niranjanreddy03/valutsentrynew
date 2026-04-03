'use client'

import { Card } from '@/components/ui'
import { Minus, TrendingDown, TrendingUp } from 'lucide-react'
import { useMemo } from 'react'
import {
    Area,
    AreaChart,
    Bar,
    BarChart,
    CartesianGrid,
    Legend,
    Line,
    LineChart,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis,
} from 'recharts'

interface TrendDataPoint {
  date: string
  secrets: number
  scans: number
  resolved: number
  critical?: number
}

interface TrendGraphProps {
  data?: TrendDataPoint[]
  title?: string
  type?: 'line' | 'area' | 'bar'
  showLegend?: boolean
  height?: number
}

// Generate demo trend data
const generateDemoData = (): TrendDataPoint[] => {
  const data: TrendDataPoint[] = []
  const now = new Date()
  
  for (let i = 13; i >= 0; i--) {
    const date = new Date(now)
    date.setDate(date.getDate() - i)
    
    data.push({
      date: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      secrets: Math.floor(Math.random() * 15) + 5 + (14 - i) * 0.5,
      scans: Math.floor(Math.random() * 8) + 3,
      resolved: Math.floor(Math.random() * 10) + 2,
      critical: Math.floor(Math.random() * 5),
    })
  }
  
  return data
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-lg p-3 shadow-xl">
        <p className="text-sm font-medium text-[var(--text-primary)] mb-2">{label}</p>
        {payload.map((entry: any, index: number) => (
          <div key={index} className="flex items-center gap-2 text-sm">
            <div 
              className="w-3 h-3 rounded-full"
              style={{ backgroundColor: entry.color }}
            />
            <span className="text-[var(--text-muted)]">{entry.name}:</span>
            <span className="text-[var(--text-primary)] font-medium">{entry.value}</span>
          </div>
        ))}
      </div>
    )
  }
  return null
}

export function TrendGraph({ 
  data, 
  title = 'Security Trends', 
  type = 'area',
  showLegend = true,
  height = 300 
}: TrendGraphProps) {
  const chartData = useMemo(() => data || generateDemoData(), [data])

  // Calculate trend
  const trend = useMemo(() => {
    if (chartData.length < 2) return { direction: 'stable', percentage: 0 }
    const recent = chartData.slice(-7).reduce((sum, d) => sum + d.secrets, 0) / 7
    const previous = chartData.slice(0, 7).reduce((sum, d) => sum + d.secrets, 0) / 7
    const change = ((recent - previous) / previous) * 100
    
    return {
      direction: change > 5 ? 'up' : change < -5 ? 'down' : 'stable',
      percentage: Math.abs(change).toFixed(1)
    }
  }, [chartData])

  const TrendIcon = trend.direction === 'up' ? TrendingUp : trend.direction === 'down' ? TrendingDown : Minus
  const trendColor = trend.direction === 'up' ? 'text-red-400' : trend.direction === 'down' ? 'text-green-400' : 'text-gray-400'

  return (
    <Card className="p-5">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-lg font-semibold text-[var(--text-primary)]">{title}</h3>
          <p className="text-sm text-[var(--text-muted)]">Last 14 days</p>
        </div>
        <div className={`flex items-center gap-1 ${trendColor}`}>
          <TrendIcon className="w-4 h-4" />
          <span className="text-sm font-medium">{trend.percentage}%</span>
        </div>
      </div>

      <ResponsiveContainer width="100%" height={height}>
        {type === 'area' ? (
          <AreaChart data={chartData}>
            <defs>
              <linearGradient id="secretsGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="resolvedGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#22c55e" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" />
            <XAxis 
              dataKey="date" 
              stroke="var(--text-muted)"
              fontSize={12}
              tickLine={false}
            />
            <YAxis 
              stroke="var(--text-muted)"
              fontSize={12}
              tickLine={false}
              axisLine={false}
            />
            <Tooltip content={<CustomTooltip />} />
            {showLegend && <Legend />}
            <Area 
              type="monotone" 
              dataKey="secrets" 
              stroke="#ef4444" 
              fill="url(#secretsGradient)"
              strokeWidth={2}
              name="Secrets Found"
            />
            <Area 
              type="monotone" 
              dataKey="resolved" 
              stroke="#22c55e" 
              fill="url(#resolvedGradient)"
              strokeWidth={2}
              name="Resolved"
            />
          </AreaChart>
        ) : type === 'line' ? (
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" />
            <XAxis 
              dataKey="date" 
              stroke="var(--text-muted)"
              fontSize={12}
              tickLine={false}
            />
            <YAxis 
              stroke="var(--text-muted)"
              fontSize={12}
              tickLine={false}
              axisLine={false}
            />
            <Tooltip content={<CustomTooltip />} />
            {showLegend && <Legend />}
            <Line 
              type="monotone" 
              dataKey="secrets" 
              stroke="#ef4444" 
              strokeWidth={2}
              dot={false}
              name="Secrets Found"
            />
            <Line 
              type="monotone" 
              dataKey="resolved" 
              stroke="#22c55e" 
              strokeWidth={2}
              dot={false}
              name="Resolved"
            />
            <Line 
              type="monotone" 
              dataKey="scans" 
              stroke="#3b82f6" 
              strokeWidth={2}
              dot={false}
              name="Scans"
            />
          </LineChart>
        ) : (
          <BarChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" />
            <XAxis 
              dataKey="date" 
              stroke="var(--text-muted)"
              fontSize={12}
              tickLine={false}
            />
            <YAxis 
              stroke="var(--text-muted)"
              fontSize={12}
              tickLine={false}
              axisLine={false}
            />
            <Tooltip content={<CustomTooltip />} />
            {showLegend && <Legend />}
            <Bar dataKey="secrets" fill="#ef4444" radius={[4, 4, 0, 0]} name="Secrets Found" />
            <Bar dataKey="resolved" fill="#22c55e" radius={[4, 4, 0, 0]} name="Resolved" />
          </BarChart>
        )}
      </ResponsiveContainer>
    </Card>
  )
}

// Severity distribution component
interface SeverityData {
  name: string
  value: number
  color: string
}

interface SeverityChartProps {
  data?: SeverityData[]
}

export function SeverityDistribution({ data }: SeverityChartProps) {
  const chartData = data || [
    { name: 'Critical', value: 12, color: '#ef4444' },
    { name: 'High', value: 25, color: '#f97316' },
    { name: 'Medium', value: 45, color: '#eab308' },
    { name: 'Low', value: 38, color: '#22c55e' },
  ]

  const total = chartData.reduce((sum, d) => sum + d.value, 0)

  return (
    <Card className="p-5">
      <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-4">Severity Distribution</h3>
      
      {/* Stacked Bar */}
      <div className="flex h-4 rounded-full overflow-hidden mb-4">
        {chartData.map((item, index) => (
          <div
            key={item.name}
            className="h-full transition-all duration-300"
            style={{ 
              width: `${(item.value / total) * 100}%`,
              backgroundColor: item.color,
            }}
            title={`${item.name}: ${item.value}`}
          />
        ))}
      </div>

      {/* Legend */}
      <div className="grid grid-cols-2 gap-3">
        {chartData.map(item => (
          <div key={item.name} className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div 
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: item.color }}
              />
              <span className="text-sm text-[var(--text-secondary)]">{item.name}</span>
            </div>
            <span className="text-sm font-medium text-[var(--text-primary)]">{item.value}</span>
          </div>
        ))}
      </div>
    </Card>
  )
}

// Activity Heatmap
interface ActivityData {
  day: string
  hour: number
  value: number
}

export function ActivityHeatmap() {
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
  const hours = Array.from({ length: 24 }, (_, i) => i)

  // Generate random activity data
  const data = useMemo(() => {
    const result: ActivityData[] = []
    days.forEach(day => {
      hours.forEach(hour => {
        // More activity during work hours
        const baseValue = hour >= 9 && hour <= 17 ? 5 : 1
        const dayMultiplier = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'].includes(day) ? 2 : 0.5
        result.push({
          day,
          hour,
          value: Math.floor(Math.random() * 10 * baseValue * dayMultiplier)
        })
      })
    })
    return result
  }, [])

  const maxValue = Math.max(...data.map(d => d.value))

  const getColor = (value: number) => {
    if (value === 0) return 'bg-[var(--bg-tertiary)]'
    const intensity = value / maxValue
    if (intensity < 0.25) return 'bg-green-500/30'
    if (intensity < 0.5) return 'bg-green-500/50'
    if (intensity < 0.75) return 'bg-green-500/70'
    return 'bg-green-500'
  }

  return (
    <Card className="p-5">
      <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-4">Scan Activity</h3>
      <p className="text-sm text-[var(--text-muted)] mb-4">Last 7 days by hour</p>
      
      <div className="overflow-x-auto">
        <div className="min-w-[500px]">
          {/* Hour labels */}
          <div className="flex gap-1 mb-1 pl-10">
            {[0, 6, 12, 18, 23].map(h => (
              <div 
                key={h} 
                className="text-xs text-[var(--text-muted)]"
                style={{ position: 'absolute', left: `${(h / 24) * 100}%` }}
              >
                {h}:00
              </div>
            ))}
          </div>
          
          {/* Heatmap grid */}
          <div className="space-y-1">
            {days.map(day => (
              <div key={day} className="flex items-center gap-1">
                <span className="w-8 text-xs text-[var(--text-muted)]">{day}</span>
                <div className="flex gap-0.5 flex-1">
                  {hours.map(hour => {
                    const cellData = data.find(d => d.day === day && d.hour === hour)
                    return (
                      <div
                        key={hour}
                        className={`flex-1 h-4 rounded-sm ${getColor(cellData?.value || 0)} transition-colors`}
                        title={`${day} ${hour}:00 - ${cellData?.value || 0} scans`}
                      />
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center justify-end gap-2 mt-4 text-xs text-[var(--text-muted)]">
        <span>Less</span>
        <div className="flex gap-0.5">
          <div className="w-3 h-3 rounded-sm bg-[var(--bg-tertiary)]" />
          <div className="w-3 h-3 rounded-sm bg-green-500/30" />
          <div className="w-3 h-3 rounded-sm bg-green-500/50" />
          <div className="w-3 h-3 rounded-sm bg-green-500/70" />
          <div className="w-3 h-3 rounded-sm bg-green-500" />
        </div>
        <span>More</span>
      </div>
    </Card>
  )
}
