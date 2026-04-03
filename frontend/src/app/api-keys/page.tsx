'use client'

import Header from '@/components/layout/Header'
import Sidebar from '@/components/layout/Sidebar'
import { Badge, Button, Card, Modal, Skeleton } from '@/components/ui'
import { useToast } from '@/contexts/ToastContext'
import {
    AlertTriangle,
    Calendar,
    Clock,
    Copy,
    Eye,
    EyeOff,
    Key,
    Plus,
    Shield,
    Trash2
} from 'lucide-react'
import { useEffect, useState } from 'react'

interface ApiKey {
  id: number
  name: string
  key: string
  prefix: string
  permissions: string[]
  status: 'active' | 'revoked' | 'expired'
  last_used: string | null
  expires_at: string | null
  created_at: string
  created_by: string
}

const DEMO_API_KEYS: ApiKey[] = [
  {
    id: 1,
    name: 'CI/CD Pipeline',
    key: 'demo_key_xxxxxxxxxxxxxxxxxxxxxxxxxxxx',
    prefix: 'demo_key_',
    permissions: ['scan:read', 'scan:write', 'repo:read'],
    status: 'active',
    last_used: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
    expires_at: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(),
    created_at: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
    created_by: 'demo@VaultSentry.io',
  },
  {
    id: 2,
    name: 'GitHub Integration',
    key: 'demo_key_yyyyyyyyyyyyyyyyyyyyyyyyyyyy',
    prefix: 'demo_key_',
    permissions: ['scan:read', 'scan:write', 'repo:read', 'repo:write', 'webhook:write'],
    status: 'active',
    last_used: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
    expires_at: null,
    created_at: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString(),
    created_by: 'admin@acme.com',
  },
  {
    id: 3,
    name: 'Monitoring Dashboard',
    key: 'demo_key_zzzzzzzzzzzzzzzzzzzzzzzzzzzz',
    prefix: 'demo_key_',
    permissions: ['scan:read', 'secret:read', 'report:read'],
    status: 'active',
    last_used: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
    expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    created_at: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString(),
    created_by: 'demo@VaultSentry.io',
  },
  {
    id: 4,
    name: 'Old CLI Token',
    key: 'demo_key_oldtoken00000000000000000000',
    prefix: 'demo_key_',
    permissions: ['scan:read', 'scan:write'],
    status: 'revoked',
    last_used: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString(),
    expires_at: null,
    created_at: new Date(Date.now() - 180 * 24 * 60 * 60 * 1000).toISOString(),
    created_by: 'admin@acme.com',
  },
]

const AVAILABLE_PERMISSIONS = [
  { id: 'scan:read', label: 'View Scans', description: 'Read scan history and results' },
  { id: 'scan:write', label: 'Run Scans', description: 'Trigger new scans' },
  { id: 'repo:read', label: 'View Repos', description: 'List repositories' },
  { id: 'repo:write', label: 'Manage Repos', description: 'Add/remove repositories' },
  { id: 'secret:read', label: 'View Secrets', description: 'View detected secrets' },
  { id: 'secret:write', label: 'Manage Secrets', description: 'Resolve/ignore secrets' },
  { id: 'report:read', label: 'View Reports', description: 'Download reports' },
  { id: 'report:write', label: 'Generate Reports', description: 'Create new reports' },
  { id: 'webhook:write', label: 'Webhooks', description: 'Manage webhooks' },
]

