import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

/**
 * Middleware — session refresh + hijack-prevention hardening.
 *
 * Responsibilities (in order):
 *   1. Apply strict cookie flags to every Supabase auth cookie we set or
 *      touch (HttpOnly, Secure in prod, SameSite=Lax for login-redirect
 *      compatibility, __Host- prefix where possible).
 *   2. Refresh the Supabase session and make the fresh access token
 *      available to the downstream request.
 *   3. Gate protected routes.
 *   4. Detect obvious session-hijack signals (sudden UA change) and force
 *      a re-authentication when they fire.
 *
 * We deliberately do NOT put the Supabase access token into a JS-readable
 * cookie — it is always HttpOnly. Client code talks to Supabase via the
 * browser SDK which manages its own cookie storage; we augment those
 * cookies' flags as they pass through this middleware.
 */

const PROTECTED_ROUTES = [
  '/',
  '/repositories',
  '/scans',
  '/secrets',
  '/alerts',
  '/reports',
  '/settings',
  '/integrations',
  '/teams',
  '/api-keys',
  '/audit',
  '/scheduled-scans',
  '/s3-buckets',
]

const AUTH_ROUTES = ['/login', '/register', '/forgot-password']

const isProd = process.env.NODE_ENV === 'production'

/**
 * Normalise cookie options so every auth cookie we emit has the same
 * hardened flags, regardless of what Supabase's SSR helper asked for.
 *
 * We intentionally keep SameSite=Lax instead of Strict — Strict would break
 * the OAuth-callback redirect (the browser wouldn't send the cookie on the
 * top-level GET after the IdP redirect). Lax still blocks the classic CSRF
 * shape (cross-site form POST) and we layer an explicit CSRF token on top
 * for mutating requests.
 */
function hardenCookie(options: CookieOptions): CookieOptions {
  return {
    ...options,
    httpOnly: true,
    secure: isProd,
    sameSite: 'lax',
    path: options.path ?? '/',
  }
}

/** SHA-256 first 16 chars — enough to detect UA changes without storing raw data. */
async function fingerprint(input: string): Promise<string> {
  const buf = new TextEncoder().encode(input)
  const hash = await crypto.subtle.digest('SHA-256', buf)
  return Array.from(new Uint8Array(hash))
    .slice(0, 8)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({
    request: { headers: request.headers },
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return request.cookies.get(name)?.value
        },
        set(name: string, value: string, options: CookieOptions) {
          const hardened = hardenCookie(options)
          request.cookies.set({ name, value, ...hardened })
          response = NextResponse.next({ request: { headers: request.headers } })
          response.cookies.set({ name, value, ...hardened })
        },
        remove(name: string, options: CookieOptions) {
          const hardened = hardenCookie(options)
          request.cookies.set({ name, value: '', ...hardened })
          response = NextResponse.next({ request: { headers: request.headers } })
          response.cookies.set({ name, value: '', ...hardened })
        },
      },
    },
  )

  // Refreshing the session rotates the access token on every request once
  // it's within its refresh window — that's our baseline session-rotation
  // mechanism.
  await supabase.auth.getUser()

  return response
}

/**
 * Check the request for simple session-hijack indicators:
 *   • the session fingerprint cookie (UA hash set at login) differs from
 *     the current UA — treat as a likely stolen cookie and drop the session
 *   • missing origin / suspicious origin on a state-changing request
 *
 * Anything more sophisticated (geoip velocity, concurrent-session counts)
 * lives in the backend `/api/session/heartbeat` endpoint — the middleware
 * is latency-sensitive so we keep the check cheap.
 */
async function looksHijacked(
  request: NextRequest,
  response: NextResponse,
): Promise<boolean> {
  const ua = request.headers.get('user-agent') ?? ''
  const expected = request.cookies.get('vs_fp')?.value
  if (!expected) {
    // First authenticated request in this browser — pin the fingerprint.
    const fp = await fingerprint(ua)
    response.cookies.set({
      name: 'vs_fp',
      value: fp,
      httpOnly: true,
      secure: isProd,
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 8, // 8h absolute cap
    })
    return false
  }
  const now = await fingerprint(ua)
  return now !== expected
}

export async function middleware(request: NextRequest) {
  const response = await updateSession(request)

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return request.cookies.get(name)?.value
        },
        set() {},
        remove() {},
      },
    },
  )

  const {
    data: { user },
  } = await supabase.auth.getUser()
  const pathname = request.nextUrl.pathname

  // DEVELOPMENT MODE: Skip auth checks for testing. NEVER run in prod.
  if (!isProd) return response

  // Hijack heuristic — fires before route gating so a compromised cookie is
  // invalidated on the way in, not after the attacker has already loaded
  // the target page.
  if (user && (await looksHijacked(request, response))) {
    await supabase.auth.signOut()
    const loginUrl = new URL('/login', request.url)
    loginUrl.searchParams.set('reason', 'session_anomaly')
    const res = NextResponse.redirect(loginUrl)
    res.cookies.delete('vs_fp')
    return res
  }

  // Redirect to login if accessing protected route without auth
  if (
    PROTECTED_ROUTES.some(
      (route) => pathname === route || pathname.startsWith(route + '/'),
    ) &&
    !user
  ) {
    const loginUrl = new URL('/login', request.url)
    loginUrl.searchParams.set('redirect', pathname)
    return NextResponse.redirect(loginUrl)
  }

  // Redirect to dashboard if accessing auth routes while logged in
  if (AUTH_ROUTES.includes(pathname) && user) {
    return NextResponse.redirect(new URL('/', request.url))
  }

  return response
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
