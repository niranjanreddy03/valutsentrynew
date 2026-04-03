'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useSubscription, SubscriptionTier } from '@/contexts/SubscriptionContext'
import { useAuth } from '@/contexts/AuthContext'
import { useToast } from '@/contexts/ToastContext'

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

export default function PricingPage() {
  const router = useRouter()
  const { user, isAuthenticated } = useAuth()
  const { plans, status, upgradeTier, startTrial, isLoading, error } = useSubscription()
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
        toast.success(`Successfully upgraded to ${tier === 'premium_plus' ? 'Premium Plus' : tier.charAt(0).toUpperCase() + tier.slice(1)}!`)
        router.push('/')
      } else {
        toast.error(error || 'Failed to upgrade')
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

  const canUpgradeTo = (tier: string): boolean => {
    return getTierOrder(tier) > getTierOrder(currentTier)
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-extrabold text-gray-900 dark:text-white sm:text-5xl">
            Choose Your Plan
          </h1>
          <p className="mt-4 text-xl text-gray-600 dark:text-gray-400">
            Secure your code with the right level of protection
          </p>
          
          {/* Current plan badge */}
          {isAuthenticated && (
            <div className="mt-4">
              <span className="inline-flex items-center px-4 py-2 rounded-full text-sm font-medium bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                Current Plan: {currentTier === 'premium_plus' ? 'Premium Plus' : currentTier.charAt(0).toUpperCase() + currentTier.slice(1)}
                {isTrialActive && ' (Trial)'}
              </span>
            </div>
          )}

          {/* Billing toggle */}
          <div className="mt-8 flex items-center justify-center gap-4">
            <span className={`text-sm ${billingCycle === 'monthly' ? 'text-gray-900 dark:text-white font-semibold' : 'text-gray-500'}`}>
              Monthly
            </span>
            <button
              onClick={() => setBillingCycle(billingCycle === 'monthly' ? 'yearly' : 'monthly')}
              className="relative inline-flex h-6 w-11 items-center rounded-full bg-gray-200 dark:bg-gray-700 transition-colors"
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                  billingCycle === 'yearly' ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
            <span className={`text-sm ${billingCycle === 'yearly' ? 'text-gray-900 dark:text-white font-semibold' : 'text-gray-500'}`}>
              Yearly
              <span className="ml-1 text-green-600 dark:text-green-400">(Save 17%)</span>
            </span>
          </div>
        </div>

        {/* Pricing cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-6xl mx-auto">
          {plans.map((plan) => {
            const isCurrentPlan = plan.tier === currentTier
            const canUpgrade = canUpgradeTo(plan.tier)
            const price = billingCycle === 'yearly' ? plan.price.yearly / 12 : plan.price.monthly

            return (
              <div
                key={plan.id}
                className={`relative rounded-2xl bg-white dark:bg-gray-800 shadow-xl border-2 transition-all ${
                  plan.tier === 'premium'
                    ? 'border-blue-500 scale-105 z-10'
                    : isCurrentPlan
                    ? 'border-green-500'
                    : 'border-gray-200 dark:border-gray-700'
                }`}
              >
                {/* Popular badge */}
                {plan.tier === 'premium' && (
                  <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                    <span className="bg-blue-500 text-white px-4 py-1 rounded-full text-sm font-semibold">
                      Most Popular
                    </span>
                  </div>
                )}

                {/* Current plan badge */}
                {isCurrentPlan && (
                  <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                    <span className="bg-green-500 text-white px-4 py-1 rounded-full text-sm font-semibold">
                      Current Plan
                    </span>
                  </div>
                )}

                <div className="p-8">
                  {/* Plan name */}
                  <h3 className="text-2xl font-bold text-gray-900 dark:text-white">
                    {plan.name}
                  </h3>

                  {/* Price */}
                  <div className="mt-4 flex items-baseline">
                    {plan.price.monthly === 0 ? (
                      <span className="text-5xl font-extrabold text-gray-900 dark:text-white">Free</span>
                    ) : (
                      <>
                        <span className="text-5xl font-extrabold text-gray-900 dark:text-white">
                          ${Math.round(price)}
                        </span>
                        <span className="ml-1 text-xl text-gray-500">/mo</span>
                      </>
                    )}
                  </div>
                  {billingCycle === 'yearly' && plan.price.yearly > 0 && (
                    <p className="mt-1 text-sm text-gray-500">
                      Billed ${plan.price.yearly}/year
                    </p>
                  )}

                  {/* Limits */}
                  <div className="mt-6 space-y-2">
                    <div className="flex items-center text-gray-700 dark:text-gray-300">
                      <svg className="w-5 h-5 text-green-500 mr-2" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                      </svg>
                      <span>{typeof plan.limits.max_repositories === 'number' ? plan.limits.max_repositories : plan.limits.max_repositories} Repositories</span>
                    </div>
                    <div className="flex items-center text-gray-700 dark:text-gray-300">
                      <svg className="w-5 h-5 text-green-500 mr-2" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                      </svg>
                      <span>{typeof plan.limits.scans_per_week === 'number' ? plan.limits.scans_per_week : plan.limits.scans_per_week} Scans/Week</span>
                    </div>
                    <div className="flex items-center text-gray-700 dark:text-gray-300">
                      <svg className="w-5 h-5 text-green-500 mr-2" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                      </svg>
                      <span>{plan.limits.history_retention_days} Days History</span>
                    </div>
                  </div>

                  {/* CTA Button */}
                  <div className="mt-8">
                    {isCurrentPlan ? (
                      <button
                        disabled
                        className="w-full py-3 px-4 rounded-lg font-semibold bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 cursor-not-allowed"
                      >
                        Current Plan
                      </button>
                    ) : canUpgrade ? (
                      <button
                        onClick={() => handleUpgrade(plan.tier as SubscriptionTier)}
                        disabled={isUpgrading}
                        className={`w-full py-3 px-4 rounded-lg font-semibold transition-colors ${
                          plan.tier === 'premium'
                            ? 'bg-blue-600 hover:bg-blue-700 text-white'
                            : plan.tier === 'premium_plus'
                            ? 'bg-purple-600 hover:bg-purple-700 text-white'
                            : 'bg-gray-900 hover:bg-gray-800 text-white dark:bg-white dark:text-gray-900 dark:hover:bg-gray-100'
                        } disabled:opacity-50 disabled:cursor-not-allowed`}
                      >
                        {isUpgrading ? 'Processing...' : `Upgrade to ${plan.name}`}
                      </button>
                    ) : (
                      <button
                        disabled
                        className="w-full py-3 px-4 rounded-lg font-semibold bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 cursor-not-allowed"
                      >
                        Included in Current Plan
                      </button>
                    )}
                  </div>

                  {/* Trial button for basic users */}
                  {plan.tier === 'premium_plus' && currentTier === 'basic' && !isTrialActive && (
                    <button
                      onClick={handleStartTrial}
                      disabled={isUpgrading}
                      className="w-full mt-3 py-2 px-4 rounded-lg font-medium text-purple-600 dark:text-purple-400 border-2 border-purple-600 dark:border-purple-400 hover:bg-purple-50 dark:hover:bg-purple-900/20 transition-colors disabled:opacity-50"
                    >
                      Start 14-Day Free Trial
                    </button>
                  )}

                  {/* Features */}
                  <div className="mt-8 border-t border-gray-200 dark:border-gray-700 pt-6">
                    <h4 className="text-sm font-semibold text-gray-900 dark:text-white uppercase tracking-wide">
                      Features
                    </h4>
                    <ul className="mt-4 space-y-3">
                      {HIGHLIGHTED_FEATURES.map((feature) => {
                        const hasFeature = plan.features[feature]
                        return (
                          <li key={feature} className="flex items-center">
                            {hasFeature ? (
                              <svg className="w-5 h-5 text-green-500 mr-2" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                              </svg>
                            ) : (
                              <svg className="w-5 h-5 text-gray-300 dark:text-gray-600 mr-2" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                              </svg>
                            )}
                            <span className={hasFeature ? 'text-gray-700 dark:text-gray-300' : 'text-gray-400 dark:text-gray-500'}>
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

        {/* FAQ or additional info */}
        <div className="mt-16 text-center">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
            Frequently Asked Questions
          </h2>
          <div className="mt-8 max-w-3xl mx-auto space-y-6">
            <div className="text-left">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                Can I cancel anytime?
              </h3>
              <p className="mt-2 text-gray-600 dark:text-gray-400">
                Yes, you can cancel your subscription at any time. Your access will continue until the end of your billing period.
              </p>
            </div>
            <div className="text-left">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                What happens when my trial ends?
              </h3>
              <p className="mt-2 text-gray-600 dark:text-gray-400">
                When your trial ends, you'll be automatically moved to the Basic plan unless you upgrade. Your data will be retained.
              </p>
            </div>
            <div className="text-left">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                Do you offer team or enterprise plans?
              </h3>
              <p className="mt-2 text-gray-600 dark:text-gray-400">
                Yes! Contact us for custom enterprise pricing with volume discounts, dedicated support, and custom features.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
