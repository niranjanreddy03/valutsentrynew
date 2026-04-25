import { NextResponse } from 'next/server'

const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v1'

/**
 * Forward every identity/auth-related header from the browser to the backend.
 * The backend's `get_current_user` dependency requires a Bearer JWT; the
 * x-user-* headers are used by the proxy layer for per-user data isolation.
 */
function forwardHeaders(request: Request): Record<string, string> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  const auth = request.headers.get('authorization')
  if (auth) headers['Authorization'] = auth

  const passthrough = ['x-user-id', 'x-user-email', 'x-user-name']
  for (const key of passthrough) {
    const val = request.headers.get(key)
    if (val) headers[key] = val
  }
  // Default user id so backend doesn't 400 on missing header
  if (!headers['x-user-id']) headers['x-user-id'] = 'local-user'
  return headers
}

export async function GET(request: Request) {
  try {
    const response = await fetch(`${BACKEND_URL}/repositories`, {
      headers: forwardHeaders(request),
    })
    const data = await response.json()
    return NextResponse.json(data, { status: response.status })
  } catch {
    return NextResponse.json([])
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const response = await fetch(`${BACKEND_URL}/repositories`, {
      method: 'POST',
      headers: forwardHeaders(request),
      body: JSON.stringify(body),
    })
    const data = await response.json()
    return NextResponse.json(data, { status: response.status })
  } catch (err) {
    console.error('[API /api/repositories POST]', err)
    return NextResponse.json({ error: 'Failed to save repository' }, { status: 502 })
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    const response = await fetch(`${BACKEND_URL}/repositories/${id}`, {
      method: 'DELETE',
      headers: forwardHeaders(request),
    })
    const data = await response.json().catch(() => ({}))
    return NextResponse.json(data, { status: response.status })
  } catch {
    return NextResponse.json({ error: 'Failed to delete' }, { status: 502 })
  }
}
