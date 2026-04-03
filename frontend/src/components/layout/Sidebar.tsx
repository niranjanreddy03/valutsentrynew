'use client'

import { useAuth } from '@/contexts/AuthContext'
import { useSubscription } from '@/contexts/SubscriptionContext'
import { SubscriptionBadge } from '@/components/ui/SubscriptionBadge'
import {
    Bell,
    ChevronLeft,
    CreditCard,
    FileText,
    FolderGit2,
    HelpCircle,
    History,
    Key,
    LayoutDashboard,
    Radar,
    Scale,
    Settings,
    Shield,
    ShieldAlert,
    Users
} from 'lucide-react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

interface SidebarProps {
  isOpen: boolean
  onToggle: () => void
}

const navigation = [
  { name: 'Dashboard', href: '/', icon: LayoutDashboard },
  { name: 'Repositories', href: '/repositories', icon: FolderGit2 },
  { name: 'Detection', href: '/scans', icon: Radar },
  { name: 'Findings', href: '/secrets', icon: ShieldAlert },
  { name: 'Policies', href: '/policies', icon: Scale },
  { name: 'Alerts', href: '/alerts', icon: Bell },
  { name: 'Reports', href: '/reports', icon: FileText },
]

const adminNavigation = [
  { name: 'Teams', href: '/teams', icon: Users },
  { name: 'API Keys', href: '/api-keys', icon: Key },
  { name: 'Audit Logs', href: '/audit', icon: History },
]

const bottomNavigation = [
  { name: 'Pricing', href: '/pricing', icon: CreditCard },
  { name: 'Settings', href: '/settings', icon: Settings },
  { name: 'Help', href: '/help', icon: HelpCircle },
]

export default function Sidebar({ isOpen, onToggle }: SidebarProps) {
  const pathname = usePathname()

  return (
    <aside 
      className={`
        ${isOpen ? 'w-64' : 'w-20'} 
        relative flex flex-col
        border-r
        transition-all duration-300 ease-in-out z-40
      `}
      style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-color)' }}
    >
      {/* Logo */}
      <div className="h-14 flex items-center justify-between px-4 border-b" style={{ borderColor: 'var(--border-color)' }}>
        <Link href="/" className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-md flex items-center justify-center" style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border-color)' }}>
            <Shield className="w-4 h-4" style={{ color: 'var(--text-primary)' }} />
          </div>
          {isOpen && (
            <span className="font-semibold text-lg whitespace-nowrap" style={{ color: 'var(--text-primary)' }}>
              Vault Sentry
            </span>
          )}
        </Link>
        <button 
          onClick={onToggle}
          className="p-1.5 rounded-md transition-colors hover:opacity-80"
          style={{ background: 'var(--bg-tertiary)' }}
        >
          <ChevronLeft className={`w-5 h-5 transition-transform ${!isOpen && 'rotate-180'}`} style={{ color: 'var(--text-muted)' }} />
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-1">
        {navigation.map((item) => {
          const isActive = pathname === item.href
          const Icon = item.icon
          
          return (
            <Link
              key={item.name}
              href={item.href}
              className="flex items-center gap-3 px-3 py-2 rounded-md transition-colors hover:opacity-90"
              style={{ 
                background: isActive ? 'var(--bg-tertiary)' : 'transparent',
                color: isActive ? 'var(--text-primary)' : 'var(--text-muted)'
              }}
              title={!isOpen ? item.name : undefined}
            >
              <Icon className="w-5 h-5 flex-shrink-0" />
              {isOpen && (
                <span className="text-sm whitespace-nowrap">{item.name}</span>
              )}
            </Link>
          )
        })}
      </nav>

      {/* Admin Navigation */}
      <div className="px-3 py-2 border-t" style={{ borderColor: 'var(--border-color)' }}>
        {isOpen && (
          <p className="px-3 py-2 text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Admin</p>
        )}
        {adminNavigation.map((item) => {
          const isActive = pathname === item.href
          const Icon = item.icon
          
          return (
            <Link
              key={item.name}
              href={item.href}
              className="flex items-center gap-3 px-3 py-2 rounded-md transition-colors hover:opacity-90"
              style={{ 
                background: isActive ? 'var(--bg-tertiary)' : 'transparent',
                color: isActive ? 'var(--text-primary)' : 'var(--text-muted)'
              }}
              title={!isOpen ? item.name : undefined}
            >
              <Icon className="w-5 h-5 flex-shrink-0" />
              {isOpen && (
                <span className="text-sm whitespace-nowrap">{item.name}</span>
              )}
            </Link>
          )
        })}
      </div>

      {/* Bottom Navigation */}
      <div className="px-3 py-4 border-t space-y-1" style={{ borderColor: 'var(--border-color)' }}>
        {bottomNavigation.map((item) => {
          const isActive = pathname === item.href
          const Icon = item.icon
          
          return (
            <Link
              key={item.name}
              href={item.href}
              className="flex items-center gap-3 px-3 py-2 rounded-md transition-colors hover:opacity-90"
              style={{ 
                background: isActive ? 'var(--bg-tertiary)' : 'transparent',
                color: isActive ? 'var(--text-primary)' : 'var(--text-muted)'
              }}
              title={!isOpen ? item.name : undefined}
            >
              <Icon className="w-5 h-5 flex-shrink-0" />
              {isOpen && (
                <span className="text-sm whitespace-nowrap">{item.name}</span>
              )}
            </Link>
          )
        })}
      </div>

      {/* User Section */}
      {isOpen && (
        <UserSection />
      )}
    </aside>
  )
}

function UserSection() {
  const { user, supabaseUser } = useAuth()
  const { status } = useSubscription()
  
  // Use supabaseUser.email as fallback since user profile might not exist in DB yet
  const email = user?.email || supabaseUser?.email || ''
  const fullName = user?.full_name || supabaseUser?.user_metadata?.full_name || ''
  
  const initials = fullName 
    ? fullName.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2)
    : email?.charAt(0).toUpperCase() || 'U'
  
  const displayName = fullName || email?.split('@')[0] || 'User'
  const displayEmail = email

  return (
    <div className="p-3 border-t" style={{ borderColor: 'var(--border-color)' }}>
      {/* Subscription Badge */}
      <div className="px-2 mb-3">
        <SubscriptionBadge size="sm" />
        {status && status.tier === 'basic' && (
          <div className="mt-2 space-y-1">
            <div className="flex justify-between text-xs" style={{ color: 'var(--text-muted)' }}>
              <span>Repos</span>
              <span>{status.repositories_used}/{status.repositories_limit === -1 ? '∞' : status.repositories_limit}</span>
            </div>
            <div className="h-1 rounded-full" style={{ background: 'var(--bg-tertiary)' }}>
              <div 
                className="h-full rounded-full bg-blue-500"
                style={{ width: `${status.repositories_limit === -1 ? 0 : Math.min((status.repositories_used / status.repositories_limit) * 100, 100)}%` }}
              />
            </div>
          </div>
        )}
      </div>
      
      <div className="flex items-center gap-3 p-2">
        <div className="w-8 h-8 rounded-full flex items-center justify-center" style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border-color)' }}>
          <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>{initials}</span>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate" style={{ color: 'var(--text-primary)' }}>{displayName}</p>
          <p className="text-xs truncate" style={{ color: 'var(--text-muted)' }}>{displayEmail}</p>
        </div>
      </div>
    </div>
  )
}
