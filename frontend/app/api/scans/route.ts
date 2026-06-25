import { NextResponse } from 'next/server'
import { authForwardHeaders, backendUrl, requireVerifiedUser } from '@/lib/serverSecurity'

// GET /api/scans -> GET /api/v1/scans
export async function GET(request: Request) {
  try {
    const auth = await requireVerifiedUser(request)
    if (!auth.ok) return auth.response

    const response = await fetch(backendUrl('/scans'), {
      headers: authForwardHeaders(auth.user, false),
      cache: 'no-store',
    })
    const data = await response.json()
    return NextResponse.json(data)
  } catch {
    return NextResponse.json([], { status: 200 })
  }
}
