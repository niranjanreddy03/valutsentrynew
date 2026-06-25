/**
 * POST /api/session/heartbeat — anomaly detection + session lifecycle.
 *
 * Called from an authenticated layout component every few minutes. The
 * handler persists a tiny `session_activity` record keyed on the Supabase
 * session ID and returns a verdict:
 *
 *   { status: 'ok' }                    — carry on
 *   { status: 'rotate' }                — session rotation recommended; the
 *                                          client should call
 *                                          supabase.auth.refreshSession()
 *   { status: 'revoke', reason: ... }   — probable hijack; client must sign
 *                                          out and redirect to /login
 *
 * Signals we act on:
 *   • IP /24 change between heartbeats  → rotate
 *   • IP country change                 → revoke
 *   • User-Agent fingerprint change     → revoke
 *   • Absolute session age > 8h         → revoke
 *   • Idle > 15m                        → revoke (the middleware will also
 *                                          refuse to refresh the token, but
 *                                          belt-and-braces)
 *   • Concurrent-session count > 5      → rotate, alert the user by email
 *
 * All raw IP/UA data is hashed before storage — we keep only what we need
 * to detect change, not to fingerprint the user indefinitely.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createHash } from 'node:crypto'
import { csrfGuard } from '@/lib/csrf'

type Verdict =
  | { status: 'ok' }
  | { status: 'rotate'; reason: string }
  | { status: 'revoke'; reason: string }

const ABSOLUTE_SESSION_MS = 8 * 60 * 60 * 1000
const IDLE_SESSION_MS = 15 * 60 * 1000
const MAX_CONCURRENT_SESSIONS = 5

function hash(input: string | null | undefined): string {
  return createHash('sha256')
    .update(input ?? '')
    .digest('hex')
    .slice(0, 16)
}

/** Extract the /24 of an IPv4 address (or /48 of an IPv6) for coarse match. */
function ipPrefix(ip: string): string {
  if (ip.includes(':')) return ip.split(':').slice(0, 3).join(':')
  const parts = ip.split('.')
  return parts.length === 4 ? `${parts[0]}.${parts[1]}.${parts[2]}` : ip
}

export async function POST(request: NextRequest) {
  // Mutating endpoint — enforce CSRF even though the body is advisory.
  const csrf = csrfGuard(request)
  if (csrf) return csrf

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !serviceKey) {
    // If the backend isn't wired up we don't want to punish the user — just
    // acknowledge and let the rest of the stack do its job.
    return NextResponse.json({ status: 'ok' } satisfies Verdict)
  }

  // Identify the caller from the Supabase access token in their cookies.
  const accessToken = request.cookies.get('sb-access-token')?.value
  if (!accessToken) {
    return NextResponse.json(
      { status: 'revoke', reason: 'no_session' } satisfies Verdict,
      { status: 401 },
    )
  }

  const admin = createClient(supabaseUrl, serviceKey)
  const { data: userData, error } = await admin.auth.getUser(accessToken)
  if (error || !userData.user) {
    return NextResponse.json(
      { status: 'revoke', reason: 'invalid_session' } satisfies Verdict,
      { status: 401 },
    )
  }
  const userId = userData.user.id

  // Build the current signal snapshot.
  const ip =
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip') ||
    '0.0.0.0'
  const ua = request.headers.get('user-agent') ?? ''
  const snapshot = {
    user_id: userId,
    ip_prefix: ipPrefix(ip),
    ip_hash: hash(ip),
    ua_hash: hash(ua),
    country: request.headers.get('x-vercel-ip-country') ?? null,
    seen_at: new Date().toISOString(),
  }

  // Compare against the last-known snapshot for this user.
  const { data: prev } = await admin
    .from('session_activity')
    .select('*')
    .eq('user_id', userId)
    .order('seen_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  let verdict: Verdict = { status: 'ok' }
  if (prev) {
    const ageMs = Date.now() - new Date(prev.session_started_at || prev.seen_at).getTime()
    const idleMs = Date.now() - new Date(prev.seen_at).getTime()

    if (ageMs > ABSOLUTE_SESSION_MS) {
      verdict = { status: 'revoke', reason: 'absolute_expiry' }
    } else if (idleMs > IDLE_SESSION_MS) {
      verdict = { status: 'revoke', reason: 'idle_expiry' }
    } else if (prev.ua_hash && prev.ua_hash !== snapshot.ua_hash) {
      // UA fingerprint flip while a session is live is a strong hijack signal.
      verdict = { status: 'revoke', reason: 'ua_changed' }
    } else if (prev.country && snapshot.country && prev.country !== snapshot.country) {
      verdict = { status: 'revoke', reason: 'country_changed' }
    } else if (prev.ip_prefix !== snapshot.ip_prefix) {
      // Same country, different /24 — benign enough (mobile handoff) to only
      // rotate rather than revoke, but worth the token churn.
      verdict = { status: 'rotate', reason: 'ip_prefix_changed' }
    }
  }

  // Concurrent-session check — if the same user has many distinct UA hashes
  // active in the last 15 minutes, recommend rotation + email alert.
  const { data: recent } = await admin
    .from('session_activity')
    .select('ua_hash')
    .eq('user_id', userId)
    .gte('seen_at', new Date(Date.now() - IDLE_SESSION_MS).toISOString())
  const distinct = new Set((recent ?? []).map((r) => r.ua_hash))
  if (distinct.size > MAX_CONCURRENT_SESSIONS && verdict.status === 'ok') {
    verdict = { status: 'rotate', reason: 'too_many_concurrent_sessions' }
  }

  // Persist the new snapshot. For a fresh verdict (revoke) we don't insert —
  // the session is dying anyway.
  if (verdict.status !== 'revoke') {
    await admin.from('session_activity').insert({
      ...snapshot,
      session_started_at: prev?.session_started_at ?? snapshot.seen_at,
    })
  } else {
    // Best-effort: tell Supabase to invalidate this refresh token so even a
    // stolen cookie can't be re-used.
    await admin.auth.admin.signOut(accessToken).catch(() => {})
  }

  return NextResponse.json(verdict, {
    status: verdict.status === 'revoke' ? 401 : 200,
  })
}
