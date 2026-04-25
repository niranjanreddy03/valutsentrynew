'use client'

import { useEffect, useMemo, useState, Suspense } from 'react'
import Script from 'next/script'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowLeft,
  CheckCircle2,
  Lock,
  Shield,
  Loader2,
  Crown,
  Rocket,
} from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { useToast } from '@/contexts/ToastContext'

// Keep this in sync with /choose-plan PLANS.
type PaidTier = 'premium' | 'premium_plus'
type Cycle = 'monthly' | 'yearly'

interface PaidPlan {
  tier: PaidTier
  name: string
  tagline: string
  highlights: string[]
  icon: typeof Rocket
  gradient: string
}

const PAID_PLANS: Record<PaidTier, PaidPlan> = {
  premium: {
    tier: 'premium',
    name: 'Professional',
    tagline: 'Best for growing teams',
    icon: Rocket,
    gradient: 'from-blue-500 to-indigo-600',
    highlights: [
      'Up to 25 repositories',
      '100 scans per week',
      'Slack & Jira integration',
      'Team management',
      'Priority support',
    ],
  },
  premium_plus: {
    tier: 'premium_plus',
    name: 'Enterprise',
    tagline: 'For large organizations',
    icon: Crown,
    gradient: 'from-purple-500 to-pink-600',
    highlights: [
      'Unlimited repositories & scans',
      'ML-powered risk scoring',
      'SSO / SAML',
      'Audit logs & custom branding',
      'Dedicated support',
    ],
  },
}

// Minimal typing for the global Razorpay Checkout script.
declare global {
  interface Window {
    Razorpay?: new (options: RazorpayOptions) => { open: () => void; on: (e: string, cb: (p: unknown) => void) => void }
  }
}
interface RazorpayOptions {
  key: string
  amount: number
  currency: string
  name: string
  description: string
  order_id: string
  prefill?: { name?: string; email?: string }
  theme?: { color?: string }
  handler: (response: {
    razorpay_order_id: string
    razorpay_payment_id: string
    razorpay_signature: string
  }) => void
  modal?: { ondismiss?: () => void }
}

