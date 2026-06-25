import { NextResponse } from 'next/server'
import { rateLimitOrBlock } from '@/lib/rate-limit'
import {
  assertSameOrigin,
  authForwardHeaders,
  backendUrl,
  readJsonBody,
  requireVerifiedUser,
} from '@/lib/serverSecurity'

async function proxyToBackend(path: string, request: Request) {
  try {
    const auth = await requireVerifiedUser(request)
    if (!auth.ok) return auth.response

    const options: RequestInit = {
      method: request.method,
      headers: authForwardHeaders(auth.user),
    }

    if (request.method !== 'GET' && request.method !== 'HEAD') {
      const parsed = await readJsonBody(request)
      if (!parsed.ok) return parsed.response
      options.body = JSON.stringify(parsed.data)
    }

    const response = await fetch(backendUrl(path), options)
    const data = await response.json().catch(() => ({}))
    return NextResponse.json(data, { status: response.status })
  } catch (error) {
    console.error('[API PROXY] Failed to reach scanner backend:', error)
    return NextResponse.json(
      { error: 'Scanner backend not reachable. Make sure the backend is running.' },
      { status: 502 },
    )
  }
}

// POST /api/scan -> POST /api/v1/scans/trigger
export async function POST(request: Request) {
  const origin = assertSameOrigin(request)
  if (origin) return origin

  // Rate limit: 5 scans per 2 minutes per IP
  const blocked = rateLimitOrBlock(request, 'scan', 5, 120_000)
  if (blocked) return blocked

  return proxyToBackend('/scans/trigger', request)
}
