import { NextResponse } from 'next/server'
import { lookup } from 'node:dns/promises'
import net from 'node:net'
import { rateLimitOrBlock } from '@/lib/rate-limit'
import {
  assertSameOrigin,
  readJsonBody,
  requireVerifiedUser,
} from '@/lib/serverSecurity'

export const runtime = 'nodejs'

const PRIVATE_IPV4 = [
  /^10\./,
  /^127\./,
  /^169\.254\./,
  /^172\.(1[6-9]|2\d|3[01])\./,
  /^192\.168\./,
  /^0\.0\.0\.0$/,
]

function isPrivateAddress(address: string): boolean {
  if (address === '::1') return true
  if (net.isIPv4(address)) return PRIVATE_IPV4.some((re) => re.test(address))
  if (net.isIPv6(address)) {
    const lower = address.toLowerCase()
    return lower.startsWith('fc') || lower.startsWith('fd') || lower.startsWith('fe80')
  }
  return false
}

async function validateWebhookUrl(raw: unknown): Promise<URL> {
  if (typeof raw !== 'string' || !raw.trim()) {
    throw new Error('Webhook URL is required')
  }

  let url: URL
  try {
    url = new URL(raw)
  } catch {
    throw new Error('Webhook URL is invalid')
  }

  if (url.protocol !== 'https:') {
    throw new Error('Webhook URL must use HTTPS')
  }

  const { address } = await lookup(url.hostname)
  if (isPrivateAddress(address)) {
    throw new Error('Webhook URL cannot point to a private or local address')
  }

  return url
}

export async function POST(request: Request) {
  const origin = assertSameOrigin(request)
  if (origin) return origin

  const blocked = rateLimitOrBlock(request, 'integrations:webhook', 10, 300_000)
  if (blocked) return blocked

  const auth = await requireVerifiedUser(request)
  if (!auth.ok) return auth.response

  const parsed = await readJsonBody<any>(request, 64 * 1024)
  if (!parsed.ok) return parsed.response
  const body = parsed.data

  try {
    const url = await validateWebhookUrl(body?.url)
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 10_000)

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body?.payload ?? {}),
        signal: controller.signal,
      })
      const text = await response.text().catch(() => '')
      return NextResponse.json(
        {
          ok: response.ok,
          status: response.status,
          message: text.slice(0, 500),
        },
        { status: response.ok ? 200 : 502 },
      )
    } finally {
      clearTimeout(timeout)
    }
  } catch (error: any) {
    return NextResponse.json(
      { ok: false, status: 0, message: error?.message || 'Webhook request failed' },
      { status: 400 },
    )
  }
}