export default function ApiKeysPage() {
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showKeyModal, setShowKeyModal] = useState(false)
  const [newKey, setNewKey] = useState<string | null>(null)
  const [newKeyName, setNewKeyName] = useState('')
  const [selectedPermissions, setSelectedPermissions] = useState<string[]>(['scan:read', 'scan:write'])
  const [expiresIn, setExpiresIn] = useState<string>('90')
  const [visibleKeys, setVisibleKeys] = useState<Set<number>>(new Set())
  const toast = useToast()

  useEffect(() => {
    setApiKeys(DEMO_API_KEYS)
    setLoading(false)
  }, [])

  const generateRandomKey = () => {
    const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
    let key = 'demo_key_'
    for (let i = 0; i < 32; i++) {
      key += chars.charAt(Math.floor(Math.random() * chars.length))
    }
    return key
  }

  const handleCreateKey = () => {
    if (!newKeyName) {
      toast.error('Name required', 'Please enter a name for your API key')
      return
    }

    const key = generateRandomKey()
    const newApiKey: ApiKey = {
      id: Date.now(),
      name: newKeyName,
      key: key,
      prefix: 'demo_key_',
      permissions: selectedPermissions,
      status: 'active',
      last_used: null,
      expires_at: expiresIn !== 'never' 
        ? new Date(Date.now() + parseInt(expiresIn) * 24 * 60 * 60 * 1000).toISOString()
        : null,
      created_at: new Date().toISOString(),
      created_by: 'demo@VaultSentry.io',
    }

    setApiKeys([newApiKey, ...apiKeys])
    setNewKey(key)
    setShowCreateModal(false)
    setShowKeyModal(true)
    setNewKeyName('')
    setSelectedPermissions(['scan:read', 'scan:write'])
  }

  const handleRevokeKey = (keyId: number) => {
    setApiKeys(apiKeys.map(k => 
      k.id === keyId ? { ...k, status: 'revoked' as const } : k
    ))
    toast.success('API key revoked')
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
    toast.success('Copied to clipboard')
  }

  const toggleKeyVisibility = (keyId: number) => {
    setVisibleKeys(prev => {
      const next = new Set(prev)
      if (next.has(keyId)) {
        next.delete(keyId)
      } else {
        next.add(keyId)
      }
      return next
    })
  }

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return 'Never'
    const date = new Date(dateStr)
    const now = new Date()
    const diff = now.getTime() - date.getTime()
    
    if (diff < 0) {
      const days = Math.ceil(Math.abs(diff) / (24 * 60 * 60 * 1000))
      return `in ${days} days`
    }
    if (diff < 3600000) return 'Just now'
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`
    return date.toLocaleDateString()
  }

  const maskKey = (key: string) => {
    return key.substring(0, 12) + '••••••••••••••••••••'
  }

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: 'var(--bg-primary)' }}>
      <Sidebar isOpen={sidebarOpen} onToggle={() => setSidebarOpen(!sidebarOpen)} />
      
      <div className="flex-1 flex flex-col min-w-0">
        <Header onMenuClick={() => setSidebarOpen(!sidebarOpen)} alertCount={0} />
        
        <main className="flex-1 overflow-y-auto overflow-x-hidden" style={{ background: 'var(--bg-primary)' }}>
          <div className="max-w-[1200px] mx-auto px-6 py-6 space-y-6">
            {/* Header */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
              <div>
                <h1 className="text-2xl font-bold text-[var(--text-primary)] flex items-center gap-3">
                  <Key className="w-7 h-7 text-blue-400" />
                  API Keys
                </h1>
                <p className="text-[var(--text-muted)] mt-1">Manage API keys for integrations and automation</p>
              </div>
              <Button 
                variant="primary" 
                leftIcon={<Plus className="w-4 h-4" />}
                onClick={() => setShowCreateModal(true)}
              >
                Create API Key
              </Button>
            </div>

            {/* Warning Banner */}
            <Card className="p-4 border-yellow-500/30 bg-yellow-500/10">
              <div className="flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-yellow-400 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium text-[var(--text-primary)]">Keep your API keys secure</p>
                  <p className="text-sm text-[var(--text-muted)] mt-1">
                    Never commit API keys to your repositories. Use environment variables and secret managers.
                  </p>
                </div>
              </div>
            </Card>

            {/* Stats */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card className="p-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-green-500/20 flex items-center justify-center">
                    <Key className="w-5 h-5 text-green-400" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-[var(--text-primary)]">{apiKeys.filter(k => k.status === 'active').length}</p>
                    <p className="text-xs text-[var(--text-muted)]">Active Keys</p>
                  </div>
                </div>
              </Card>
              <Card className="p-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-red-500/20 flex items-center justify-center">
                    <Shield className="w-5 h-5 text-red-400" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-[var(--text-primary)]">{apiKeys.filter(k => k.status === 'revoked').length}</p>
                    <p className="text-xs text-[var(--text-muted)]">Revoked</p>
                  </div>
                </div>
              </Card>
              <Card className="p-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-blue-500/20 flex items-center justify-center">
                    <Clock className="w-5 h-5 text-blue-400" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-[var(--text-primary)]">
                      {apiKeys.filter(k => k.last_used && new Date(k.last_used) > new Date(Date.now() - 24 * 60 * 60 * 1000)).length}
                    </p>
                    <p className="text-xs text-[var(--text-muted)]">Used Today</p>
                  </div>
                </div>
              </Card>
            </div>

            {/* API Keys List */}
            <Card>
              <Card.Header title="Your API Keys" description="Manage access tokens for the Vault Sentry API" />
              
              {loading ? (
                <div className="p-6"><Skeleton.Table rows={4} columns={5} /></div>
              ) : apiKeys.length === 0 ? (
                <div className="text-center py-12">
                  <Key className="w-12 h-12 text-[var(--text-muted)] mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-[var(--text-secondary)]">No API keys yet</h3>
                  <p className="text-[var(--text-muted)] mb-4">Create your first API key to get started</p>
                  <Button variant="primary" leftIcon={<Plus className="w-4 h-4" />} onClick={() => setShowCreateModal(true)}>
                    Create API Key
                  </Button>
                </div>
              ) : (
                <div className="divide-y divide-[var(--border-color)]">
                  {apiKeys.map(apiKey => (
                    <div key={apiKey.id} className="p-4 hover:bg-[var(--bg-secondary)]/50 transition-colors">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <h3 className="font-semibold text-[var(--text-primary)]">{apiKey.name}</h3>
                            <Badge 
                              variant={apiKey.status === 'active' ? 'success' : 'critical'}
                              size="sm"
                            >
                              {apiKey.status}
                            </Badge>
                          </div>
                          
                          <div className="flex items-center gap-2 mb-3">
                            <code className="px-2 py-1 bg-[var(--bg-tertiary)] rounded text-sm font-mono text-[var(--text-secondary)]">
                              {visibleKeys.has(apiKey.id) ? apiKey.key : maskKey(apiKey.key)}
                            </code>
                            <button
                              onClick={() => toggleKeyVisibility(apiKey.id)}
                              className="p-1 rounded hover:bg-[var(--bg-tertiary)] text-[var(--text-muted)]"
                            >
                              {visibleKeys.has(apiKey.id) ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                            </button>
                            <button
                              onClick={() => copyToClipboard(apiKey.key)}
                              className="p-1 rounded hover:bg-[var(--bg-tertiary)] text-[var(--text-muted)]"
                            >
                              <Copy className="w-4 h-4" />
                            </button>
                          </div>

                          <div className="flex flex-wrap gap-1 mb-3">
                            {apiKey.permissions.map(perm => (
                              <span key={perm} className="px-2 py-0.5 bg-[var(--bg-tertiary)] rounded text-xs text-[var(--text-muted)]">
                                {perm}
                              </span>
                            ))}
                          </div>

                          <div className="flex items-center gap-4 text-xs text-[var(--text-muted)]">
                            <span className="flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              Last used: {formatDate(apiKey.last_used)}
                            </span>
                            <span className="flex items-center gap-1">
                              <Calendar className="w-3 h-3" />
                              Expires: {apiKey.expires_at ? formatDate(apiKey.expires_at) : 'Never'}
                            </span>
                          </div>
                        </div>

                        {apiKey.status === 'active' && (
                          <Button
                            variant="danger"
                            size="sm"
                            leftIcon={<Trash2 className="w-4 h-4" />}
                            onClick={() => handleRevokeKey(apiKey.id)}
                          >
                            Revoke
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </div>
        </main>
      </div>

      {/* Create Modal */}
      <Modal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        title="Create API Key"
        description="Generate a new API key for integrations"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-[var(--text-secondary)] mb-2">Key Name</label>
            <input
              type="text"
              placeholder="e.g., CI/CD Pipeline"
              value={newKeyName}
              onChange={(e) => setNewKeyName(e.target.value)}
              className="w-full px-4 py-2 rounded-lg bg-[var(--bg-tertiary)] border border-[var(--border-color)] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-blue-500/50"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-[var(--text-secondary)] mb-2">Expiration</label>
            <select
              value={expiresIn}
              onChange={(e) => setExpiresIn(e.target.value)}
              className="w-full px-4 py-2 rounded-lg bg-[var(--bg-tertiary)] border border-[var(--border-color)] text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-blue-500/50"
            >
              <option value="30">30 days</option>
              <option value="90">90 days</option>
              <option value="365">1 year</option>
              <option value="never">Never</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-[var(--text-secondary)] mb-2">Permissions</label>
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {AVAILABLE_PERMISSIONS.map(perm => (
                <label key={perm.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-[var(--bg-tertiary)] cursor-pointer">
                  <input
                    type="checkbox"
                    checked={selectedPermissions.includes(perm.id)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSelectedPermissions([...selectedPermissions, perm.id])
                      } else {
                        setSelectedPermissions(selectedPermissions.filter(p => p !== perm.id))
                      }
                    }}
                    className="w-4 h-4 rounded border-[var(--border-color)] text-blue-500 focus:ring-blue-500"
                  />
                  <div>
                    <p className="text-sm font-medium text-[var(--text-primary)]">{perm.label}</p>
                    <p className="text-xs text-[var(--text-muted)]">{perm.description}</p>
                  </div>
                </label>
              ))}
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-[var(--border-color)]">
            <Button variant="ghost" onClick={() => setShowCreateModal(false)}>Cancel</Button>
            <Button variant="primary" leftIcon={<Key className="w-4 h-4" />} onClick={handleCreateKey}>
              Create Key
            </Button>
          </div>
        </div>
      </Modal>

      {/* New Key Modal */}
      <Modal
        isOpen={showKeyModal}
        onClose={() => {
          setShowKeyModal(false)
          setNewKey(null)
        }}
        title="API Key Created"
        description="Copy your new API key now - it won't be shown again!"
      >
        <div className="space-y-4">
          <div className="p-4 bg-green-500/10 border border-green-500/30 rounded-lg">
            <p className="text-sm text-green-400 mb-2">Your new API key:</p>
            <div className="flex items-center gap-2">
              <code className="flex-1 p-3 bg-[var(--bg-tertiary)] rounded font-mono text-sm text-[var(--text-primary)] break-all">
                {newKey}
              </code>
              <Button variant="ghost" size="sm" leftIcon={<Copy className="w-4 h-4" />} onClick={() => copyToClipboard(newKey || '')}>
                Copy
              </Button>
            </div>
          </div>

          <div className="p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
            <div className="flex items-start gap-2">
              <AlertTriangle className="w-5 h-5 text-yellow-400 flex-shrink-0" />
              <p className="text-sm text-[var(--text-secondary)]">
                Make sure to copy your API key now. You won't be able to see it again!
              </p>
            </div>
          </div>

          <div className="flex justify-end pt-4 border-t border-[var(--border-color)]">
            <Button variant="primary" onClick={() => {
              setShowKeyModal(false)
              setNewKey(null)
            }}>
              Done
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
