import { NextResponse } from 'next/server'
import { deleteStoredToken, saveStoredToken, validateGitHubToken } from '../../_tokenStore'
import { assertSameOrigin, readJsonBody } from '@/lib/serverSecurity'
import { rateLimitOrBlock } from '@/lib/rate-limit'

export const runtime = 'nodejs'

export async function POST(request: Request) {
  const origin = assertSameOrigin(request)
  if (origin) return origin

  const blocked = rateLimitOrBlock(request, 'integrations:github', 5, 300_000)
  if (blocked) return blocked

  const parsed = await readJsonBody<any>(request, 16 * 1024)
  if (!parsed.ok) return parsed.response
  const body = parsed.data
  const token = String(body?.token || '').trim()

  if (!token) {
    return NextResponse.json({ detail: 'Token is required' }, { status: 400 })
  }
  if (!token.startsWith('ghp_') && !token.startsWith('github_pat_')) {
    return NextResponse.json(
      { detail: "Invalid token format. GitHub PATs start with 'ghp_' or 'github_pat_'" },
      { status: 400 },
    )
  }

  const validation = await validateGitHubToken(token)
  if (!validation.valid) {
    return NextResponse.json({ detail: validation.error_message }, { status: 400 })
  }

  const saved = await saveStoredToken(request, 'github', token, validation.username)
  return NextResponse.json({
    configured: true,
    github_username: validation.username,
    added_at: saved?.added_at,
    scopes: validation.scopes,
  })
}

export async function DELETE(request: Request) {
  const origin = assertSameOrigin(request)
  if (origin) return origin

  await deleteStoredToken(request, 'github')
  return NextResponse.json({ message: 'GitHub token has been revoked' })
}
