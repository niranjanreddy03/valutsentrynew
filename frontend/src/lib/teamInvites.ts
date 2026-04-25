/**
 * Team invites — resilient flow that works whether or not the FastAPI
 * backend is reachable.
 *
 * Design:
 *   1. Validate input (email, team, no duplicates).
 *   2. POST to `/api/teams?teamId=…&action=members` (backend of record).
 *      - Header encoding is defensive: `x-user-name` is URL-encoded so
 *        non-ASCII characters don't blow up the fetch ByteString check.
 *   3. If the backend is unreachable OR returns a transient error
 *      (5xx / 502 proxy error), we fall back to a *local pending invite*
 *      stored in localStorage so the UI reflects the intent.
 *   4. Regardless of step 2/3, fire a magic-link email via
 *      `/api/invite-email`. Swallow and surface its failure separately so
 *      a broken email service doesn't look like the invite failed.
 *
 * The returned `InviteOutcome` lets callers show accurate toasts:
 *   - `memberPersistedOn = 'backend' | 'local' | 'none'`
 *   - `emailSent = true | false`
 */

import { getAuthHeaders } from '@/lib/authHeaders'

export type MemberRole = 'admin' | 'member' | 'viewer'
export type MemberStatus = 'active' | 'pending'

export interface InvitedMember {
  id: number | string
  team_id: number
  user_id: string
  email: string
  name: string
  role: MemberRole
  status: MemberStatus
  joined_at: string
  source?: 'backend' | 'local'
}

export interface InviteInput {
  teamId: number
  teamName: string
  email: string
  name?: string
  role: MemberRole
  /** Existing members of this team — used to prevent duplicate invites. */
  existingMembers?: Array<{ email?: string }>
}

export interface InviteOutcome {
  member: InvitedMember
  memberPersistedOn: 'backend' | 'local'
  emailSent: boolean
  emailError?: string
  backendError?: string
}

const LOCAL_PENDING_KEY = 'vaultsentry_team_pending_invites'
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

/* ------------------------------------------------------------------ */
/*  Input validation                                                   */
/* ------------------------------------------------------------------ */

export class InviteValidationError extends Error {
  code: string
  constructor(code: string, message: string) {
    super(message)
    this.code = code
  }
}

export function validateInvite(input: InviteInput): void {
  if (!input.teamId) {
    throw new InviteValidationError('no_team', 'Select a team before inviting.')
  }
  const email = input.email.trim().toLowerCase()
  if (!email) {
    throw new InviteValidationError('no_email', 'Enter an email address.')
  }
  if (!EMAIL_REGEX.test(email)) {
    throw new InviteValidationError('bad_email', 'That doesn’t look like a valid email.')
  }
  if (input.existingMembers?.some((m) => m.email?.toLowerCase() === email)) {
    throw new InviteValidationError(
      'duplicate',
      'That email is already a member of this team.',
    )
  }
}

/* ------------------------------------------------------------------ */
/*  Local pending-invite store (fallback when backend is down)         */
/* ------------------------------------------------------------------ */

function safeStorage(): Storage | null {
  if (typeof window === 'undefined') return null
  try {
    return window.localStorage
  } catch {
    return null
  }
}

export function getLocalPendingInvites(teamId?: number): InvitedMember[] {
  const s = safeStorage()
  if (!s) return []
  try {
    const list = JSON.parse(s.getItem(LOCAL_PENDING_KEY) || '[]') as InvitedMember[]
    return teamId ? list.filter((m) => m.team_id === teamId) : list
  } catch {
    return []
  }
}

function saveLocalPendingInvites(list: InvitedMember[]) {
  const s = safeStorage()
  if (!s) return
  s.setItem(LOCAL_PENDING_KEY, JSON.stringify(list))
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('vaultsentry:team-invites-updated'))
  }
}

export function appendLocalPendingInvite(m: InvitedMember) {
  const list = getLocalPendingInvites()
  list.push(m)
  saveLocalPendingInvites(list)
}

export function removeLocalPendingInvite(teamId: number, email: string) {
  const target = email.toLowerCase()
  saveLocalPendingInvites(
    getLocalPendingInvites().filter(
      (m) => !(m.team_id === teamId && m.email.toLowerCase() === target),
    ),
  )
}

/* ------------------------------------------------------------------ */
/*  Header safety — x-user-name may contain non-ASCII (e.g. emoji)    */
/* ------------------------------------------------------------------ */

