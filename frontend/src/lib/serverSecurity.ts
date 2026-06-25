import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const isProd = process.env.NODE_ENV === 'production'
const MAX_JSON_BYTES = 128 * 1024

export interface VerifiedUser {
  id: string
  email: string
  name: string
  authorization?: string
}

export function jsonError(message: string, status = 500) {
  return NextResponse.json({ error: message }, { status })
}

export function assertSameOrigin(request: Request): NextResponse | null {
  const origin = request.headers.get('origin')
  if (!origin) return null

  try {
    const originUrl = new URL(origin)
    const requestUrl = new URL(request.url)
    const forwardedHost = request.headers.get('x-forwarded-host')
    const forwardedProto = request.headers.get('x-forwarded-proto') || requestUrl.protocol.replace(':', '')
    const expectedHost = forwardedHost || request.headers.get('host') || requestUrl.host

    if (originUrl.host !== expectedHost || originUrl.protocol.replace(':', '') !== forwardedProto) {
      return jsonError('Invalid request origin', 403)
    }
  } catch {
    return jsonError('Invalid request origin', 403)
  }

  return null
}

export function enforceJsonBodyLimit(request: Request, maxBytes = MAX_JSON_BYTES): NextResponse | null {
  const rawLength = request.headers.get('content-length')
  if (!rawLength) return null

  const length = Number(rawLength)
  if (!Number.isFinite(length) || length < 0) {
    return jsonError('Invalid content length', 400)
  }
  if (length > maxBytes) {
    return jsonError('Request body too large', 413)
  }
  return null
}

export async function readJsonBody<T = Record<string, unknown>>(
  request: Request,
  maxBytes = MAX_JSON_BYTES,
): Promise<{ ok: true; data: T } | { ok: false; response: NextResponse }> {
  const tooLarge = enforceJsonBodyLimit(request, maxBytes)
  if (tooLarge) return { ok: false, response: tooLarge }

  try {
    return { ok: true, data: (await request.json()) as T }
  } catch {
    return { ok: false, response: jsonError('Invalid JSON body', 400) }
  }
}

export async function requireVerifiedUser(request: Request): Promise<
  | { ok: true; user: VerifiedUser }
  | { ok: false; response: NextResponse }
> {
  const authorization = request.headers.get('authorization') || undefined
  const bearer = authorization?.match(/^Bearer\s+(.+)$/i)?.[1]
  const claimedUserId = request.headers.get('x-user-id') || ''

  if (!bearer) {
    if (!isProd && (claimedUserId === 'local-user' || claimedUserId.startsWith('demo-user'))) {
      return {
        ok: true,
        user: {
          id: claimedUserId,
          email: request.headers.get('x-user-email') || '',
          name: request.headers.get('x-user-name') || '',
        },
      }
    }
    return { ok: false, response: jsonError('Not authenticated', 401) }
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!supabaseUrl || !supabaseAnonKey) {
    return { ok: false, response: jsonError('Authentication service not configured', 500) }
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${bearer}` } },
  })

  const { data, error } = await supabase.auth.getUser(bearer)
  const user = data?.user
  if (error || !user) {
    return { ok: false, response: jsonError('Invalid session', 401) }
  }

  if (claimedUserId && claimedUserId !== user.id) {
    return { ok: false, response: jsonError('Authenticated user mismatch', 403) }
  }

  return {
    ok: true,
    user: {
      id: user.id,
      email: user.email || request.headers.get('x-user-email') || '',
      name:
        String(user.user_metadata?.full_name || '') ||
        request.headers.get('x-user-name') ||
        user.email?.split('@')[0] ||
        '',
      authorization,
    },
  }
}

export function authForwardHeaders(user: VerifiedUser, contentType = true): Record<string, string> {
  const headers: Record<string, string> = {
    'x-user-id': user.id,
    'x-user-email': user.email,
    'x-user-name': user.name,
  }
  if (contentType) headers['Content-Type'] = 'application/json'
  if (user.authorization) headers.Authorization = user.authorization
  return headers
}

function isUnsafeBackendHost(hostname: string) {
  const host = hostname.toLowerCase()
  return (
    host === 'localhost' ||
    host === '0.0.0.0' ||
    host === '127.0.0.1' ||
    host === '::1' ||
    host.endsWith('.local') ||
    host.startsWith('10.') ||
    host.startsWith('192.168.') ||
    /^172\.(1[6-9]|2\d|3[0-1])\./.test(host) ||
    /^169\.254\./.test(host)
  )
}

export function backendUrl(pathname = ''): string {
  const configured = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v1'
  const base = new URL(configured)

  if (!['http:', 'https:'].includes(base.protocol) || base.username || base.password) {
    throw new Error('Invalid backend URL')
  }
  if (isProd && isUnsafeBackendHost(base.hostname)) {
    throw new Error('Unsafe backend URL for production')
  }

  const basePath = base.pathname.replace(/\/$/, '')
  const childPath = pathname.startsWith('/') ? pathname : `/${pathname}`
  base.pathname = `${basePath}${childPath}`
  base.search = ''
  base.hash = ''
  return base.toString()
}
