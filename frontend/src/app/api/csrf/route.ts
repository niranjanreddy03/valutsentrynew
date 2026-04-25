/**
 * GET /api/csrf — issue (or refresh) the double-submit CSRF token pair.
 *
 * The client calls this once on app boot; the HttpOnly cookie stays on the
 * server side while the public mirror cookie is read by secureFetch. Tokens
 * rotate on every call, so calling this right after login rebinds CSRF to
 * the new session.
 */

import { NextResponse } from 'next/server'
import { attachCsrfCookies, mintCsrfToken } from '@/lib/csrf'

export async function GET() {
  const token = mintCsrfToken()
  const res = NextResponse.json({ ok: true })
  attachCsrfCookies(res, token)
  // Never cache a CSRF response.
  res.headers.set('Cache-Control', 'no-store, max-age=0')
  return res
}
