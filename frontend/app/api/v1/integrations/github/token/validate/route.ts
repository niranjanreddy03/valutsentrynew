import { NextResponse } from 'next/server'
import { decrypt, getStoredToken, validateGitHubToken } from '../../../_tokenStore'
import { assertSameOrigin } from '@/lib/serverSecurity'
import { rateLimitOrBlock } from '@/lib/rate-limit'

export const runtime = 'nodejs'

export async function POST(request: Request) {
  const origin = assertSameOrigin(request)
  if (origin) return origin

  const blocked = rateLimitOrBlock(request, 'integrations:github:validate', 10, 300_000)
  if (blocked) return blocked

  let stored
  try {
    stored = await getStoredToken(request, 'github')
  } catch {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  if (!stored) {
    return NextResponse.json({
      valid: false,
      status: 'not_configured',
      error_message: 'No GitHub token configured',
    })
  }

  try {
    const token = decrypt(stored.token)
    return NextResponse.json(await validateGitHubToken(token))
  } catch {
    return NextResponse.json({
      valid: false,
      status: 'invalid',
      error_message: 'Stored GitHub token could not be decrypted',
    })
  }
}
