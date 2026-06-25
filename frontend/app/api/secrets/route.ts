import { NextResponse } from 'next/server'
import { authForwardHeaders, backendUrl, requireVerifiedUser } from '@/lib/serverSecurity'

// GET /api/secrets -> GET /api/v1/secrets
export async function GET(request: Request) {
  try {
    const auth = await requireVerifiedUser(request)
    if (!auth.ok) return auth.response

    const response = await fetch(backendUrl('/secrets'), {
      headers: authForwardHeaders(auth.user, false),
      cache: 'no-store',
    })
    const data = await response.json()
    return NextResponse.json(data)
  } catch {
    return NextResponse.json([], { status: 200 })
  }
}
