import { NextResponse } from 'next/server'
import { createRazorpaySubscription } from '@/lib/razorpay/server'
import { assertSameOrigin, readJsonBody, requireVerifiedUser } from '@/lib/serverSecurity'
import {
  getPlanPrice,
  getRazorpayPlanId,
  getSubscriptionTotalCount,
  isCycle,
  isPaidTier,
  type BillingCycle,
  type PaidTier,
} from '@/lib/razorpay/plans'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * POST /api/razorpay/create-subscription
 * Body: { tier: 'premium'|'premium_plus', cycle: 'monthly'|'yearly' }
 *
 * Creates a Razorpay Subscription so Razorpay can generate and email invoices
 * for each successful subscription charge.
 */
export async function POST(req: Request) {
  const origin = assertSameOrigin(req)
  if (origin) return origin

  const auth = await requireVerifiedUser(req)
  if (!auth.ok) return auth.response

  try {
    const userId = auth.user.id
    const userEmail = auth.user.email
    const parsed = await readJsonBody<any>(req)
    if (!parsed.ok) return parsed.response
    const body = parsed.data
    const tier = body.tier as PaidTier
    const cycle = body.cycle as BillingCycle

    if (!isPaidTier(tier) || !isCycle(cycle)) {
      return NextResponse.json({ error: 'Invalid tier or billing cycle' }, { status: 400 })
    }

    const planId = getRazorpayPlanId(tier, cycle)
    if (!planId) {
      return NextResponse.json(
        {
          error:
            `Missing Razorpay plan id. Set RAZORPAY_PLAN_${tier.toUpperCase()}_${cycle.toUpperCase()} in production.`,
        },
        { status: 500 },
      )
    }

    const price = getPlanPrice(tier, cycle)
    const subscription = await createRazorpaySubscription({
      plan_id: planId,
      total_count: getSubscriptionTotalCount(cycle),
      notes: {
        user_id: userId,
        email: userEmail,
        tier,
        cycle,
      },
    })

    return NextResponse.json({
      subscriptionId: subscription.id,
      keyId: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID,
      amount: price.amountMinor,
      currency: price.currency,
      tier,
      cycle,
      displayAmount: price.amountMajor,
    })
  } catch (err: any) {
    console.error('[razorpay] create-subscription crashed:', err?.message || err)
    return NextResponse.json(
      { error: 'Could not create subscription' },
      { status: 500 },
    )
  }
}
