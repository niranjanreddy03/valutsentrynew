'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useSubscription, SubscriptionTier } from '@/contexts/SubscriptionContext'
import { useAuth } from '@/contexts/AuthContext'
import { useToast } from '@/contexts/ToastContext'
import { Check, X, Zap, Building2, Shield, ArrowRight } from 'lucide-react'

const FEATURE_LABELS: Record<string, string> = {
  slack_integration: 'Slack Integration',
  jira_integration: 'Jira Integration',
  github_app_integration: 'GitHub App Integration',
  aws_integration: 'AWS Integration',
  auto_rotation: 'Auto Secret Rotation',
  ml_risk_scoring: 'ML Risk Scoring',
  custom_patterns: 'Custom Scan Patterns',
  api_access: 'API Access',
  webhook_notifications: 'Webhook Notifications',
  scheduled_scans: 'Scheduled Scans',
  team_management: 'Team Management',
  priority_support: 'Priority Support',
  export_reports: 'Export Reports',
  audit_logs: 'Audit Logs',
  sso_enabled: 'SSO / SAML',
  custom_branding: 'Custom Branding',
  deep_scan: 'Deep Scan',
  entropy_analysis: 'Entropy Analysis',
  pr_scanning: 'PR Scanning',
  realtime_alerts: 'Real-time Alerts',
}

const HIGHLIGHTED_FEATURES = [
  'slack_integration',
  'jira_integration',
  'ml_risk_scoring',
  'scheduled_scans',
  'team_management',
  'api_access',
  'export_reports',
  'priority_support',
]

const INR = (n: number) => `₹${n.toLocaleString('en-IN')}`

