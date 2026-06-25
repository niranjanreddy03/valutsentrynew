'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { useToast } from '@/contexts/ToastContext'
import {
  Check,
  ArrowRight,
  Zap,
  Building2,
  Shield,
} from 'lucide-react'

interface Plan {
  id: string
  name: string
  tier: 'basic' | 'premium' | 'premium_plus'
  price: number
  yearlyPrice: number
  tagline: string
  popular?: boolean
  features: string[]
  limits: {
    repos: number | string
    scans: number | string
    retention: string
  }
}

const PLANS: Plan[] = [
  {
    id: 'basic',
    name: 'Starter',
    tier: 'basic',
    price: 0,
    yearlyPrice: 0,
    tagline: 'For solo developers exploring secret detection',
    limits: { repos: 5, scans: 10, retention: '7 days' },
    features: [
      '5 repositories',
      '10 scans per week',
      'Basic secret detection',
      'Email notifications',
      '7-day scan history',
    ],
  },
  {
    id: 'premium',
    name: 'Professional',
    tier: 'premium',
    price: 299,
    yearlyPrice: 2990,
    tagline: 'For teams shipping code daily',
    popular: true,
    limits: { repos: 25, scans: 100, retention: '90 days' },
    features: [
      '25 repositories',
      '100 scans per week',
      'Slack & Jira integration',
      'Team management',
      'Scheduled scans & API access',
      '90-day history',
      'Priority support',
    ],
  },
  {
    id: 'premium_plus',
    name: 'Enterprise',
    tier: 'premium_plus',
    price: 999,
    yearlyPrice: 9990,
    tagline: 'For organizations with strict compliance needs',
    limits: { repos: 'Unlimited', scans: 'Unlimited', retention: '1 year' },
    features: [
      'Unlimited repos & scans',
      'ML-powered risk scoring',
      'Auto secret rotation',
      'SSO / SAML',
      'Audit logs & custom branding',
      'Export reports (PDF/CSV)',
      'Dedicated support',
    ],
  },
]

