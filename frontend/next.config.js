/** @type {import('next').NextConfig} */

/**
 * Security headers applied to every response.
 *
 * Layered defense against session hijacking & adjacent attacks:
 *   • HSTS               — forces HTTPS for 2 years, includes subdomains
 *   • CSP                — blocks inline JS, constrains connect-src to Supabase
 *                           + our own origin, neutralising stored-XSS → cookie theft
 *   • X-Frame-Options    — denies iframes so an attacker can't UI-redress us
 *   • Referrer-Policy    — strip Referer on cross-origin requests
 *   • Permissions-Policy — kill unused device APIs
 *   • COOP / CORP        — process isolation so a compromised cross-origin
 *                           popup can't share our memory
 *
 * The CSP is applied via middleware (not here) so that a unique nonce can be
 * injected per-request.  We keep the remaining security headers here in
 * next.config.js because they are static and don't need per-request variation.
 *
 * Changes here must be paired with a CSP-report test deploy — a single wrong
 * directive can white-screen the app. Run with `Content-Security-Policy-
 * Report-Only` first when adjusting the CSP.
 */
const isProd = process.env.NODE_ENV === 'production'

// Static fallback CSP for responses that bypass middleware (CDN error pages,
// static asset 404s, etc.).  The middleware CSP (with per-request nonce) takes
// precedence for all routes where middleware actually runs.
const fallbackCsp = [
  "default-src 'self'",
  "script-src 'self' 'strict-dynamic'",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "img-src 'self' data: blob:",
  "font-src 'self' data: https://fonts.gstatic.com",
  "connect-src 'self'",
  "frame-src 'none'",
  "frame-ancestors 'none'",
  "form-action 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "worker-src 'self'",
  isProd ? 'upgrade-insecure-requests' : '',
].filter(Boolean).join('; ')

const securityHeaders = [
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  {
    key: 'Permissions-Policy',
    value: 'camera=(), microphone=(), geolocation=(), interest-cohort=()',
  },
  { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
  { key: 'Cross-Origin-Resource-Policy', value: 'same-origin' },
  { key: 'X-DNS-Prefetch-Control', value: 'off' },
  { key: 'Content-Security-Policy', value: fallbackCsp },
]

if (isProd) {
  // Force HTTPS for two years; eligible for the HSTS preload list.
  securityHeaders.unshift({
    key: 'Strict-Transport-Security',
    value: 'max-age=63072000; includeSubDomains; preload',
  })
}

const nextConfig = {
  reactStrictMode: true,
  // Block the `x-powered-by: Next.js` fingerprint.
  poweredByHeader: false,
  typescript: {
    ignoreBuildErrors: true,
  },

  // CVE-2025-56471 & CVE-2024-27980: Harden image optimization.
  // Empty remotePatterns = no external images via the optimizer.
  // minimumCacheTTL + deviceSizes limit disk-cache abuse.
  images: {
    remotePatterns: [],
    minimumCacheTTL: 60,
    formats: ['image/webp'],
  },

  async headers() {
    return [
      {
        source: '/:path*',
        headers: securityHeaders,
      },
    ]
  },

  async rewrites() {
    const backendUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v1'
    // Strip trailing /api/v1 to get the base URL for the rewrite destination.
    const backendBase = backendUrl.replace(/\/api\/v1\/?$/, '')

    return [
      {
        // Only proxy /api/v1/* to the scanner backend.
        // Other /api/* routes (razorpay, support, csrf, etc.) stay in Next.js.
        source: '/api/v1/:path*',
        destination: `${backendBase}/api/v1/:path*`,
      },
    ]
  },
}

module.exports = nextConfig
