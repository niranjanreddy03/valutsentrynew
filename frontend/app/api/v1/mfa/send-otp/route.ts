import { NextResponse } from 'next/server'
import {
  assertSameOrigin,
  authForwardHeaders,
  backendUrl,
  requireVerifiedUser,
} from '@/lib/serverSecurity'
import { rateLimitOrBlock } from '@/lib/rate-limit'

export async function POST(request: Request) {
  const origin = assertSameOrigin(request)
  if (origin) return origin

  const blocked = rateLimitOrBlock(request, 'mfa:send-otp', 3, 300_000)
  if (blocked) return blocked

  const auth = await requireVerifiedUser(request)
  if (!auth.ok) return auth.response

  let timeout: ReturnType<typeof setTimeout> | undefined
  try {
    const controller = new AbortController()
    timeout = setTimeout(() => controller.abort(), 30_000)

    const res = await fetch(backendUrl('/mfa/send-otp'), {
      method: 'POST',
      headers: authForwardHeaders(auth.user),
      signal: controller.signal,
    })
    const data = await res.json().catch(() => ({}))

    if (!res.ok && data.detail && !data.error) {
      data.error = data.detail
    }

    return NextResponse.json(data, { status: res.status })
  } catch (error: any) {
    console.error('[MFA PROXY] send-otp failed:', error)
    const message = error?.name === 'AbortError'
      ? 'MFA email request timed out. Please try again.'
      : 'Backend not reachable.'
    return NextResponse.json(
      { error: message },
      { status: 502 },
    )
  } finally {
    if (timeout) clearTimeout(timeout)
  }
}
