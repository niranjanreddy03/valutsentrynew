import { NextResponse } from 'next/server'
import { rateLimitOrBlock } from '@/lib/rate-limit'

const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v1'

function forwardHeaders(request: Request): Record<string, string> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  const auth = request.headers.get('authorization')
  if (auth) headers['Authorization'] = auth
  for (const key of ['x-user-id', 'x-user-email', 'x-user-name']) {
    const val = request.headers.get(key)
    if (val) headers[key] = val
  }
  if (!headers['x-user-id']) headers['x-user-id'] = 'local-user'
  return headers
}

async function proxyToBackend(path: string, request: Request) {
  try {
    const url = `${BACKEND_URL}${path}`
    const options: RequestInit = { method: request.method, headers: forwardHeaders(request) }

    if (request.method !== 'GET' && request.method !== 'HEAD') {
      try {
        const body = await request.json()
        options.body = JSON.stringify(body)
      } catch {
        /* no body */
      }
    }

    const response = await fetch(url, options)
    const data = await response.json().catch(() => ({}))
    return NextResponse.json(data, { status: response.status })
  } catch (error) {
    console.error(`[API PROXY] Failed to reach backend at ${BACKEND_URL}:`, error)
    return NextResponse.json(
      { error: 'Scanner backend not reachable. Make sure the backend is running.' },
      { status: 502 },
    )
  }
}

// POST /api/scan → POST /api/v1/scans/trigger
export async function POST(request: Request) {
  // Rate limit: 5 scans per 2 minutes per IP
  const blocked = rateLimitOrBlock(request, 'scan', 5, 120_000)
  if (blocked) return blocked

  // Subscription limits enforced on frontend + Supabase RLS.
  // Server-side guard removed — Amplify SSR doesn't forward cookies
  // reliably, causing false 403s.

  return proxyToBackend('/scans/trigger', request)
}
