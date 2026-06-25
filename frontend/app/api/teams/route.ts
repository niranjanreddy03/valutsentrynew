import { NextRequest, NextResponse } from 'next/server'
import {
  assertSameOrigin,
  authForwardHeaders,
  backendUrl,
  readJsonBody,
  requireVerifiedUser,
} from '@/lib/serverSecurity'

function validId(id: string | null) {
  return Boolean(id && /^[A-Za-z0-9_-]+$/.test(id))
}

export async function GET(request: NextRequest) {
  try {
    const auth = await requireVerifiedUser(request)
    if (!auth.ok) return auth.response

    const { searchParams } = new URL(request.url)
    const teamId = searchParams.get('teamId')
    const action = searchParams.get('action')

    let endpoint = '/teams'
    if (teamId && action === 'members') {
      if (!validId(teamId)) return NextResponse.json({ error: 'Invalid team id' }, { status: 400 })
      endpoint = `/teams/${encodeURIComponent(teamId)}/members`
    }

    const response = await fetch(backendUrl(endpoint), {
      headers: authForwardHeaders(auth.user, false),
      cache: 'no-store',
    })
    const data = await response.json()
    return NextResponse.json(data, { status: response.status })
  } catch {
    return NextResponse.json([], { status: 200 })
  }
}

export async function POST(request: NextRequest) {
  const origin = assertSameOrigin(request)
  if (origin) return origin

  const auth = await requireVerifiedUser(request)
  if (!auth.ok) return auth.response

  const parsed = await readJsonBody(request)
  if (!parsed.ok) return parsed.response

  try {
    const { searchParams } = new URL(request.url)
    const teamId = searchParams.get('teamId')
    const action = searchParams.get('action')

    let endpoint = '/teams'
    if (teamId && action === 'members') {
      if (!validId(teamId)) return NextResponse.json({ error: 'Invalid team id' }, { status: 400 })
      endpoint = `/teams/${encodeURIComponent(teamId)}/members`
    }

    const response = await fetch(backendUrl(endpoint), {
      method: 'POST',
      headers: authForwardHeaders(auth.user),
      body: JSON.stringify(parsed.data),
    })
    const data = await response.json()
    return NextResponse.json(data, { status: response.status })
  } catch {
    return NextResponse.json({ error: 'Request failed' }, { status: 502 })
  }
}

export async function DELETE(request: NextRequest) {
  const origin = assertSameOrigin(request)
  if (origin) return origin

  const auth = await requireVerifiedUser(request)
  if (!auth.ok) return auth.response

  try {
    const { searchParams } = new URL(request.url)
    const teamId = searchParams.get('teamId')
    const memberId = searchParams.get('memberId')

    if (!validId(teamId)) return NextResponse.json({ error: 'Invalid team id' }, { status: 400 })

    let endpoint = `/teams/${encodeURIComponent(teamId as string)}`
    if (memberId) {
      if (!validId(memberId)) return NextResponse.json({ error: 'Invalid member id' }, { status: 400 })
      endpoint = `/teams/${encodeURIComponent(teamId as string)}/members/${encodeURIComponent(memberId)}`
    }

    const response = await fetch(backendUrl(endpoint), {
      method: 'DELETE',
      headers: authForwardHeaders(auth.user, false),
    })
    const data = await response.json()
    return NextResponse.json(data, { status: response.status })
  } catch {
    return NextResponse.json({ error: 'Request failed' }, { status: 502 })
  }
}
