/**
 * Policy executor — the "then" half of the engine.
 *
 * evaluatePolicies() says which findings matched which policies. This module
 * takes those matches and actually fires the configured actions:
 *   - `alert`         → in-app toast (handled by caller) + execution log entry
 *   - `slack_notify`  → POST to a Slack webhook URL (if configured)
 *   - `jira_ticket`   → record an intent + optional generic webhook
 *   - `block_pr`      → record intent (server-side GitHub check would live elsewhere)
 *   - `auto_rotate`   → record intent (provider integration would live elsewhere)
 *   - `assign_team`   → record intent
 *
 * Every execution (regardless of type) is appended to a ring buffer in
 * localStorage so the Policies page can show "Recent triggers" without any
 * backend. This is the minimum that makes policies *feel alive* to the user.
 */

import type { Policy, PolicyAction, PolicyFinding, PolicyMatch } from './policyEngine'
import { getAuthHeaders } from './authHeaders'

const LOG_KEY = 'vaultsentry_policy_executions'
const WEBHOOKS_KEY = 'vaultsentry_policy_webhooks'
const LOG_CAP = 50

// Webhook URLs are credentials. They MUST live only on the backend, encrypted
// with AES-256-GCM (see backend/app/core/encryption.py). Any legacy plaintext
// blob from earlier builds gets wiped on first import so it cannot be exfil'd
// via XSS or a stolen device profile.
function purgeLegacyWebhookStorage(): void {
  if (typeof window === 'undefined') return
  try {
    const s = window.localStorage
    for (let i = s.length - 1; i >= 0; i--) {
      const key = s.key(i)
      if (key && key.startsWith(WEBHOOKS_KEY)) s.removeItem(key)
    }
  } catch {
    /* noop */
  }
}
purgeLegacyWebhookStorage()

export interface PolicyExecution {
  id: string
  timestamp: string
  policyId: string
  policyName: string
  actionType: string
  status: 'fired' | 'skipped' | 'failed'
  message: string
  findingIds: Array<string | number>
  repository?: string
}

export interface PolicyWebhookConfig {
  slackWebhookUrl?: string
  genericWebhookUrl?: string
  jiraWebhookUrl?: string
  jiraProjectKey?: string
  mlRiskScoringEnabled?: boolean
}

// ---------- Storage helpers ---------------------------------------------------

function safeStorage(): Storage | null {
  if (typeof window === 'undefined') return null
  try {
    return window.localStorage
  } catch {
    return null
  }
}

function currentUserId(): string {
  return getAuthHeaders()['x-user-id'] || 'local-user'
}

function userKey(base: string): string {
  return `${base}:${currentUserId()}`
}

function readItemWithMigration(s: Storage, base: string): string | null {
  const scoped = userKey(base)
  const value = s.getItem(scoped)
  if (value !== null) return value

  const legacy = s.getItem(base)
  if (legacy !== null) {
    try {
      s.setItem(scoped, legacy)
    } catch {
      /* quota */
    }
  }
  return legacy
}

// Webhook config is fetched from the backend on demand and never persisted in
// the browser. The backend stores it AES-256-GCM encrypted; the response only
// flows to the authenticated user. Callers that already hold a freshly
// fetched config should pass it via `executeMatches({ webhooks })` to avoid
// an extra round-trip.
export async function getPolicyWebhooks(): Promise<PolicyWebhookConfig> {
  if (typeof window === 'undefined') return {}
  try {
    const { getAuthHeaders } = await import('./authHeaders')
    const res = await fetch('/api/v1/integrations/config', {
      headers: getAuthHeaders(),
      cache: 'no-store',
    })
    if (!res.ok) return {}
    return (await res.json()) as PolicyWebhookConfig
  } catch {
    return {}
  }
}

