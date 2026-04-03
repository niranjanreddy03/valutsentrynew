'use client'

import { useState, useEffect } from 'react'
import Sidebar from '@/components/layout/Sidebar'
import Header from '@/components/layout/Header'
import { Button, Card, Input, Select, Badge } from '@/components/ui'
import { useToast } from '@/contexts/ToastContext'
import { policyService, Policy, PolicyCondition } from '@/services/api'
import {
  Shield,
  Plus,
  Edit2,
  Trash2,
  Save,
  X,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Zap,
  Users,
  Target,
  Filter,
  Search,
  ChevronDown,
  ChevronRight,
  Play,
  Pause,
  Copy,
  MoreVertical,
  FileText,
  Bell,
  RotateCcw
} from 'lucide-react'

type ActionType = 'alert' | 'block_pr' | 'jira_ticket' | 'slack_notify' | 'auto_rotate' | 'assign_team'

interface PolicyAction {
  type: ActionType
  config?: Record<string, any>
}

interface LocalPolicy {
  id: string
  name: string
  description: string
  enabled: boolean
  priority: number
  conditions: PolicyCondition[]
  actions: PolicyAction[]
  created_at?: string
  updated_at?: string
}

const actionConfig: Record<ActionType, { label: string; icon: any; color: string }> = {
  alert: { label: 'Send Alert', icon: Bell, color: 'text-amber-400' },
  block_pr: { label: 'Block PR', icon: Pause, color: 'text-red-400' },
  jira_ticket: { label: 'Create Jira Ticket', icon: FileText, color: 'text-blue-400' },
  slack_notify: { label: 'Slack Notification', icon: Bell, color: 'text-purple-400' },
  auto_rotate: { label: 'Auto-Rotate', icon: RotateCcw, color: 'text-emerald-400' },
  assign_team: { label: 'Assign Team', icon: Users, color: 'text-cyan-400' },
}

const conditionFields = [
  { value: 'secret_type', label: 'Secret Type' },
  { value: 'risk_level', label: 'Risk Level' },
  { value: 'ml_risk_score', label: 'ML Risk Score' },
  { value: 'environment', label: 'Environment' },
  { value: 'repository', label: 'Repository' },
  { value: 'file_path', label: 'File Path' },
  { value: 'age_days', label: 'Age (Days)' },
]

const conditionOperators = [
  { value: 'equals', label: 'Equals' },
  { value: 'not_equals', label: 'Not Equals' },
  { value: 'contains', label: 'Contains' },
  { value: 'gt', label: 'Greater Than' },
  { value: 'lt', label: 'Less Than' },
  { value: 'in', label: 'In List' },
  { value: 'regex', label: 'Matches Regex' },
]

// Default policies from backend
const defaultPolicies: LocalPolicy[] = [
  {
    id: 'policy-1',
    name: 'Critical Secret Alert',
    description: 'Immediately alert on critical secrets in production',
    enabled: true,
    priority: 100,
    conditions: [
      { field: 'risk_level', operator: 'equals', value: 'critical' },
      { field: 'environment', operator: 'equals', value: 'production' },
    ],
    actions: [
      { type: 'alert' },
      { type: 'slack_notify', config: { channel: '#security-alerts' } },
      { type: 'jira_ticket', config: { priority: 'P1' } },
    ],
  },
  {
    id: 'policy-2',
    name: 'Block PR on High-Risk Secrets',
    description: 'Prevent merging PRs with high or critical secrets',
    enabled: true,
    priority: 90,
    conditions: [
      { field: 'risk_level', operator: 'in', value: 'critical,high' },
    ],
    actions: [
      { type: 'block_pr' },
      { type: 'alert' },
    ],
  },
  {
    id: 'policy-3',
    name: 'Auto-Rotate AWS Keys',
    description: 'Automatically rotate exposed AWS credentials',
    enabled: false,
    priority: 80,
    conditions: [
      { field: 'secret_type', operator: 'contains', value: 'aws' },
      { field: 'risk_level', operator: 'in', value: 'critical,high' },
    ],
    actions: [
      { type: 'auto_rotate', config: { provider: 'aws' } },
      { type: 'slack_notify' },
    ],
  },
  {
    id: 'policy-4',
    name: 'Stale Secret Escalation',
    description: 'Escalate secrets older than 7 days',
    enabled: true,
    priority: 70,
    conditions: [
      { field: 'age_days', operator: 'gt', value: '7' },
      { field: 'risk_level', operator: 'in', value: 'critical,high' },
    ],
    actions: [
      { type: 'assign_team', config: { team: 'security-oncall' } },
      { type: 'jira_ticket', config: { priority: 'P2' } },
    ],
  },
]

