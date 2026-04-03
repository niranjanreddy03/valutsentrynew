import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// POST /api/invite-email — Send an invite email to a user
export async function POST(request: NextRequest) {
  try {
    const { email, teamName, inviterName, role } = await request.json()

    if (!email) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 })
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
          invited_to_team: teamName,
          invited_by: inviterName,
          role: role,
        },
        emailRedirectTo: `${request.headers.get('origin') || 'http://localhost:3000'}/teams`,
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
    console.error('[INVITE] Error:', err)
    return NextResponse.json({ error: err.message || 'Failed to send invite' }, { status: 500 })
  }
}