function CheckoutInner() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { user, isAuthenticated, isLoading: authLoading, updateProfile } = useAuth()
  const toast = useToast()

  const planParam = (searchParams.get('plan') || '') as PaidTier | ''
  const cycleParam = (searchParams.get('cycle') || 'monthly') as Cycle

  const plan = planParam && planParam in PAID_PLANS ? PAID_PLANS[planParam] : null

  const [scriptReady, setScriptReady] = useState(false)
  const [processing, setProcessing] = useState(false)
  const [success, setSuccess] = useState(false)
  const [quote, setQuote] = useState<{ amountMajor: number; currency: string } | null>(null)

  // Guard: bad params → back to plan selection
  useEffect(() => {
    if (!plan) router.replace('/choose-plan')
  }, [plan, router])

  // Guard: must be signed in.
  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.replace('/login?redirect=/choose-plan')
    }
  }, [authLoading, isAuthenticated, router])

  // Fetch a preview order just to know the amount/currency for display.
  // The real order used for the charge is the one created at pay time.
  useEffect(() => {
    if (!plan || !isAuthenticated) return
    let cancelled = false
    fetch('/api/razorpay/create-order', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ tier: plan.tier, cycle: cycleParam }),
    })
      .then((r) => (r.ok ? r.json() : Promise.reject(r)))
      .then((data) => {
        if (cancelled) return
        setQuote({ amountMajor: data.displayAmount, currency: data.currency })
      })
      .catch(() => {
        /* fall back to hiding the price until the user clicks pay */
      })
    return () => {
      cancelled = true
    }
  }, [plan, cycleParam, isAuthenticated])

  const priceLabel = useMemo(() => {
    if (!quote) return null
    const symbol = quote.currency === 'INR' ? '₹' : quote.currency === 'USD' ? '$' : ''
    return `${symbol}${quote.amountMajor.toLocaleString()}`
  }, [quote])

  const handlePay = async () => {
    if (!plan) return
    if (!window.Razorpay) {
      toast.error('Payment unavailable', 'Checkout script failed to load.')
      return
    }
    setProcessing(true)
    try {
      // 1) Server creates the order with a trusted amount.
      const orderRes = await fetch('/api/razorpay/create-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ tier: plan.tier, cycle: cycleParam }),
      })
      if (!orderRes.ok) {
        const err = await orderRes.json().catch(() => ({}))
        throw new Error(err.error || 'Could not start payment')
      }
      const order = await orderRes.json()

      // 2) Open Razorpay Checkout modal.
      const rzp = new window.Razorpay({
        key: order.keyId,
        amount: order.amount,
        currency: order.currency,
        name: 'VaultSentry',
        description: `${plan.name} · ${cycleParam === 'yearly' ? 'Annual' : 'Monthly'}`,
        order_id: order.orderId,
        prefill: {
          name: user?.full_name ?? undefined,
          email: user?.email ?? undefined,
        },
        theme: { color: '#2563eb' },
        handler: async (response) => {
          // 3) Browser posts signature back for server-side verification.
          try {
            const verifyRes = await fetch('/api/razorpay/verify', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              credentials: 'include',
              body: JSON.stringify({
                ...response,
                tier: plan.tier,
                cycle: cycleParam,
              }),
            })
            if (!verifyRes.ok) {
              const err = await verifyRes.json().catch(() => ({}))
              throw new Error(err.error || 'Verification failed')
            }
            const data = await verifyRes.json()
            // Server already promoted via service-role. Sync the local user
            // cache so SubscriptionContext/UI reflect the new tier without
            // requiring a full reload.
            await updateProfile({
              subscription_tier: plan.tier,
              subscription_started_at: new Date().toISOString(),
              subscription_expires_at: data.subscriptionExpiresAt,
              is_trial: false,
              trial_ends_at: null,
            }).catch(() => {})
            setSuccess(true)
            toast.success('Payment successful!', `Your ${plan.name} plan is now active.`)
            setTimeout(() => router.push('/'), 1500)
          } catch (e: unknown) {
            const msg = e instanceof Error ? e.message : 'Could not confirm payment'
            toast.error('Verification failed', msg)
            setProcessing(false)
          }
        },
        modal: {
          ondismiss: () => {
            setProcessing(false)
          },
        },
      })
      rzp.open()
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Payment could not start'
      toast.error('Payment error', msg)
      setProcessing(false)
    }
  }

  if (!plan) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950">
        <Loader2 className="w-8 h-8 text-slate-400 animate-spin" />
      </div>
    )
  }

  const Icon = plan.icon

  return (
    <>
      <Script
        src="https://checkout.razorpay.com/v1/checkout.js"
        strategy="afterInteractive"
        onLoad={() => setScriptReady(true)}
      />
      <div
        className="min-h-screen py-8 px-4"
        style={{ background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #0f172a 100%)' }}
      >
        <div className="max-w-4xl mx-auto">
          {/* Top bar */}
          <div className="flex items-center justify-between mb-8">
            <Link
              href="/choose-plan"
              className="inline-flex items-center gap-2 text-sm text-gray-300 hover:text-white transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to plans
            </Link>
            <div className="flex items-center gap-2 text-sm text-gray-300">
              <Lock className="w-4 h-4 text-emerald-400" />
              Secured by Razorpay
            </div>
          </div>

          {/* Brand */}
          <div className="text-center mb-10">
            <div className="inline-flex items-center gap-2">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-lg">
                <Shield className="w-5 h-5 text-white" />
              </div>
              <span className="text-xl font-bold text-white">VaultSentry Pay</span>
            </div>
            <p className="text-sm text-gray-400 mt-2">Complete your subscription</p>
          </div>

          <div className="bg-slate-900/80 border border-gray-700/50 rounded-2xl p-6 sm:p-8 backdrop-blur">
            {success ? (
              <div className="py-10 text-center">
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-emerald-500/15 border border-emerald-500/30 mb-5">
                  <CheckCircle2 className="w-8 h-8 text-emerald-400" />
                </div>
                <h2 className="text-2xl font-bold text-white mb-2">Payment successful</h2>
                <p className="text-gray-300">
                  Your {plan.name} plan is now active. Redirecting to your dashboard…
                </p>
                <Loader2 className="w-5 h-5 text-gray-400 animate-spin mx-auto mt-6" />
              </div>
            ) : (
              <>
                {/* Plan summary */}
                <div className="flex items-start gap-4 pb-6 border-b border-gray-700/40">
                  <div
                    className={`w-12 h-12 rounded-xl bg-gradient-to-br ${plan.gradient} flex items-center justify-center flex-shrink-0 shadow-lg`}
                  >
                    <Icon className="w-6 h-6 text-white" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-lg font-bold text-white">{plan.name}</p>
                    <p className="text-sm text-gray-400">{plan.tagline}</p>
                    <p className="text-xs text-gray-500 mt-1 capitalize">
                      {cycleParam} billing
                    </p>
                  </div>
                  <div className="text-right">
                    {priceLabel ? (
                      <>
                        <p className="text-2xl font-bold text-white">{priceLabel}</p>
                        <p className="text-xs text-gray-500">
                          per {cycleParam === 'yearly' ? 'year' : 'month'}
                        </p>
                      </>
                    ) : (
                      <Loader2 className="w-5 h-5 text-gray-400 animate-spin" />
                    )}
                  </div>
                </div>

                <ul className="mt-6 space-y-2">
                  {plan.highlights.map((h) => (
                    <li key={h} className="flex items-start gap-2 text-sm text-gray-200">
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 mt-0.5 flex-shrink-0" />
                      <span>{h}</span>
                    </li>
                  ))}
                </ul>

                <div className="mt-8 p-4 rounded-lg bg-blue-500/10 border border-blue-500/20">
                  <p className="text-xs text-blue-200 leading-relaxed">
                    You&apos;ll be redirected to Razorpay&apos;s secure checkout to pay with
                    UPI, card, net banking, or wallet. Your card details never touch our
                    servers.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={handlePay}
                  disabled={processing || !scriptReady || !quote}
                  className="mt-6 w-full py-3.5 px-4 rounded-xl font-semibold text-white bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 shadow-lg shadow-blue-500/25 transition-all flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {processing ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Processing…
                    </>
                  ) : (
                    <>
                      <Lock className="w-4 h-4" />
                      Pay {priceLabel ?? ''} securely
                    </>
                  )}
                </button>

                <p className="mt-4 text-center text-xs text-gray-500">
                  256-bit TLS · PCI-DSS compliant via Razorpay
                </p>
              </>
            )}
          </div>
        </div>
      </div>
    </>
  )
}

export default function CheckoutPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-slate-950">
          <Loader2 className="w-8 h-8 text-slate-400 animate-spin" />
        </div>
      }
    >
      <CheckoutInner />
    </Suspense>
  )
}