export default function PricingPage() {
  const router = useRouter()
  const { user, isAuthenticated } = useAuth()
  const { plans, upgradeTier, startTrial, error } = useSubscription()
  const toast = useToast()
  const [isUpgrading, setIsUpgrading] = useState(false)
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'yearly'>('monthly')

  const currentTier = user?.subscription_tier || 'basic'
  const isTrialActive = user?.is_trial

  const handleUpgrade = async (tier: SubscriptionTier) => {
    if (!isAuthenticated) {
      router.push('/login?redirect=/pricing')
      return
    }
    if (tier === currentTier) {
      toast.info('You are already on this plan')
      return
    }
    if (tier === 'basic') {
      setIsUpgrading(true)
      try {
        const success = await upgradeTier(tier)
        if (success) {
          toast.success('Switched to Basic plan.')
          router.push('/')
        } else {
          toast.error(error || 'Failed to switch plan')
        }
      } finally {
        setIsUpgrading(false)
      }
      return
    }
    const params = new URLSearchParams({ plan: tier, cycle: billingCycle })
    router.push(`/checkout?${params.toString()}`)
  }

  const handleDowngrade = async (tier: SubscriptionTier, planName: string) => {
    if (!isAuthenticated) {
      router.push('/login?redirect=/pricing')
      return
    }
    const confirmed = window.confirm(
      `Switch from your current plan to ${planName}?\n\nYou'll lose access to higher-tier features at the end of your billing period. Continue?`,
    )
    if (!confirmed) return
    if (tier === 'basic') {
      setIsUpgrading(true)
      try {
        const success = await upgradeTier(tier)
        if (success) {
          toast.success(`Plan changed to ${planName}.`)
          router.push('/')
        } else {
          toast.error(error || 'Failed to change plan')
        }
      } finally {
        setIsUpgrading(false)
      }
    } else {
      const params = new URLSearchParams({ plan: tier, cycle: billingCycle })
      router.push(`/checkout?${params.toString()}`)
    }
  }

  const handleCancel = async () => {
    if (!isAuthenticated) return
    const confirmed = window.confirm(
      `Cancel your subscription?\n\nYou'll be moved to the Basic (Free) plan and lose access to paid features. This cannot be undone from this screen.`,
    )
    if (!confirmed) return
    setIsUpgrading(true)
    try {
      const success = await upgradeTier('basic' as SubscriptionTier)
      if (success) {
        toast.success('Subscription cancelled. You are now on the Basic plan.')
        router.push('/')
      } else {
        toast.error(error || 'Failed to cancel subscription')
      }
    } finally {
      setIsUpgrading(false)
    }
  }

  const handleStartTrial = async () => {
    if (!isAuthenticated) {
      router.push('/login?redirect=/pricing')
      return
    }
    setIsUpgrading(true)
    try {
      const success = await startTrial()
      if (success) {
        toast.success('Your 14-day Premium Plus trial has started!')
        router.push('/')
      } else {
        toast.error(error || 'Failed to start trial')
      }
    } finally {
      setIsUpgrading(false)
    }
  }

  const getTierOrder = (tier: string): number => {
    const order: Record<string, number> = { basic: 0, premium: 1, premium_plus: 2 }
    return order[tier] ?? 0
  }
  const canUpgradeTo = (tier: string): boolean => getTierOrder(tier) > getTierOrder(currentTier)

  const tierIcons: Record<string, typeof Shield> = {
    basic: Shield,
    premium: Zap,
    premium_plus: Building2,
  }

  const tierIconColors: Record<string, string> = {
    basic: 'bg-white/[0.05] text-white/50',
    premium: 'bg-blue-500/10 text-blue-400',
    premium_plus: 'bg-purple-500/10 text-purple-400',
  }

  return (
    <div className="min-h-screen bg-[#0a0a0f] py-16 px-4 sm:px-6 lg:px-8">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="text-center mb-14">
          <div className="inline-flex items-center justify-center w-10 h-10 rounded-lg bg-white/[0.04] border border-white/[0.06] mb-6">
            <Shield className="w-5 h-5 text-white/70" />
          </div>
          <h1 className="text-3xl font-semibold text-white tracking-tight">Pricing</h1>
          <p className="mt-3 text-[15px] text-white/50 max-w-md mx-auto">
            Secure your code at any scale. Start free, upgrade when you need more.
          </p>

          {isAuthenticated && (
            <div className="mt-6 flex flex-col items-center gap-2">
              <span className="inline-flex items-center px-3 py-1 rounded-full text-[12px] font-medium border border-white/[0.08] bg-white/[0.03] text-white/60">
                Current plan:{' '}
                <span className="ml-1 text-white">
                  {currentTier === 'premium_plus'
                    ? 'Premium Plus'
                    : currentTier.charAt(0).toUpperCase() + currentTier.slice(1)}
                </span>
                {isTrialActive && <span className="ml-1 text-amber-400">(Trial)</span>}
              </span>
              {currentTier !== 'basic' && (
                <button
                  onClick={handleCancel}
                  disabled={isUpgrading}
                  className="text-[12px] text-red-400/60 hover:text-red-400 transition-colors disabled:opacity-50"
                >
                  Cancel subscription
                </button>
              )}
            </div>
          )}

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

        {/* Pricing cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 max-w-5xl mx-auto">
          {plans.map((plan) => {
            const isCurrentPlan = plan.tier === currentTier
            const canUpgrade = canUpgradeTo(plan.tier)
            const price = billingCycle === 'yearly' ? plan.price.yearly / 12 : plan.price.monthly
            const isPopular = plan.tier === 'premium'
            const Icon = tierIcons[plan.tier] || Shield
            const iconColor = tierIconColors[plan.tier] || ''

            return (
              <div
                key={plan.id}
                className={`relative rounded-xl transition-all duration-200 ${
                  isPopular
                    ? 'bg-white/[0.03] border border-blue-500/30'
                    : isCurrentPlan
                    ? 'bg-white/[0.02] border border-emerald-500/20'
                    : 'bg-white/[0.015] border border-white/[0.06] hover:border-white/[0.1]'
                }`}
              >
                {isPopular && (
                  <div className="absolute -top-3 left-6">
                    <span className="text-[11px] font-medium text-blue-400 bg-blue-500/10 border border-blue-500/20 px-2.5 py-0.5 rounded-full">
                      Most popular
                    </span>
                  </div>
                )}
                {isCurrentPlan && !isPopular && (
                  <div className="absolute -top-3 left-6">
                    <span className="text-[11px] font-medium text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-0.5 rounded-full">
                      Current plan
                    </span>
                  </div>
                )}

                <div className="p-6">
                  <div className="flex items-center gap-2.5 mb-4">
                    <div className={`w-7 h-7 rounded-md flex items-center justify-center ${iconColor}`}>
                      <Icon className="w-3.5 h-3.5" />
                    </div>
                    <h3 className="text-[15px] font-semibold text-white">{plan.name}</h3>
                  </div>

                  {/* Price */}
                  <div className="mb-5">
                    {plan.price.monthly === 0 ? (
                      <div className="flex items-baseline gap-1">
                        <span className="text-3xl font-bold text-white">₹0</span>
                        <span className="text-sm text-white/30">/ month</span>
                      </div>
                    ) : (
                      <div>
                        <div className="flex items-baseline gap-1">
                          <span className="text-3xl font-bold text-white">{INR(Math.round(price))}</span>
                          <span className="text-sm text-white/30">/ mo</span>
                        </div>
                        {billingCycle === 'yearly' && plan.price.yearly > 0 && (
                          <p className="text-[12px] text-white/30 mt-1">
                            {INR(plan.price.yearly)} billed annually
                          </p>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Limits */}
                  <div className="flex gap-4 mb-5 py-3 border-y border-white/[0.04]">
                    <div>
                      <p className="text-[13px] font-medium text-white">{plan.limits.max_repositories}</p>
                      <p className="text-[11px] text-white/30">repos</p>
                    </div>
                    <div>
                      <p className="text-[13px] font-medium text-white">{plan.limits.scans_per_week}</p>
                      <p className="text-[11px] text-white/30">scans/wk</p>
                    </div>
                    <div>
                      <p className="text-[13px] font-medium text-white">{plan.limits.history_retention_days}d</p>
                      <p className="text-[11px] text-white/30">history</p>
                    </div>
                  </div>

                  {/* CTA */}
                  <div className="mb-5">
                    {isCurrentPlan ? (
                      <button
                        disabled
                        className="w-full py-2.5 px-4 rounded-lg text-[13px] font-medium cursor-not-allowed bg-white/[0.03] text-white/30 border border-white/[0.04]"
                      >
                        Current plan
                      </button>
                    ) : canUpgrade ? (
                      <button
                        onClick={() => handleUpgrade(plan.tier as SubscriptionTier)}
                        disabled={isUpgrading}
                        className={`w-full py-2.5 px-4 rounded-lg text-[13px] font-medium transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed ${
                          isPopular
                            ? 'bg-blue-600 hover:bg-blue-500 text-white'
                            : plan.tier === 'premium_plus'
                            ? 'bg-white/[0.08] hover:bg-white/[0.12] text-white border border-white/[0.08]'
                            : 'bg-white/[0.05] hover:bg-white/[0.08] text-white/80 border border-white/[0.06]'
                        }`}
                      >
                        {isUpgrading ? 'Processing…' : `Upgrade to ${plan.name}`}
                        {!isUpgrading && <ArrowRight className="w-3.5 h-3.5" />}
                      </button>
                    ) : (
                      <button
                        onClick={() => handleDowngrade(plan.tier as SubscriptionTier, plan.name)}
                        disabled={isUpgrading}
                        className="w-full py-2.5 px-4 rounded-lg text-[13px] font-medium transition-all bg-white/[0.05] hover:bg-white/[0.08] text-white/60 border border-white/[0.06] disabled:opacity-50"
                      >
                        {isUpgrading ? 'Processing…' : `Switch to ${plan.name}`}
                      </button>
                    )}
                  </div>

                  {plan.tier === 'premium_plus' && currentTier === 'basic' && !isTrialActive && (
                    <button
                      onClick={handleStartTrial}
                      disabled={isUpgrading}
                      className="w-full mb-5 py-2 px-4 rounded-lg text-[12px] font-medium transition-all text-purple-400/80 border border-purple-500/15 hover:border-purple-500/30 bg-transparent disabled:opacity-50"
                    >
                      Start 14-day free trial
                    </button>
                  )}

                  {/* Features */}
                  <div className="pt-4 border-t border-white/[0.04]">
                    <p className="text-[10px] font-medium text-white/25 uppercase tracking-wider mb-3">
                      Features
                    </p>
                    <ul className="space-y-2">
                      {HIGHLIGHTED_FEATURES.map((feature) => {
                        const hasFeature = plan.features[feature]
                        return (
                          <li key={feature} className="flex items-center gap-2 text-[13px]">
                            {hasFeature ? (
                              <Check className="w-3.5 h-3.5 text-emerald-400/70 shrink-0" />
                            ) : (
                              <X className="w-3.5 h-3.5 text-white/15 shrink-0" />
                            )}
                            <span className={hasFeature ? 'text-white/50' : 'text-white/20'}>
                              {FEATURE_LABELS[feature]}
                            </span>
                          </li>
                        )
                      })}
                    </ul>
                  </div>
                </div>
              </div>
            )
          })}
        </div>

        {/* FAQ */}
        <div className="mt-20 max-w-2xl mx-auto">
          <h2 className="text-lg font-semibold text-white text-center mb-6">Common questions</h2>
          <div className="space-y-3">
            <FAQ
              q="Can I cancel anytime?"
              a="Yes. Cancel anytime from your account settings. Access continues through the end of your billing period."
            />
            <FAQ
              q="What happens when my trial ends?"
              a="You'll move to the Starter plan automatically. No charge unless you upgrade. Your data stays."
            />
            <FAQ
              q="Do you offer enterprise plans?"
              a="Yes — contact us for volume discounts, dedicated support, and custom feature development."
            />
            <FAQ
              q="Which currencies do you support?"
              a="All plans are billed in INR. Contact us for invoicing in other currencies."
            />
          </div>
        </div>

        {/* Footer */}
        <p className="mt-12 text-center text-[11px] text-white/20">
          All plans include 256-bit encryption · Prices shown exclude applicable taxes
        </p>
      </div>
    </div>
  )
}

function FAQ({ q, a }: { q: string; a: string }) {
  return (
    <div className="rounded-lg border border-white/[0.05] bg-white/[0.015] px-5 py-4">
      <h3 className="text-[14px] font-medium text-white/80">{q}</h3>
      <p className="mt-1.5 text-[13px] text-white/40 leading-relaxed">{a}</p>
    </div>
  )
}
