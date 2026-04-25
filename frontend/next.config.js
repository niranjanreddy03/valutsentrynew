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
 * Changes here must be paired with a CSP-report test deploy — a single wrong
 * directive can white-screen the app. Run with `Content-Security-Policy-
 * Report-Only` first when adjusting the CSP.
 */
const isProd = process.env.NODE_ENV === 'production'

// Build CSP from a structured map so diffs stay reviewable.
const CSP_DIRECTIVES = {
  'default-src': ["'self'"],
  // Next.js injects a per-request nonce in production. In dev we need
  // 'unsafe-eval' for Fast Refresh.
  'script-src': isProd
    ? ["'self'", "'strict-dynamic'", "'nonce-__CSP_NONCE__'", 'https://challenges.cloudflare.com', 'https://checkout.razorpay.com']
    : ["'self'", "'unsafe-eval'", "'unsafe-inline'", 'https://challenges.cloudflare.com', 'https://checkout.razorpay.com'],
  'style-src': ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'], // Tailwind runtime classes + Google Fonts
  'img-src': ["'self'", 'data:', 'blob:', 'https:'],
  'font-src': ["'self'", 'data:', 'https://fonts.gstatic.com'],
  'connect-src': [
    "'self'",
    'https://*.supabase.co',
    'wss://*.supabase.co',
    'https://challenges.cloudflare.com',
    'https://api.resend.com',
    'https://hooks.slack.com',
    'https://*.razorpay.com',
    'https://lumberjack.razorpay.com',
  ],
  'frame-src': ["'self'", 'https://challenges.cloudflare.com', 'https://api.razorpay.com', 'https://*.razorpay.com'],
  'frame-ancestors': ["'none'"],
  'form-action': ["'self'"],
  'base-uri': ["'self'"],
  'object-src': ["'none'"],
  'upgrade-insecure-requests': [],
}

const csp = Object.entries(CSP_DIRECTIVES)
  .map(([k, v]) => (v.length ? `${k} ${v.join(' ')}` : k))
  .join('; ')

const securityHeaders = [
  // Force HTTPS for two years; eligible for the HSTS preload list.
  {
    key: 'Strict-Transport-Security',
    value: 'max-age=63072000; includeSubDomains; preload',
  },
  { key: 'Content-Security-Policy', value: csp },
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
]

const nextConfig = {
  reactStrictMode: true,
  // Block the `x-powered-by: Next.js` fingerprint.
  poweredByHeader: false,

  async headers() {
    return [
      {
        source: '/:path*',
        headers: securityHeaders,
      },
    ]
  },

  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: 'http://localhost:8000/api/:path*',
      },
    ]
  },
}

module.exports = nextConfig
