/**
 * Convenience wrapper: fetch findings for a repo + stored policies,
 * evaluate them, execute matching actions, and return a summary that
 * scan-completion toasts can render.
 *
 * Kept as its own module so repositories page, dashboard, and future CI
 * integrations all trigger the same pipeline.
 */

import { getAuthHeaders } from './authHeaders'
import {
  evaluatePolicies,
  type Policy,
  type PolicyFinding,
} from './policyEngine'
import {
  executeMatches,
  getPolicyWebhooks,
  type PolicyExecution,
} from './policyExecutor'

const POLICIES_STORAGE_KEY = 'vaultsentry_policies'

function loadStoredPolicies(): Policy[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = window.localStorage.getItem(POLICIES_STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? (parsed as Policy[]) : []
  } catch {
    return []
  }
}

async function loadFindingsForRepo(repoName?: string): Promise<PolicyFinding[]> {
  try {
    const res = await fetch('/api/secrets', {
      cache: 'no-store',
      headers: getAuthHeaders(),
    })
    if (!res.ok) return []
    const all = (await res.json()) as PolicyFinding[]
    if (!Array.isArray(all)) return []
    if (!repoName) return all
    const target = repoName.toLowerCase()
    return all.filter(
      (f) =>
        (f.repository_name ?? '').toString().toLowerCase() === target ||
        (f.repository ?? '').toString().toLowerCase() === target,
    )
  } catch {
    return []
  }
}

export interface ScanPolicyOutcome {
  firedPolicies: number
  executions: PolicyExecution[]
  alerts: Array<{ policyName: string; findings: PolicyFinding[] }>
}

export async function runPoliciesForScan(opts: {
  repoName?: string
}): Promise<ScanPolicyOutcome> {
  const policies = loadStoredPolicies()
  if (policies.length === 0) {
    return { firedPolicies: 0, executions: [], alerts: [] }
  }

  const findings = await loadFindingsForRepo(opts.repoName)
  if (findings.length === 0) {
    return { firedPolicies: 0, executions: [], alerts: [] }
  }

  const evalResult = evaluatePolicies(findings, policies)
  if (evalResult.matches.length === 0) {
    return { firedPolicies: 0, executions: [], alerts: [] }
  }

  const alerts: ScanPolicyOutcome['alerts'] = []
  const executions = await executeMatches(evalResult.matches, {
    webhooks: getPolicyWebhooks(),
    onAlert: (policy, findings) => {
      alerts.push({ policyName: policy.name, findings })
    },
  })

  return {
    firedPolicies: evalResult.matches.length,
    executions,
    alerts,
  }
}
