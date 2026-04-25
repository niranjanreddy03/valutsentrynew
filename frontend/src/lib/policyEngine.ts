/**
 * Policy engine — pure evaluator.
 *
 * Turns the Policies page's authored rules into real decisions against a set
 * of scan findings. Deliberately free of React / side effects so it can be
 * unit-tested and reused from scripts.
 *
 * Shape:
 *   evaluatePolicies(findings, policies) → { matches, summary }
 *   matches: per-policy list of findings that satisfied all conditions.
 */

export type PolicyOperator =
  | 'equals'
  | 'not_equals'
  | 'contains'
  | 'not_contains'
  | 'gt'
  | 'gte'
  | 'lt'
  | 'lte'
  | 'in'
  | 'not_in'
  | 'regex'

export interface PolicyCondition {
  field: string
  operator: PolicyOperator | string
  value: unknown
}

export type PolicyActionType =
  | 'alert'
  | 'block_pr'
  | 'jira_ticket'
  | 'slack_notify'
  | 'auto_rotate'
  | 'assign_team'

export interface PolicyAction {
  type: PolicyActionType
  config?: Record<string, unknown>
}

export interface Policy {
  id: string
  name: string
  description?: string
  enabled: boolean
  priority: number
  conditions: PolicyCondition[]
  actions: PolicyAction[]
  created_at?: string
  updated_at?: string
}

/**
 * Subset of a scanner finding we actually match on. The engine is intentionally
 * forgiving about field naming — the scanner uses `secret_type` / `file_path`
 * while the Supabase model uses `type` / `file`, so we look under a few
 * aliases before giving up.
 */
export interface PolicyFinding {
  id?: number | string
  secret_type?: string
  type?: string
  severity?: string
  risk_level?: string
  ml_risk_score?: number
  file_path?: string
  file?: string
  repository?: string
  repository_name?: string
  environment?: string
  detected_at?: string | null
  created_at?: string | null
  age_days?: number
  description?: string
  line?: number
  line_number?: number
  [key: string]: unknown
}

export interface PolicyMatch {
  policy: Policy
  findings: PolicyFinding[]
}

export interface PolicyEvaluation {
  matches: PolicyMatch[]
  unmatchedFindings: PolicyFinding[]
  summary: {
    totalFindings: number
    totalMatches: number // sum of findings across all matched policies (may double-count)
    uniqueFindingsMatched: number
    policiesFired: number
  }
}

// ---------- Field accessors ---------------------------------------------------

function toLower(v: unknown): string {
  return typeof v === 'string' ? v.toLowerCase() : ''
}

function daysBetween(iso: string | null | undefined): number | null {
  if (!iso) return null
  const t = new Date(iso).getTime()
  if (Number.isNaN(t)) return null
  return Math.max(0, Math.floor((Date.now() - t) / (24 * 60 * 60 * 1000)))
}

function getField(finding: PolicyFinding, field: string): unknown {
  switch (field) {
    case 'secret_type':
      return finding.secret_type ?? finding.type
    case 'risk_level':
    case 'severity':
      return (finding.risk_level ?? finding.severity ?? '').toString().toLowerCase()
    case 'ml_risk_score':
      return typeof finding.ml_risk_score === 'number' ? finding.ml_risk_score : null
    case 'file_path':
    case 'file':
      return finding.file_path ?? finding.file ?? ''
    case 'repository':
      return finding.repository_name ?? finding.repository ?? ''
    case 'environment':
      // Infer environment from file path if the finding doesn't carry one.
      if (finding.environment) return finding.environment
      const p = (finding.file_path ?? finding.file ?? '').toString().toLowerCase()
      if (/prod/.test(p)) return 'production'
      if (/stag/.test(p)) return 'staging'
      if (/(dev|test|local)/.test(p)) return 'development'
      return ''
    case 'age_days':
      if (typeof finding.age_days === 'number') return finding.age_days
      return daysBetween(finding.detected_at ?? finding.created_at ?? null)
    case 'description':
      return finding.description ?? ''
    default:
      return (finding as Record<string, unknown>)[field] ?? null
  }
}

// ---------- Operator ----------------------------------------------------------

function parseList(raw: unknown): string[] {
  if (Array.isArray(raw)) return raw.map((v) => String(v).trim().toLowerCase())
  if (raw == null) return []
  return String(raw)
    .split(',')
    .map((v) => v.trim().toLowerCase())
    .filter(Boolean)
}

function toNumber(v: unknown): number | null {
  if (typeof v === 'number') return Number.isFinite(v) ? v : null
  if (typeof v === 'string' && v.trim() !== '') {
    const n = Number(v)
    return Number.isFinite(n) ? n : null
  }
  return null
}

export function matchCondition(finding: PolicyFinding, cond: PolicyCondition): boolean {
  const actual = getField(finding, cond.field)
  const op = cond.operator as PolicyOperator

  switch (op) {
    case 'equals':
      return toLower(actual) === toLower(cond.value)
    case 'not_equals':
      return toLower(actual) !== toLower(cond.value)
    case 'contains':
      return toLower(actual).includes(toLower(cond.value))
    case 'not_contains':
      return !toLower(actual).includes(toLower(cond.value))
    case 'gt':
    case 'gte':
    case 'lt':
    case 'lte': {
      const a = toNumber(actual)
      const b = toNumber(cond.value)
      if (a == null || b == null) return false
      if (op === 'gt') return a > b
      if (op === 'gte') return a >= b
      if (op === 'lt') return a < b
      return a <= b
    }
    case 'in':
      return parseList(cond.value).includes(toLower(actual))
    case 'not_in':
      return !parseList(cond.value).includes(toLower(actual))
    case 'regex': {
      try {
        const re = new RegExp(String(cond.value), 'i')
        return re.test(String(actual ?? ''))
      } catch {
        return false
      }
    }
    default:
      return false
  }
}

// ---------- Policy matching ---------------------------------------------------

export function matchPolicy(finding: PolicyFinding, policy: Policy): boolean {
  if (!policy.enabled) return false
  // Empty conditions list → matches every finding (documented in the UI).
  if (!policy.conditions || policy.conditions.length === 0) return true
  return policy.conditions.every((c) => matchCondition(finding, c))
}

export function evaluatePolicies(
  findings: PolicyFinding[],
  policies: Policy[],
): PolicyEvaluation {
  // Priority DESC so higher-priority policies fire first in the reporting order.
  const ordered = [...policies]
    .filter((p) => p.enabled)
    .sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0))

  const matches: PolicyMatch[] = []
  const matchedIds = new Set<string>()

  for (const policy of ordered) {
    const hits = findings.filter((f) => matchPolicy(f, policy))
    if (hits.length > 0) {
      matches.push({ policy, findings: hits })
      for (const f of hits) matchedIds.add(String(f.id ?? `${f.file_path}:${f.line_number}`))
    }
  }

  const unmatchedFindings = findings.filter(
    (f) => !matchedIds.has(String(f.id ?? `${f.file_path}:${f.line_number}`)),
  )

  return {
    matches,
    unmatchedFindings,
    summary: {
      totalFindings: findings.length,
      totalMatches: matches.reduce((sum, m) => sum + m.findings.length, 0),
      uniqueFindingsMatched: matchedIds.size,
      policiesFired: matches.length,
    },
  }
}
