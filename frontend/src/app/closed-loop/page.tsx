'use client'

import Header from '@/components/layout/Header'
import Sidebar from '@/components/layout/Sidebar'
import { Badge, Button, Card, Skeleton } from '@/components/ui'
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  ClipboardList,
  FileCode2,
  History,
  Plug,
  RefreshCw,
  RotateCw,
  Settings2,
  ShieldCheck,
  ShieldOff,
  Workflow,
  XCircle,
} from 'lucide-react'
import Link from 'next/link'
import { useCallback, useEffect, useMemo, useState } from 'react'

type ValidationResult = {
  status: 'active' | 'inactive' | 'unknown' | 'skipped'
  method: string
  confidence: number
  safe: boolean
}

type RemediationAction = {
  status: 'pending' | 'succeeded' | 'failed' | 'skipped' | 'needs_approval'
  steps: Array<{ name: string; status: string; reason?: string; branch?: string }>
  completed_at?: string
}

type Incident = {
  incident_id: string
  tenant_id: string
  repository: string
  branch: string
  commit_sha: string
  file_path: string
  line_start: number
  secret_type: string
  provider: string
  redacted_preview: string
  detector_id: string
  confidence: number
  entropy?: number
  severity: string
  status: string
  validation?: ValidationResult
  decision: {
    actions?: string[]
    requires_approval?: boolean
    dry_run?: boolean
    reason?: string
  }
  remediation?: RemediationAction
  first_seen_at: string
  last_seen_at: string
  exposure_count: number
}

type OrgConfig = {
  tenant_id: string
  auto_revoke: Record<string, boolean>
  auto_pr: boolean
  dry_run_remediation: boolean
  require_approval_for_production: boolean
  require_approval_below_confidence: number
  protected_repositories: string[]
  validation_enabled: Record<string, boolean>
}

type AuditEvent = {
  audit_id: string
  event_type: string
  actor_id: string
  resource_id: string
  message: string
  created_at: string
  integrity_hash: string
}

type Pipeline = {
  topics: string[]
  workers: string[]
  security: Record<string, string>
}

const ORG_ID = 'default-org'
const CLOSED_LOOP_API = '/api/v1/closed-loop'

const statusTone: Record<string, string> = {
  remediated: 'success',
  validated: 'info',
  remediation_pending: 'warning',
  needs_approval: 'warning',
  failed: 'critical',
  detected: 'info',
}

const providerTone: Record<string, string> = {
  aws: 'bg-orange-500/10 text-orange-500',
  github: 'bg-zinc-500/10 text-zinc-500 dark:text-zinc-300',
  stripe: 'bg-violet-500/10 text-violet-500',
  database: 'bg-blue-500/10 text-blue-500',
  jwt: 'bg-emerald-500/10 text-emerald-500',
}

async function apiGet<T>(path: string): Promise<T> {
  const response = await fetch(`${CLOSED_LOOP_API}${path}`, { cache: 'no-store' })
  if (!response.ok) throw new Error((await response.json().catch(() => ({}))).error || 'Request failed')
  return response.json()
}

