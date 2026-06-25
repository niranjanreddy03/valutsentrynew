'use client'

import Header from '@/components/layout/Header'
import Sidebar from '@/components/layout/Sidebar'
import { Badge, Button, Card, Select, Skeleton } from '@/components/ui'
import { useToast } from '@/contexts/ToastContext'
import { DEMO_ALERTS, isDemoMode } from '@/lib/demoData'
import { Alert, alertService } from '@/services/api'
import {
    AlertCircle,
    AlertTriangle,
    Bell,
    Check,
    CheckCheck,
    CheckCircle,
    Clock,
    ExternalLink,
    Filter,
    GitBranch,
    Info
} from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'

const alertConfig = {
  critical: {
    icon: AlertCircle,
    color: 'text-red-400',
    bg: 'bg-red-500/10',
    border: 'border-red-500/30',
    badge: 'critical' as const,
  },
  warning: {
    icon: AlertTriangle,
    color: 'text-yellow-400',
    bg: 'bg-yellow-500/10',
    border: 'border-yellow-500/30',
    badge: 'warning' as const,
  },
  info: {
    icon: Info,
    color: 'text-blue-400',
    bg: 'bg-blue-500/10',
    border: 'border-blue-500/30',
    badge: 'info' as const,
  },
  success: {
    icon: CheckCircle,
    color: 'text-green-400',
    bg: 'bg-green-500/10',
    border: 'border-green-500/30',
    badge: 'success' as const,
  },
}

