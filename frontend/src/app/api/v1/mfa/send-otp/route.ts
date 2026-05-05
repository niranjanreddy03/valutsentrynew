import { NextResponse } from 'next/server'

const BACKEND_URL = process.env.BACKEND_API_URL || 'http://localhost:8001/api/v1'

export async function POST(request: Request) {
  let timeout: ReturnType<typeof setTimeout> | undefined
  try {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' }
    const auth = request.headers.get('authorization')
    if (auth) headers['Authorization'] = auth

    const controller = new AbortController()
    timeout = setTimeout(() => controller.abort(), 30_000)

    const res = await fetch(`${BACKEND_URL}/mfa/send-otp`, {
      method: 'POST',
      headers,
      signal: controller.signal,
    })
    const data = await res.json().catch(() => ({}))

    // FastAPI returns { detail: "..." }; frontend expects { error: "..." }
    if (!res.ok && data.detail && !data.error) {
      data.error = data.detail
    }

    return NextResponse.json(data, { status: res.status })
  } catch (error: any) {
    console.error('[MFA PROXY] send-otp failed:', error)
    const message = error?.name === 'AbortError'
      ? 'MFA email request timed out. Please try again.'
      : 'Backend not reachable. Start the FastAPI backend on port 8001.'
    return NextResponse.json(
      { error: message },
      { status: 502 },
    )
  } finally {
    if (timeout) clearTimeout(timeout)
  }
}
