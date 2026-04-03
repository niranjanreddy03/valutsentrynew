import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get('code')
  const next = requestUrl.searchParams.get('next') ?? '/'

  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    
    if (!error) {
      // Ensure user has a subscription tier set (for existing users or first-time login)
      const { data: { user } } = await supabase.auth.getUser()
      
      if (user) {
        // Check if user exists in public.users and has subscription set
        const { data: profile } = await supabase
          .from('users')
          .select('subscription_tier')
          .eq('id', user.id)
          .single()
        
        // If user has no subscription_tier, set to basic
        if (profile && !profile.subscription_tier) {
          await supabase
            .from('users')
            .update({
              subscription_tier: 'basic',
              subscription_started_at: new Date().toISOString()
            })
            .eq('id', user.id)
        }
      }
      
      return NextResponse.redirect(new URL(next, requestUrl.origin))
    }
  }

  // Return to login on error
  return NextResponse.redirect(new URL('/login?error=auth_callback_error', requestUrl.origin))
}
