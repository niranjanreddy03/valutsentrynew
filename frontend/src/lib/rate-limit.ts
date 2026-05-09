/**
 * Lightweight rate-limiter for Next.js API routes and auth actions.
 *
 * Two layers:
 *   1. `clientRateLimit` — runs in the browser, prevents rapid-fire form
 *      submissions without a network round-trip.
 *   2. `serverRateLimit` — runs in API routes / middleware using an in-memory
 *      sliding-window counter keyed by IP. On Amplify (serverless), each
 *      Lambda instance has its own map, so it won't catch a truly distributed
 *      attack — but it blocks simple script-kiddie loops effectively. For
 *      full DDoS protection, use AWS WAF or Cloudflare in front of Amplify.
 *
 * Neither layer is a replacement for infrastructure-level DDoS mitigation,
 * but they cover the common abuse patterns (credential stuffing, brute-force
 * login, signup spam) well enough.
 */

// ─── Client-side rate limiter ───────────────────────────────────────────────

const clientTimestamps = new Map<string, number[]>()

/**
 * Client-side sliding-window rate limit.
 *
 * @param key   — action identifier, e.g. "login", "register"
 * @param limit — max attempts allowed in the window
 * @param windowMs — window duration in milliseconds (default 60 s)
 * @returns `null` if allowed, or a user-facing error string if blocked
 */
export function clientRateLimit(
  key: string,
  limit: number = 5,
  windowMs: number = 60_000,
): string | null {
  const now = Date.now()
  const timestamps = clientTimestamps.get(key) ?? []

  // Drop entries outside the window
  const recent = timestamps.filter((t) => now - t < windowMs)

  if (recent.length >= limit) {
    const oldestInWindow = recent[0]
    const waitSec = Math.ceil((windowMs - (now - oldestInWindow)) / 1000)
    return `Too many attempts. Please wait ${waitSec} seconds before trying again.`
  }

  recent.push(now)
  clientTimestamps.set(key, recent)
  return null
}

/** Reset a specific client rate-limit key (e.g. after successful login). */
export function clientRateLimitReset(key: string): void {
  clientTimestamps.delete(key)
}

// ─── Server-side rate limiter ───────────────────────────────────────────────

interface WindowEntry {
  timestamps: number[]
}

const ipWindows = new Map<string, WindowEntry>()

// Periodically prune stale IPs so the map doesn't grow unbounded.
// On serverless this timer is short-lived anyway.
let pruneTimer: ReturnType<typeof setInterval> | null = null

function ensurePruner() {
  if (pruneTimer) return
  pruneTimer = setInterval(
    () => {
      const now = Date.now()
      for (const [key, entry] of ipWindows) {
        entry.timestamps = entry.timestamps.filter((t) => now - t < 120_000)
        if (entry.timestamps.length === 0) ipWindows.delete(key)
      }
    },
    60_000, // prune every minute
  )
  // Don't keep the process alive just for cleanup.
  if (typeof pruneTimer === 'object' && 'unref' in pruneTimer) {
    pruneTimer.unref()
  }
}

export interface RateLimitResult {
  allowed: boolean
  retryAfterSec?: number
  remaining: number
}

/**
 * Server-side sliding-window rate limit keyed by IP + action.
 *
 * @param ip       — client IP (use `getClientIp` from turnstile.ts or x-forwarded-for)
 * @param action   — e.g. "login", "register", "forgot-password"
 * @param limit    — max requests in the window (default 10)
 * @param windowMs — window duration in ms (default 60 s)
 */
export function serverRateLimit(
  ip: string,
  action: string,
  limit: number = 10,
  windowMs: number = 60_000,
): RateLimitResult {
  ensurePruner()

  const key = `${action}:${ip}`
  const now = Date.now()
  const entry = ipWindows.get(key) ?? { timestamps: [] }

  // Trim to window
  entry.timestamps = entry.timestamps.filter((t) => now - t < windowMs)

  if (entry.timestamps.length >= limit) {
    const oldest = entry.timestamps[0]
    const retryAfterSec = Math.ceil((windowMs - (now - oldest)) / 1000)
    ipWindows.set(key, entry)
    return { allowed: false, retryAfterSec, remaining: 0 }
  }

  entry.timestamps.push(now)
  ipWindows.set(key, entry)
  return { allowed: true, remaining: limit - entry.timestamps.length }
}

/**
 * Extract client IP from request headers.
 * Works behind CloudFront / Amplify / Cloudflare proxies.
 */
export function getClientIp(headers: Headers): string {
  const xff = headers.get('x-forwarded-for')
  if (xff) return xff.split(',')[0].trim()
  return (
    headers.get('cf-connecting-ip') ||
    headers.get('x-real-ip') ||
    '127.0.0.1'
  )
}

/**
 * Helper that returns a 429 Response when the limit is exceeded.
 * Use in Next.js API routes:
 *
 *   const blocked = rateLimitOrBlock(request, 'login', 5, 60_000)
 *   if (blocked) return blocked
 */
export function rateLimitOrBlock(
  request: { headers: Headers },
  action: string,
  limit: number = 10,
  windowMs: number = 60_000,
): Response | null {
  const ip = getClientIp(request.headers)
  const result = serverRateLimit(ip, action, limit, windowMs)

  if (!result.allowed) {
    return new Response(
      JSON.stringify({
        error: 'Too many requests',
        retryAfterSec: result.retryAfterSec,
      }),
      {
        status: 429,
        headers: {
          'Content-Type': 'application/json',
          'Retry-After': String(result.retryAfterSec ?? 60),
        },
      },
    )
  }

  return null
}