export default function AlertsPage() {
  const [alerts, setAlerts] = useState<Alert[]>([])
  const [loading, setLoading] = useState(true)
  const [filterType, setFilterType] = useState('all')
  const [filterRead, setFilterRead] = useState('all')
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const toast = useToast()

  const fetchAlerts = useCallback(async () => {
    try {
      // Check for demo mode
      if (isDemoMode()) {
        const demoAlertsFormatted = DEMO_ALERTS.map(a => ({
          ...a,
          repository: a.repository.name,
        })) as Alert[]
        setAlerts(demoAlertsFormatted)
        setLoading(false)
        return
      }

      const data = await alertService.getAll()
      setAlerts(data)
    } catch (error) {
      toast.error('Failed to load alerts')
    } finally {
      setLoading(false)
    }
  }, [toast])

  useEffect(() => {
    fetchAlerts()
  }, [fetchAlerts])

  const handleMarkAsRead = async (id: number) => {
    try {
      await alertService.markAsRead(id)
      setAlerts(alerts.map(a => a.id === id ? { ...a, is_read: true } : a))
    } catch (error) {
      toast.error('Failed to update alert')
    }
  }

  const handleMarkAllAsRead = async () => {
    try {
      await alertService.markAllAsRead()
      setAlerts(alerts.map(a => ({ ...a, is_read: true })))
      toast.success('All alerts marked as read')
    } catch (error) {
      toast.error('Failed to update alerts')
    }
  }

  const filteredAlerts = alerts.filter(alert => {
    const matchesType = filterType === 'all' || alert.type === filterType
    const matchesRead = filterRead === 'all' || 
      (filterRead === 'unread' && !alert.is_read) ||
      (filterRead === 'read' && alert.is_read)
    return matchesType && matchesRead
  })

  const unreadCount = alerts.filter(a => !a.is_read).length
  const criticalCount = alerts.filter(a => a.type === 'critical' && !a.is_read).length

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar isOpen={sidebarOpen} onToggle={() => setSidebarOpen(!sidebarOpen)} />
      
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header 
          alertCount={unreadCount}
          onMenuClick={() => setSidebarOpen(!sidebarOpen)}
        />
        
        <main className="flex-1 overflow-y-auto p-6 bg-[var(--bg-primary)]">
          <div className="max-w-[1400px] mx-auto">
            {/* Page Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
              <div>
                <h1 className="text-2xl font-bold text-[var(--text-primary)]">Alerts</h1>
                <p className="text-[var(--text-muted)] mt-1">
                  {unreadCount} unread alerts
                  {criticalCount > 0 && (
                    <span className="text-red-400 ml-2">• {criticalCount} critical</span>
                  )}
                </p>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="secondary"
                  leftIcon={<CheckCheck className="w-5 h-5" />}
                  onClick={handleMarkAllAsRead}
                  disabled={unreadCount === 0}
                >
                  Mark all as read
                </Button>
              </div>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              <Card className="!p-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-red-500/20 flex items-center justify-center">
                    <AlertCircle className="w-5 h-5 text-red-400" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-[var(--text-primary)]">
                      {alerts.filter(a => a.type === 'critical').length}
                    </p>
                    <p className="text-xs text-[var(--text-muted)]">Critical</p>
                  </div>
                </div>
              </Card>
              <Card className="!p-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-yellow-500/20 flex items-center justify-center">
                    <AlertTriangle className="w-5 h-5 text-yellow-400" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-[var(--text-primary)]">
                      {alerts.filter(a => a.type === 'warning').length}
                    </p>
                    <p className="text-xs text-[var(--text-muted)]">Warnings</p>
                  </div>
                </div>
              </Card>
              <Card className="!p-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-blue-500/20 flex items-center justify-center">
                    <Info className="w-5 h-5 text-blue-400" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-[var(--text-primary)]">
                      {alerts.filter(a => a.type === 'info').length}
                    </p>
                    <p className="text-xs text-[var(--text-muted)]">Info</p>
                  </div>
                </div>
              </Card>
              <Card className="!p-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-green-500/20 flex items-center justify-center">
                    <CheckCircle className="w-5 h-5 text-green-400" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-[var(--text-primary)]">
                      {alerts.filter(a => a.type === 'success').length}
                    </p>
                    <p className="text-xs text-[var(--text-muted)]">Resolved</p>
                  </div>
                </div>
              </Card>
            </div>

            {/* Filters */}
            <div className="flex flex-col sm:flex-row gap-4 mb-6">
              <div className="flex items-center gap-2">
                <Filter className="w-5 h-5 text-[var(--text-muted)]" />
                <Select
                  options={[
                    { value: 'all', label: 'All Types' },
                    { value: 'critical', label: 'Critical' },
                    { value: 'warning', label: 'Warning' },
                    { value: 'info', label: 'Info' },
                    { value: 'success', label: 'Success' },
                  ]}
                  value={filterType}
                  onChange={setFilterType}
                  className="w-36"
                />
              </div>
              <Select
                options={[
                  { value: 'all', label: 'All Alerts' },
                  { value: 'unread', label: 'Unread' },
                  { value: 'read', label: 'Read' },
                ]}
                value={filterRead}
                onChange={setFilterRead}
                className="w-32"
              />
            </div>

            {/* Alerts List */}
            {loading ? (
              <div className="space-y-4">
                {[...Array(5)].map((_, i) => (
                  <Skeleton.Card key={i} />
                ))}
              </div>
            ) : filteredAlerts.length === 0 ? (
              <Card className="text-center py-12">
                <Bell className="w-12 h-12 text-[var(--text-muted)] mx-auto mb-4" />
                <h3 className="text-lg font-medium text-[var(--text-secondary)] mb-2">No alerts found</h3>
                <p className="text-[var(--text-muted)]">
                  {filterType !== 'all' || filterRead !== 'all' 
                    ? 'Try adjusting your filters'
                    : 'Your security feed is empty'}
                </p>
              </Card>
            ) : (
              <div className="space-y-3">
                {filteredAlerts.map((alert) => {
                  const config = alertConfig[alert.type]
                  const Icon = config.icon
                  
                  return (
                    <Card
                      key={alert.id}
                      className={`
                        !p-4 border-l-4 ${config.border}
                        ${!alert.is_read ? 'bg-[var(--bg-secondary)]' : 'bg-[var(--bg-secondary)]/50'}
                        transition-all hover:bg-[var(--bg-tertiary)]
                      `}
                    >
                      <div className="flex items-start gap-4">
                        {/* Icon */}
                        <div className={`w-10 h-10 rounded-lg ${config.bg} flex items-center justify-center flex-shrink-0`}>
                          <Icon className={`w-5 h-5 ${config.color}`} />
                        </div>

                        {/* Content */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <div className="flex items-center gap-2 mb-1">
                                <h3 className={`font-medium ${alert.is_read ? 'text-[var(--text-secondary)]' : 'text-[var(--text-primary)]'}`}>
                                  {alert.title}
                                </h3>
                                {!alert.is_read && (
                                  <span className="w-2 h-2 rounded-full bg-[var(--accent)]" />
                                )}
                              </div>
                              <p className="text-sm text-[var(--text-muted)]">{alert.message}</p>
                            </div>
                            <Badge variant={config.badge} size="sm">
                              {alert.type}
                            </Badge>
                          </div>

                          {/* Meta */}
                          <div className="flex items-center gap-4 mt-3">
                            {alert.repository && (
                              <span className="flex items-center gap-1 text-xs text-[var(--text-muted)]">
                                <GitBranch className="w-3 h-3" />
                                {alert.repository}
                              </span>
                            )}
                            <span className="flex items-center gap-1 text-xs text-[var(--text-muted)]">
                              <Clock className="w-3 h-3" />
                              {alert.created_at}
                            </span>
                          </div>
                        </div>

                        {/* Actions */}
                        <div className="flex items-center gap-1 flex-shrink-0">
                          {!alert.is_read && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleMarkAsRead(alert.id)}
                              title="Mark as read"
                            >
                              <Check className="w-4 h-4" />
                            </Button>
                          )}
                          {alert.repository && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {}}
                              title="View repository"
                            >
                              <ExternalLink className="w-4 h-4" />
                            </Button>
                          )}
                        </div>
                      </div>
                    </Card>
                  )
                })}
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  )
}