export default function PoliciesPage() {
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [policies, setPolicies] = useState<LocalPolicy[]>(defaultPolicies)
  const [searchQuery, setSearchQuery] = useState('')
  const [expandedPolicy, setExpandedPolicy] = useState<string | null>(null)
  const [editingPolicy, setEditingPolicy] = useState<LocalPolicy | null>(null)
  const [isCreating, setIsCreating] = useState(false)
  const [loading, setLoading] = useState(false)
  const toast = useToast()

  const filteredPolicies = policies.filter(p => 
    p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.description.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const togglePolicy = (id: string) => {
    setPolicies(prev => prev.map(p => 
      p.id === id ? { ...p, enabled: !p.enabled } : p
    ))
    toast.success('Policy status updated')
  }

  const deletePolicy = (id: string) => {
    setPolicies(prev => prev.filter(p => p.id !== id))
    toast.success('Policy deleted')
  }

  const duplicatePolicy = (policy: LocalPolicy) => {
    const newPolicy: LocalPolicy = {
      ...policy,
      id: `policy-${Date.now()}`,
      name: `${policy.name} (Copy)`,
      enabled: false,
    }
    setPolicies(prev => [...prev, newPolicy])
    toast.success('Policy duplicated')
  }

  const savePolicy = (policy: LocalPolicy) => {
    if (isCreating) {
      setPolicies(prev => [...prev, { ...policy, id: `policy-${Date.now()}` }])
      toast.success('Policy created')
    } else {
      setPolicies(prev => prev.map(p => p.id === policy.id ? policy : p))
      toast.success('Policy saved')
    }
    setEditingPolicy(null)
    setIsCreating(false)
  }

  const startCreate = () => {
    setIsCreating(true)
    setEditingPolicy({
      id: '',
      name: '',
      description: '',
      enabled: true,
      priority: 50,
      conditions: [],
      actions: [],
    })
  }

  return (
    <div className="flex h-screen bg-[var(--bg-primary)]">
      <Sidebar isOpen={sidebarOpen} onToggle={() => setSidebarOpen(!sidebarOpen)} />
      
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header onMenuClick={() => setSidebarOpen(!sidebarOpen)} alertCount={0} />
        
        <main className="flex-1 overflow-auto p-6">
          {/* Page Header */}
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-2xl font-bold text-[var(--text-primary)]">Security Policies</h1>
              <p className="text-[var(--text-muted)] mt-1">
                Configure automated actions based on secret detection rules
              </p>
            </div>
            <Button onClick={startCreate}>
              <Plus className="w-4 h-4 mr-2" />
              Create Policy
            </Button>
          </div>

          {/* Search & Stats */}
          <div className="flex items-center gap-4 mb-6">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)]" />
              <input
                type="text"
                placeholder="Search policies..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-[var(--bg-tertiary)] border border-[var(--border-color)] rounded-lg text-sm text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none focus:border-[var(--accent)]/50"
              />
            </div>
            <div className="flex items-center gap-4 text-sm">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-emerald-400"></div>
                <span className="text-[var(--text-muted)]">{policies.filter(p => p.enabled).length} Active</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-gray-400"></div>
                <span className="text-[var(--text-muted)]">{policies.filter(p => !p.enabled).length} Disabled</span>
              </div>
            </div>
          </div>

          {/* Policy List */}
          <div className="space-y-3">
            {filteredPolicies.map((policy) => {
              const isExpanded = expandedPolicy === policy.id
              
              return (
                <div 
                  key={policy.id}
                  className={`card border ${policy.enabled ? 'border-[var(--border-color)]' : 'border-[var(--border-color)]/50 opacity-70'}`}
                >
                  {/* Policy Header */}
                  <div 
                    className="flex items-center gap-4 cursor-pointer"
                    onClick={() => setExpandedPolicy(isExpanded ? null : policy.id)}
                  >
                    <button className="text-[var(--text-muted)]">
                      {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                    </button>
                    
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                      policy.enabled ? 'bg-emerald-500/20' : 'bg-gray-500/20'
                    }`}>
                      <Shield className={`w-5 h-5 ${policy.enabled ? 'text-emerald-400' : 'text-gray-400'}`} />
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="font-medium text-[var(--text-primary)]">{policy.name}</h3>
                        <Badge variant={policy.enabled ? 'success' : 'default'}>
                          {policy.enabled ? 'Active' : 'Disabled'}
                        </Badge>
                        <span className="text-xs text-[var(--text-muted)] bg-[var(--bg-tertiary)] px-2 py-0.5 rounded">
                          Priority: {policy.priority}
                        </span>
                      </div>
                      <p className="text-sm text-[var(--text-muted)] truncate">{policy.description}</p>
                    </div>

                    {/* Quick Actions */}
                    <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center gap-1">
                        {policy.actions.slice(0, 3).map((action, i) => {
                          const config = actionConfig[action.type]
                          const Icon = config.icon
                          return (
                            <div 
                              key={i}
                              className="p-1.5 bg-[var(--bg-tertiary)] rounded"
                              title={config.label}
                            >
                              <Icon className={`w-3.5 h-3.5 ${config.color}`} />
                            </div>
                          )
                        })}
                        {policy.actions.length > 3 && (
                          <span className="text-xs text-[var(--text-muted)]">+{policy.actions.length - 3}</span>
                        )}
                      </div>
                      
                      <button
                        onClick={() => togglePolicy(policy.id)}
                        className={`p-2 rounded-lg transition-colors ${
                          policy.enabled 
                            ? 'bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30' 
                            : 'bg-[var(--bg-tertiary)] text-[var(--text-muted)] hover:text-[var(--text-primary)]'
                        }`}
                        title={policy.enabled ? 'Disable' : 'Enable'}
                      >
                        {policy.enabled ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                      </button>
                      
                      <button
                        onClick={() => setEditingPolicy(policy)}
                        className="p-2 rounded-lg bg-[var(--bg-tertiary)] text-[var(--text-muted)] hover:text-[var(--accent)] transition-colors"
                        title="Edit"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      
                      <button
                        onClick={() => duplicatePolicy(policy)}
                        className="p-2 rounded-lg bg-[var(--bg-tertiary)] text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
                        title="Duplicate"
                      >
                        <Copy className="w-4 h-4" />
                      </button>
                      
                      <button
                        onClick={() => deletePolicy(policy.id)}
                        className="p-2 rounded-lg bg-[var(--bg-tertiary)] text-[var(--text-muted)] hover:text-red-400 transition-colors"
                        title="Delete"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Expanded Details */}
                  {isExpanded && (
                    <div className="mt-4 pt-4 border-t border-[var(--border-color)] space-y-4">
                      {/* Conditions */}
                      <div>
                        <h4 className="text-sm font-medium text-[var(--text-primary)] mb-2 flex items-center gap-2">
                          <Filter className="w-4 h-4 text-[var(--accent)]" />
                          Conditions (ALL must match)
                        </h4>
                        <div className="flex flex-wrap gap-2">
                          {policy.conditions.map((cond, i) => (
                            <div 
                              key={i}
                              className="flex items-center gap-2 px-3 py-1.5 bg-[var(--bg-tertiary)] rounded-lg text-sm"
                            >
                              <span className="text-[var(--accent)] font-medium">{cond.field}</span>
                              <span className="text-[var(--text-muted)]">{cond.operator}</span>
                              <span className="text-[var(--text-primary)]">{String(cond.value)}</span>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Actions */}
                      <div>
                        <h4 className="text-sm font-medium text-[var(--text-primary)] mb-2 flex items-center gap-2">
                          <Zap className="w-4 h-4 text-amber-400" />
                          Actions
                        </h4>
                        <div className="flex flex-wrap gap-2">
                          {policy.actions.map((action, i) => {
                            const config = actionConfig[action.type]
                            const Icon = config.icon
                            return (
                              <div 
                                key={i}
                                className="flex items-center gap-2 px-3 py-1.5 bg-[var(--bg-tertiary)] rounded-lg text-sm"
                              >
                                <Icon className={`w-4 h-4 ${config.color}`} />
                                <span className="text-[var(--text-primary)]">{config.label}</span>
                                {action.config && Object.keys(action.config).length > 0 && (
                                  <span className="text-xs text-[var(--text-muted)]">
                                    ({Object.entries(action.config).map(([k, v]) => `${k}: ${v}`).join(', ')})
                                  </span>
                                )}
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          {/* Empty State */}
          {filteredPolicies.length === 0 && (
            <div className="text-center py-12">
              <Shield className="w-12 h-12 text-[var(--text-muted)] mx-auto mb-4" />
              <p className="text-[var(--text-muted)]">No policies found</p>
              <Button onClick={startCreate} className="mt-4">
                <Plus className="w-4 h-4 mr-2" />
                Create Your First Policy
              </Button>
            </div>
          )}
        </main>
      </div>

      {/* Edit/Create Modal */}
      {editingPolicy && (
        <PolicyEditor
          policy={editingPolicy}
          isCreating={isCreating}
          onSave={savePolicy}
          onCancel={() => { setEditingPolicy(null); setIsCreating(false); }}
        />
      )}
    </div>
  )
}

interface PolicyEditorProps {
  policy: LocalPolicy
  isCreating: boolean
  onSave: (policy: LocalPolicy) => void
  onCancel: () => void
}

function PolicyEditor({ policy, isCreating, onSave, onCancel }: PolicyEditorProps) {
  const [localPolicy, setLocalPolicy] = useState<LocalPolicy>(policy)

  const addCondition = () => {
    setLocalPolicy(prev => ({
      ...prev,
      conditions: [...prev.conditions, { field: 'secret_type', operator: 'equals', value: '' }]
    }))
  }

  const updateCondition = (index: number, updates: Partial<PolicyCondition>) => {
    setLocalPolicy(prev => ({
      ...prev,
      conditions: prev.conditions.map((c, i) => i === index ? { ...c, ...updates } : c)
    }))
  }

  const removeCondition = (index: number) => {
    setLocalPolicy(prev => ({
      ...prev,
      conditions: prev.conditions.filter((_, i) => i !== index)
    }))
  }

  const toggleAction = (type: ActionType) => {
    setLocalPolicy(prev => {
      const hasAction = prev.actions.some(a => a.type === type)
      if (hasAction) {
        return { ...prev, actions: prev.actions.filter(a => a.type !== type) }
      } else {
        return { ...prev, actions: [...prev.actions, { type }] }
      }
    })
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-[var(--bg-secondary)] rounded-xl max-w-2xl w-full max-h-[90vh] overflow-auto">
        <div className="p-6 border-b border-[var(--border-color)]">
          <h2 className="text-xl font-semibold text-[var(--text-primary)]">
            {isCreating ? 'Create Policy' : 'Edit Policy'}
          </h2>
        </div>

        <div className="p-6 space-y-6">
          {/* Basic Info */}
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">
                Policy Name
              </label>
              <input
                type="text"
                value={localPolicy.name}
                onChange={(e) => setLocalPolicy(prev => ({ ...prev, name: e.target.value }))}
                className="w-full px-3 py-2 bg-[var(--bg-tertiary)] border border-[var(--border-color)] rounded-lg text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)]"
                placeholder="e.g., Critical Secret Alert"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">
                Description
              </label>
              <textarea
                value={localPolicy.description}
                onChange={(e) => setLocalPolicy(prev => ({ ...prev, description: e.target.value }))}
                className="w-full px-3 py-2 bg-[var(--bg-tertiary)] border border-[var(--border-color)] rounded-lg text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)] resize-none"
                rows={2}
                placeholder="Describe what this policy does..."
              />
            </div>
            <div className="flex gap-4">
              <div className="flex-1">
                <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">
                  Priority (1-100)
                </label>
                <input
                  type="number"
                  min="1"
                  max="100"
                  value={localPolicy.priority}
                  onChange={(e) => setLocalPolicy(prev => ({ ...prev, priority: parseInt(e.target.value) || 50 }))}
                  className="w-full px-3 py-2 bg-[var(--bg-tertiary)] border border-[var(--border-color)] rounded-lg text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)]"
                />
              </div>
              <div className="flex items-end">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={localPolicy.enabled}
                    onChange={(e) => setLocalPolicy(prev => ({ ...prev, enabled: e.target.checked }))}
                    className="w-4 h-4 rounded border-[var(--border-color)] text-[var(--accent)] focus:ring-[var(--accent)]"
                  />
                  <span className="text-sm text-[var(--text-secondary)]">Enabled</span>
                </label>
              </div>
            </div>
          </div>

          {/* Conditions */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-medium text-[var(--text-primary)] flex items-center gap-2">
                <Filter className="w-4 h-4 text-[var(--accent)]" />
                Conditions
              </h3>
              <button
                onClick={addCondition}
                className="text-sm text-[var(--accent)] hover:underline flex items-center gap-1"
              >
                <Plus className="w-3 h-3" />
                Add Condition
              </button>
            </div>
            <div className="space-y-2">
              {localPolicy.conditions.map((cond, i) => (
                <div key={i} className="flex items-center gap-2">
                  <select
                    value={cond.field}
                    onChange={(e) => updateCondition(i, { field: e.target.value })}
                    className="px-3 py-2 bg-[var(--bg-tertiary)] border border-[var(--border-color)] rounded-lg text-sm text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)]"
                  >
                    {conditionFields.map(f => (
                      <option key={f.value} value={f.value}>{f.label}</option>
                    ))}
                  </select>
                  <select
                    value={cond.operator}
                    onChange={(e) => updateCondition(i, { operator: e.target.value as PolicyCondition['operator'] })}
                    className="px-3 py-2 bg-[var(--bg-tertiary)] border border-[var(--border-color)] rounded-lg text-sm text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)]"
                  >
                    {conditionOperators.map(o => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                  <input
                    type="text"
                    value={String(cond.value)}
                    onChange={(e) => updateCondition(i, { value: e.target.value })}
                    className="flex-1 px-3 py-2 bg-[var(--bg-tertiary)] border border-[var(--border-color)] rounded-lg text-sm text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)]"
                    placeholder="Value..."
                  />
                  <button
                    onClick={() => removeCondition(i)}
                    className="p-2 text-[var(--text-muted)] hover:text-red-400 transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ))}
              {localPolicy.conditions.length === 0 && (
                <p className="text-sm text-[var(--text-muted)] text-center py-4 bg-[var(--bg-tertiary)] rounded-lg">
                  No conditions added. Policy will match all secrets.
                </p>
              )}
            </div>
          </div>

          {/* Actions */}
          <div>
            <h3 className="text-sm font-medium text-[var(--text-primary)] mb-3 flex items-center gap-2">
              <Zap className="w-4 h-4 text-amber-400" />
              Actions
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {(Object.entries(actionConfig) as [ActionType, typeof actionConfig[ActionType]][]).map(([type, config]) => {
                const Icon = config.icon
                const isSelected = localPolicy.actions.some(a => a.type === type)
                return (
                  <button
                    key={type}
                    onClick={() => toggleAction(type)}
                    className={`flex items-center gap-2 p-3 rounded-lg border transition-colors ${
                      isSelected 
                        ? 'border-[var(--accent)] bg-[var(--accent)]/10' 
                        : 'border-[var(--border-color)] bg-[var(--bg-tertiary)] hover:border-[var(--border-hover)]'
                    }`}
                  >
                    <Icon className={`w-4 h-4 ${isSelected ? config.color : 'text-[var(--text-muted)]'}`} />
                    <span className={`text-sm ${isSelected ? 'text-[var(--text-primary)]' : 'text-[var(--text-secondary)]'}`}>
                      {config.label}
                    </span>
                  </button>
                )
              })}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-[var(--border-color)] flex justify-end gap-3">
          <Button variant="secondary" onClick={onCancel}>
            Cancel
          </Button>
          <Button onClick={() => onSave(localPolicy)} disabled={!localPolicy.name}>
            <Save className="w-4 h-4 mr-2" />
            {isCreating ? 'Create Policy' : 'Save Changes'}
          </Button>
        </div>
      </div>
    </div>
  )
}
