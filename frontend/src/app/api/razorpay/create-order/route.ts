import { NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { razorpay } from '@/lib/razorpay/server'
import {
  getPlanPrice,
  isCycle,
  isPaidTier,
  type BillingCycle,
  type PaidTier,
} from '@/lib/razorpay/plans'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * POST /api/razorpay/create-order
 * Body: { tier: 'premium'|'premium_plus', cycle: 'monthly'|'yearly' }
 *
 * Creates a Razorpay order server-side (amount authored here, NOT from the
 * client) and returns the order id + public key. The browser then opens
 * Razorpay Checkout with these values.
 */
export async function POST(req: Request) {
  const supabase = createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  let body: { tier?: unknown; cycle?: unknown }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const tier = body.tier as PaidTier
  const cycle = body.cycle as BillingCycle
  if (!isPaidTier(tier) || !isCycle(cycle)) {
    return NextResponse.json(
      { error: 'Invalid tier or billing cycle' },
      { status: 400 },
    )
  }

  const price = getPlanPrice(tier, cycle)

  try {
    const order = await razorpay().orders.create({
      amount: price.amountMinor,
      currency: price.currency,
      // Receipt must be <= 40 chars. Use a short deterministic-ish token.
      receipt: `vs_${user.id.slice(0, 8)}_${Date.now().toString(36)}`.slice(0, 40),
      notes: {
        user_id: user.id,
        email: user.email ?? '',
        tier,
        cycle,
      },
    })

    return NextResponse.json({
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      keyId: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID,
      tier,
      cycle,
      displayAmount: price.amountMajor,
    })
  } catch (err) {
    console.error('[razorpay] create-order failed:', err)
    return NextResponse.json(
      { error: 'Could not create payment order' },
      { status: 502 },
    )
  }
}
