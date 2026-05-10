import { NextResponse } from 'next/server'

const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v1'

function forwardHeaders(request: Request): Record<string, string> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  const auth = request.headers.get('authorization')
  if (auth) headers['Authorization'] = auth

  const passthrough = ['x-user-id', 'x-user-email', 'x-user-name']
  for (const key of passthrough) {
    const val = request.headers.get(key)
    if (val) headers[key] = val
  }
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
  // Subscription limits enforced on frontend + Supabase RLS.
  // Server-side guard removed — Amplify SSR doesn't forward cookies
  // reliably, causing false 403s.

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
