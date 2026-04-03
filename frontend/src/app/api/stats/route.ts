import { NextResponse } from 'next/server'

const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v1'

// GET /api/stats → GET /api/v1/stats
export async function GET(request: Request) {
  try {
    const userId = request.headers.get('x-user-id') || 'local-user'
    const response = await fetch(`${BACKEND_URL}/stats`, {
      headers: { 'x-user-id': userId },
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
