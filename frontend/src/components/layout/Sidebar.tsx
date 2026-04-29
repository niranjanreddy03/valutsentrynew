'use client'

import {
    Bell,
    Brain,
    CalendarClock,
    ChevronLeft,
    Cloud,
    FileText,
    FolderGit2,
    HelpCircle,
    History,
    Key,
    LayoutDashboard,
    LifeBuoy,
    Plug,
    Radar,
    Scale,
    Settings,
    Sparkles,
    Shield,
    ShieldAlert,
    User,
    Users
} from 'lucide-react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

interface SidebarProps {
  isOpen: boolean
  onToggle: () => void
}

type NavItem = {
  name: string
  href: string
  icon: typeof LayoutDashboard
  feature?: string
}

const navigation: NavItem[] = [
  { name: 'Dashboard', href: '/', icon: LayoutDashboard },
  { name: 'Repositories', href: '/repositories', icon: FolderGit2 },
  { name: 'S3 Buckets', href: '/s3-buckets', icon: Cloud, feature: 'aws_integration' },
  { name: 'Detection', href: '/scans', icon: Radar },
  { name: 'Findings', href: '/secrets', icon: ShieldAlert },
  { name: 'ML Insights', href: '/insights', icon: Brain },
  { name: 'Policies', href: '/policies', icon: Scale },
  { name: 'Alerts', href: '/alerts', icon: Bell },
  { name: 'Reports', href: '/reports', icon: FileText, feature: 'export_reports' },
  { name: 'Scheduled Scans', href: '/scheduled-scans', icon: CalendarClock, feature: 'scheduled_scans' },
  { name: 'Integrations', href: '/integrations', icon: Plug },
]

const adminNavigation: NavItem[] = [
  { name: 'Teams', href: '/teams', icon: Users, feature: 'team_management' },
  { name: 'API Keys', href: '/api-keys', icon: Key, feature: 'api_access' },
  { name: 'Audit Logs', href: '/audit', icon: History, feature: 'audit_logs' },
]

const bottomNavigation = [
  { name: 'Pricing', href: '/pricing', icon: Sparkles },
  { name: 'Settings', href: '/settings', icon: Settings },
  { name: 'Priority Support', href: '/support', icon: LifeBuoy },
  { name: 'Help', href: '/help', icon: HelpCircle },
]

export default function Sidebar({ isOpen, onToggle }: SidebarProps) {
  const pathname = usePathname()

  const renderNavItem = (item: NavItem) => {
    const isActive = pathname === item.href
    const Icon = item.icon

    return (
      <Link
        key={item.name}
        href={item.href}
        className="flex items-center gap-3 px-3 py-2 rounded-md transition-colors hover:opacity-90"
        style={{
          background: isActive ? 'var(--bg-tertiary)' : 'transparent',
          color: isActive ? 'var(--text-primary)' : 'var(--text-muted)',
        }}
        title={!isOpen ? item.name : undefined}
      >
        <Icon className="w-5 h-5 flex-shrink-0" />
        {isOpen && (
          <span className="text-sm whitespace-nowrap flex-1">{item.name}</span>
        )}
      </Link>
    )
  }

  return (
    <aside
      className={`
        ${isOpen ? 'w-64' : 'w-20'}
        sticky top-0 flex flex-col
        h-screen max-h-screen overflow-hidden
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
      <nav
        className="flex-1 min-h-0 overflow-y-auto px-3 py-4 space-y-1 [&::-webkit-scrollbar]:hidden"
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' as const }}
      >
        {navigation.map(renderNavItem)}
      </nav>

      {/* Admin Navigation */}
      <div className="px-3 py-2 border-t" style={{ borderColor: 'var(--border-color)' }}>
        {isOpen && (
          <p className="px-3 py-2 text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Admin</p>
        )}
        {adminNavigation.map(renderNavItem)}
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
  return (
    <div className="p-3 border-t" style={{ borderColor: 'var(--border-color)' }}>
      <div className="flex items-center gap-3 p-2">
        <div className="w-8 h-8 rounded-full flex items-center justify-center" style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border-color)' }}>
          <User className="w-4 h-4" style={{ color: 'var(--text-secondary)' }} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate" style={{ color: 'var(--text-primary)' }}>Account</p>
        </div>
      </div>
    </div>
  )
}
