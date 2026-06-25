import { NextResponse } from 'next/server'
import {
  getPlanPrice,
  isCycle,
  isPaidTier,
  type BillingCycle,
  type PaidTier,
} from '@/lib/razorpay/plans'
import { assertSameOrigin, readJsonBody } from '@/lib/serverSecurity'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  const origin = assertSameOrigin(req)
  if (origin) return origin

  const parsed = await readJsonBody<any>(req, 8 * 1024)
  if (!parsed.ok) return parsed.response
  const body = parsed.data
  const tier = body.tier as PaidTier
  const cycle = body.cycle as BillingCycle

  if (!isPaidTier(tier) || !isCycle(cycle)) {
    return NextResponse.json({ error: 'Invalid tier or billing cycle' }, { status: 400 })
  }

  const price = getPlanPrice(tier, cycle)
  return NextResponse.json({
    amount: price.amountMinor,
    displayAmount: price.amountMajor,
    currency: price.currency,
    tier,
    cycle,
  })
}