export async function setPolicyWebhooks(cfg: PolicyWebhookConfig): Promise<PolicyWebhookConfig> {
  if (typeof window === 'undefined') return cfg
  try {
    const { getAuthHeaders } = await import('./authHeaders')
    const res = await fetch('/api/v1/integrations/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
      body: JSON.stringify(cfg),
    })
    if (!res.ok) throw new Error(`Save failed (${res.status})`)
    return (await res.json()) as PolicyWebhookConfig
  } catch (err) {
    throw err
  }
}

export function getExecutions(): PolicyExecution[] {
  const s = safeStorage()
  if (!s) return []
  try {
    const raw = s.getItem(LOG_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? (parsed as PolicyExecution[]) : []
  } catch {
    return []
  }
}

export function clearExecutions(): void {
  const s = safeStorage()
  if (!s) return
  try {
    s.removeItem(LOG_KEY)
  } catch {
    /* noop */
  }
}

function appendExecutions(entries: PolicyExecution[]): void {
  if (entries.length === 0) return
  const s = safeStorage()
  if (!s) return
  try {
    const existing = getExecutions()
    const combined = [...entries, ...existing].slice(0, LOG_CAP)
    s.setItem(LOG_KEY, JSON.stringify(combined))
    // Let other tabs / components know so they can refresh without polling.
    if (typeof window !== 'undefined' && typeof CustomEvent === 'function') {
      window.dispatchEvent(new CustomEvent('vaultsentry:policy-log-updated'))
    }
  } catch {
    /* quota */
  }
}

// ---------- Actions -----------------------------------------------------------

function uniqueId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

function describeFindings(findings: PolicyFinding[]): string {
  if (findings.length === 0) return ''
  if (findings.length === 1) {
    const f = findings[0]
    const repo = f.repository_name ?? f.repository ?? ''
    const file = f.file_path ?? f.file ?? ''
    return `${f.secret_type ?? f.type ?? 'secret'} in ${repo}${file ? `/${file}` : ''}`
  }
  return `${findings.length} findings`
}

async function postJson(
  url: string,
  body: unknown,
): Promise<{ ok: boolean; status: number; message?: string }> {
  try {
    const res = await fetch('/api/integrations/webhook', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url, payload: body }),
    })
    const data = await res.json().catch(() => ({}))
    return {
      ok: res.ok && data.ok !== false,
      status: data.status ?? res.status,
      message: data.message,
    }
  } catch (err: any) {
    return { ok: false, status: 0, message: err?.message ?? 'Network error' }
  }
}

async function fireSlack(
  policy: Policy,
  findings: PolicyFinding[],
  webhook: string | undefined,
): Promise<{ status: PolicyExecution['status']; message: string }> {
  if (!webhook) {
    return {
      status: 'skipped',
      message: 'No Slack webhook configured (set one in Policies → Settings)',
    }
  }
  const text =
    `*VaultSentry policy fired:* ${policy.name}\n` +
    `• ${findings.length} finding${findings.length === 1 ? '' : 's'}\n` +
    findings
      .slice(0, 5)
      .map(
        (f) =>
          `  - [${(f.severity ?? f.risk_level ?? 'n/a').toString().toUpperCase()}] ${
            f.secret_type ?? f.type ?? 'secret'
          } in ${f.repository_name ?? f.repository ?? '?'}/${f.file_path ?? f.file ?? '?'}`,
      )
      .join('\n')
  const res = await postJson(webhook, { text })
  return res.ok
    ? { status: 'fired', message: 'Slack message sent' }
    : {
        status: 'failed',
        message: res.message || `Slack responded ${res.status}`,
      }
}

