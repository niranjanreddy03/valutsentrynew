import { NextResponse } from 'next/server'
import { authForwardHeaders, backendUrl, requireVerifiedUser } from '@/lib/serverSecurity'

// GET /api/scans/:id -> GET /api/v1/scans/:id
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireVerifiedUser(request)
    if (!auth.ok) return auth.response

    const { id } = await params
    if (!/^[A-Za-z0-9_-]+$/.test(id)) {
      return NextResponse.json({ error: 'Invalid scan id' }, { status: 400 })
    }

    const response = await fetch(backendUrl(`/scans/${encodeURIComponent(id)}`), {
      headers: authForwardHeaders(auth.user, false),
      cache: 'no-store',
    })
    const data = await response.json().catch(() => ({}))
    return NextResponse.json(data, { status: response.status })
  } catch (err) {
    console.error('[API /api/scans/:id]', err)
    return NextResponse.json({ error: 'Scanner backend not reachable' }, { status: 502 })
  }
}
