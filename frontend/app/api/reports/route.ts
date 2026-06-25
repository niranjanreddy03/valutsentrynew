import { NextResponse } from 'next/server'
import { authForwardHeaders, backendUrl, requireVerifiedUser } from '@/lib/serverSecurity'

// GET /api/reports?type=full|csv|scan&scanId=x
export async function GET(request: Request) {
  const auth = await requireVerifiedUser(request)
  if (!auth.ok) return auth.response

  const { searchParams } = new URL(request.url)
  const type = searchParams.get('type') || 'full'
  const scanId = searchParams.get('scanId')

  try {
    let endpoint = '/reports/full'
    if (type === 'csv') endpoint = '/reports/csv'
    else if (type === 'scan' && scanId && /^[A-Za-z0-9_-]+$/.test(scanId)) {
      endpoint = `/reports/scan/${encodeURIComponent(scanId)}`
    } else if (type !== 'full') {
      return NextResponse.json({ error: 'Invalid report request' }, { status: 400 })
    }

    const response = await fetch(backendUrl(endpoint), {
      headers: authForwardHeaders(auth.user, false),
      cache: 'no-store',
    })

    if (type === 'csv') {
      const text = await response.text()
      return new NextResponse(text, {
        status: response.status,
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': 'attachment; filename=vaultsentry-report.csv',
          'X-Content-Type-Options': 'nosniff',
        },
      })
    }

    const data = await response.json()
    return NextResponse.json(data, { status: response.status })
  } catch {
    return NextResponse.json({ error: 'Report generation failed' }, { status: 502 })
  }
}
