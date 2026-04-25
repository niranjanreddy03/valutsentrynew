'use client'

import { useState, useEffect, useMemo } from 'react'
import Link from 'next/link'
import Sidebar from '@/components/layout/Sidebar'
import Header from '@/components/layout/Header'
import { Button, Card, Input, Select, Badge } from '@/components/ui'
import { useToast } from '@/contexts/ToastContext'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/services/supabase'
import {
  Settings,
  User,
  Bell,
  Shield,
  ShieldCheck,
  Key,
  Palette,
  Globe,
  Database,
  Mail,
  Slack,
  Github,
  Save,
  RefreshCw,
  Eye,
  EyeOff,
  Copy,
  Trash2,
  Plus,
  Check,
  X,
  Camera,
  CalendarDays,
  Clock,
  Smartphone,
  BadgeCheck,
  ArrowRight,
  AlertTriangle,
  Download,
  KeyRound,
} from 'lucide-react'

// NOTE: Integrations moved to the dedicated /integrations page so connection
// state lives in one place. The tab here is intentionally removed.
type TabId = 'profile' | 'notifications' | 'security' | 'api' | 'advanced'

interface Tab {
  id: TabId
  label: string
  icon: React.ReactNode
}

const tabs: Tab[] = [
  { id: 'profile', label: 'Profile', icon: <User className="w-4 h-4" /> },
  { id: 'notifications', label: 'Notifications', icon: <Bell className="w-4 h-4" /> },
  { id: 'security', label: 'Security', icon: <Shield className="w-4 h-4" /> },
  { id: 'api', label: 'API Keys', icon: <Key className="w-4 h-4" /> },
  { id: 'advanced', label: 'Advanced', icon: <Settings className="w-4 h-4" /> },
]