async function apiSend<T>(path: string, method: 'POST' | 'PUT', body?: unknown): Promise<T> {
  const response = await fetch(`${CLOSED_LOOP_API}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  })
  if (!response.ok) throw new Error((await response.json().catch(() => ({}))).error || 'Request failed')
  return response.json()
}

export default function ClosedLoopPage() {
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [incidents, setIncidents] = useState<Incident[]>([])
  const [audit, setAudit] = useState<AuditEvent[]>([])
  const [config, setConfig] = useState<OrgConfig | null>(null)
  const [pipeline, setPipeline] = useState<Pipeline | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const loadData = useCallback(async () => {
    setError(null)
    try {
      const [incidentResult, configResult, auditResult, pipelineResult] = await Promise.all([
        apiGet<{ items: Incident[] }>(`/orgs/${ORG_ID}/incidents`),
        apiGet<OrgConfig>(`/orgs/${ORG_ID}/config`),
        apiGet<{ items: AuditEvent[] }>(`/orgs/${ORG_ID}/audit`),
        apiGet<Pipeline>('/pipeline'),
      ])
      setIncidents(incidentResult.items)
      setConfig(configResult)
      setAudit(auditResult.items)
      setPipeline(pipelineResult)
      if (!selectedId && incidentResult.items[0]) setSelectedId(incidentResult.items[0].incident_id)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load closed-loop data')
    } finally {
      setLoading(false)
    }
  }, [selectedId])

  useEffect(() => {
    loadData()
  }, [loadData])

  const selectedIncident = useMemo(
    () => incidents.find((incident) => incident.incident_id === selectedId) || incidents[0] || null,
    [incidents, selectedId],
  )

  const metrics = useMemo(() => {
    const active = incidents.filter((i) => !['remediated', 'false_positive'].includes(i.status)).length
    const remediated = incidents.filter((i) => i.status === 'remediated').length
    const approvals = incidents.filter((i) => i.status === 'needs_approval').length
    const validated = incidents.filter((i) => i.validation && i.validation.status !== 'skipped').length
    return { total: incidents.length, active, remediated, approvals, validated }
  }, [incidents])

  const remediateIncident = async (incidentId: string) => {
    setBusy(incidentId)
    setError(null)
    try {
      await apiSend(`/orgs/${ORG_ID}/incidents/${incidentId}/remediate`, 'POST')
      await loadData()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to trigger remediation')
    } finally {
      setBusy(null)
    }
  }

  const updateConfig = async (patch: Partial<OrgConfig>) => {
    setBusy('config')
    setError(null)
    try {
      const next = await apiSend<OrgConfig>(`/orgs/${ORG_ID}/config`, 'PUT', patch)
      setConfig(next)
      await loadData()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update config')
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar isOpen={sidebarOpen} onToggle={() => setSidebarOpen(!sidebarOpen)} />

      <div className="flex-1 flex flex-col overflow-hidden">
        <Header alertCount={metrics.active} onMenuClick={() => setSidebarOpen(!sidebarOpen)} />

        <main className="flex-1 overflow-y-auto bg-[var(--bg-primary)]">
          <div className="max-w-[1800px] mx-auto p-6 space-y-6">
            <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4">
              <div>
                <h1 className="text-2xl font-bold text-[var(--text-primary)]">Closed Loop</h1>
                <p className="text-[var(--text-muted)] mt-1">
                  Validate active leaks, decide policy, run remediation, and keep audit evidence in one flow.
                </p>
              </div>
              <div className="flex flex-wrap gap-3">
                <Button variant="secondary" onClick={loadData} isLoading={loading || busy === 'refresh'}>
                  <RefreshCw className="w-4 h-4" />
                  Refresh
                </Button>
                <Link href="/integrations">
                  <Button>
                    <Plug className="w-4 h-4" />
                    Connect Webhook
                  </Button>
                </Link>
              </div>
            </div>

            {error && (
              <div className="flex items-center gap-3 rounded-md border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-500">
                <XCircle className="w-4 h-4 shrink-0" />
                {error}
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-4">
              <MetricCard label="Incidents" value={metrics.total} icon={ClipboardList} />
              <MetricCard label="Open" value={metrics.active} icon={AlertTriangle} tone="text-orange-500" />
              <MetricCard label="Validated" value={metrics.validated} icon={ShieldCheck} tone="text-blue-500" />
              <MetricCard label="Remediated" value={metrics.remediated} icon={CheckCircle2} tone="text-green-500" />
              <MetricCard label="Approvals" value={metrics.approvals} icon={ShieldOff} tone="text-yellow-500" />
            </div>

            <div className="grid grid-cols-1 2xl:grid-cols-[minmax(360px,480px)_1fr] gap-6">
              <Card noPadding className="overflow-hidden">
                <div className="px-5 py-4 border-b border-[var(--border-color)] flex items-center justify-between">
                  <div>
                    <h2 className="font-semibold text-[var(--text-primary)]">Incident Queue</h2>
                    <p className="text-sm text-[var(--text-muted)]">Deduplicated by tenant fingerprint</p>
                  </div>
                  <Workflow className="w-5 h-5 text-[var(--accent)]" />
                </div>
                <div className="max-h-[680px] overflow-y-auto">
                  {loading ? (
                    <div className="p-4 space-y-3">
                      {Array.from({ length: 6 }).map((_, index) => (
                        <Skeleton key={index} className="h-20 w-full" />
                      ))}
                    </div>
                  ) : incidents.length === 0 ? (
                    <div className="p-6 text-center">
                      <FileCode2 className="w-10 h-10 mx-auto text-[var(--text-muted)] mb-3" />
                      <p className="font-medium text-[var(--text-primary)]">No incidents yet</p>
                      <p className="text-sm text-[var(--text-muted)] mt-1">Send a webhook or run a sample event.</p>
                    </div>
                  ) : (
                    incidents.map((incident) => (
                      <button
                        key={incident.incident_id}
                        onClick={() => setSelectedId(incident.incident_id)}
                        className="w-full text-left px-5 py-4 border-b border-[var(--border-color)] hover:bg-[var(--bg-tertiary)] transition-colors"
                        style={{
                          background: selectedIncident?.incident_id === incident.incident_id ? 'var(--bg-tertiary)' : undefined,
                        }}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <span className={`px-2 py-0.5 rounded text-xs font-medium ${providerTone[incident.provider] || 'bg-blue-500/10 text-blue-500'}`}>
                                {incident.provider}
                              </span>
                              <Badge variant={(statusTone[incident.status] || 'info') as any}>{incident.status.replace(/_/g, ' ')}</Badge>
                            </div>
                            <p className="font-medium text-[var(--text-primary)] truncate">{incident.repository}</p>
                            <p className="text-sm text-[var(--text-muted)] truncate">
                              {incident.file_path}:{incident.line_start}
                            </p>
                          </div>
                          <span className="text-xs text-[var(--text-muted)] whitespace-nowrap">
                            x{incident.exposure_count}
                          </span>
                        </div>
                      </button>
                    ))
                  )}
                </div>
              </Card>

              <div className="space-y-6">
                {selectedIncident ? (
                  <IncidentDetail
                    incident={selectedIncident}
                    onRemediate={() => remediateIncident(selectedIncident.incident_id)}
                    busy={busy === selectedIncident.incident_id}
                  />
                ) : (
                  <Card className="p-8 text-center text-[var(--text-muted)]">Select an incident to inspect the lifecycle.</Card>
                )}

                <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                  <ConfigPanel config={config} busy={busy === 'config'} onUpdate={updateConfig} />
                  <PipelinePanel pipeline={pipeline} />
                </div>

                <AuditPanel events={audit} resourceId={selectedIncident?.incident_id} />
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  )
}

function MetricCard({
  label,
  value,
  icon: Icon,
  tone = 'text-[var(--accent)]',
}: {
  label: string
  value: number
  icon: React.ElementType
  tone?: string
}) {
  return (
    <Card className="p-4">
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-md bg-[var(--bg-tertiary)]">
          <Icon className={`w-5 h-5 ${tone}`} />
        </div>
        <div>
          <p className="text-sm text-[var(--text-muted)]">{label}</p>
          <p className="text-2xl font-bold text-[var(--text-primary)]">{value}</p>
        </div>
      </div>
    </Card>
  )
}

function IncidentDetail({
  incident,
  onRemediate,
  busy,
}: {
  incident: Incident
  onRemediate: () => void
  busy: boolean
}) {
  return (
    <Card noPadding className="overflow-hidden">
      <div className="px-5 py-4 border-b border-[var(--border-color)] flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Badge variant={(statusTone[incident.status] || 'info') as any}>{incident.status.replace(/_/g, ' ')}</Badge>
            {incident.decision?.dry_run && <Badge variant="info">dry run</Badge>}
            {incident.decision?.requires_approval && <Badge variant="warning">approval required</Badge>}
          </div>
          <h2 className="text-lg font-semibold text-[var(--text-primary)]">{incident.secret_type}</h2>
          <p className="text-sm text-[var(--text-muted)]">{incident.incident_id}</p>
        </div>
        <Button onClick={onRemediate} isLoading={busy} disabled={incident.status === 'remediated' && !!incident.remediation}>
          <RotateCw className="w-4 h-4" />
          Remediate
        </Button>
      </div>

      <div className="p-5 grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Field label="Repository" value={incident.repository} />
        <Field label="Branch" value={incident.branch} />
        <Field label="Commit" value={incident.commit_sha} mono />
        <Field label="Location" value={`${incident.file_path}:${incident.line_start}`} mono />
        <Field label="Detector" value={incident.detector_id} />
        <Field label="Preview" value={incident.redacted_preview} mono />
        <Field label="Validation" value={`${incident.validation?.status || 'unknown'} via ${incident.validation?.method || 'none'}`} />
        <Field label="Confidence" value={`${Math.round((incident.confidence || 0) * 100)}%`} />
        <Field label="Entropy" value={incident.entropy == null ? 'n/a' : String(incident.entropy)} />
      </div>

      <div className="px-5 pb-5 grid grid-cols-1 xl:grid-cols-2 gap-4">
        <div className="rounded-md border border-[var(--border-color)] p-4">
          <h3 className="font-medium text-[var(--text-primary)] mb-3">Decision</h3>
          <div className="flex flex-wrap gap-2 mb-3">
            {(incident.decision?.actions || []).map((action) => (
              <span key={action} className="px-2 py-1 rounded bg-[var(--bg-tertiary)] text-xs text-[var(--text-secondary)]">
                {action.replace(/_/g, ' ')}
              </span>
            ))}
          </div>
          <p className="text-sm text-[var(--text-muted)]">{incident.decision?.reason || 'Policy evaluated.'}</p>
        </div>

        <div className="rounded-md border border-[var(--border-color)] p-4">
          <h3 className="font-medium text-[var(--text-primary)] mb-3">Remediation Steps</h3>
          {incident.remediation?.steps?.length ? (
            <div className="space-y-2">
              {incident.remediation.steps.map((step) => (
                <div key={`${step.name}-${step.status}`} className="flex items-center justify-between gap-3 text-sm">
                  <span className="text-[var(--text-secondary)]">{step.name.replace(/_/g, ' ')}</span>
                  <span className="text-[var(--text-muted)]">{step.status.replace(/_/g, ' ')}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-[var(--text-muted)]">No remediation has run yet.</p>
          )}
        </div>
      </div>
    </Card>
  )
}

function Field({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <p className="text-xs uppercase tracking-wide text-[var(--text-muted)] mb-1">{label}</p>
      <p className={`text-sm text-[var(--text-primary)] break-words ${mono ? 'font-mono' : ''}`}>{value}</p>
    </div>
  )
}

function ConfigPanel({
  config,
  busy,
  onUpdate,
}: {
  config: OrgConfig | null
  busy: boolean
  onUpdate: (patch: Partial<OrgConfig>) => void
}) {
  if (!config) {
    return (
      <Card className="p-5">
        <Skeleton className="h-40 w-full" />
      </Card>
    )
  }

  return (
    <Card noPadding>
      <div className="px-5 py-4 border-b border-[var(--border-color)] flex items-center justify-between">
        <div>
          <h2 className="font-semibold text-[var(--text-primary)]">Policy Controls</h2>
          <p className="text-sm text-[var(--text-muted)]">Tenant: {config.tenant_id}</p>
        </div>
        <Settings2 className="w-5 h-5 text-[var(--accent)]" />
      </div>
      <div className="p-5 space-y-4">
        <ToggleRow
          label="Create remediation PRs"
          description="Open a GitHub PR or planned PR step for code cleanup."
          checked={config.auto_pr}
          disabled={busy}
          onChange={(value) => onUpdate({ auto_pr: value })}
        />
        <ToggleRow
          label="Dry-run remediation"
          description="Plan revoke, rotate, and PR steps without mutating providers."
          checked={config.dry_run_remediation}
          disabled={busy}
          onChange={(value) => onUpdate({ dry_run_remediation: value })}
        />
        <ToggleRow
          label="Require production approval"
          description="Protected repositories stop at the approval gate."
          checked={config.require_approval_for_production}
          disabled={busy}
          onChange={(value) => onUpdate({ require_approval_for_production: value })}
        />
      </div>
    </Card>
  )
}

function ToggleRow({
  label,
  description,
  checked,
  disabled,
  onChange,
}: {
  label: string
  description: string
  checked: boolean
  disabled?: boolean
  onChange: (value: boolean) => void
}) {
  return (
    <label className="flex items-center justify-between gap-4">
      <span>
        <span className="block text-sm font-medium text-[var(--text-primary)]">{label}</span>
        <span className="block text-xs text-[var(--text-muted)]">{description}</span>
      </span>
      <input
        type="checkbox"
        className="h-5 w-5 rounded border-[var(--border-color)]"
        checked={checked}
        disabled={disabled}
        onChange={(event) => onChange(event.target.checked)}
      />
    </label>
  )
}

function PipelinePanel({ pipeline }: { pipeline: Pipeline | null }) {
  return (
    <Card noPadding>
      <div className="px-5 py-4 border-b border-[var(--border-color)] flex items-center justify-between">
        <div>
          <h2 className="font-semibold text-[var(--text-primary)]">Event Pipeline</h2>
          <p className="text-sm text-[var(--text-muted)]">Topics and workers exposed by the backend</p>
        </div>
        <Activity className="w-5 h-5 text-[var(--accent)]" />
      </div>
      <div className="p-5">
        {pipeline ? (
          <div className="space-y-3">
            {pipeline.workers.map((worker, index) => (
              <div key={worker} className="flex items-center gap-3">
                <span className="w-6 h-6 rounded bg-[var(--bg-tertiary)] text-xs flex items-center justify-center text-[var(--text-muted)]">
                  {index + 1}
                </span>
                <span className="text-sm text-[var(--text-secondary)]">{worker}</span>
              </div>
            ))}
          </div>
        ) : (
          <Skeleton className="h-40 w-full" />
        )}
      </div>
    </Card>
  )
}

function AuditPanel({ events, resourceId }: { events: AuditEvent[]; resourceId?: string }) {
  const visible = resourceId ? events.filter((event) => event.resource_id === resourceId).slice(-8) : events.slice(-8)

  return (
    <Card noPadding>
      <div className="px-5 py-4 border-b border-[var(--border-color)] flex items-center justify-between">
        <div>
          <h2 className="font-semibold text-[var(--text-primary)]">Audit Trail</h2>
          <p className="text-sm text-[var(--text-muted)]">Hash-linked SOC2-style evidence events</p>
        </div>
        <History className="w-5 h-5 text-[var(--accent)]" />
      </div>
      <div className="p-5">
        {visible.length === 0 ? (
          <p className="text-sm text-[var(--text-muted)]">No audit events yet.</p>
        ) : (
          <div className="space-y-3">
            {visible.map((event) => (
              <div key={event.audit_id} className="grid grid-cols-[140px_1fr] gap-4 text-sm">
                <span className="text-[var(--text-muted)]">{new Date(event.created_at).toLocaleTimeString()}</span>
                <div>
                  <p className="font-medium text-[var(--text-primary)]">{event.event_type}</p>
                  <p className="text-[var(--text-muted)]">{event.message}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </Card>
  )
}
