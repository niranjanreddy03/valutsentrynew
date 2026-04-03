import { NextRequest, NextResponse } from 'next/server'

const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v1'

// Unified teams API proxy
// GET  /api/teams                              → list teams
// GET  /api/teams?teamId=1&action=members      → list members
// POST /api/teams                              → create team
// POST /api/teams?teamId=1&action=members      → invite member
// DELETE /api/teams?teamId=1                   → delete team
// DELETE /api/teams?teamId=1&memberId=2        → remove member

export async function GET(request: NextRequest) {
  try {
    const userId = request.headers.get('x-user-id') || 'local-user'
    const { searchParams } = new URL(request.url)
    const teamId = searchParams.get('teamId')
    const action = searchParams.get('action')

    let url = `${BACKEND_URL}/teams`
    if (teamId && action === 'members') {
      url = `${BACKEND_URL}/teams/${teamId}/members`
    }

    const response = await fetch(url, {
      headers: { 'x-user-id': userId },
    })
    const data = await response.json()
    return NextResponse.json(data, { status: response.status })
  } catch {
    return NextResponse.json([], { status: 200 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const userId = request.headers.get('x-user-id') || 'local-user'
    const userEmail = request.headers.get('x-user-email') || ''
    const userName = request.headers.get('x-user-name') || ''
    const { searchParams } = new URL(request.url)
    const teamId = searchParams.get('teamId')
    const action = searchParams.get('action')
    const body = await request.json()

    let url = `${BACKEND_URL}/teams`
    if (teamId && action === 'members') {
      url = `${BACKEND_URL}/teams/${teamId}/members`
    }

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-user-id': userId,
        'x-user-email': userEmail,
        'x-user-name': userName,
      },
      body: JSON.stringify(body),
    })
    const data = await response.json()
    return NextResponse.json(data, { status: response.status })
  } catch {
    return NextResponse.json({ error: 'Request failed' }, { status: 502 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const userId = request.headers.get('x-user-id') || 'local-user'
    const { searchParams } = new URL(request.url)
    const teamId = searchParams.get('teamId')
    const memberId = searchParams.get('memberId')

    let url = `${BACKEND_URL}/teams/${teamId}`
    if (memberId) {
      url = `${BACKEND_URL}/teams/${teamId}/members/${memberId}`
    }

    const response = await fetch(url, {
      method: 'DELETE',
      headers: { 'x-user-id': userId },
    })
    const data = await response.json()
    return NextResponse.json(data, { status: response.status })
  } catch {
    return NextResponse.json({ error: 'Request failed' }, { status: 502 })
  }
}
