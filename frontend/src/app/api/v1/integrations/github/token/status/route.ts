import { NextResponse } from 'next/server'
import { getStoredToken } from '../../../_tokenStore'

export const runtime = 'nodejs'

export async function GET(request: Request) {
  const token = await getStoredToken(request, 'github')
  return NextResponse.json({
    configured: Boolean(token),
    github_username: token?.username,
    added_at: token?.added_at,
  })
}
