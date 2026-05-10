import { NextResponse } from 'next/server'
import { guardFeature } from '@/lib/subscriptionGuard'

const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v1'

export async function GET(request: Request) {
  // Closed-loop requires premium_plus
  const guard = await guardFeature('auto_rotation')
  if (!guard.allowed) {
    return NextResponse.json({ error: guard.error, upgrade: true }, { status: 403 })
  }

  try {
    const userId = request.headers.get('x-user-id') || 'default-org'
    const tenantId = request.headers.get('x-tenant-id') || userId
    const url = new URL(request.url)
    const status = url.searchParams.get('status')
    const provider = url.searchParams.get('provider')

    const fetchIncidents = (orgId: string) => {
      const endpoint = new URL(`${BACKEND_URL}/closed-loop/orgs/${encodeURIComponent(orgId)}/incidents`)
      if (status) endpoint.searchParams.set('status', status)
      if (provider) endpoint.searchParams.set('provider', provider)

      return fetch(endpoint, {
        headers: {
          'x-user-id': userId,
          'x-tenant-id': orgId,
        },
        cache: 'no-store',
      })
    }

    let latestPayload = { items: [], total: 0 }
    const candidateTenants = Array.from(new Set([tenantId, 'default-org', 'org_http']))

    for (const candidateTenant of candidateTenants) {
      const response = await fetchIncidents(candidateTenant)
      if (!response.ok) continue

      const payload = await response.json()
      latestPayload = payload
      if ((payload.items || []).length > 0) {
        return NextResponse.json(payload)
      }
    }

    return NextResponse.json(latestPayload)
  } catch {
    return NextResponse.json({ items: [], total: 0 }, { status: 200 })
  }
}
