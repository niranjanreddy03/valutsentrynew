'use client'

import { useState } from 'react'
import {
  Bell,
  AlertTriangle,
  ShieldAlert,
  Info,
  CheckCircle2,
  X,
  ExternalLink,
  BellOff
} from 'lucide-react'

interface Alert {
  id: number
  type: 'critical' | 'warning' | 'info' | 'success'
  title: string
  message: string
  repository: string
  created_at: string
  is_read: boolean
}

interface AlertsPanelProps {
  alerts: Alert[]
}

const alertConfig = {
  critical: {
    icon: ShieldAlert,
    color: 'text-[#f87171]',
    bg: 'bg-[var(--bg-tertiary)]',
    border: 'border-[var(--border-color)]',
    label: 'Critical'
  },
  warning: {
    icon: AlertTriangle,
    color: 'text-[#fbbf24]',
    bg: 'bg-[var(--bg-tertiary)]',
    border: 'border-[var(--border-color)]',
    label: 'Warning'
  },
  info: {
    icon: Info,
    color: 'text-[#60a5fa]',
    bg: 'bg-[var(--bg-tertiary)]',
    border: 'border-[var(--border-color)]',
    label: 'Info'
  },
  success: {
    icon: CheckCircle2,
    color: 'text-[#4ade80]',
    bg: 'bg-[var(--bg-tertiary)]',
    border: 'border-[var(--border-color)]',
    label: 'Success'
  }
}

export default function AlertsPanel({ alerts }: AlertsPanelProps) {
  const [localAlerts, setLocalAlerts] = useState(alerts)
  const [filter, setFilter] = useState<'all' | 'unread'>('all')

  const unreadCount = localAlerts.filter(a => !a.is_read).length

  const filteredAlerts = localAlerts.filter(alert => {
    if (filter === 'unread') return !alert.is_read
    return true
  }).slice(0, 4) // Show only top 4 alerts for compact view

  const markAsRead = (id: number) => {
    setLocalAlerts(prev => 
      prev.map(alert => 
        alert.id === id ? { ...alert, is_read: true } : alert
      )
    )
  }

  const dismissAlert = (id: number) => {
    setLocalAlerts(prev => prev.filter(alert => alert.id !== id))
  }

  const markAllAsRead = () => {
    setLocalAlerts(prev => prev.map(alert => ({ ...alert, is_read: true })))
  }

  return (
    <div className="card">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-red-500/20 flex items-center justify-center relative">
            <Bell className="w-4 h-4 text-red-400" />
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                {unreadCount}
              </span>
            )}
          </div>
          <div>
            <h3 className="text-base font-semibold text-[var(--text-primary)]">Alerts</h3>
            <p className="text-xs text-[var(--text-muted)]">{unreadCount} unread</p>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <button
            onClick={() => setFilter(filter === 'all' ? 'unread' : 'all')}
            className={`
              px-2 py-1 rounded-lg text-xs font-medium transition-colors
              ${filter === 'unread' 
                ? 'bg-blue-500/20 text-blue-400' 
                : 'bg-[var(--bg-tertiary)] text-[var(--text-muted)] hover:text-[var(--text-secondary)]'}
            `}
          >
            {filter === 'unread' ? 'Unread' : 'All'}
          </button>
          {unreadCount > 0 && (
            <button
              onClick={markAllAsRead}
              className="text-xs text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {/* Alerts List - Compact */}
      <div className="space-y-2">
        {filteredAlerts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-6 text-center">
            <BellOff className="w-6 h-6 text-[var(--text-muted)] mb-2" />
            <p className="text-xs text-[var(--text-muted)]">
              {filter === 'unread' ? 'No unread alerts' : 'No alerts'}
            </p>
          </div>
        ) : (
          filteredAlerts.map((alert) => {
            const config = alertConfig[alert.type]
            const Icon = config.icon
            return (
              <div
                key={alert.id}
                className={`
                  group flex items-start gap-3 p-2.5 rounded-lg border transition-all cursor-pointer
                  ${config.bg} ${config.border}
                  ${!alert.is_read ? 'border-l-2 border-l-blue-500' : 'opacity-70'}
                  hover:opacity-100 hover:bg-[var(--bg-secondary)]
                `}
                onClick={() => markAsRead(alert.id)}
              >
                <div className={`flex-shrink-0 w-7 h-7 rounded-lg flex items-center justify-center ${config.bg}`}>
                  <Icon className={`w-3.5 h-3.5 ${config.color}`} />
                </div>
                
                <div className="flex-1 min-w-0">
                  <p className={`font-medium ${config.color} text-sm truncate`}>
                    {alert.title}
                  </p>
                  <div className="flex items-center gap-2 mt-1 text-[var(--text-muted)] text-xs">
                    <span className="truncate">{alert.repository}</span>
                    <span>•</span>
                    <span>{alert.created_at}</span>
                  </div>
                </div>

                <button 
                  className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-[var(--bg-tertiary)] text-[var(--text-muted)] hover:text-red-400 transition-all"
                  onClick={(e) => { e.stopPropagation(); dismissAlert(alert.id); }}
                  title="Dismiss"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            )
          })
        )}
      </div>

      {/* Footer */}
      {localAlerts.length > 4 && (
        <div className="pt-3 mt-3 border-t border-[var(--border-color)]">
          <a href="/alerts" className="text-sm text-[var(--accent)] hover:underline flex items-center justify-center gap-1">
            View All {localAlerts.length} Alerts
            <ExternalLink className="w-3 h-3" />
          </a>
        </div>
      )}
    </div>
  )
}
