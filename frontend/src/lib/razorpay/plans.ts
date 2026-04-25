/**
 * Server-trusted plan catalog.
 *
 * Prices are declared in the smallest currency unit (paise for INR, cents for
 * USD) so the amount passed to Razorpay is always an integer. Never trust the
 * amount sent from the browser — always look it up here by tier + cycle.
 */

export type PaidTier = 'premium' | 'premium_plus'
export type BillingCycle = 'monthly' | 'yearly'

export interface PlanPrice {
  /** Smallest currency unit (e.g. paise). Razorpay expects this. */
  amountMinor: number
  /** Display-friendly amount in the major unit. */
  amountMajor: number
  currency: string
  label: string
}

/**
 * Keep this in sync with the marketing copy on /choose-plan and /checkout.
 * INR prices chosen to roughly mirror the existing SubscriptionContext
 * defaults (₹299/mo premium, ₹999/mo premium_plus). Annual tiers give ~2
 * months free.
 */
const INR_PRICES: Record<PaidTier, Record<BillingCycle, { major: number }>> = {
  premium: { monthly: { major: 299 }, yearly: { major: 2990 } },
  premium_plus: { monthly: { major: 999 }, yearly: { major: 9990 } },
}

const USD_PRICES: Record<PaidTier, Record<BillingCycle, { major: number }>> = {
  premium: { monthly: { major: 29 }, yearly: { major: 290 } },
  premium_plus: { monthly: { major: 99 }, yearly: { major: 990 } },
}

export function getPlanPrice(tier: PaidTier, cycle: BillingCycle): PlanPrice {
  const currency = (process.env.RAZORPAY_CURRENCY || 'INR').toUpperCase()
  const table = currency === 'USD' ? USD_PRICES : INR_PRICES
  const major = table[tier][cycle].major
  return {
    amountMinor: major * 100,
    amountMajor: major,
    currency,
    label: cycle === 'yearly' ? 'year' : 'month',
  }
}

export function cycleDurationMs(cycle: BillingCycle): number {
  const days = cycle === 'yearly' ? 365 : 30
  return days * 24 * 60 * 60 * 1000
}

export function isPaidTier(value: unknown): value is PaidTier {
  return value === 'premium' || value === 'premium_plus'
}

export function isCycle(value: unknown): value is BillingCycle {
  return value === 'monthly' || value === 'yearly'
}
