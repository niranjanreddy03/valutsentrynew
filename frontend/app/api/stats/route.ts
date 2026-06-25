import { NextResponse } from 'next/server'
import { authForwardHeaders, backendUrl, requireVerifiedUser } from '@/lib/serverSecurity'

// GET /api/stats -> GET /api/v1/stats
export async function GET(request: Request) {
  try {
    const auth = await requireVerifiedUser(request)
    if (!auth.ok) return auth.response

    const response = await fetch(backendUrl('/stats'), {
      headers: authForwardHeaders(auth.user, false),
      cache: 'no-store',
    })
    const data = await response.json()
    return NextResponse.json(data)
  } catch {
    return NextResponse.json({
      totalSecrets: 0, activeSecrets: 0, resolvedSecrets: 0,
      criticalSecrets: 0, highSecrets: 0, totalScans: 0,
      completedScans: 0, totalRepos: 0, recentScans: [],
      secretsBySeverity: { critical: 0, high: 0, medium: 0, low: 0 },
      secretsByType: {},
    })
  }
}
