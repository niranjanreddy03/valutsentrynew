import { NextResponse } from 'next/server'

const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v1'

export async function GET(request: Request) {
  try {
    const userId = request.headers.get('x-user-id') || 'local-user'
    const response = await fetch(`${BACKEND_URL}/repositories`, {
      headers: { 'x-user-id': userId },
    })
    const data = await response.json()
    return NextResponse.json(data)
  } catch {
    return NextResponse.json([])
  }
}

export async function POST(request: Request) {
  try {
    const userId = request.headers.get('x-user-id') || 'local-user'
    const body = await request.json()
    const response = await fetch(`${BACKEND_URL}/repositories`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-user-id': userId },
      body: JSON.stringify(body),
    })
    const data = await response.json()
    return NextResponse.json(data, { status: response.status })
  } catch {
    return NextResponse.json({ error: 'Failed to save repository' }, { status: 502 })
  }
}

export async function DELETE(request: Request) {
  try {
    const userId = request.headers.get('x-user-id') || 'local-user'
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    const response = await fetch(`${BACKEND_URL}/repositories/${id}`, {
      method: 'DELETE',
      headers: { 'x-user-id': userId },
    })
    const data = await response.json()
    return NextResponse.json(data)
  } catch {
    return NextResponse.json({ error: 'Failed to delete' }, { status: 502 })
  }
}
