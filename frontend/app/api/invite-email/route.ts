import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { rateLimitOrBlock } from '@/lib/rate-limit'
import { assertSameOrigin, readJsonBody, requireVerifiedUser } from '@/lib/serverSecurity'

// POST /api/invite-email — Send an invite email to a user
export async function POST(request: NextRequest) {
  const origin = assertSameOrigin(request)
  if (origin) return origin

  // Rate limit: 10 invites per 5 minutes per IP
  const blocked = rateLimitOrBlock(request, 'invite', 10, 300_000)
  if (blocked) return blocked

  const auth = await requireVerifiedUser(request)
  if (!auth.ok) return auth.response

  try {
    const parsed = await readJsonBody<any>(request, 16 * 1024)
    if (!parsed.ok) return parsed.response
    const { email, teamName, inviterName, role } = parsed.data

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email))) {
      return NextResponse.json({ error: 'A valid email is required' }, { status: 400 })
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

    if (!supabaseUrl || !supabaseAnonKey) {
      return NextResponse.json({ error: 'Supabase not configured' }, { status: 500 })
    }

    // Use Supabase's signInWithOtp to send a magic link as an invite
    // This sends a real email to the invited user via Supabase's built-in email service
    const supabase = createClient(supabaseUrl, supabaseAnonKey)

    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        // Don't actually create a session — just send an email
        shouldCreateUser: true,
        data: {
          invited_to_team: String(teamName || '').slice(0, 100),
          invited_by: String(inviterName || auth.user.name || auth.user.email).slice(0, 100),
          role: ['owner', 'admin', 'member', 'viewer'].includes(String(role)) ? role : 'member',
        },
        emailRedirectTo: new URL('/teams', request.url).toString(),
      },
    })

    if (error) {
      console.error('[INVITE] Supabase email error:', error)
      return NextResponse.json({ 
        error: error.message,
        fallback: true 
      }, { status: 422 })
    }

    return NextResponse.json({ 
      success: true, 
      message: `Invitation email sent to ${email}` 
    })
  } catch (err: any) {
    console.error('[INVITE] Error:', err?.message || err)
    return NextResponse.json({ error: 'Failed to send invite' }, { status: 500 })
  }
}
