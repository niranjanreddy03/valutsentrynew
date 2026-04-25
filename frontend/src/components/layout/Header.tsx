'use client'

import GlobalSearch, { useGlobalSearch } from '@/components/ui/GlobalSearch'
import { useAuth } from '@/contexts/AuthContext'
import { useTheme } from '@/contexts/ThemeContext'
import {
    Bell,
    Command,
    LogOut,
    Menu,
    Moon,
    Search,
    Sun,
    User,
    UserCog,
    ChevronRight,
} from 'lucide-react'
import { useEffect, useRef, useState } from 'react'

interface HeaderProps {
  alertCount: number
  onMenuClick: () => void
}

export default function Header({ alertCount, onMenuClick }: HeaderProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [showUserMenu, setShowUserMenu] = useState(false)
  const [showNotifications, setShowNotifications] = useState(false)
  const { theme, toggleTheme } = useTheme()
  const { user, supabaseUser, logout } = useAuth()
  const globalSearch = useGlobalSearch()

  const handleLogout = async () => {
    try {
      await logout()
    } catch (error) {
      console.error('Logout error:', error)
    }
  }

  // Use supabaseUser as fallback for email/name when user profile doesn't exist in DB
  const email = user?.email || supabaseUser?.email || ''
  const fullName = user?.full_name || supabaseUser?.user_metadata?.full_name || ''
  
  const userInitials = fullName
    ? fullName.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2)
    : email?.slice(0, 2).toUpperCase() || 'U'
  
  const displayName = fullName || email?.split('@')[0] || 'User'
  const displayEmail = email

  // Close user menu on Escape for accessibility
  const userMenuFirstItemRef = useRef<HTMLAnchorElement | null>(null)
  useEffect(() => {
    if (!showUserMenu) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setShowUserMenu(false)
    }
    window.addEventListener('keydown', handler)
    // Move focus into menu for keyboard users
    requestAnimationFrame(() => userMenuFirstItemRef.current?.focus())
    return () => window.removeEventListener('keydown', handler)
  }, [showUserMenu])

  return (
    <header className="h-12 border-b flex items-center justify-between px-4 relative z-50" style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-color)' }}>
      {/* Left Section */}
      <div className="flex items-center gap-4">
        <button 
          onClick={onMenuClick}
          className="lg:hidden p-2 rounded-md transition-colors hover:opacity-80"
          style={{ background: 'var(--bg-tertiary)' }}
        >
          <Menu className="w-5 h-5" style={{ color: 'var(--text-muted)' }} />
        </button>
        
        {/* Search Bar */}
        <button 
          onClick={globalSearch.open}
          className="hidden md:flex items-center relative cursor-pointer"
        >
          <Search className="absolute left-3 w-4 h-4" style={{ color: 'var(--text-muted)' }} />
          <div
            className="w-56 pl-9 pr-4 py-1.5 rounded-md text-sm border flex items-center justify-between"
            style={{ background: 'var(--input-bg)', borderColor: 'var(--border-color)', color: 'var(--text-muted)' }}
          >
            <span>Search...</span>
            <kbd className="hidden sm:flex items-center gap-0.5 px-1.5 py-0.5 rounded text-xs" style={{ background: 'var(--bg-tertiary)' }}>
              <Command className="w-3 h-3" />K
            </kbd>
          </div>
        </button>
      </div>

      {/* Global Search Modal */}
      <GlobalSearch isOpen={globalSearch.isOpen} onClose={globalSearch.close} />

      {/* Click outside to close dropdowns - rendered first so dropdowns appear on top */}
      {(showNotifications || showUserMenu) && (
        <div 
          className="fixed inset-0 z-40" 
          onClick={() => {
            setShowNotifications(false)
            setShowUserMenu(false)
          }}
        />
      )}

      {/* Right Section */}
      <div className="flex items-center gap-2">
        {/* Theme Toggle */}
        <button 
          onClick={toggleTheme}
          className="p-2 rounded-md transition-colors hover:opacity-80"
          style={{ background: 'var(--bg-tertiary)' }}
          title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
        >
          {theme === 'dark' ? (
            <Sun className="w-5 h-5" style={{ color: 'var(--text-muted)' }} />
          ) : (
            <Moon className="w-5 h-5" style={{ color: 'var(--text-muted)' }} />
          )}
        </button>

        {/* Notifications */}
        <div className="relative">
          <button 
            onClick={() => setShowNotifications(!showNotifications)}
            className="relative p-2 rounded-md transition-colors hover:opacity-80"
            style={{ background: 'var(--bg-tertiary)' }}
          >
            <Bell className="w-5 h-5" style={{ color: 'var(--text-muted)' }} />
            {alertCount > 0 && (
              <span className="absolute top-1 right-1 w-4 h-4 bg-red-500 text-white text-xs rounded-full flex items-center justify-center">
                {alertCount > 9 ? '9+' : alertCount}
              </span>
            )}
          </button>
          
          {/* Notifications Dropdown */}
          {showNotifications && (
            <div className="absolute top-full right-0 mt-2 w-72 rounded-lg shadow-2xl z-[100]" style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-color)' }}>
              <div className="p-3 border-b" style={{ borderColor: 'var(--border-color)' }}>
                <h3 className="font-medium" style={{ color: 'var(--text-primary)' }}>Notifications</h3>
              </div>
              <div className="max-h-80 overflow-y-auto">
                {[
                  { type: 'critical', title: 'Critical secret found', message: 'AWS key detected in frontend-app', time: '2m ago' },
                  { type: 'warning', title: 'Scan completed', message: 'backend-api scan finished with 8 findings', time: '15m ago' },
                  { type: 'info', title: 'New repository added', message: 'mobile-app was added to monitoring', time: '1h ago' },
                ].map((notification, index) => (
                  <div 
                    key={index}
                    className="p-3 cursor-pointer transition-colors hover:opacity-90"
                    style={{ borderBottom: '1px solid var(--border-color)', background: 'var(--bg-secondary)' }}
                  >
                    <div className="flex items-start gap-2">
                      <span className={`
                        w-2 h-2 rounded-full mt-1.5 flex-shrink-0
                        ${notification.type === 'critical' ? 'bg-red-500' : 
                          notification.type === 'warning' ? 'bg-amber-500' : 'bg-blue-500'}
                      `} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{notification.title}</p>
                        <p className="text-xs mt-0.5 truncate" style={{ color: 'var(--text-muted)' }}>{notification.message}</p>
                        <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>{notification.time}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              <div className="p-2 border-t" style={{ borderColor: 'var(--border-color)' }}>
                <a href="/alerts" className="block text-center text-sm text-blue-400 hover:underline">
                  View all
                </a>
              </div>
            </div>
          )}
        </div>

        {/* User Menu */}
        <div className="relative">
          <button
            onClick={() => setShowUserMenu(!showUserMenu)}
            aria-haspopup="menu"
            aria-expanded={showUserMenu}
            aria-label="Account menu"
            className="group flex items-center gap-2 p-0.5 rounded-full transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400/60 focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bg-primary)]"
          >
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center ring-2 ring-transparent group-hover:ring-[var(--border-color)] transition-all"
              style={{
                background: 'linear-gradient(135deg, #3b82f6 0%, #60a5fa 100%)',
                boxShadow: '0 4px 14px -4px rgba(59, 130, 246, 0.5)',
              }}
            >
              <span className="text-white text-xs font-semibold tracking-wide">{userInitials}</span>
            </div>
          </button>

          {/* User Dropdown — premium glassmorphism */}
          {showUserMenu && (
            <div
              role="menu"
              aria-label="Account"
              className="absolute top-full right-0 mt-2.5 w-72 rounded-xl overflow-hidden z-[100] animate-scale-in origin-top-right"
              style={{
                background: 'color-mix(in srgb, var(--bg-secondary) 85%, transparent)',
                backdropFilter: 'blur(16px) saturate(180%)',
                WebkitBackdropFilter: 'blur(16px) saturate(180%)',
                border: '1px solid rgba(82, 82, 82, 0.45)',
                boxShadow:
                  '0 1px 0 rgba(255,255,255,0.04) inset,' +
                  '0 20px 50px -12px rgba(0, 0, 0, 0.6),' +
                  '0 8px 20px -8px rgba(0, 0, 0, 0.4)',
              }}
            >
              {/* Header: clickable profile link */}
              <a
                href="/settings"
                ref={userMenuFirstItemRef}
                role="menuitem"
                onClick={() => setShowUserMenu(false)}
                className="flex items-center gap-3 px-4 py-3.5 transition-colors duration-150 hover:bg-white/[0.04] focus:bg-white/[0.06] focus:outline-none"
              >
                <div
                  className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0"
                  style={{
                    background: 'linear-gradient(135deg, #3b82f6 0%, #60a5fa 100%)',
                    boxShadow: '0 4px 14px -4px rgba(59, 130, 246, 0.5)',
                  }}
                >
                  <span className="text-white text-sm font-semibold">{userInitials}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p
                    className="text-sm font-semibold truncate"
                    style={{ color: 'var(--text-primary)' }}
                  >
                    {displayName}
                  </p>
                  <p
                    className="text-xs truncate mt-0.5"
                    style={{ color: 'var(--text-muted)' }}
                  >
                    {displayEmail}
                  </p>
                </div>
                <ChevronRight
                  className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity"
                  style={{ color: 'var(--text-muted)' }}
                />
              </a>

              {/* Divider */}
              <div className="h-px" style={{ background: 'rgba(82, 82, 82, 0.35)' }} />

              {/* Navigation actions */}
              <div className="p-1.5">
                <a
                  href="/settings"
                  role="menuitem"
                  onClick={() => setShowUserMenu(false)}
                  className="group/item flex items-center gap-3 px-3 py-2.5 text-sm rounded-lg transition-colors duration-150 hover:bg-white/[0.05] focus:bg-white/[0.07] focus:outline-none"
                  style={{ color: 'var(--text-secondary)' }}
                >
                  <UserCog
                    className="w-4 h-4 opacity-70 group-hover/item:opacity-100 transition-opacity"
                    style={{ color: 'var(--text-muted)' }}
                  />
                  <span className="flex-1">Manage account</span>
                </a>

                {/* Theme toggle — acts as a menu item */}
                <button
                  role="menuitem"
                  onClick={toggleTheme}
                  className="group/item w-full flex items-center gap-3 px-3 py-2.5 text-sm rounded-lg transition-colors duration-150 hover:bg-white/[0.05] focus:bg-white/[0.07] focus:outline-none"
                  style={{ color: 'var(--text-secondary)' }}
                >
                  {theme === 'dark' ? (
                    <Sun
                      className="w-4 h-4 opacity-70 group-hover/item:opacity-100 transition-opacity"
                      style={{ color: 'var(--text-muted)' }}
                    />
                  ) : (
                    <Moon
                      className="w-4 h-4 opacity-70 group-hover/item:opacity-100 transition-opacity"
                      style={{ color: 'var(--text-muted)' }}
                    />
                  )}
                  <span className="flex-1 text-left">
                    {theme === 'dark' ? 'Light mode' : 'Dark mode'}
                  </span>
                  <span
                    className="text-[10px] uppercase tracking-wider font-medium"
                    style={{ color: 'var(--text-muted)' }}
                  >
                    {theme}
                  </span>
                </button>
              </div>

              {/* Divider */}
              <div className="h-px" style={{ background: 'rgba(82, 82, 82, 0.35)' }} />

              {/* Destructive */}
              <div className="p-1.5">
                <button
                  role="menuitem"
                  onClick={handleLogout}
                  className="flex items-center gap-3 w-full px-3 py-2.5 text-sm rounded-lg transition-colors duration-150 hover:bg-red-500/[0.10] focus:bg-red-500/[0.14] focus:outline-none"
                  style={{ color: '#f87171' }}
                >
                  <LogOut className="w-4 h-4 opacity-80" />
                  <span className="flex-1 text-left">Sign out</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}
