/**
 * Double-submit CSRF protection — SERVER ONLY.
 *
 * How it works:
 *   1. On first visit, the server issues an HttpOnly `vs_csrf` cookie plus a
 *      readable `vs_csrf_pub` cookie that holds the SAME random value.
 *   2. Client code reads `vs_csrf_pub` via document.cookie and echoes it in
 *      the `X-CSRF-Token` header on every mutating request.
 *   3. `requireCsrf()` on the server compares the header against the
 *      HttpOnly cookie — a cross-site attacker can trigger the request but
 *      cannot read our cookies, so they can't forge the header.
 *
 * This module imports `node:crypto`, so it MUST NOT be imported from a
 * client component. Client code should import constants and the cookie
 * reader from `./csrf-shared` instead. `CSRF_HEADERS` is re-exported here
 * for convenience on the server side.
 */

import { NextResponse, type NextRequest } from 'next/server'
import { randomBytes, timingSafeEqual } from 'node:crypto'
import { CSRF_COOKIE, CSRF_PUBLIC_COOKIE, CSRF_HEADER, CSRF_HEADERS } from './csrf-shared'

export { CSRF_HEADERS }

const TOKEN_BYTES = 32
const isProd = process.env.NODE_ENV === 'production'

export function mintCsrfToken(): string {
  return randomBytes(TOKEN_BYTES).toString('base64url')
}

/** Attach both the HttpOnly truth-cookie and the JS-readable mirror. */
export function attachCsrfCookies(res: NextResponse, token: string): void {
  const base = {
    value: token,
    path: '/',
    sameSite: 'lax' as const,
    secure: isProd,
    maxAge: 60 * 60 * 8, // 8h — matches absolute session expiry
  }
  res.cookies.set({ name: CSRF_COOKIE, httpOnly: true, ...base })
  res.cookies.set({ name: CSRF_PUBLIC_COOKIE, httpOnly: false, ...base })
}

/**
 * Constant-time comparison. Rejects when:
 *   • the cookie or header is missing,
 *   • their lengths differ (timingSafeEqual would throw),
 *   • their contents differ,
 *   • the request came from an Origin we don't recognise.
 */
export function requireCsrf(
  request: NextRequest,
): { ok: true } | { ok: false; reason: string } {
  const method = request.method.toUpperCase()
  if (method === 'GET' || method === 'HEAD' || method === 'OPTIONS') {
    return { ok: true }
  }

  const origin = request.headers.get('origin')
  const host = request.headers.get('host')
  if (origin && host) {
    try {
      const originHost = new URL(origin).host
      if (originHost !== host) return { ok: false, reason: 'origin_mismatch' }
    } catch {
      return { ok: false, reason: 'origin_malformed' }
    }
  }

  const cookieToken = request.cookies.get(CSRF_COOKIE)?.value
  const headerToken = request.headers.get(CSRF_HEADER)
  if (!cookieToken || !headerToken) {
    return { ok: false, reason: 'missing_token' }
  }

  const a = Buffer.from(cookieToken)
  const b = Buffer.from(headerToken)
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    return { ok: false, reason: 'token_mismatch' }
  }
  return { ok: true }
}

export function csrfGuard(request: NextRequest): NextResponse | null {
  const check = requireCsrf(request)
  if (check.ok) return null
  return NextResponse.json(
    { error: 'CSRF validation failed', reason: check.reason },
    { status: 403 },
  )
}
