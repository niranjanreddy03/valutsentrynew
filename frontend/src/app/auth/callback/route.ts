import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

const PRODUCTION_FALLBACK_ORIGIN = 'https://www.thevaultsentry.com'

/**
 * Derive the real external origin.
 *
 * On AWS Amplify (and similar reverse-proxy hosts) `request.url` resolves to
 * `http://localhost:3000` because Next.js runs behind the platform proxy.
 * We use `NEXT_PUBLIC_SITE_URL` first, then the forwarded host headers, and
 * finally fall back to a hardcoded production origin.
 */
function getExternalOrigin(request: Request): string {
  // 1. Explicit env var (most reliable — set once in Amplify console)
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim().replace(/\/$/, '')
  if (siteUrl) return siteUrl

  // 2. Forwarded headers set by the reverse proxy / CDN
  const forwardedHost =
    request.headers.get('x-forwarded-host') || request.headers.get('host')
  if (forwardedHost) {
    const proto = request.headers.get('x-forwarded-proto') || 'https'
    const host = forwardedHost.split(',')[0].trim()
    // Ignore localhost origins in production
    if (!host.startsWith('localhost') && !host.startsWith('127.0.0.1')) {
      return `${proto}://${host}`
    }
  }

  // 3. Hardcoded fallback
  return PRODUCTION_FALLBACK_ORIGIN
}

export async function GET(request: Request) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get('code')
  const next = requestUrl.searchParams.get('next') ?? '/'
  const origin = getExternalOrigin(request)

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
      
      return NextResponse.redirect(new URL(next, origin))
    }
  }

  // Return to login on error
  return NextResponse.redirect(new URL('/login?error=auth_callback_error', origin))
}
