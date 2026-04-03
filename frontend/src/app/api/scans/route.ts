import { NextResponse } from 'next/server'

const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v1'

// GET /api/scans → GET /api/v1/scans
export async function GET(request: Request) {
  try {
    const userId = request.headers.get('x-user-id') || 'local-user'
    const response = await fetch(`${BACKEND_URL}/scans`, {
      headers: { 'x-user-id': userId },
    })
    const data = await response.json()
    return NextResponse.json(data)
  } catch {
    return NextResponse.json([], { status: 200 })
  }
}
