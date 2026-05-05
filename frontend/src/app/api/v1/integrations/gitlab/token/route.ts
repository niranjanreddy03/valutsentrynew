import { NextResponse } from 'next/server'
import { deleteStoredToken, saveStoredToken } from '../../_tokenStore'

export const runtime = 'nodejs'

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}))
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
  await deleteStoredToken(request, 'gitlab')
  return NextResponse.json({ message: 'GitLab token has been revoked' })
}
