'use client'

import Link from 'next/link'
import { useSubscription } from '@/contexts/SubscriptionContext'
import { useAuth } from '@/contexts/AuthContext'

interface SubscriptionBadgeProps {
  showUpgrade?: boolean
  size?: 'sm' | 'md' | 'lg'
}

export function SubscriptionBadge({ showUpgrade = true, size = 'md' }: SubscriptionBadgeProps) {
  const { user } = useAuth()
  const { status } = useSubscription()

  if (!user) return null

  const tier = user.subscription_tier || 'basic'
  const isTrialActive = user.is_trial

  const tierConfig = {
    basic: {
      label: 'Basic',
      bgColor: 'bg-gray-100 dark:bg-gray-700',
      textColor: 'text-gray-700 dark:text-gray-300',
      borderColor: 'border-gray-300 dark:border-gray-600',
    },
    premium: {
      label: 'Premium',
      bgColor: 'bg-blue-100 dark:bg-blue-900/30',
      textColor: 'text-blue-700 dark:text-blue-300',
      borderColor: 'border-blue-300 dark:border-blue-700',
    },
    premium_plus: {
      label: 'Premium Plus',
      bgColor: 'bg-purple-100 dark:bg-purple-900/30',
      textColor: 'text-purple-700 dark:text-purple-300',
      borderColor: 'border-purple-300 dark:border-purple-700',
    },
  }

  const config = tierConfig[tier as keyof typeof tierConfig] || tierConfig.basic

  const sizeClasses = {
    sm: 'text-xs px-2 py-0.5',
    md: 'text-sm px-2.5 py-1',
    lg: 'text-base px-3 py-1.5',
  }

  return (
    <div className="flex items-center gap-2">
      <span
        className={`inline-flex items-center rounded-full border font-medium ${config.bgColor} ${config.textColor} ${config.borderColor} ${sizeClasses[size]}`}
      >
        {config.label}
        {isTrialActive && (
          <span className="ml-1 text-xs opacity-75">(Trial)</span>
        )}
      </span>
      {showUpgrade && tier === 'basic' && (
        <Link
          href="/pricing"
          className="text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline"
        >
          Upgrade
        </Link>
      )}
    </div>
  )
}

interface UsageMeterProps {
  label: string
  used: number
  limit: number
  showPercentage?: boolean
}

export function UsageMeter({ label, used, limit, showPercentage = true }: UsageMeterProps) {
  const isUnlimited = limit < 0 || limit >= 999999
  const percentage = isUnlimited ? 0 : Math.min((used / limit) * 100, 100)
  const isNearLimit = percentage >= 80
  const isAtLimit = percentage >= 100

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-sm">
        <span className="text-gray-600 dark:text-gray-400">{label}</span>
        <span className={`font-medium ${isAtLimit ? 'text-red-600' : isNearLimit ? 'text-yellow-600' : 'text-gray-900 dark:text-white'}`}>
          {used} / {isUnlimited ? '∞' : limit}
        </span>
      </div>
      {!isUnlimited && (
        <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${
              isAtLimit
                ? 'bg-red-500'
                : isNearLimit
                ? 'bg-yellow-500'
                : 'bg-blue-500'
            }`}
            style={{ width: `${percentage}%` }}
          />
        </div>
      )}
      {showPercentage && !isUnlimited && (
        <p className={`text-xs ${isAtLimit ? 'text-red-600' : isNearLimit ? 'text-yellow-600' : 'text-gray-500'}`}>
          {Math.round(percentage)}% used
        </p>
      )}
    </div>
  )
}

export function SubscriptionUsageCard() {
  const { status, isLoading } = useSubscription()
  const { user } = useAuth()

  if (isLoading || !status || !user) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 animate-pulse">
        <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/2 mb-4"></div>
        <div className="space-y-3">
          <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded"></div>
          <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded"></div>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-gray-900 dark:text-white">Subscription</h3>
        <SubscriptionBadge showUpgrade={false} size="sm" />
      </div>

      <div className="space-y-4">
        <UsageMeter
          label="Repositories"
          used={status.repositories_used}
          limit={status.repositories_limit}
        />
        <UsageMeter
          label="Scans this week"
          used={status.scans_this_week}
          limit={status.scans_week_limit}
        />
        <UsageMeter
          label="Scans today"
          used={status.scans_today}
          limit={status.scans_day_limit}
        />
      </div>

      {status.tier === 'basic' && (
        <Link
          href="/pricing"
          className="mt-4 block w-full text-center py-2 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
        >
          Upgrade Plan
        </Link>
      )}

      {status.is_trial && status.trial_ends_at && (
        <p className="mt-4 text-sm text-yellow-600 dark:text-yellow-400">
          Trial ends: {new Date(status.trial_ends_at).toLocaleDateString()}
        </p>
      )}
    </div>
  )
}

interface FeatureGateProps {
  feature: string
  children: React.ReactNode
  fallback?: React.ReactNode
}

export function FeatureGate({ feature, children, fallback }: FeatureGateProps) {
  const { checkFeature } = useSubscription()
  const hasAccess = checkFeature(feature)

  if (hasAccess) {
    return <>{children}</>
  }

  if (fallback) {
    return <>{fallback}</>
  }

  return (
    <div className="relative">
      <div className="opacity-50 pointer-events-none blur-sm">
        {children}
      </div>
      <div className="absolute inset-0 flex items-center justify-center bg-gray-900/10 dark:bg-gray-900/50 rounded-lg">
        <div className="text-center p-4">
          <svg className="w-8 h-8 mx-auto text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
          <p className="mt-2 text-sm font-medium text-gray-600 dark:text-gray-300">
            Premium Feature
          </p>
          <Link
            href="/pricing"
            className="mt-2 inline-block text-sm text-blue-600 dark:text-blue-400 hover:underline"
          >
            Upgrade to unlock
          </Link>
        </div>
      </div>
    </div>
  )
}
