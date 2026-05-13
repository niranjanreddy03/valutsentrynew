'use client'

import { useEffect, useMemo, useState, Suspense } from 'react'
import Script from 'next/script'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowLeft,
  Check,
  Lock,
  Shield,
  Loader2,
  Crown,
  Zap,
} from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { useToast } from '@/contexts/ToastContext'
import { getAuthHeaders } from '@/lib/authHeaders'

type PaidTier = 'premium' | 'premium_plus'
type Cycle = 'monthly' | 'yearly'

interface PaidPlan {
  tier: PaidTier
  name: string
  tagline: string
  highlights: string[]
}

const PAID_PLANS: Record<PaidTier, PaidPlan> = {
  premium: {
    tier: 'premium',
    name: 'Professional',
    tagline: 'Best for growing teams',
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
    highlights: [
      'Unlimited repositories & scans',
      'ML-powered risk scoring',
      'SSO / SAML',
      'Audit logs & custom branding',
      'Dedicated support',
    ],
  },
}

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
  const [billing, setBilling] = useState({
    fullName: '',
    address: '',
    city: '',
    state: '',
    zip: '',
    country: 'India',
  })
  const [quoteError, setQuoteError] = useState(false)
  const [billingErrors, setBillingErrors] = useState<Record<string, string>>({})

  useEffect(() => {
    if (!plan) router.replace('/choose-plan')
  }, [plan, router])

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.replace('/login?redirect=/choose-plan')
    }
  }, [authLoading, isAuthenticated, router])

  useEffect(() => {
    if (!plan || !isAuthenticated) return
    let cancelled = false
    setQuoteError(false)
    fetch('/api/razorpay/create-order', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
      credentials: 'include',
      body: JSON.stringify({ tier: plan.tier, cycle: cycleParam }),
    })
      .then((r) => (r.ok ? r.json() : Promise.reject(r)))
      .then((data) => {
        if (cancelled) return
        setQuote({ amountMajor: data.displayAmount, currency: data.currency })
      })
      .catch(() => {
        if (!cancelled) setQuoteError(true)
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

  const validateBilling = (): boolean => {
    const errors: Record<string, string> = {}
    if (!billing.fullName.trim()) errors.fullName = 'Full name is required'
    if (!billing.address.trim()) errors.address = 'Street address is required'
    if (!billing.city.trim()) errors.city = 'City is required'
    if (!billing.state.trim()) errors.state = 'State is required'
    if (!billing.zip.trim()) errors.zip = 'ZIP code is required'
    setBillingErrors(errors)
    return Object.keys(errors).length === 0
  }

  const handlePay = async () => {
    if (!plan) return
    if (!validateBilling()) {
      toast.error('Missing billing details', 'Please fill in all billing address fields.')
      return
    }
    if (!window.Razorpay) {
      toast.error('Payment unavailable', 'Checkout script failed to load.')
      return
    }
    setProcessing(true)
    try {
      const orderRes = await fetch('/api/razorpay/create-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        credentials: 'include',
        body: JSON.stringify({ tier: plan.tier, cycle: cycleParam }),
      })
      if (!orderRes.ok) {
        const err = await orderRes.json().catch(() => ({}))
        throw new Error(err.error || 'Could not start payment')
      }
      const order = await orderRes.json()

      const rzp = new window.Razorpay({
        key: order.keyId,
        amount: order.amount,
        currency: order.currency,
        name: 'VaultSentry',
        description: `${plan.name} · ${cycleParam === 'yearly' ? 'Annual' : 'Monthly'}`,
        order_id: order.orderId,
        prefill: {
          name: billing.fullName || user?.full_name || undefined,
          email: user?.email ?? undefined,
        },
        notes: {
          billing_address: billing.address,
          billing_city: billing.city,
          billing_state: billing.state,
          billing_zip: billing.zip,
          billing_country: billing.country,
        },
        theme: { color: '#2563eb' },
        handler: async (response) => {
          try {
            const verifyRes = await fetch('/api/razorpay/verify', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
              credentials: 'include',
              body: JSON.stringify({
                ...response,
                tier: plan.tier,
                cycle: cycleParam,
                billing,
              }),
            })
            if (!verifyRes.ok) {
              const err = await verifyRes.json().catch(() => ({}))
              throw new Error(err.error || 'Verification failed')
            }
            const data = await verifyRes.json()
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
      <div className="min-h-screen flex items-center justify-center bg-[#0a0a0f]">
        <Loader2 className="w-5 h-5 text-white/40 animate-spin" />
      </div>
    )
  }

  return (
    <>
      <Script
        src="https://checkout.razorpay.com/v1/checkout.js"
        strategy="afterInteractive"
        onLoad={() => setScriptReady(true)}
      />
      <div className="min-h-screen bg-[#0a0a0f] py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto">
          {/* Back link */}
          <Link
            href="/choose-plan"
            className="inline-flex items-center gap-1.5 text-[13px] text-white/40 hover:text-white/60 transition-colors mb-8"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Back to plans
          </Link>

          {success ? (
            <div className="text-center py-16">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-emerald-500/10 border border-emerald-500/20 mb-4">
                <Check className="w-5 h-5 text-emerald-400" />
              </div>
              <h2 className="text-xl font-semibold text-white mb-2">You&apos;re all set</h2>
              <p className="text-[14px] text-white/50">
                {plan.name} plan is active. Redirecting…
              </p>
              <div className="mt-6">
                <div className="w-4 h-4 border-2 border-white/20 border-t-white/60 rounded-full animate-spin mx-auto" />
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
              {/* Left — Order summary + billing */}
              <div className="lg:col-span-3 space-y-6">
                <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-6">
                  <p className="text-[11px] font-medium text-white/30 uppercase tracking-wider mb-5">
                    Order summary
                  </p>

                  <div className="flex items-center justify-between mb-5">
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                        plan.tier === 'premium' ? 'bg-blue-500/10' : 'bg-purple-500/10'
                      }`}>
                        {plan.tier === 'premium'
                          ? <Zap className="w-5 h-5 text-blue-400" />
                          : <Crown className="w-5 h-5 text-purple-400" />
                        }
                      </div>
                      <div>
                        <p className="text-[16px] font-semibold text-white">{plan.name}</p>
                        <p className="text-[13px] text-white/40">{plan.tagline}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      {priceLabel ? (
                        <div>
                          <p className="text-2xl font-bold text-white">{priceLabel}</p>
                          <p className="text-[12px] text-white/30">per {cycleParam === 'yearly' ? 'year' : 'month'}</p>
                        </div>
                      ) : quoteError ? (
                        <p className="text-[13px] text-red-400">Error</p>
                      ) : (
                        <div className="w-4 h-4 border-2 border-white/20 border-t-white/60 rounded-full animate-spin" />
                      )}
                    </div>
                  </div>

                  <div className="border-t border-white/[0.04] pt-4">
                    <p className="text-[11px] font-medium text-white/25 uppercase tracking-wider mb-3">What&apos;s included</p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {plan.highlights.map((h) => (
                        <div key={h} className="flex items-center gap-2">
                          <Check className="w-3.5 h-3.5 text-emerald-400/60 flex-shrink-0" />
                          <span className="text-[13px] text-white/50">{h}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="border-t border-white/[0.04] mt-5 pt-4 flex items-center justify-between">
                    <span className="text-[13px] text-white/40 capitalize">{cycleParam} billing</span>
                    <div className="flex items-center gap-1.5 text-[12px] text-white/25">
                      <Lock className="w-3 h-3" />
                      Secure checkout
                    </div>
                  </div>
                </div>

                {/* Billing Address — required */}
                <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-6">
                  <p className="text-[11px] font-medium text-white/30 uppercase tracking-wider mb-1">
                    Billing address
                  </p>
                  <p className="text-[12px] text-white/25 mb-4">
                    Required for your invoice.
                  </p>
                  <div className="space-y-3">
                    <div>
                      <label className="block text-[12px] text-white/40 mb-1">Full name <span className="text-red-400">*</span></label>
                      <input
                        type="text"
                        value={billing.fullName}
                        onChange={(e) => { setBilling({ ...billing, fullName: e.target.value }); setBillingErrors((p) => ({ ...p, fullName: '' })) }}
                        placeholder={user?.full_name || 'John Doe'}
                        className={`w-full px-3 py-2 rounded-lg bg-white/[0.04] border text-[13px] text-white placeholder:text-white/20 focus:outline-none transition-colors ${billingErrors.fullName ? 'border-red-500/50 focus:border-red-500/70' : 'border-white/[0.08] focus:border-white/[0.15]'}`}
                      />
                      {billingErrors.fullName && <p className="text-[11px] text-red-400 mt-1">{billingErrors.fullName}</p>}
                    </div>
                    <div>
                      <label className="block text-[12px] text-white/40 mb-1">Street address <span className="text-red-400">*</span></label>
                      <input
                        type="text"
                        value={billing.address}
                        onChange={(e) => { setBilling({ ...billing, address: e.target.value }); setBillingErrors((p) => ({ ...p, address: '' })) }}
                        placeholder="123 Main St, Apt 4"
                        className={`w-full px-3 py-2 rounded-lg bg-white/[0.04] border text-[13px] text-white placeholder:text-white/20 focus:outline-none transition-colors ${billingErrors.address ? 'border-red-500/50 focus:border-red-500/70' : 'border-white/[0.08] focus:border-white/[0.15]'}`}
                      />
                      {billingErrors.address && <p className="text-[11px] text-red-400 mt-1">{billingErrors.address}</p>}
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[12px] text-white/40 mb-1">City <span className="text-red-400">*</span></label>
                        <input
                          type="text"
                          value={billing.city}
                          onChange={(e) => { setBilling({ ...billing, city: e.target.value }); setBillingErrors((p) => ({ ...p, city: '' })) }}
                          placeholder="Hyderabad"
                          className={`w-full px-3 py-2 rounded-lg bg-white/[0.04] border text-[13px] text-white placeholder:text-white/20 focus:outline-none transition-colors ${billingErrors.city ? 'border-red-500/50 focus:border-red-500/70' : 'border-white/[0.08] focus:border-white/[0.15]'}`}
                        />
                        {billingErrors.city && <p className="text-[11px] text-red-400 mt-1">{billingErrors.city}</p>}
                      </div>
                      <div>
                        <label className="block text-[12px] text-white/40 mb-1">State <span className="text-red-400">*</span></label>
                        <input
                          type="text"
                          value={billing.state}
                          onChange={(e) => { setBilling({ ...billing, state: e.target.value }); setBillingErrors((p) => ({ ...p, state: '' })) }}
                          placeholder="Telangana"
                          className={`w-full px-3 py-2 rounded-lg bg-white/[0.04] border text-[13px] text-white placeholder:text-white/20 focus:outline-none transition-colors ${billingErrors.state ? 'border-red-500/50 focus:border-red-500/70' : 'border-white/[0.08] focus:border-white/[0.15]'}`}
                        />
                        {billingErrors.state && <p className="text-[11px] text-red-400 mt-1">{billingErrors.state}</p>}
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[12px] text-white/40 mb-1">ZIP / Postal code <span className="text-red-400">*</span></label>
                        <input
                          type="text"
                          value={billing.zip}
                          onChange={(e) => { setBilling({ ...billing, zip: e.target.value }); setBillingErrors((p) => ({ ...p, zip: '' })) }}
                          placeholder="500001"
                          className={`w-full px-3 py-2 rounded-lg bg-white/[0.04] border text-[13px] text-white placeholder:text-white/20 focus:outline-none transition-colors ${billingErrors.zip ? 'border-red-500/50 focus:border-red-500/70' : 'border-white/[0.08] focus:border-white/[0.15]'}`}
                        />
                        {billingErrors.zip && <p className="text-[11px] text-red-400 mt-1">{billingErrors.zip}</p>}
                      </div>
                      <div>
                        <label className="block text-[12px] text-white/40 mb-1">Country <span className="text-red-400">*</span></label>
                        <select
                          value={billing.country}
                          onChange={(e) => setBilling({ ...billing, country: e.target.value })}
                          className="w-full px-3 py-2 rounded-lg bg-white/[0.04] border border-white/[0.08] text-[13px] text-white focus:outline-none focus:border-white/[0.15] transition-colors"
                        >
                          <option value="India">India</option>
                          <option value="United States">United States</option>
                          <option value="United Kingdom">United Kingdom</option>
                          <option value="Canada">Canada</option>
                          <option value="Australia">Australia</option>
                          <option value="Germany">Germany</option>
                          <option value="Singapore">Singapore</option>
                        </select>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Right — Payment */}
              <div className="lg:col-span-2 space-y-4">
                <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-6">
                  <p className="text-[11px] font-medium text-white/30 uppercase tracking-wider mb-4">
                    Payment
                  </p>

                  <p className="text-[13px] text-white/50 leading-relaxed mb-5">
                    You&apos;ll be redirected to Razorpay&apos;s secure checkout to pay with UPI, card, net banking, or wallet.
                  </p>

                  <div className="rounded-lg border border-white/[0.04] bg-white/[0.02] p-3 mb-5">
                    <div className="flex items-center justify-between">
                      <span className="text-[13px] text-white/40">Total</span>
                      {priceLabel ? (
                        <span className="text-[15px] font-semibold text-white">{priceLabel}<span className="text-[11px] text-white/30 font-normal ml-0.5">/{cycleParam === 'yearly' ? 'yr' : 'mo'}</span></span>
                      ) : (
                        <div className="w-4 h-4 border-2 border-white/20 border-t-white/60 rounded-full animate-spin" />
                      )}
                    </div>
                  </div>

                  {quoteError && (
                    <div className="mb-4 p-3 rounded-lg bg-red-500/5 border border-red-500/10">
                      <p className="text-[13px] text-red-400">
                        Could not connect to payment server.
                      </p>
                      <button
                        type="button"
                        onClick={() => window.location.reload()}
                        className="mt-1.5 text-[12px] text-red-400/70 hover:text-red-300 underline underline-offset-2"
                      >
                        Retry
                      </button>
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={handlePay}
                    disabled={processing || !scriptReady || !quote || quoteError}
                    className="w-full py-3 px-4 rounded-lg text-[13px] font-medium text-white bg-blue-600 hover:bg-blue-500 transition-colors flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    {processing ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Processing…
                      </>
                    ) : (
                      <>
                        Pay {priceLabel ?? '…'} securely
                      </>
                    )}
                  </button>

                  <p className="mt-3 text-center text-[11px] text-white/20">
                    Your card details never touch our servers.
                  </p>
                </div>

                <div className="flex items-center justify-center gap-4 text-[11px] text-white/20 py-2">
                  <span className="flex items-center gap-1">
                    <Lock className="w-3 h-3" />
                    256-bit TLS
                  </span>
                  <span>PCI-DSS compliant</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  )
}

export default function CheckoutPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-[#0a0a0f]">
          <Loader2 className="w-5 h-5 text-white/40 animate-spin" />
        </div>
      }
    >
      <CheckoutInner />
    </Suspense>
  )
}
