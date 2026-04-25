/**
 * Client-safe CSRF constants and helpers.
 *
 * This file MUST NOT import any Node-only module (`node:crypto`, `fs`, …)
 * because it's bundled into the browser by `secureFetch.ts`. Server-only
 * helpers live in `./csrf.ts`.
 */

export const CSRF_COOKIE = 'vs_csrf' // HttpOnly — server-side truth
export const CSRF_PUBLIC_COOKIE = 'vs_csrf_pub' // JS-readable mirror
export const CSRF_HEADER = 'x-csrf-token'

export const CSRF_HEADERS = {
  cookie: CSRF_COOKIE,
  publicCookie: CSRF_PUBLIC_COOKIE,
  header: CSRF_HEADER,
}

/** Client helper — read the JS-visible mirror cookie. */
export function readCsrfTokenFromDocument(): string | null {
  if (typeof document === 'undefined') return null
  const match = document.cookie
    .split('; ')
    .find((c) => c.startsWith(`${CSRF_PUBLIC_COOKIE}=`))
  return match ? decodeURIComponent(match.split('=')[1]) : null
}
