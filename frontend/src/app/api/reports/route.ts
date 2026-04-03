import { NextResponse } from 'next/server'

const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v1'

// GET /api/reports?type=full|csv|scan&scanId=x
export async function GET(request: Request) {
  const userId = request.headers.get('x-user-id') || 'local-user'
  const { searchParams } = new URL(request.url)
  const type = searchParams.get('type') || 'full'
  const scanId = searchParams.get('scanId')
  
  try {
    let endpoint = '/reports/full'
    if (type === 'csv') endpoint = '/reports/csv'
    else if (type === 'scan' && scanId) endpoint = `/reports/scan/${scanId}`
    
    const response = await fetch(`${BACKEND_URL}${endpoint}`, {
      headers: { 'x-user-id': userId },
    })
    
    if (type === 'csv') {
      const text = await response.text()
      return new NextResponse(text, {
        status: 200,
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': 'attachment; filename=vaultsentry-report.csv',
        },
      })
    }
    
    const data = await response.json()
    return NextResponse.json(data)
  } catch {
    return NextResponse.json({ error: 'Report generation failed' }, { status: 502 })
  }
}
