import { NextResponse } from 'next/server'
import { getStoredToken } from '../../../_tokenStore'

export const runtime = 'nodejs'

export async function GET(request: Request) {
  let token
  try {
    token = await getStoredToken(request, 'github')
  } catch {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }
  return NextResponse.json({
    configured: Boolean(token),
    github_username: token?.username,
    added_at: token?.added_at,
  })
}
