import { NextResponse } from 'next/server'
import { authForwardHeaders, backendUrl, requireVerifiedUser } from '@/lib/serverSecurity'

export async function GET(request: Request) {
  try {
    const auth = await requireVerifiedUser(request)
    if (!auth.ok) return auth.response

    const url = new URL(request.url)
    const status = url.searchParams.get('status')
    const provider = url.searchParams.get('provider')
    const endpoint = new URL(backendUrl(`/closed-loop/orgs/${encodeURIComponent(auth.user.id)}/incidents`))

    if (status && /^[a-z_-]{1,32}$/i.test(status)) endpoint.searchParams.set('status', status)
    if (provider && /^[a-z_-]{1,32}$/i.test(provider)) endpoint.searchParams.set('provider', provider)

    const response = await fetch(endpoint, {
      headers: {
        ...authForwardHeaders(auth.user, false),
        'x-tenant-id': auth.user.id,
      },
      cache: 'no-store',
    })
    const payload = await response.json()
    return NextResponse.json(payload, { status: response.status })
  } catch {
    return NextResponse.json({ items: [], total: 0 }, { status: 200 })
  }
}
