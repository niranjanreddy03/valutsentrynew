'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useSubscription, SubscriptionTier } from '@/contexts/SubscriptionContext'
import { useAuth } from '@/contexts/AuthContext'
import { useToast } from '@/contexts/ToastContext'
import { Check, X, Sparkles } from 'lucide-react'

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
    setIsUpgrading(true)
    try {
      const success = await upgradeTier(tier)
      if (success) {
        toast.success(
          `Successfully upgraded to ${tier === 'premium_plus' ? 'Premium Plus' : tier.charAt(0).toUpperCase() + tier.slice(1)}!`,
        )
        router.push('/')
      } else {
        toast.error(error || 'Failed to upgrade')
      }
    } finally {
      setIsUpgrading(false)
    }
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

  return (
    <div className="min-h-screen bg-[var(--bg-primary)] py-12 px-4 sm:px-6 lg:px-8 text-[var(--text-primary)]">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 rounded-full border border-[var(--border-color)] bg-[var(--bg-secondary)] px-3 py-1 text-xs text-[var(--text-muted)]">
            <Sparkles className="w-3.5 h-3.5 text-[var(--accent)]" />
            Simple, transparent pricing
          </div>
          <h1 className="mt-4 text-4xl font-extrabold sm:text-5xl">Choose Your Plan</h1>
          <p className="mt-4 text-lg text-[var(--text-muted)]">
            Secure your code with the right level of protection
          </p>

          {isAuthenticated && (
            <div className="mt-6 flex flex-col items-center gap-3">
              <span className="inline-flex items-center px-4 py-1.5 rounded-full text-sm font-medium border border-[var(--accent)]/40 bg-[var(--accent)]/10 text-[var(--accent)]">
                Current Plan:{' '}
                {currentTier === 'premium_plus'
                  ? 'Premium Plus'
                  : currentTier.charAt(0).toUpperCase() + currentTier.slice(1)}
                {isTrialActive && ' (Trial)'}
              </span>
              {currentTier !== 'basic' && (
                <button
                  onClick={handleCancel}
                  disabled={isUpgrading}
                  className="text-sm font-medium text-red-400 hover:text-red-300 underline-offset-2 hover:underline disabled:opacity-50"
                >
                  Cancel subscription
                </button>
              )}
            </div>
          )}

          {/* Billing toggle */}
          <div className="mt-8 flex items-center justify-center gap-4">
            <span
              className={`text-sm ${
                billingCycle === 'monthly'
                  ? 'text-[var(--text-primary)] font-semibold'
                  : 'text-[var(--text-muted)]'
              }`}
            >
              Monthly
            </span>
            <button
              onClick={() => setBillingCycle(billingCycle === 'monthly' ? 'yearly' : 'monthly')}
              className="relative inline-flex h-6 w-11 items-center rounded-full transition-colors"
              style={{
                background:
                  billingCycle === 'yearly' ? 'var(--accent)' : 'var(--bg-secondary)',
                border: '1px solid var(--border-color)',
              }}
              aria-label="Toggle billing cycle"
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                  billingCycle === 'yearly' ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
            <span
              className={`text-sm ${
                billingCycle === 'yearly'
                  ? 'text-[var(--text-primary)] font-semibold'
                  : 'text-[var(--text-muted)]'
              }`}
            >
              Yearly
              <span className="ml-1 text-emerald-400">(Save 17%)</span>
            </span>
          </div>
        </div>

        {/* Pricing cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-6xl mx-auto">
          {plans.map((plan) => {
            const isCurrentPlan = plan.tier === currentTier
            const canUpgrade = canUpgradeTo(plan.tier)
            const price = billingCycle === 'yearly' ? plan.price.yearly / 12 : plan.price.monthly
            const isPopular = plan.tier === 'premium'

            return (
              <div
                key={plan.id}
                className="relative rounded-2xl transition-all"
                style={{
                  background: 'var(--card-bg)',
                  border: isPopular
                    ? '1px solid var(--accent)'
                    : isCurrentPlan
                    ? '1px solid rgb(16 185 129)'
                    : '1px solid var(--border-color)',
                  boxShadow: isPopular
                    ? '0 0 0 4px color-mix(in srgb, var(--accent) 15%, transparent)'
                    : 'none',
                  transform: isPopular ? 'translateY(-4px)' : 'none',
                }}
              >
                {isPopular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <span
                      className="px-3 py-1 rounded-full text-xs font-semibold text-white"
                      style={{ background: 'var(--accent)' }}
                    >
                      Most Popular
                    </span>
                  </div>
                )}
                {isCurrentPlan && !isPopular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <span className="bg-emerald-500 text-white px-3 py-1 rounded-full text-xs font-semibold">
                      Current Plan
                    </span>
                  </div>
                )}

                <div className="p-8">
                  <h3 className="text-2xl font-bold">{plan.name}</h3>

                  {/* Price */}
                  <div className="mt-4 flex items-baseline">
                    {plan.price.monthly === 0 ? (
                      <span className="text-5xl font-extrabold">Free</span>
                    ) : (
                      <>
                        <span className="text-5xl font-extrabold">{INR(Math.round(price))}</span>
                        <span className="ml-1 text-xl text-[var(--text-muted)]">/mo</span>
                      </>
                    )}
                  </div>
                  {billingCycle === 'yearly' && plan.price.yearly > 0 && (
                    <p className="mt-1 text-sm text-[var(--text-muted)]">
                      Billed {INR(plan.price.yearly)}/year
                    </p>
                  )}

                  {/* Limits */}
                  <div className="mt-6 space-y-2">
                    <LimitRow
                      text={`${plan.limits.max_repositories} Repositories`}
                    />
                    <LimitRow text={`${plan.limits.scans_per_week} Scans/Week`} />
                    <LimitRow text={`${plan.limits.history_retention_days} Days History`} />
                  </div>

                  {/* CTA */}
                  <div className="mt-8">
                    {isCurrentPlan ? (
                      <button
                        disabled
                        className="w-full py-3 px-4 rounded-lg font-semibold cursor-not-allowed"
                        style={{
                          background: 'var(--bg-secondary)',
                          color: 'var(--text-muted)',
                          border: '1px solid var(--border-color)',
                        }}
                      >
                        Current Plan
                      </button>
                    ) : canUpgrade ? (
                      <button
                        onClick={() => handleUpgrade(plan.tier as SubscriptionTier)}
                        disabled={isUpgrading}
                        className="w-full py-3 px-4 rounded-lg font-semibold transition-colors text-white disabled:opacity-50 disabled:cursor-not-allowed"
                        style={{
                          background: isPopular
                            ? 'var(--accent)'
                            : plan.tier === 'premium_plus'
                            ? 'linear-gradient(135deg, var(--accent), #8b5cf6)'
                            : 'var(--bg-secondary)',
                          color: isPopular || plan.tier === 'premium_plus' ? 'white' : 'var(--text-primary)',
                          border:
                            isPopular || plan.tier === 'premium_plus'
                              ? 'none'
                              : '1px solid var(--border-color)',
                        }}
                      >
                        {isUpgrading ? 'Processing…' : `Upgrade to ${plan.name}`}
                      </button>
                    ) : (
                      <button
                        onClick={() => handleDowngrade(plan.tier as SubscriptionTier, plan.name)}
                        disabled={isUpgrading}
                        className="w-full py-3 px-4 rounded-lg font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        style={{
                          background: 'var(--bg-secondary)',
                          color: 'var(--text-primary)',
                          border: '1px solid var(--border-color)',
                        }}
                      >
                        {isUpgrading ? 'Processing…' : `Downgrade to ${plan.name}`}
                      </button>
                    )}
                  </div>

                  {plan.tier === 'premium_plus' && currentTier === 'basic' && !isTrialActive && (
                    <button
                      onClick={handleStartTrial}
                      disabled={isUpgrading}
                      className="w-full mt-3 py-2 px-4 rounded-lg font-medium transition-colors disabled:opacity-50"
                      style={{
                        color: 'var(--accent)',
                        border: '1px solid var(--accent)',
                        background: 'transparent',
                      }}
                    >
                      Start 14-Day Free Trial
                    </button>
                  )}

                  {/* Features */}
                  <div
                    className="mt-8 pt-6 border-t"
                    style={{ borderColor: 'var(--border-color)' }}
                  >
                    <h4 className="text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">
                      Features
                    </h4>
                    <ul className="mt-4 space-y-3">
                      {HIGHLIGHTED_FEATURES.map((feature) => {
                        const hasFeature = plan.features[feature]
                        return (
                          <li key={feature} className="flex items-center text-sm">
                            {hasFeature ? (
                              <Check className="w-4 h-4 text-emerald-400 mr-2 shrink-0" />
                            ) : (
                              <X className="w-4 h-4 text-[var(--text-muted)] opacity-40 mr-2 shrink-0" />
                            )}
                            <span
                              className={
                                hasFeature
                                  ? 'text-[var(--text-primary)]'
                                  : 'text-[var(--text-muted)] opacity-60'
                              }
                            >
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
        <div className="mt-16 text-center">
          <h2 className="text-2xl font-bold">Frequently Asked Questions</h2>
          <div className="mt-8 max-w-3xl mx-auto space-y-6 text-left">
            <FAQ
              q="Can I cancel anytime?"
              a="Yes, you can cancel your subscription at any time. Your access will continue until the end of your billing period."
            />
            <FAQ
              q="What happens when my trial ends?"
              a="When your trial ends, you'll be automatically moved to the Basic plan unless you upgrade. Your data will be retained."
            />
            <FAQ
              q="Do you offer team or enterprise plans?"
              a="Yes! Contact us for custom enterprise pricing with volume discounts, dedicated support, and custom features."
            />
            <FAQ
              q="Which currencies do you support?"
              a="All plans are billed in Indian Rupees (INR). Contact us if you need billing in a different currency."
            />
          </div>
        </div>
      </div>
    </div>
  )
}

function LimitRow({ text }: { text: string }) {
  return (
    <div className="flex items-center text-sm text-[var(--text-secondary)]">
      <Check className="w-4 h-4 text-emerald-400 mr-2 shrink-0" />
      <span>{text}</span>
    </div>
  )
}

function FAQ({ q, a }: { q: string; a: string }) {
  return (
    <div
      className="rounded-xl p-5"
      style={{
        background: 'var(--card-bg)',
        border: '1px solid var(--border-color)',
      }}
    >
      <h3 className="text-base font-semibold text-[var(--text-primary)]">{q}</h3>
      <p className="mt-2 text-sm text-[var(--text-muted)]">{a}</p>
    </div>
  )
}
