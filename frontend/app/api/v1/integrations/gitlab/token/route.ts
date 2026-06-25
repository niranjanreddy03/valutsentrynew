import { NextResponse } from 'next/server'
import { deleteStoredToken, saveStoredToken } from '../../_tokenStore'
import { assertSameOrigin, readJsonBody } from '@/lib/serverSecurity'
import { rateLimitOrBlock } from '@/lib/rate-limit'

export const runtime = 'nodejs'

export async function POST(request: Request) {
  const origin = assertSameOrigin(request)
  if (origin) return origin

  const blocked = rateLimitOrBlock(request, 'integrations:gitlab', 5, 300_000)
  if (blocked) return blocked

  const parsed = await readJsonBody<any>(request, 16 * 1024)
  if (!parsed.ok) return parsed.response
  const body = parsed.data
  const token = String(body?.token || '').trim()

  if (!token) {
    return NextResponse.json({ detail: 'Token is required' }, { status: 400 })
  }
  if (!token.startsWith('glpat-')) {
    return NextResponse.json(
      { detail: "Invalid token format. GitLab PATs usually start with 'glpat-'" },
      { status: 400 },
    )
  }

  const saved = await saveStoredToken(request, 'gitlab', token)
  return NextResponse.json({
    configured: true,
    added_at: saved?.added_at,
  })
}

export async function DELETE(request: Request) {
  const origin = assertSameOrigin(request)
  if (origin) return origin

  await deleteStoredToken(request, 'gitlab')
  return NextResponse.json({ message: 'GitLab token has been revoked' })
}
