import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/razorpay/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * GET /api/cron/expire-subscriptions
 *
 * Downgrades all users whose subscription_expires_at has passed back to
 * the 'basic' (Starter) tier.  Designed to be called by an external cron
 * service (e.g. Vercel Cron, AWS EventBridge, or a simple curl scheduler)
 * once per hour or once per day.
 *
 * Protected by CRON_SECRET — the caller must send it as a Bearer token
 * or as the `secret` query parameter.
 */
export async function GET(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret) {
    return NextResponse.json({ error: 'CRON_SECRET not configured' }, { status: 500 })
  }

  const auth = req.headers.get('authorization')?.replace('Bearer ', '') ||
    req.nextUrl.searchParams.get('secret')

  if (auth !== cronSecret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const admin = supabaseAdmin()
    const now = new Date().toISOString()

    const { data: expired, error: fetchErr } = await admin
      .from('users')
      .select('id, email, subscription_tier, subscription_expires_at')
      .neq('subscription_tier', 'basic')
      .lt('subscription_expires_at', now)

    if (fetchErr) {
      console.error('[cron] fetch expired subscriptions failed:', fetchErr)
      return NextResponse.json({ error: fetchErr.message }, { status: 500 })
    }

    if (!expired || expired.length === 0) {
      return NextResponse.json({ ok: true, expired: 0 })
    }

    const expiredIds = expired.map((u) => u.id)

    const { error: updateErr } = await admin
      .from('users')
      .update({
        subscription_tier: 'basic',
        updated_at: now,
      })
      .in('id', expiredIds)

    if (updateErr) {
      console.error('[cron] bulk downgrade failed:', updateErr)
      return NextResponse.json({ error: updateErr.message }, { status: 500 })
    }

    // Send expiry notification emails (best-effort).
    const resendKey = process.env.RESEND_API_KEY
    if (resendKey) {
      for (const user of expired) {
        if (!user.email) continue
        try {
          await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${resendKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              from: process.env.INVOICE_FROM_ADDRESS || 'VaultSentry <billing@thevaultsentry.com>',
              to: [user.email],
              subject: 'Your VaultSentry subscription has expired',
              html: `
<div style="font-family:system-ui,-apple-system,sans-serif;max-width:600px;margin:0 auto;padding:32px;color:#111">
  <h2 style="color:#2563eb;margin:0 0 16px">VaultSentry</h2>
  <p>Hi,</p>
  <p>Your <strong>${user.subscription_tier === 'premium' ? 'Professional' : 'Enterprise'}</strong> plan has expired as of <strong>${new Date(user.subscription_expires_at!).toLocaleDateString('en-IN', { year: 'numeric', month: 'long', day: 'numeric' })}</strong>.</p>
  <p>Your account has been downgraded to the <strong>Starter</strong> (free) plan. You can renew anytime from your dashboard to restore full access.</p>
  <p style="margin-top:24px">
    <a href="https://www.thevaultsentry.com/choose-plan" style="background:#2563eb;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none;font-size:14px;font-weight:500">Renew Plan</a>
  </p>
  <p style="color:#888;font-size:12px;margin-top:32px">Questions? Contact support@thevaultsentry.com</p>
</div>`,
              text: `Your VaultSentry ${user.subscription_tier === 'premium' ? 'Professional' : 'Enterprise'} plan has expired. Your account has been downgraded to Starter. Renew at https://www.thevaultsentry.com/choose-plan`,
            }),
          })
        } catch (err) {
          console.error(`[cron] expiry email to ${user.email} failed:`, err)
        }
      }
    }

    console.log(`[cron] expired ${expiredIds.length} subscriptions:`, expiredIds)
    return NextResponse.json({ ok: true, expired: expiredIds.length })
  } catch (err: any) {
    console.error('[cron] expire-subscriptions crashed:', err)
    return NextResponse.json({ error: err?.message || 'Internal error' }, { status: 500 })
  }
}
