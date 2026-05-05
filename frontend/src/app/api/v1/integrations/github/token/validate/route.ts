import { NextResponse } from 'next/server'
import { decrypt, getStoredToken, validateGitHubToken } from '../../../_tokenStore'

export const runtime = 'nodejs'

export async function POST(request: Request) {
  const stored = await getStoredToken(request, 'github')

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