export default function SettingsPage() {
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [activeTab, setActiveTab] = useState<TabId>('profile')
  const [saving, setSaving] = useState(false)
  const toast = useToast()
  const { user, supabaseUser, updateProfile, refreshSession } = useAuth()

  // Profile state
  const [profile, setProfile] = useState({
    fullName: '',
    email: '',
    company: '',
    role: '',
    timezone: 'America/New_York',
  })

  useEffect(() => {
    // Use supabaseUser as fallback when user profile doesn't exist in DB
    const email = user?.email || supabaseUser?.email || ''
    const fullName = user?.full_name || supabaseUser?.user_metadata?.full_name || ''
    const role = user?.role || 'user'
    
    setProfile(prev => ({
      ...prev,
      fullName,
      email,
      role,
    }))
  }, [user, supabaseUser])

  // Notification settings
  const [notifications, setNotifications] = useState({
    emailOnCritical: true,
    emailOnHigh: true,
    emailOnScanComplete: false,
    emailWeeklyReport: true,
    slackOnCritical: true,
    slackOnHigh: false,
    browserNotifications: true,
  })

  // Security settings
  const [security, setSecurity] = useState({
    twoFactorEnabled: false,
    sessionTimeout: '30',
    ipWhitelist: '',
  })
  const [verifiedFactorId, setVerifiedFactorId] = useState<string | null>(null)

  // Pull real MFA enrollment state from Supabase on mount so the "Enabled"
  // badge reflects reality instead of a hardcoded false.
  useEffect(() => {
    let cancelled = false
    const loadMfa = async () => {
      try {
        const { data, error } = await supabase.auth.mfa.listFactors()
        if (error || cancelled) return
        const verified = data?.totp?.find((f: any) => f.status === 'verified')
        setSecurity((s) => ({ ...s, twoFactorEnabled: !!verified }))
        setVerifiedFactorId(verified?.id ?? null)
      } catch {
        /* ignore */
      }
    }
    loadMfa()
    return () => {
      cancelled = true
    }
  }, [supabaseUser?.id])

  const disableTwoFactor = async () => {
    if (!verifiedFactorId) {
      setSecurity({ ...security, twoFactorEnabled: false })
      return
    }
    try {
      const { error } = await supabase.auth.mfa.unenroll({ factorId: verifiedFactorId })
      if (error) throw error
      setSecurity({ ...security, twoFactorEnabled: false })
      setVerifiedFactorId(null)
      toast.success('2FA disabled', 'Two-factor authentication has been turned off')
    } catch (err: any) {
      toast.error('Could not disable 2FA', err?.message || 'Please try again')
    }
  }

  // Integration settings
  const [integrations, setIntegrations] = useState({
    githubConnected: false,
    githubToken: '',
    showGithubToken: false,
    gitlabConnected: false,
    gitlabToken: '',
    showGitlabToken: false,
    slackConnected: false,
    slackWorkspace: '',
    awsConnected: false,
  })
  const [savingToken, setSavingToken] = useState(false)
  const [validatingToken, setValidatingToken] = useState(false)

  // Load GitHub token status from backend (NEVER loads actual token)
  useEffect(() => {
    const loadTokenStatus = async () => {
      if (!supabaseUser?.id) return
      
      try {
        const response = await fetch('/api/v1/integrations/github/token/status', {
          headers: {
            'Authorization': `Bearer ${await supabase.auth.getSession().then(s => s.data.session?.access_token)}`
          }
        })
        
        if (response.ok) {
          const data = await response.json()
          setIntegrations(prev => ({
            ...prev,
            githubConnected: data.configured,
            // Token is NEVER returned from backend for security
            githubToken: data.configured ? '••••••••••••••••' : '',
          }))
        }
      } catch (error) {
        console.error('[SETTINGS] Failed to load token status')
      }
    }
    loadTokenStatus()
  }, [supabaseUser?.id])

  // Save GitHub token via secure backend API
  const handleSaveToken = async (provider: 'github' | 'gitlab') => {
    if (!supabaseUser?.id) {
      toast.error('Error', 'Please log in to save your token')
      return
    }
    
    const tokenValue = provider === 'github' ? integrations.githubToken : integrations.gitlabToken
    
    // Don't save masked placeholder
    if (tokenValue === '••••••••••••••••') {
      toast.info('No changes', 'Token is already configured')
      return
    }
    
    // Validate token format
    if (provider === 'github' && !tokenValue.startsWith('ghp_') && !tokenValue.startsWith('github_pat_')) {
      toast.error('Invalid token', "GitHub tokens start with 'ghp_' or 'github_pat_'")
      return
    }
    
    setSavingToken(true)
    
    try {
      const session = await supabase.auth.getSession()
      const accessToken = session.data.session?.access_token
      
      const response = await fetch('/api/v1/integrations/github/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`
        },
        body: JSON.stringify({ token: tokenValue })
      })
      
      const data = await response.json()
      
      if (!response.ok) {
        throw new Error(data.detail || 'Failed to save token')
      }
      
      toast.success('Token saved', `Your ${provider.toUpperCase()} token has been validated and encrypted`)
      setIntegrations(prev => ({
        ...prev,
        githubConnected: true,
        githubToken: '••••••••••••••••', // Never show actual token
      }))
    } catch (error: any) {
      toast.error('Error', error.message || `Failed to save ${provider} token`)
    } finally {
      setSavingToken(false)
    }
  }

  // Revoke/delete GitHub token
  const handleRevokeToken = async (provider: 'github' | 'gitlab') => {
    if (!supabaseUser?.id) return
    
    setSavingToken(true)
    
    try {
      const session = await supabase.auth.getSession()
      const accessToken = session.data.session?.access_token
      
      const response = await fetch('/api/v1/integrations/github/token', {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      })
      
      if (!response.ok) {
        throw new Error('Failed to revoke token')
      }
      
      toast.success('Token revoked', `Your ${provider.toUpperCase()} token has been removed`)
      setIntegrations(prev => ({
        ...prev,
        githubConnected: false,
        githubToken: '',
      }))
    } catch (error: any) {
      toast.error('Error', error.message || 'Failed to revoke token')
    } finally {
      setSavingToken(false)
    }
  }

  // Validate current token is still valid
  const handleValidateToken = async () => {
    if (!supabaseUser?.id) return
    
    setValidatingToken(true)
    
    try {
      const session = await supabase.auth.getSession()
      const accessToken = session.data.session?.access_token
      
      const response = await fetch('/api/v1/integrations/github/token/validate', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      })
      
      const data = await response.json()
      
      if (data.valid) {
        toast.success('Token valid', 'Your GitHub token is working correctly')
      } else {
        toast.error('Token invalid', data.error_message || 'Your token may have been revoked')
        setIntegrations(prev => ({
          ...prev,
          githubConnected: false,
        }))
      }
    } catch (error) {
      toast.error('Error', 'Failed to validate token')
    } finally {
      setValidatingToken(false)
    }
  }

  // API keys
  const [apiKeys, setApiKeys] = useState<{ id: number; name: string; key: string; created: string; lastUsed: string }[]>([])
  const [showApiKey, setShowApiKey] = useState<number | null>(null)

  const handleSave = async () => {
    setSaving(true)
    // Simulate API call
    await new Promise((resolve) => setTimeout(resolve, 1000))
    setSaving(false)
    toast.success('Settings saved', 'Your changes have been saved successfully')
  }

  const handleGenerateApiKey = () => {
    const newKey = {
      id: Date.now(),
      name: 'New API Key',
      key: 'demo_key_' + Math.random().toString(36).substring(2, 38),
      created: new Date().toISOString().split('T')[0],
      lastUsed: 'Never',
    }
    setApiKeys([...apiKeys, newKey])
    toast.success('API Key generated', 'New API key has been created')
  }

  const handleDeleteApiKey = (id: number) => {
    setApiKeys(apiKeys.filter((k) => k.id !== id))
    toast.info('API Key deleted', 'The API key has been revoked')
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
    toast.info('Copied', 'Copied to clipboard')
  }

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar isOpen={sidebarOpen} onToggle={() => setSidebarOpen(!sidebarOpen)} />

      <div className="flex-1 flex flex-col overflow-hidden">
        <Header alertCount={0} onMenuClick={() => setSidebarOpen(!sidebarOpen)} />

        <main className="flex-1 overflow-y-auto p-6 bg-[var(--bg-primary)]">
          <div className="max-w-5xl mx-auto space-y-6">
            {/* Page Header */}
            <div>
              <h1 className="text-2xl font-bold text-[var(--text-primary)]">Settings</h1>
              <p className="text-[var(--text-muted)] mt-1">Manage your account and preferences</p>
            </div>

            <div className="flex flex-col lg:flex-row gap-6">
              {/* Sidebar Tabs */}
              <div className="w-full lg:w-64 flex-shrink-0">
                <Card className="p-2">
                  <nav className="space-y-1">
                    {tabs.map((tab) => (
                      <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-md transition-colors ${
                          activeTab === tab.id
                            ? 'bg-[var(--accent)]/10 text-[var(--accent)]'
                            : 'text-[var(--text-muted)] hover:bg-[var(--bg-tertiary)] hover:text-[var(--text-primary)]'
                        }`}
                      >
                        {tab.icon}
                        <span>{tab.label}</span>
                      </button>
                    ))}
                  </nav>
                </Card>
              </div>

              {/* Settings Content */}
              <div className="flex-1">
                <Card className="p-6">
                  {/* Profile Settings */}
                  {activeTab === 'profile' && (
                    <div className="space-y-8">
                      {/* Identity header: avatar + name/email + role */}
                      <div className="flex flex-col sm:flex-row sm:items-center gap-5 pb-6 border-b border-[var(--border-color)]">
                        <div className="relative">
                          <div
                            className="w-20 h-20 rounded-2xl flex items-center justify-center text-[26px] font-semibold shadow-[0_8px_28px_-8px_rgba(59,130,246,0.55)]"
                            style={{
                              background: 'linear-gradient(135deg, #3b82f6 0%, #60a5fa 100%)',
                              color: '#fff',
                            }}
                          >
                            {(profile.fullName || profile.email || '?')
                              .trim()
                              .split(/\s+/)
                              .map((n) => n[0])
                              .filter(Boolean)
                              .slice(0, 2)
                              .join('')
                              .toUpperCase() || '?'}
                          </div>
                          <button
                            type="button"
                            onClick={() => toast.info('Coming soon', 'Avatar upload will be available shortly')}
                            className="absolute -bottom-1.5 -right-1.5 h-8 w-8 rounded-full flex items-center justify-center border border-[var(--border-color)] bg-[var(--bg-tertiary)] text-[var(--text-primary)] hover:bg-[var(--bg-secondary)] transition-colors shadow"
                            aria-label="Change avatar"
                          >
                            <Camera className="w-4 h-4" />
                          </button>
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h2 className="text-xl font-semibold text-[var(--text-primary)] truncate">
                              {profile.fullName || 'Unnamed user'}
                            </h2>
                            {supabaseUser?.email_confirmed_at && (
                              <Badge variant="success" className="gap-1">
                                <BadgeCheck className="w-3 h-3" />
                                Verified
                              </Badge>
                            )}
                            {profile.role && (
                              <Badge variant="info" className="capitalize">
                                {profile.role}
                              </Badge>
                            )}
                          </div>
                          <p className="text-sm text-[var(--text-muted)] mt-1 truncate">
                            {profile.email || 'No email on file'}
                          </p>
                          <div className="flex items-center gap-4 mt-3 text-xs text-[var(--text-muted)]">
                            {supabaseUser?.created_at && (
                              <span className="inline-flex items-center gap-1.5">
                                <CalendarDays className="w-3.5 h-3.5" />
                                Joined {new Date(supabaseUser.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                              </span>
                            )}
                            {supabaseUser?.last_sign_in_at && (
                              <span className="inline-flex items-center gap-1.5">
                                <Clock className="w-3.5 h-3.5" />
                                Last sign-in {new Date(supabaseUser.last_sign_in_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Personal info */}
                      <div>
                        <h3 className="text-sm font-medium text-[var(--text-secondary)] mb-4">Personal information</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                          <div>
                            <label className="block text-sm text-[var(--text-muted)] mb-2">Full Name</label>
                            <Input
                              value={profile.fullName}
                              onChange={(e) => setProfile({ ...profile, fullName: e.target.value })}
                              placeholder="Your full name"
                            />
                          </div>
                          <div>
                            <label className="block text-sm text-[var(--text-muted)] mb-2 flex items-center gap-2">
                              Email Address
                              {supabaseUser?.email_confirmed_at ? (
                                <span className="text-[11px] text-green-500 inline-flex items-center gap-0.5">
                                  <Check className="w-3 h-3" /> verified
                                </span>
                              ) : (
                                <span className="text-[11px] text-yellow-500 inline-flex items-center gap-0.5">
                                  <AlertTriangle className="w-3 h-3" /> unverified
                                </span>
                              )}
                            </label>
                            <Input
                              type="email"
                              value={profile.email}
                              onChange={(e) => setProfile({ ...profile, email: e.target.value })}
                              placeholder="email@example.com"
                            />
                          </div>
                          <div>
                            <label className="block text-sm text-[var(--text-muted)] mb-2">Company</label>
                            <Input
                              value={profile.company}
                              onChange={(e) => setProfile({ ...profile, company: e.target.value })}
                              placeholder="Company name"
                            />
                          </div>
                          <div>
                            <label className="block text-sm text-[var(--text-muted)] mb-2">Role</label>
                            <Select
                              value={profile.role}
                              onChange={(value) => setProfile({ ...profile, role: value })}
                              options={[
                                { value: 'admin', label: 'Admin' },
                                { value: 'developer', label: 'Developer' },
                              ]}
                            />
                          </div>
                          <div>
                            <label className="block text-sm text-[var(--text-muted)] mb-2">Timezone</label>
                            <Select
                              value={profile.timezone}
                              onChange={(value) => setProfile({ ...profile, timezone: value })}
                              options={[
                                { value: 'America/New_York', label: 'Eastern Time (ET)' },
                                { value: 'America/Chicago', label: 'Central Time (CT)' },
                                { value: 'America/Denver', label: 'Mountain Time (MT)' },
                                { value: 'America/Los_Angeles', label: 'Pacific Time (PT)' },
                                { value: 'Europe/London', label: 'London (GMT)' },
                                { value: 'Europe/Paris', label: 'Paris (CET)' },
                                { value: 'Asia/Tokyo', label: 'Tokyo (JST)' },
                              ]}
                            />
                          </div>
                        </div>
                      </div>

                    </div>
                  )}

                  {/* Notification Settings */}
                  {activeTab === 'notifications' && (
                    <div className="space-y-6">
                      <h2 className="text-lg font-semibold text-[var(--text-primary)]">Notification Preferences</h2>

                      <div className="space-y-6">
                        <div>
                          <h3 className="text-sm font-medium text-[var(--text-secondary)] mb-4 flex items-center gap-2">
                            <Mail className="w-4 h-4" />
                            Email Notifications
                          </h3>
                          <div className="space-y-4">
                            {[
                              { key: 'emailOnCritical', label: 'Critical severity findings', desc: 'Immediate notification' },
                              { key: 'emailOnHigh', label: 'High severity findings', desc: 'Immediate notification' },
                              { key: 'emailOnScanComplete', label: 'Scan completion', desc: 'When a scan finishes' },
                              { key: 'emailWeeklyReport', label: 'Weekly summary report', desc: 'Every Monday' },
                            ].map((item) => (
                              <label key={item.key} className="flex items-center justify-between p-4 bg-[var(--bg-secondary)] rounded-lg cursor-pointer">
                                <div>
                                  <p className="text-[var(--text-primary)]">{item.label}</p>
                                  <p className="text-[var(--text-muted)] text-sm">{item.desc}</p>
                                </div>
                                <div
                                  className={`w-12 h-6 rounded-full transition-colors ${
                                    notifications[item.key as keyof typeof notifications] ? 'bg-[var(--accent)]' : 'bg-[var(--bg-tertiary)]'
                                  } relative cursor-pointer`}
                                  onClick={() =>
                                    setNotifications({
                                      ...notifications,
                                      [item.key]: !notifications[item.key as keyof typeof notifications],
                                    })
                                  }
                                >
                                  <div
                                    className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-transform ${
                                      notifications[item.key as keyof typeof notifications] ? 'translate-x-7' : 'translate-x-1'
                                    }`}
                                  />
                                </div>
                              </label>
                            ))}
                          </div>
                        </div>

                        <div>
                          <h3 className="text-sm font-medium text-[var(--text-secondary)] mb-4 flex items-center gap-2">
                            <Slack className="w-4 h-4" />
                            Slack Notifications
                          </h3>
                          <div className="space-y-4">
                            {[
                              { key: 'slackOnCritical', label: 'Critical severity findings' },
                              { key: 'slackOnHigh', label: 'High severity findings' },
                            ].map((item) => (
                              <label key={item.key} className="flex items-center justify-between p-4 bg-[var(--bg-secondary)] rounded-lg cursor-pointer">
                                <p className="text-[var(--text-primary)]">{item.label}</p>
                                <div
                                  className={`w-12 h-6 rounded-full transition-colors ${
                                    notifications[item.key as keyof typeof notifications] ? 'bg-[var(--accent)]' : 'bg-[var(--bg-tertiary)]'
                                  } relative cursor-pointer`}
                                  onClick={() =>
                                    setNotifications({
                                      ...notifications,
                                      [item.key]: !notifications[item.key as keyof typeof notifications],
                                    })
                                  }
                                >
                                  <div
                                    className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-transform ${
                                      notifications[item.key as keyof typeof notifications] ? 'translate-x-7' : 'translate-x-1'
                                    }`}
                                  />
                                </div>
                              </label>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Security Settings */}
                  {activeTab === 'security' && (
                    <div className="space-y-6">
                      <h2 className="text-lg font-semibold text-[var(--text-primary)]">Security Settings</h2>

                      <div className="space-y-6">
                        {/* 2FA hero card */}
                        <div
                          className="relative overflow-hidden rounded-xl border border-[var(--border-color)]"
                          style={{ background: 'var(--bg-secondary)' }}
                        >
                          <div
                            aria-hidden
                            className="pointer-events-none absolute -top-24 -right-24 h-64 w-64 rounded-full blur-3xl"
                            style={{
                              background: security.twoFactorEnabled
                                ? 'radial-gradient(closest-side, rgba(16,185,129,0.25), transparent 70%)'
                                : 'radial-gradient(closest-side, rgba(59,130,246,0.20), transparent 70%)',
                            }}
                          />
                          <div className="relative p-5 flex items-start gap-4">
                            <div
                              className="h-12 w-12 rounded-xl flex items-center justify-center shrink-0"
                              style={{
                                background: security.twoFactorEnabled
                                  ? 'rgba(16,185,129,0.12)'
                                  : 'rgba(59,130,246,0.12)',
                                border: security.twoFactorEnabled
                                  ? '1px solid rgba(16,185,129,0.3)'
                                  : '1px solid rgba(59,130,246,0.3)',
                                color: security.twoFactorEnabled ? '#10b981' : '#3b82f6',
                              }}
                            >
                              <ShieldCheck className="w-6 h-6" />
                            </div>

                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <p className="text-[var(--text-primary)] font-semibold">
                                  Two-Factor Authentication
                                </p>
                                <Badge variant={security.twoFactorEnabled ? 'success' : 'warning'}>
                                  {security.twoFactorEnabled ? 'Enabled' : 'Not set up'}
                                </Badge>
                              </div>
                              <p className="text-[var(--text-muted)] text-sm mt-1 max-w-xl">
                                Protect your account with a second step at sign-in. Even if your password
                                is compromised, attackers won&apos;t be able to get in.
                              </p>

                              <div className="mt-4 flex flex-wrap gap-2">
                                {security.twoFactorEnabled ? (
                                  <>
                                    <Button
                                      variant="secondary"
                                      onClick={() => toast.info('Backup codes', 'Generate these from the MFA setup screen.')}
                                    >
                                      <Download className="w-4 h-4 mr-2" />
                                      View backup codes
                                    </Button>
                                    <Link href="/mfa-setup">
                                      <Button variant="secondary">
                                        <RefreshCw className="w-4 h-4 mr-2" />
                                        Regenerate
                                      </Button>
                                    </Link>
                                    <Button
                                      variant="secondary"
                                      onClick={disableTwoFactor}
                                      className="hover:bg-red-500/10 hover:text-red-500"
                                    >
                                      <X className="w-4 h-4 mr-2" />
                                      Disable
                                    </Button>
                                  </>
                                ) : (
                                  <Link href="/mfa-setup">
                                    <Button>
                                      <ShieldCheck className="w-4 h-4 mr-2" />
                                      Set up two-factor auth
                                      <ArrowRight className="w-4 h-4 ml-2" />
                                    </Button>
                                  </Link>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Available methods */}
                        <div>
                          <h3 className="text-sm font-medium text-[var(--text-secondary)] mb-3">
                            Authentication methods
                          </h3>
                          <div className="space-y-2">
                            <div className="flex items-center justify-between p-4 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border-color)]">
                              <div className="flex items-center gap-3">
                                <div className="h-10 w-10 rounded-lg bg-[var(--bg-tertiary)] flex items-center justify-center">
                                  <Smartphone className="w-5 h-5 text-[var(--text-primary)]" />
                                </div>
                                <div>
                                  <p className="text-sm font-medium text-[var(--text-primary)]">
                                    Authenticator app
                                  </p>
                                  <p className="text-xs text-[var(--text-muted)]">
                                    Use 1Password, Authy, Google Authenticator, etc.
                                  </p>
                                </div>
                              </div>
                              <Badge variant={security.twoFactorEnabled ? 'success' : 'default'}>
                                {security.twoFactorEnabled ? 'Active' : 'Not configured'}
                              </Badge>
                            </div>

                            <div className="flex items-center justify-between p-4 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border-color)]">
                              <div className="flex items-center gap-3">
                                <div className="h-10 w-10 rounded-lg bg-[var(--bg-tertiary)] flex items-center justify-center">
                                  <KeyRound className="w-5 h-5 text-[var(--text-primary)]" />
                                </div>
                                <div>
                                  <p className="text-sm font-medium text-[var(--text-primary)]">
                                    Recovery codes
                                  </p>
                                  <p className="text-xs text-[var(--text-muted)]">
                                    One-time codes to sign in if you lose your device.
                                  </p>
                                </div>
                              </div>
                              <Badge variant={security.twoFactorEnabled ? 'success' : 'default'}>
                                {security.twoFactorEnabled ? 'Available' : 'Not generated'}
                              </Badge>
                            </div>
                          </div>
                        </div>

                        <div>
                          <label className="block text-sm text-[var(--text-muted)] mb-2">Session Timeout (minutes)</label>
                          <Select
                            value={security.sessionTimeout}
                            onChange={(value) => setSecurity({ ...security, sessionTimeout: value })}
                            options={[
                              { value: '15', label: '15 minutes' },
                              { value: '30', label: '30 minutes' },
                              { value: '60', label: '1 hour' },
                              { value: '120', label: '2 hours' },
                              { value: '480', label: '8 hours' },
                            ]}
                          />
                        </div>

                        <div>
                          <label className="block text-sm text-[var(--text-muted)] mb-2">Change Password</label>
                          <div className="space-y-3">
                            <Input type="password" placeholder="Current password" />
                            <Input type="password" placeholder="New password" />
                            <Input type="password" placeholder="Confirm new password" />
                          </div>
                          <Button className="mt-4">Update Password</Button>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Integrations — moved to /integrations (left for type
                      safety; this block is unreachable because the tab
                      is no longer in the `tabs` array). */}
                  {false && (
                    <div className="space-y-6">
                      <h2 className="text-lg font-semibold text-[var(--text-primary)]">Integrations</h2>
                      
                      <p className="text-[var(--text-muted)] text-sm">
                        Connect your accounts to scan private repositories. Your tokens are stored securely and only used for repository access.
                      </p>

                      <div className="space-y-4">
                        {/* GitHub */}
                        <div className="p-4 bg-[var(--bg-secondary)] rounded-lg space-y-4">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-4">
                              <div className="p-3 bg-[var(--bg-tertiary)] rounded-lg">
                                <Github className="w-6 h-6 text-[var(--text-primary)]" />
                              </div>
                              <div>
                                <p className="text-[var(--text-primary)] font-medium">GitHub</p>
                                <p className="text-[var(--text-muted)] text-sm">
                                  {integrations.githubConnected
                                    ? 'Token configured - can scan private repos'
                                    : 'Add a Personal Access Token to scan private repos'}
                                </p>
                              </div>
                            </div>
                            <Badge variant={integrations.githubConnected ? 'success' : 'warning'}>
                              {integrations.githubConnected ? 'Connected' : 'Not connected'}
                            </Badge>
                          </div>
                          
                          {/* GitHub Token Input */}
                          <div className="space-y-2">
                            <label className="block text-sm text-[var(--text-muted)]">
                              Personal Access Token (PAT)
                            </label>
                            <div className="flex gap-2">
                              <div className="relative flex-1">
                                <Input
                                  type={integrations.showGithubToken ? 'text' : 'password'}
                                  value={integrations.githubToken}
                                  onChange={(e) => setIntegrations({ ...integrations, githubToken: e.target.value })}
                                  placeholder="ghp_xxxxxxxxxxxxxxxxxxxx"
                                  className="pr-10"
                                />
                                <button
                                  type="button"
                                  onClick={() => setIntegrations({ ...integrations, showGithubToken: !integrations.showGithubToken })}
                                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                                >
                                  {integrations.showGithubToken ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                </button>
                              </div>
                              <Button 
                                onClick={() => handleSaveToken('github')} 
                                disabled={savingToken || integrations.githubToken === '••••••••••••••••'}
                              >
                                {savingToken ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                                <span className="ml-2">Save</span>
                              </Button>
                            </div>
                            
                            {/* Security actions for configured tokens */}
                            {integrations.githubConnected && (
                              <div className="flex gap-2 pt-2">
                                <Button 
                                  variant="secondary"
                                  onClick={handleValidateToken}
                                  disabled={validatingToken}
                                  className="flex-1"
                                >
                                  {validatingToken ? (
                                    <RefreshCw className="w-4 h-4 animate-spin mr-2" />
                                  ) : (
                                    <Check className="w-4 h-4 mr-2" />
                                  )}
                                  Verify Token
                                </Button>
                                <Button 
                                  variant="secondary"
                                  onClick={() => handleRevokeToken('github')}
                                  disabled={savingToken}
                                  className="flex-1 hover:bg-red-500/10 hover:text-red-500"
                                >
                                  <Trash2 className="w-4 h-4 mr-2" />
                                  Revoke Token
                                </Button>
                              </div>
                            )}
                            
                            <div className="p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
                              <p className="text-xs text-yellow-600 dark:text-yellow-400">
                                <Shield className="w-3 h-3 inline mr-1" />
                                <strong>Security:</strong> Your token is encrypted with AES-256 before storage. 
                                It is never logged, displayed, or transmitted in plaintext.
                              </p>
                            </div>
                            
                            <p className="text-xs text-[var(--text-muted)]">
                              Create a token at{' '}
                              <a 
                                href="https://github.com/settings/tokens/new?scopes=repo&description=VaultSentry" 
                                target="_blank" 
                                rel="noopener noreferrer"
                                className="text-[var(--accent)] hover:underline"
                              >
                                GitHub Settings → Developer settings → Personal access tokens
                              </a>
                              {' '}with <code className="bg-[var(--bg-tertiary)] px-1 rounded">repo</code> scope only.
                            </p>
                          </div>
                        </div>

                        {/* GitLab */}
                        <div className="p-4 bg-[var(--bg-secondary)] rounded-lg space-y-4">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-4">
                              <div className="p-3 bg-orange-500 rounded-lg">
                                <Globe className="w-6 h-6 text-white" />
                              </div>
                              <div>
                                <p className="text-[var(--text-primary)] font-medium">GitLab</p>
                                <p className="text-[var(--text-muted)] text-sm">
                                  {integrations.gitlabConnected
                                    ? 'Token configured - can scan private repos'
                                    : 'Add a Personal Access Token to scan private repos'}
                                </p>
                              </div>
                            </div>
                            <Badge variant={integrations.gitlabConnected ? 'success' : 'warning'}>
                              {integrations.gitlabConnected ? 'Connected' : 'Not connected'}
                            </Badge>
                          </div>
                          
                          {/* GitLab Token Input */}
                          <div className="space-y-2">
                            <label className="block text-sm text-[var(--text-muted)]">
                              Personal Access Token
                            </label>
                            <div className="flex gap-2">
                              <div className="relative flex-1">
                                <Input
                                  type={integrations.showGitlabToken ? 'text' : 'password'}
                                  value={integrations.gitlabToken}
                                  onChange={(e) => setIntegrations({ ...integrations, gitlabToken: e.target.value })}
                                  placeholder="glpat-xxxxxxxxxxxxxxxxxxxx"
                                  className="pr-10"
                                />
                                <button
                                  type="button"
                                  onClick={() => setIntegrations({ ...integrations, showGitlabToken: !integrations.showGitlabToken })}
                                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                                >
                                  {integrations.showGitlabToken ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                </button>
                              </div>
                              <Button 
                                onClick={() => handleSaveToken('gitlab')} 
                                disabled={savingToken}
                              >
                                {savingToken ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                                <span className="ml-2">Save</span>
                              </Button>
                            </div>
                            <p className="text-xs text-[var(--text-muted)]">
                              Create a token at{' '}
                              <a 
                                href="https://gitlab.com/-/profile/personal_access_tokens" 
                                target="_blank" 
                                rel="noopener noreferrer"
                                className="text-[var(--accent)] hover:underline"
                              >
                                GitLab → Preferences → Access Tokens
                              </a>
                              {' '}with <code className="bg-[var(--bg-tertiary)] px-1 rounded">read_repository</code> scope.
                            </p>
                          </div>
                        </div>

                        {/* Slack */}
                        <div className="p-4 bg-[var(--bg-secondary)] rounded-lg flex items-center justify-between">
                          <div className="flex items-center gap-4">
                            <div className="p-3 bg-purple-500 rounded-lg">
                              <Slack className="w-6 h-6 text-white" />
                            </div>
                            <div>
                              <p className="text-[var(--text-primary)] font-medium">Slack</p>
                              <p className="text-[var(--text-muted)] text-sm">
                                {integrations.slackConnected
                                  ? `Connected to ${integrations.slackWorkspace}`
                                  : 'Not connected'}
                              </p>
                            </div>
                          </div>
                          <Button variant={integrations.slackConnected ? 'secondary' : 'primary'}>
                            {integrations.slackConnected ? 'Disconnect' : 'Connect'}
                          </Button>
                        </div>

                        {/* AWS */}
                        <div className="p-4 bg-[var(--bg-secondary)] rounded-lg flex items-center justify-between">
                          <div className="flex items-center gap-4">
                            <div className="p-3 bg-yellow-500 rounded-lg">
                              <Database className="w-6 h-6 text-white" />
                            </div>
                            <div>
                              <p className="text-[var(--text-primary)] font-medium">AWS S3</p>
                              <p className="text-[var(--text-muted)] text-sm">
                                {integrations.awsConnected ? 'Connected' : 'Not connected'}
                              </p>
                            </div>
                          </div>
                          <Button variant={integrations.awsConnected ? 'secondary' : 'primary'}>
                            {integrations.awsConnected ? 'Disconnect' : 'Configure'}
                          </Button>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* API Keys */}
                  {activeTab === 'api' && (
                    <div className="space-y-6">
                      <div className="flex items-center justify-between">
                        <h2 className="text-lg font-semibold text-[var(--text-primary)]">API Keys</h2>
                        <Button onClick={handleGenerateApiKey}>
                          <Plus className="w-4 h-4 mr-2" />
                          Generate New Key
                        </Button>
                      </div>

                      <p className="text-[var(--text-muted)] text-sm">
                        Use API keys to authenticate with the Vault Sentry API. Keep your keys secure and never share them publicly.
                      </p>

                      <div className="space-y-4">
                        {apiKeys.map((apiKey) => (
                          <div key={apiKey.id} className="p-4 bg-[var(--bg-secondary)] rounded-lg">
                            <div className="flex items-center justify-between mb-3">
                              <div>
                                <p className="text-[var(--text-primary)] font-medium">{apiKey.name}</p>
                                <p className="text-[var(--text-muted)] text-xs">Created {apiKey.created} • Last used {apiKey.lastUsed}</p>
                              </div>
                              <div className="flex items-center gap-2">
                                <button
                                  onClick={() => setShowApiKey(showApiKey === apiKey.id ? null : apiKey.id)}
                                  className="p-2 rounded-lg hover:bg-[var(--bg-tertiary)] transition-colors"
                                >
                                  {showApiKey === apiKey.id ? (
                                    <EyeOff className="w-4 h-4 text-[var(--text-muted)]" />
                                  ) : (
                                    <Eye className="w-4 h-4 text-[var(--text-muted)]" />
                                  )}
                                </button>
                                <button
                                  onClick={() => copyToClipboard(apiKey.key)}
                                  className="p-2 rounded-lg hover:bg-[var(--bg-tertiary)] transition-colors"
                                >
                                  <Copy className="w-4 h-4 text-[var(--text-muted)]" />
                                </button>
                                <button
                                  onClick={() => handleDeleteApiKey(apiKey.id)}
                                  className="p-2 rounded-lg hover:bg-[var(--bg-tertiary)] transition-colors"
                                >
                                  <Trash2 className="w-4 h-4 text-red-400" />
                                </button>
                              </div>
                            </div>
                            <code className="text-sm text-[var(--text-secondary)] bg-[var(--bg-tertiary)] px-3 py-2 rounded block font-mono">
                              {showApiKey === apiKey.id ? apiKey.key : apiKey.key.replace(/./g, '•')}
                            </code>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Advanced Settings */}
                  {activeTab === 'advanced' && (
                    <div className="space-y-6">
                      <h2 className="text-lg font-semibold text-[var(--text-primary)]">Advanced Settings</h2>

                      <div className="space-y-6">
                        <div>
                          <label className="block text-sm text-[var(--text-muted)] mb-2">Default Scan Severity Threshold</label>
                          <Select
                            options={[
                              { value: 'critical', label: 'Critical only' },
                              { value: 'high', label: 'High and above' },
                              { value: 'medium', label: 'Medium and above' },
                              { value: 'low', label: 'All severities' },
                            ]}
                          />
                        </div>

                        <div>
                          <label className="block text-sm text-[var(--text-muted)] mb-2">Maximum File Size (MB)</label>
                          <Input type="number" defaultValue="10" min="1" max="100" />
                        </div>

                        <div>
                          <label className="block text-sm text-[var(--text-muted)] mb-2">Custom Ignore Patterns (one per line)</label>
                          <textarea
                            className="w-full px-4 py-3 bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-lg text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none focus:border-[var(--accent)] resize-y min-h-[120px] font-mono text-sm"
                            placeholder={`node_modules/\n.git/\n*.min.js\ncoverage/`}
                          />
                        </div>

                        <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-lg">
                          <h3 className="text-red-400 font-medium mb-2">Danger Zone</h3>
                          <p className="text-[var(--text-muted)] text-sm mb-4">
                            These actions are irreversible. Please proceed with caution.
                          </p>
                          <div className="flex gap-3">
                            <Button variant="danger">Delete All Scan History</Button>
                            <Button variant="danger">Delete Account</Button>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Save Button */}
                  <div className="flex justify-end pt-6 border-t border-[var(--border-color)] mt-6">
                    <Button onClick={handleSave} disabled={saving}>
                      {saving ? (
                        <>
                          <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                          Saving...
                        </>
                      ) : (
                        <>
                          <Save className="w-4 h-4 mr-2" />
                          Save Changes
                        </>
                      )}
                    </Button>
                  </div>
                </Card>
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  )
}
