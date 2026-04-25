import { NextResponse } from 'next/server'

const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v1'

// GET /api/scans/:id → GET /api/v1/scans/:id
export async function GET(request: Request, { params }: { params: { id: string } }) {
  try {
    const userId = request.headers.get('x-user-id') || 'local-user'
    const auth = request.headers.get('authorization')
    const headers: Record<string, string> = { 'x-user-id': userId }
    if (auth) headers['Authorization'] = auth

    const response = await fetch(`${BACKEND_URL}/scans/${params.id}`, { headers })
    const data = await response.json().catch(() => ({}))
    return NextResponse.json(data, { status: response.status })
  } catch (err) {
    console.error('[API /api/scans/:id]', err)
    return NextResponse.json({ error: 'Scanner backend not reachable' }, { status: 502 })
  }
}