function safeHeaders(): Record<string, string> {
  const raw = getAuthHeaders()
  const out: Record<string, string> = {}
  for (const [k, v] of Object.entries(raw)) {
    // Fetch requires ByteString-safe headers. Percent-encode anything
    // outside the Latin-1 range so non-ASCII user names don't throw.
    if (typeof v !== 'string') continue
    // eslint-disable-next-line no-control-regex
    out[k] = /[^\x00-\x7F]/.test(v) ? encodeURIComponent(v) : v
  }
  return out
}

/* ------------------------------------------------------------------ */
/*  Backend calls                                                      */
/* ------------------------------------------------------------------ */

async function postMemberToBackend(
  input: InviteInput,
): Promise<{ ok: true; member: InvitedMember } | { ok: false; status?: number; error: string }> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 6000)
  try {
    const res = await fetch(
      `/api/teams?teamId=${input.teamId}&action=members`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...safeHeaders() },
        body: JSON.stringify({
          email: input.email.trim().toLowerCase(),
          name: input.name?.trim() || '',
          role: input.role,
        }),
        signal: controller.signal,
      },
    )
    const body = await res.json().catch(() => ({}))
    if (!res.ok) {
      return {
        ok: false,
        status: res.status,
        error:
          body?.error ||
          body?.detail ||
          `Backend returned ${res.status} ${res.statusText || ''}`.trim(),
      }
    }
    return { ok: true, member: { ...body, source: 'backend' } }
  } catch (err: any) {
    return {
      ok: false,
      error:
        err?.name === 'AbortError'
          ? 'Backend timed out after 6s'
          : err?.message || 'Network error',
    }
  } finally {
    clearTimeout(timeout)
  }
}

async function sendInviteEmail(
  input: InviteInput,
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const res = await fetch('/api/invite-email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: input.email.trim().toLowerCase(),
        teamName: input.teamName,
        inviterName: safeHeaders()['x-user-name'] || 'A team member',
        role: input.role,
      }),
    })
    const data = await res.json().catch(() => ({}))
    if (res.ok && data?.success) return { ok: true }
    return { ok: false, error: data?.error || `Email service: ${res.status}` }
  } catch (err: any) {
    return { ok: false, error: err?.message || 'Email service unavailable' }
  }
}

/* ------------------------------------------------------------------ */
/*  Public entrypoint                                                  */
/* ------------------------------------------------------------------ */

/**
 * Invite a member. Throws `InviteValidationError` for bad input. Anything
 * else — backend failure, email failure — is captured on the returned
 * `InviteOutcome` so callers can give the user a precise explanation.
 */
export async function inviteMember(input: InviteInput): Promise<InviteOutcome> {
  validateInvite(input)

  const email = input.email.trim().toLowerCase()
  const name = input.name?.trim() || email.split('@')[0]

  // 1) Backend first.
  const backend = await postMemberToBackend({ ...input, email, name })

  let member: InvitedMember
  let memberPersistedOn: InviteOutcome['memberPersistedOn']
  let backendError: string | undefined

  if (backend.ok) {
    member = backend.member
    memberPersistedOn = 'backend'
  } else {
    backendError = backend.error
    // 2) Fall back to local pending invite so UI still reflects intent.
    member = {
      id: `local_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      team_id: input.teamId,
      user_id: '',
      email,
      name,
      role: input.role,
      status: 'pending',
      joined_at: new Date().toISOString(),
      source: 'local',
    }
    appendLocalPendingInvite(member)
    memberPersistedOn = 'local'
  }

  // 3) Fire the invite email independently — it's useful whether the member
  //    ended up in the backend or in local pending.
  const email_result = await sendInviteEmail({ ...input, email, name })

  return {
    member,
    memberPersistedOn,
    emailSent: email_result.ok,
    emailError: email_result.ok ? undefined : email_result.error,
    backendError,
  }
}

/**
 * Retry a locally-stored pending invite against the backend. Call this
 * when the backend is known to be back up (e.g. on refocus or mount).
 */
export async function retryLocalPendingInvite(
  m: InvitedMember,
  teamName: string,
): Promise<boolean> {
  const r = await postMemberToBackend({
    teamId: m.team_id,
    teamName,
    email: m.email,
    name: m.name,
    role: m.role,
  })
  if (r.ok) {
    removeLocalPendingInvite(m.team_id, m.email)
    return true
  }
  return false
}
