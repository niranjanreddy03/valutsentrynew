import { NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import {
  supabaseAdmin,
  verifyPaymentSignature,
} from '@/lib/razorpay/server'
import {
  cycleDurationMs,
  isCycle,
  isPaidTier,
  type BillingCycle,
  type PaidTier,
} from '@/lib/razorpay/plans'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * POST /api/razorpay/verify
 * Body: {
 *   razorpay_order_id, razorpay_payment_id, razorpay_signature,
 *   tier, cycle
 * }
 *
 * Verifies the HMAC-SHA256 signature returned by Razorpay Checkout and,
 * on success, promotes the user in Supabase.
 *
 * Signature math: sha256_hmac(key_secret, `${order_id}|${payment_id}`).
 * Without this check an attacker could fake a successful payment by
 * crafting a POST — the signature is the only server-side proof.
 */
export async function POST(req: Request) {
  const supabase = createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const orderId = String(body.razorpay_order_id ?? '')
  const paymentId = String(body.razorpay_payment_id ?? '')
  const signature = String(body.razorpay_signature ?? '')
  const tier = body.tier as PaidTier
  const cycle = body.cycle as BillingCycle

  if (!orderId || !paymentId || !signature) {
    return NextResponse.json({ error: 'Missing payment fields' }, { status: 400 })
  }
  if (!isPaidTier(tier) || !isCycle(cycle)) {
    return NextResponse.json({ error: 'Invalid tier or cycle' }, { status: 400 })
  }

  const ok = verifyPaymentSignature({ orderId, paymentId, signature })
  if (!ok) {
    return NextResponse.json({ error: 'Signature mismatch' }, { status: 400 })
  }

  // Signature matched — promote the user. Use service-role client so this
  // works regardless of the RLS policies on public.users.
  const now = new Date()
  const expiresAt = new Date(now.getTime() + cycleDurationMs(cycle))

  const { error: updateErr } = await supabaseAdmin()
    .from('users')
    .update({
      subscription_tier: tier,
      subscription_started_at: now.toISOString(),
      subscription_expires_at: expiresAt.toISOString(),
      is_trial: false,
      trial_ends_at: null,
      updated_at: now.toISOString(),
    })
    .eq('id', user.id)

  if (updateErr) {
    console.error('[razorpay] failed to promote user after payment:', updateErr)
    return NextResponse.json(
      { error: 'Payment verified but failed to update subscription' },
      { status: 500 },
    )
  }

  return NextResponse.json({
    ok: true,
    tier,
    cycle,
    subscriptionExpiresAt: expiresAt.toISOString(),
  })
}
