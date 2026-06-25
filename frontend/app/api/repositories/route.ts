import { NextResponse } from 'next/server'
import {
  assertSameOrigin,
  authForwardHeaders,
  backendUrl,
  jsonError,
  readJsonBody,
  requireVerifiedUser,
} from '@/lib/serverSecurity'

export async function GET(request: Request) {
  try {
    const auth = await requireVerifiedUser(request)
    if (!auth.ok) return auth.response

    const response = await fetch(backendUrl('/repositories'), {
      headers: authForwardHeaders(auth.user),
      cache: 'no-store',
    })
    const data = await response.json()
    return NextResponse.json(data, { status: response.status })
  } catch {
    return NextResponse.json([])
  }
}

export async function POST(request: Request) {
  const origin = assertSameOrigin(request)
  if (origin) return origin

  const auth = await requireVerifiedUser(request)
  if (!auth.ok) return auth.response

  const parsed = await readJsonBody(request)
  if (!parsed.ok) return parsed.response

  try {
    const response = await fetch(backendUrl('/repositories'), {
      method: 'POST',
      headers: authForwardHeaders(auth.user),
      body: JSON.stringify(parsed.data),
    })
    const data = await response.json()
    return NextResponse.json(data, { status: response.status })
  } catch (err) {
    console.error('[API /api/repositories POST]', err)
    return NextResponse.json({ error: 'Failed to save repository' }, { status: 502 })
  }
}

export async function DELETE(request: Request) {
  const origin = assertSameOrigin(request)
  if (origin) return origin

  const auth = await requireVerifiedUser(request)
  if (!auth.ok) return auth.response

  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    if (!id) return jsonError('Repository id is required', 400)

    const response = await fetch(backendUrl(`/repositories/${encodeURIComponent(id)}`), {
      method: 'DELETE',
      headers: authForwardHeaders(auth.user),
    })
    const data = await response.json().catch(() => ({}))
    return NextResponse.json(data, { status: response.status })
  } catch {
    return NextResponse.json({ error: 'Failed to delete' }, { status: 502 })
  }
}
