'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { useToast } from '@/contexts/ToastContext'
import {
  Check,
  ChevronRight,
  Crown,
  Rocket,
  Shield,
  Sparkles,
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
  icon: typeof Shield
  gradient: string
  buttonGradient: string
}

const PLANS: Plan[] = [
  {
    id: 'basic',
    name: 'Starter',
    tier: 'basic',
    price: 0,
    yearlyPrice: 0,
    tagline: 'Perfect for individual developers',
    icon: Shield,
    gradient: 'from-slate-500 to-slate-700',
    buttonGradient: 'from-slate-600 to-slate-800',
    limits: { repos: 5, scans: 10, retention: '7 days' },
    features: [
      'Up to 5 repositories',
      '10 scans per week',
      'Basic secret detection',
      'Email notifications',
      '7-day scan history',
      'Community support',
    ],
  },
  {
    id: 'premium',
    name: 'Professional',
    tier: 'premium',
    price: 29,
    yearlyPrice: 290,
    tagline: 'Best for growing teams',
    popular: true,
    icon: Rocket,
    gradient: 'from-blue-500 to-indigo-600',
    buttonGradient: 'from-blue-600 to-indigo-700',
    limits: { repos: 25, scans: 100, retention: '90 days' },
    features: [
      'Up to 25 repositories',
      '100 scans per week',
      'Advanced secret detection',
      'Slack & Jira integration',
      'Team management',
      'Scheduled scans',
      'API access',
      '90-day scan history',
      'Priority support',
    ],
  },
  {
    id: 'premium_plus',
    name: 'Enterprise',
    tier: 'premium_plus',
    price: 99,
    yearlyPrice: 990,
    tagline: 'For large organizations',
    icon: Crown,
    gradient: 'from-purple-500 to-pink-600',
    buttonGradient: 'from-purple-600 to-pink-700',
    limits: { repos: 'Unlimited', scans: 'Unlimited', retention: '365 days' },
    features: [
      'Unlimited repositories',
      'Unlimited scans',
      'ML-powered risk scoring',
      'Auto secret rotation',
      'SSO / SAML',
      'Custom branding',
      'Webhook notifications',
      'Export reports (PDF/CSV)',
      'Audit logs',
      '365-day scan history',
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
    // Only redirect if fully loaded, authenticated, and NOT a new user
    const isNewUser = typeof window !== 'undefined' && localStorage.getItem('vs_new_user') === 'true'
    if (!isLoading && isAuthenticated && !isNewUser) {
      router.push('/')
    }
  }, [isAuthenticated, isLoading, router])

  const handleSelectPlan = async (plan: Plan) => {
    setSelectedPlan(plan.id)
    if (plan.tier === 'basic') {
      // Free plan — activate basic tier immediately and route to dashboard.
      // Feature limits (1 repo, 1 scan/week, etc.) apply automatically via
      // SubscriptionContext reading user.subscription_tier.
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
            // Non-fatal: Supabase write can fail in demo mode / offline —
            // user already defaults to 'basic' in AuthContext fetchUserProfile.
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
      // Paid plan — redirect to the checkout gateway. The gateway handles
      // payment, persists the upgraded tier, then bounces back to the dashboard.
      const params = new URLSearchParams({
        plan: plan.tier,
        cycle: billingCycle,
      })
      router.push(`/checkout?${params.toString()}`)
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #0f172a 100%)' }}>
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    )
  }

  return (
    <div className="min-h-screen py-8 px-4" style={{ background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #0f172a 100%)' }}>
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="text-center mb-12">
          <div className="flex items-center justify-center gap-3 mb-4">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-blue-500/25">
              <Shield className="w-7 h-7 text-white" />
            </div>
          </div>
          <h1 className="text-4xl font-bold text-white mb-3">
            Welcome to VaultSentry
          </h1>
          <p className="text-lg text-gray-400 max-w-xl mx-auto">
            Choose a plan that fits your needs. You can always change later.
          </p>
          
          {/* Billing toggle */}
          <div className="mt-8 flex items-center justify-center gap-4">
            <span className={`text-sm font-medium ${billingCycle === 'monthly' ? 'text-white' : 'text-gray-500'}`}>
              Monthly
            </span>
            <button
              onClick={() => setBillingCycle(billingCycle === 'monthly' ? 'yearly' : 'monthly')}
              className="relative inline-flex h-7 w-14 items-center rounded-full bg-gray-700 transition-colors border border-gray-600"
            >
              <span
                className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${
                  billingCycle === 'yearly' ? 'translate-x-8' : 'translate-x-1'
                }`}
              />
            </button>
            <span className={`text-sm font-medium ${billingCycle === 'yearly' ? 'text-white' : 'text-gray-500'}`}>
              Yearly
              <span className="ml-1.5 text-xs text-emerald-400 font-semibold px-2 py-0.5 rounded-full bg-emerald-500/10">Save 17%</span>
            </span>
          </div>
        </div>

        {/* Plans */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto">
          {PLANS.map((plan) => {
            const price = billingCycle === 'yearly' ? Math.round(plan.yearlyPrice / 12) : plan.price
            const Icon = plan.icon
            
            return (
              <div
                key={plan.id}
                className={`relative rounded-2xl border transition-all duration-300 ${
                  plan.popular 
                    ? 'bg-gradient-to-b from-blue-950/80 to-slate-900/90 border-blue-500/50 shadow-xl shadow-blue-500/10 scale-[1.03] z-10' 
                    : 'bg-slate-900/70 border-gray-700/50 hover:border-gray-600'
                } ${selectedPlan === plan.id ? 'ring-2 ring-blue-400' : ''}`}
              >
                {plan.popular && (
                  <div className="absolute -top-3.5 left-1/2 -translate-x-1/2">
                    <span className="bg-gradient-to-r from-blue-500 to-indigo-600 text-white text-xs font-bold px-4 py-1.5 rounded-full shadow-lg flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5" />
                      MOST POPULAR
                    </span>
                  </div>
                )}

                <div className="p-7">
                  {/* Plan header */}
                  <div className="flex items-center gap-3 mb-2">
                    <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${plan.gradient} flex items-center justify-center shadow-lg`}>
                      <Icon className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <h3 className="text-xl font-bold text-white">{plan.name}</h3>
                    </div>
                  </div>
                  <p className="text-sm text-gray-400 mb-5">{plan.tagline}</p>

                  {/* Price */}
                  <div className="mb-6">
                    {plan.price === 0 ? (
                      <div className="flex items-baseline">
                        <span className="text-4xl font-extrabold text-white">Free</span>
                        <span className="ml-2 text-gray-500">forever</span>
                      </div>
                    ) : (
                      <div>
                        <div className="flex items-baseline">
                          <span className="text-4xl font-extrabold text-white">${price}</span>
                          <span className="ml-1.5 text-gray-500">/month</span>
                        </div>
                        {billingCycle === 'yearly' && (
                          <p className="text-xs text-gray-500 mt-1">Billed ${plan.yearlyPrice}/year</p>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Limits */}
                  <div className="grid grid-cols-3 gap-2 mb-6 p-3 rounded-lg bg-slate-800/60 border border-gray-700/30">
                    <div className="text-center">
                      <p className="text-sm font-bold text-white">{plan.limits.repos}</p>
                      <p className="text-[10px] text-gray-500 uppercase">Repos</p>
                    </div>
                    <div className="text-center border-x border-gray-700/30">
                      <p className="text-sm font-bold text-white">{plan.limits.scans}</p>
                      <p className="text-[10px] text-gray-500 uppercase">Scans/wk</p>
                    </div>
                    <div className="text-center">
                      <p className="text-sm font-bold text-white">{plan.limits.retention}</p>
                      <p className="text-[10px] text-gray-500 uppercase">History</p>
                    </div>
                  </div>

                  {/* CTA */}
                  <button
                    onClick={() => handleSelectPlan(plan)}
                    disabled={processing}
                    className={`w-full py-3 px-4 rounded-xl font-semibold text-white transition-all shadow-lg ${
                      plan.popular 
                        ? 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 shadow-blue-500/25' 
                        : plan.tier === 'premium_plus'
                        ? 'bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 shadow-purple-500/20'
                        : 'bg-gradient-to-r from-slate-600 to-slate-700 hover:from-slate-500 hover:to-slate-600 shadow-slate-500/10'
                    } disabled:opacity-50`}
                  >
                    {plan.price === 0 ? 'Get Started Free' : `Choose ${plan.name}`}
                    <ChevronRight className="inline-block w-4 h-4 ml-1" />
                  </button>

                  {/* Features */}
                  <div className="mt-6 pt-6 border-t border-gray-700/30">
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
                      {plan.price === 0 ? 'Includes' : 'Everything in Starter, plus'}
                    </p>
                    <ul className="space-y-2.5">
                      {plan.features.map((feature) => (
                        <li key={feature} className="flex items-start gap-2.5">
                          <Check className="w-4 h-4 text-emerald-400 mt-0.5 flex-shrink-0" />
                          <span className="text-sm text-gray-300">{feature}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            )
          })}
        </div>

        {/* Skip link */}
        <div className="text-center mt-8">
          <button
            onClick={() => {
              localStorage.removeItem('vs_new_user')
              router.push('/')
            }}
            className="text-sm text-gray-500 hover:text-gray-400 underline underline-offset-4 transition-colors"
          >
            Skip for now — I'll choose later
          </button>
        </div>
      </div>

    </div>
  )
}