async function fireGenericWebhook(
  policy: Policy,
  action: PolicyAction,
  findings: PolicyFinding[],
  webhook: string | undefined,
  context?: Record<string, unknown>,
): Promise<{ status: PolicyExecution['status']; message: string }> {
  if (!webhook) {
    return {
      status: 'skipped',
      message: `No webhook configured for ${action.type}`,
    }
  }
  const res = await postJson(webhook, {
    type: action.type,
    policy: { id: policy.id, name: policy.name },
    config: action.config ?? {},
    context: context ?? {},
    findings: findings.map((f) => ({
      id: f.id,
      type: f.secret_type ?? f.type,
      severity: f.severity ?? f.risk_level,
      file: f.file_path ?? f.file,
      line: f.line_number ?? f.line,
      repository: f.repository_name ?? f.repository,
    })),
    timestamp: new Date().toISOString(),
  })
  return res.ok
    ? { status: 'fired', message: `${action.type} webhook delivered` }
    : {
        status: 'failed',
        message: res.message || `Webhook responded ${res.status}`,
      }
}

// ---------- Public API --------------------------------------------------------

export interface ExecuteOptions {
  webhooks?: PolicyWebhookConfig
  // Optional hook so callers can raise toasts without this module taking a
  // hard dep on the toast context.
  onAlert?: (policy: Policy, findings: PolicyFinding[]) => void
}

/**
 * Run every action for every matched policy. Records each attempt to the
 * executions log and returns them so the caller can show counts / toasts.
 */
export async function executeMatches(
  matches: PolicyMatch[],
  opts: ExecuteOptions = {},
): Promise<PolicyExecution[]> {
  if (matches.length === 0) return []
  const webhooks = opts.webhooks ?? (await getPolicyWebhooks())
  const out: PolicyExecution[] = []
  const nowIso = new Date().toISOString()

  for (const match of matches) {
    const { policy, findings } = match
    const finding = findings[0]
    const repoLabel = finding?.repository_name ?? finding?.repository
    const ids = findings.map((f) => f.id ?? `${f.file_path ?? f.file}:${f.line_number ?? f.line}`)

    for (const action of policy.actions ?? []) {
      const base: Omit<PolicyExecution, 'status' | 'message'> = {
        id: uniqueId(),
        timestamp: nowIso,
        policyId: policy.id,
        policyName: policy.name,
        actionType: action.type,
        findingIds: ids,
        repository: repoLabel,
      }

      try {
        if (action.type === 'alert') {
          opts.onAlert?.(policy, findings)
          out.push({
            ...base,
            status: 'fired',
            message: `Raised alert for ${describeFindings(findings)}`,
          })
          continue
        }

        if (action.type === 'slack_notify') {
          const r = await fireSlack(policy, findings, webhooks.slackWebhookUrl)
          out.push({ ...base, ...r })
          continue
        }

        if (action.type === 'jira_ticket') {
          // Prefer a Jira-specific webhook if configured; fall back to the
          // generic webhook so a single URL still works.
          const url = webhooks.jiraWebhookUrl || webhooks.genericWebhookUrl
          if (url) {
            const r = await fireGenericWebhook(policy, action, findings, url, {
              jiraProjectKey: webhooks.jiraProjectKey,
            })
            out.push({ ...base, ...r })
          } else {
            out.push({
              ...base,
              status: 'skipped',
              message: 'Jira ticket skipped — configure Jira in Integrations',
            })
          }
          continue
        }

        if (
          action.type === 'block_pr' ||
          action.type === 'auto_rotate' ||
          action.type === 'assign_team'
        ) {
          if (webhooks.genericWebhookUrl) {
            const r = await fireGenericWebhook(
              policy,
              action,
              findings,
              webhooks.genericWebhookUrl,
            )
            out.push({ ...base, ...r })
          } else {
            out.push({
              ...base,
              status: 'skipped',
              message: `${action.type} queued (no integration configured)`,
            })
          }
          continue
        }

        out.push({
          ...base,
          status: 'skipped',
          message: `Unknown action "${action.type}"`,
        })
      } catch (err: any) {
        out.push({
          ...base,
          status: 'failed',
          message: err?.message ?? 'Execution failed',
        })
      }
    }
  }

  appendExecutions(out)
  return out
}