export default function ChoosePlanPage() {
  const router = useRouter()
  const { user, isAuthenticated, isLoading, updateProfile } = useAuth()
  const toast = useToast()
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null)
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'yearly'>('monthly')
  const [processing, setProcessing] = useState(false)

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push('/login?redirect=/choose-plan')
    }
  }, [isAuthenticated, isLoading, router])

  const handleSelectPlan = async (plan: Plan) => {
    setSelectedPlan(plan.id)
    if (plan.tier === 'basic') {
      setProcessing(true)
      try {
        if (user) {
          try {
            await updateProfile({
              subscription_tier: 'basic',
              subscription_started_at: new Date().toISOString(),
              is_trial: false,
              trial_ends_at: null,
            })
          } catch (err) {
            console.warn('Could not persist free-plan selection:', err)
          }
        }
        localStorage.removeItem('vs_new_user')
        toast.success('Welcome to VaultSentry!', 'Your Starter plan is active — limited features unlocked.')
        router.push('/')
      } catch {
        toast.error('Something went wrong')
      } finally {
        setProcessing(false)
      }
    } else {
      const params = new URLSearchParams({
        plan: plan.tier,
        cycle: billingCycle,
      })
      router.push(`/checkout?${params.toString()}`)
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0a0a0f]">
        <div className="w-5 h-5 border-2 border-white/20 border-t-white/80 rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#0a0a0f] py-16 px-4">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="text-center mb-14">
          <div className="inline-flex items-center justify-center w-10 h-10 rounded-lg bg-white/[0.04] border border-white/[0.06] mb-6">
            <Shield className="w-5 h-5 text-white/70" />
          </div>
          <h1 className="text-3xl font-semibold text-white tracking-tight">
            Pick your plan
          </h1>
          <p className="mt-3 text-[15px] text-white/50 max-w-md mx-auto">
            Start free, upgrade when you need more. All plans include core secret scanning.
          </p>

          {/* Billing toggle */}
          <div className="mt-8 inline-flex items-center gap-3 bg-white/[0.03] border border-white/[0.06] rounded-full px-1.5 py-1.5">
            <button
              onClick={() => setBillingCycle('monthly')}
              className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all ${
                billingCycle === 'monthly'
                  ? 'bg-white/[0.08] text-white'
                  : 'text-white/40 hover:text-white/60'
              }`}
            >
              Monthly
            </button>
            <button
              onClick={() => setBillingCycle('yearly')}
              className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all ${
                billingCycle === 'yearly'
                  ? 'bg-white/[0.08] text-white'
                  : 'text-white/40 hover:text-white/60'
              }`}
            >
              Yearly
              <span className="ml-1.5 text-[11px] text-emerald-400 font-medium">−17%</span>
            </button>
          </div>
        </div>

        {/* Plans */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {PLANS.map((plan) => {
            const price = billingCycle === 'yearly' ? Math.round(plan.yearlyPrice / 12) : plan.price
            const isSelected = selectedPlan === plan.id

            return (
              <div
                key={plan.id}
                className={`relative rounded-xl border transition-all duration-200 ${
                  plan.popular
                    ? 'bg-white/[0.03] border-blue-500/30'
                    : 'bg-white/[0.015] border-white/[0.06] hover:border-white/[0.1]'
                } ${isSelected ? 'ring-1 ring-blue-400/50' : ''}`}
              >
                {plan.popular && (
                  <div className="absolute -top-3 left-6">
                    <span className="text-[11px] font-medium text-blue-400 bg-blue-500/10 border border-blue-500/20 px-2.5 py-0.5 rounded-full">
                      Recommended
                    </span>
                  </div>
                )}

                <div className="p-6">
                  {/* Plan name */}
                  <div className="flex items-center gap-2.5 mb-1">
                    <div className={`w-7 h-7 rounded-md flex items-center justify-center ${
                      plan.tier === 'basic' ? 'bg-white/[0.05]' :
                      plan.tier === 'premium' ? 'bg-blue-500/10' :
                      'bg-purple-500/10'
                    }`}>
                      {plan.tier === 'basic' && <Shield className="w-3.5 h-3.5 text-white/50" />}
                      {plan.tier === 'premium' && <Zap className="w-3.5 h-3.5 text-blue-400" />}
                      {plan.tier === 'premium_plus' && <Building2 className="w-3.5 h-3.5 text-purple-400" />}
                    </div>
                    <h3 className="text-[15px] font-semibold text-white">{plan.name}</h3>
                  </div>
                  <p className="text-[13px] text-white/40 mb-5 pl-[38px]">{plan.tagline}</p>

                  {/* Price */}
                  <div className="mb-5">
                    {plan.price === 0 ? (
                      <div className="flex items-baseline gap-1">
                        <span className="text-3xl font-bold text-white">₹0</span>
                        <span className="text-sm text-white/30">/ month</span>
                      </div>
                    ) : (
                      <div>
                        <div className="flex items-baseline gap-1">
                          <span className="text-3xl font-bold text-white">₹{price}</span>
                          <span className="text-sm text-white/30">/ month</span>
                        </div>
                        {billingCycle === 'yearly' && (
                          <p className="text-[12px] text-white/30 mt-1">₹{plan.yearlyPrice} billed annually</p>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Limits row */}
                  <div className="flex gap-4 mb-5 py-3 border-y border-white/[0.04]">
                    <div>
                      <p className="text-[13px] font-medium text-white">{plan.limits.repos}</p>
                      <p className="text-[11px] text-white/30">repos</p>
                    </div>
                    <div>
                      <p className="text-[13px] font-medium text-white">{plan.limits.scans}</p>
                      <p className="text-[11px] text-white/30">scans/wk</p>
                    </div>
                    <div>
                      <p className="text-[13px] font-medium text-white">{plan.limits.retention}</p>
                      <p className="text-[11px] text-white/30">history</p>
                    </div>
                  </div>

                  {/* CTA */}
                  <button
                    onClick={() => handleSelectPlan(plan)}
                    disabled={processing}
                    className={`w-full py-2.5 px-4 rounded-lg text-[13px] font-medium transition-all flex items-center justify-center gap-2 disabled:opacity-50 ${
                      plan.popular
                        ? 'bg-blue-600 hover:bg-blue-500 text-white'
                        : plan.tier === 'premium_plus'
                        ? 'bg-white/[0.08] hover:bg-white/[0.12] text-white border border-white/[0.08]'
                        : 'bg-white/[0.05] hover:bg-white/[0.08] text-white/80 border border-white/[0.06]'
                    }`}
                  >
                    {plan.price === 0 ? 'Start free' : `Get ${plan.name}`}
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>

                  {/* Features */}
                  <ul className="mt-5 space-y-2">
                    {plan.features.map((feature) => (
                      <li key={feature} className="flex items-start gap-2">
                        <Check className="w-3.5 h-3.5 text-emerald-400/70 mt-0.5 flex-shrink-0" />
                        <span className="text-[13px] text-white/50">{feature}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            )
          })}
        </div>

        {/* Footer */}
        <div className="mt-10 text-center space-y-3">
          <button
            onClick={() => {
              localStorage.removeItem('vs_new_user')
              router.push('/')
            }}
            className="text-[13px] text-white/30 hover:text-white/50 transition-colors"
          >
            Skip for now
          </button>
          <p className="text-[11px] text-white/20">
            All plans include 256-bit encryption · Cancel anytime · No credit card for Starter
          </p>
        </div>
      </div>
    </div>
  )
}
