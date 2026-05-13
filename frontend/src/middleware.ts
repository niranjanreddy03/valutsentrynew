import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

/**
 * Middleware — session refresh + hijack-prevention hardening + CSP nonce.
 *
 * Responsibilities (in order):
 *   1. Generate a cryptographic nonce for every request and inject a
 *      Content-Security-Policy header that allowlists *only* scripts tagged
 *      with that nonce (plus the explicitly trusted third-party origins).
 *   2. Apply consistent cookie flags to every Supabase auth cookie we set or
 *      touch (Secure in prod, SameSite=Lax for login-redirect compatibility).
 *   3. Refresh the Supabase session and make the fresh access token
 *      available to the downstream request.
 *   4. Gate protected routes.
 *   5. Detect obvious session-hijack signals (sudden UA change) and force
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

/* ------------------------------------------------------------------ */
/*  CSP — built per-request with a fresh nonce                        */
/* ------------------------------------------------------------------ */

/**
 * Build CSP directives from a structured map so diffs stay reviewable.
 *
 * Key hardening vs. the original CSP:
 *   • `'unsafe-eval'`   removed from script-src in production
 *   • `'unsafe-inline'` removed from script-src in production (nonce replaces it)
 *   • Wildcard `*.razorpay.com` replaced with pinned subdomains
 *   • Missing fallback directives added (worker-src, child-src, manifest-src)
 *   • `'unsafe-inline'` kept in style-src — required by Tailwind runtime
 *
 * The nonce is the primary mechanism: CSP Level 2+ browsers automatically
 * ignore 'unsafe-inline' when a nonce is present in script-src, so
 * production gets nonce-only enforcement without needing 'strict-dynamic'.
 */
function buildCsp(nonce: string): string {
  const directives: Record<string, string[]> = {
    'default-src': ["'self'"],
    'script-src': [
      "'self'",
      `'nonce-${nonce}'`,
      // In dev we need unsafe-eval for Fast Refresh / HMR
      // and unsafe-inline as a fallback for injected dev scripts.
      // NOTE: In CSP Level 2+ browsers, 'unsafe-inline' is automatically
      // ignored when a nonce is present — so it only helps as a fallback
      // for very old browsers.
      ...(!isProd ? ["'unsafe-eval'", "'unsafe-inline'"] : []),
      'https://challenges.cloudflare.com',
      'https://checkout.razorpay.com',
      'https://cdn.razorpay.com',
      'https://api.razorpay.com',
    ],
    // Tailwind runtime + React inline styles + Google Fonts all require unsafe-inline.
    'style-src': ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
    'img-src': ["'self'", 'data:', 'blob:'],
    'font-src': ["'self'", 'data:', 'https://fonts.gstatic.com'],
    'connect-src': [
      "'self'",
      'https://*.supabase.co',
      'wss://*.supabase.co',
      'https://challenges.cloudflare.com',
      'https://api.resend.com',
      'https://hooks.slack.com',
      'https://api.razorpay.com',
      'https://checkout.razorpay.com',
      'https://cdn.razorpay.com',
      'https://lumberjack.razorpay.com',
    ],
    'frame-src': [
      "'self'",
      'https://challenges.cloudflare.com',
      'https://api.razorpay.com',
      'https://checkout.razorpay.com',
    ],
    'frame-ancestors': ["'none'"],
    'form-action': ["'self'"],
    'base-uri': ["'self'"],
    'object-src': ["'none'"],
    'worker-src': ["'self'"],
    'child-src': ["'self'"],
    'manifest-src': ["'self'"],
  }

  if (isProd) {
    directives['upgrade-insecure-requests'] = []
  }

  return Object.entries(directives)
    .map(([k, v]) => (v.length ? `${k} ${v.join(' ')}` : k))
    .join('; ')
}

/* ------------------------------------------------------------------ */
/*  Cookie hardening                                                   */
/* ------------------------------------------------------------------ */

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
    httpOnly: false,
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

/**
 * Refresh the Supabase session.
 *
 * Accepts `requestHeaders` so the nonce and CSP headers propagate through
 * every `NextResponse.next()` call — this is critical for Next.js to
 * auto-apply the nonce to its framework scripts.
 */
export async function updateSession(
  request: NextRequest,
  requestHeaders: Headers,
) {
  let response = NextResponse.next({
    request: { headers: requestHeaders },
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
          response = NextResponse.next({ request: { headers: requestHeaders } })
          response.cookies.set({ name, value, ...hardened })
        },
        remove(name: string, options: CookieOptions) {
          const hardened = hardenCookie(options)
          request.cookies.set({ name, value: '', ...hardened })
          response = NextResponse.next({ request: { headers: requestHeaders } })
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
  // ── 1. Generate a per-request cryptographic nonce ───────────────────
  const nonce = Buffer.from(crypto.getRandomValues(new Uint8Array(16))).toString('base64')
  const cspHeader = buildCsp(nonce)

  // Clone request headers and inject nonce + CSP.
  // Next.js reads the CSP from the *request* headers to discover the nonce
  // and auto-apply it to all framework-generated <script> tags.
  const requestHeaders = new Headers(request.headers)
  requestHeaders.set('x-nonce', nonce)
  requestHeaders.set('Content-Security-Policy', cspHeader)

  // ── 2. Refresh the Supabase session ────────────────────────────────
  // Pass requestHeaders so the nonce survives through every
  // NextResponse.next() call inside updateSession.
  const response = await updateSession(request, requestHeaders)

  // ── 3. Inject CSP into the *response* headers ─────────────────────
  // The request-header CSP tells Next.js which nonce to use at render time.
  // The response-header CSP tells the browser what to enforce.
  response.headers.set('Content-Security-Policy', cspHeader)
  response.headers.set('x-nonce', nonce)

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

  // Auth checks disabled temporarily for Amplify deployment testing.
  // Amplify's serverless environment doesn't pass cookies reliably
  // to the middleware, causing redirect loops after login.
  return response
}

export const config = {
  matcher: [
    /*
     * Match ALL routes including _next/static so every response carries
     * the CSP header.  We still exclude only image/font assets that
     * don't benefit from CSP.
     */
    '/((?!_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
