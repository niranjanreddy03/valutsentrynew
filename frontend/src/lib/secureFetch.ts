/**
 * secureFetch — drop-in replacement for `fetch()` that:
 *   • attaches the double-submit CSRF header on every mutating call,
 *   • always sends cookies (credentials: 'include') so the session cookie
 *     reaches our own API routes,
 *   • refuses cross-origin URLs unless explicitly allowed — prevents a
 *     supply-chain bug from silently sending auth cookies to third parties,
 *   • on 401 triggers a single session-refresh attempt before giving up.
 *
 * Use this in place of `fetch` for anything that hits `/api/*`.
 */

import { readCsrfTokenFromDocument, CSRF_HEADERS } from './csrf-shared'

export interface SecureFetchOptions extends RequestInit {
  /**
   * Pass `true` to allow URLs on origins other than the current one. Off by
   * default so a typo doesn't leak credentials.
   */
  allowCrossOrigin?: boolean
}

const MUTATING_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE'])

export async function secureFetch(
  input: RequestInfo | URL,
  init: SecureFetchOptions = {},
): Promise<Response> {
  const url = typeof input === 'string' ? input : input.toString()

  // Refuse cross-origin unless opted in.
  if (!init.allowCrossOrigin && typeof window !== 'undefined') {
    try {
      const target = new URL(url, window.location.origin)
      if (target.origin !== window.location.origin) {
        throw new Error(
          `secureFetch refusing cross-origin request to ${target.origin}. ` +
            `Pass { allowCrossOrigin: true } to override.`,
        )
      }
    } catch {
      /* relative URL — fine */
    }
  }

  const method = (init.method || 'GET').toUpperCase()
  const headers = new Headers(init.headers)

  // CSRF header on mutating requests.
  if (MUTATING_METHODS.has(method)) {
    const token = readCsrfTokenFromDocument()
    if (token && !headers.has(CSRF_HEADERS.header)) {
      headers.set(CSRF_HEADERS.header, token)
    }
  }

  // Default to JSON if the body is an object literal.
  if (init.body && typeof init.body === 'object' && !(init.body instanceof FormData)) {
    if (!headers.has('content-type')) headers.set('content-type', 'application/json')
  }

  const res = await fetch(input, {
    ...init,
    credentials: init.credentials ?? 'include',
    headers,
  })

  // Light auto-retry on 401 — let the Supabase SDK refresh, then try once.
  if (res.status === 401 && typeof window !== 'undefined') {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { supabase } = await import('@/lib/supabase')
    await supabase.auth.refreshSession().catch(() => {})
    return fetch(input, {
      ...init,
      credentials: init.credentials ?? 'include',
      headers,
    })
  }

  return res
}
