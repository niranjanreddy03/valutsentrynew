import { NextResponse } from 'next/server'

const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v1'

async function proxyToBackend(path: string, request: Request) {
  try {
    const userId = request.headers.get('x-user-id') || 'local-user'
    const url = `${BACKEND_URL}${path}`
    const options: RequestInit = {
      method: request.method,
      headers: { 'Content-Type': 'application/json', 'x-user-id': userId },
    }
    
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      try {
        const body = await request.json()
        options.body = JSON.stringify(body)
      } catch { /* no body */ }
    }

    const response = await fetch(url, options)
    const data = await response.json()
    return NextResponse.json(data, { status: response.status })
  } catch (error) {
    console.error(`[API PROXY] Failed to reach backend at ${BACKEND_URL}:`, error)
    return NextResponse.json(
      { error: 'Scanner backend not reachable. Make sure npm run dev is running.' },
      { status: 502 }
    )
  }
}

// POST /api/scan → POST /api/v1/scans/trigger
export async function POST(request: Request) {
  return proxyToBackend('/scans/trigger', request)
}
