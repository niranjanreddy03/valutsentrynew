'use client'

import { createContext, ReactNode, useContext, useEffect, useState, useCallback } from 'react'
import { useAuth } from './AuthContext'

export type SubscriptionTier = 'basic' | 'premium' | 'premium_plus'

export interface TierLimits {
  max_repositories: number
  scans_per_week: number
  max_scans_per_day: number
  history_retention_days: number
  slack_integration: boolean
  jira_integration: boolean
  github_app_integration: boolean
  aws_integration: boolean
  auto_rotation: boolean
  ml_risk_scoring: boolean
  custom_patterns: boolean
  api_access: boolean
  webhook_notifications: boolean
  scheduled_scans: boolean
  team_management: boolean
  priority_support: boolean
  export_reports: boolean
  audit_logs: boolean
  sso_enabled: boolean
  custom_branding: boolean
  deep_scan: boolean
  entropy_analysis: boolean
  pr_scanning: boolean
  realtime_alerts: boolean
}

export interface SubscriptionStatus {
  tier: SubscriptionTier
  tier_display_name: string
  is_trial: boolean
  trial_ends_at: string | null
  subscription_started_at: string | null
  subscription_expires_at: string | null
  repositories_used: number
  repositories_limit: number
  scans_this_week: number
  scans_week_limit: number
  scans_today: number
  scans_day_limit: number
  can_add_repository: boolean
  can_run_scan: boolean
  usage_percentage: number
}

export interface PlanInfo {
  id: string
  name: string
  tier: string
  price: {
    monthly: number
    yearly: number
    currency: string
    label: string
  }
  limits: {
    max_repositories: number | string
    scans_per_week: number | string
    max_scans_per_day: number | string
    history_retention_days: number
  }
  features: TierLimits | Record<string, boolean>
}

interface SubscriptionContextType {
  status: SubscriptionStatus | null
  limits: TierLimits | null
  plans: PlanInfo[]
  isLoading: boolean
  error: string | null
  refreshStatus: () => Promise<void>
  checkFeature: (feature: string) => boolean
  canAddRepository: () => boolean
  canRunScan: () => boolean
  upgradeTier: (tier: SubscriptionTier) => Promise<boolean>
  startTrial: () => Promise<boolean>
}

// Default limits for each tier (client-side fallback)
const TIER_LIMITS: Record<SubscriptionTier, TierLimits> = {
  basic: {
    max_repositories: 1,
    scans_per_week: 1,
    max_scans_per_day: 1,
    history_retention_days: 7,
    slack_integration: false,
    jira_integration: false,
    github_app_integration: false,
    aws_integration: false,
    auto_rotation: false,
    ml_risk_scoring: false,
    custom_patterns: false,
    api_access: false,
    webhook_notifications: false,
    scheduled_scans: false,
    team_management: false,
    priority_support: false,
    export_reports: false,
    audit_logs: false,
    sso_enabled: false,
    custom_branding: false,
    deep_scan: false,
    entropy_analysis: true,
    pr_scanning: false,
    realtime_alerts: false,
  },
  premium: {
    max_repositories: 10,
    scans_per_week: 50,
    max_scans_per_day: 10,
    history_retention_days: 30,
    slack_integration: true,
    jira_integration: false,
    github_app_integration: true,
    aws_integration: false,
    auto_rotation: false,
    ml_risk_scoring: true,
    custom_patterns: true,
    api_access: true,
    webhook_notifications: true,
    scheduled_scans: true,
    team_management: false,
    priority_support: false,
    export_reports: true,
    audit_logs: true,
    sso_enabled: false,
    custom_branding: false,
    deep_scan: true,
    entropy_analysis: true,
    pr_scanning: true,
    realtime_alerts: true,
  },
  premium_plus: {
    max_repositories: 999999,
    scans_per_week: 999999,
    max_scans_per_day: 999999,
    history_retention_days: 365,
    slack_integration: true,
    jira_integration: true,
    github_app_integration: true,
    aws_integration: true,
    auto_rotation: true,
    ml_risk_scoring: true,
    custom_patterns: true,
    api_access: true,
    webhook_notifications: true,
    scheduled_scans: true,
    team_management: true,
    priority_support: true,
    export_reports: true,
    audit_logs: true,
    sso_enabled: true,
    custom_branding: true,
    deep_scan: true,
    entropy_analysis: true,
    pr_scanning: true,
    realtime_alerts: true,
  },
}

const DEFAULT_PLANS: PlanInfo[] = [
  {
    id: 'basic',
    name: 'Basic',
    tier: 'basic',
    price: { monthly: 0, yearly: 0, currency: 'USD', label: 'Free' },
    limits: {
      max_repositories: 1,
      scans_per_week: 1,
      max_scans_per_day: 1,
      history_retention_days: 7,
    },
    features: TIER_LIMITS.basic,
  },
  {
    id: 'premium',
    name: 'Premium',
    tier: 'premium',
    price: { monthly: 29, yearly: 290, currency: 'USD', label: '$29/month' },
    limits: {
      max_repositories: 10,
      scans_per_week: 50,
      max_scans_per_day: 10,
      history_retention_days: 30,
    },
    features: TIER_LIMITS.premium,
  },
  {
    id: 'premium_plus',
    name: 'Premium Plus',
    tier: 'premium_plus',
    price: { monthly: 99, yearly: 990, currency: 'USD', label: '$99/month' },
    limits: {
      max_repositories: 'Unlimited',
      scans_per_week: 'Unlimited',
      max_scans_per_day: 'Unlimited',
      history_retention_days: 365,
    },
    features: TIER_LIMITS.premium_plus,
  },
]

const SubscriptionContext = createContext<SubscriptionContextType | undefined>(undefined)

export function SubscriptionProvider({ children }: { children: ReactNode }) {
  const { user, isAuthenticated } = useAuth()
  const [status, setStatus] = useState<SubscriptionStatus | null>(null)
  const [limits, setLimits] = useState<TierLimits | null>(null)
  const [plans, setPlans] = useState<PlanInfo[]>(DEFAULT_PLANS)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Get current tier from user
  const currentTier = (user?.subscription_tier || 'basic') as SubscriptionTier

  // Refresh subscription status
  const refreshStatus = useCallback(async () => {
    if (!isAuthenticated || !user) {
      setIsLoading(false)
      return
    }

    try {
      // For demo mode or when API is not available, use local data
      const isDemoMode = localStorage.getItem('demo_mode') === 'true'
      
      if (isDemoMode) {
        const tierLimits = TIER_LIMITS[currentTier]
        setLimits(tierLimits)
        setStatus({
          tier: currentTier,
          tier_display_name: currentTier === 'premium_plus' ? 'Premium Plus' : 
                            currentTier.charAt(0).toUpperCase() + currentTier.slice(1),
          is_trial: user.is_trial,
          trial_ends_at: user.trial_ends_at,
          subscription_started_at: user.subscription_started_at,
          subscription_expires_at: user.subscription_expires_at,
          repositories_used: 0,
          repositories_limit: tierLimits.max_repositories < 999999 ? tierLimits.max_repositories : -1,
          scans_this_week: user.scans_this_week,
          scans_week_limit: tierLimits.scans_per_week < 999999 ? tierLimits.scans_per_week : -1,
          scans_today: user.scans_today,
          scans_day_limit: tierLimits.max_scans_per_day < 999999 ? tierLimits.max_scans_per_day : -1,
          can_add_repository: true,
          can_run_scan: true,
          usage_percentage: 0,
        })
        setPlans(DEFAULT_PLANS)
        setIsLoading(false)
        return
      }

      // Fetch from API when available
      const response = await fetch('/api/v1/subscription/status', {
        credentials: 'include',
      })
      
      if (response.ok) {
        const data = await response.json()
        setStatus(data)
        setLimits(TIER_LIMITS[data.tier as SubscriptionTier])
      }

      // Fetch plans
      const plansResponse = await fetch('/api/v1/subscription/plans')
      if (plansResponse.ok) {
        const plansData = await plansResponse.json()
        setPlans(plansData)
      }
    } catch (err) {
      console.error('Error fetching subscription status:', err)
      // Fallback to local data
      const tierLimits = TIER_LIMITS[currentTier]
      setLimits(tierLimits)
    } finally {
      setIsLoading(false)
    }
  }, [isAuthenticated, user, currentTier])

  // Initialize subscription data
  useEffect(() => {
    refreshStatus()
  }, [refreshStatus])

  // Check if user has access to a feature
  const checkFeature = useCallback((feature: string): boolean => {
    if (!limits) {
      const tierLimits = TIER_LIMITS[currentTier]
      return tierLimits[feature as keyof TierLimits] as boolean ?? false
    }
    return limits[feature as keyof TierLimits] as boolean ?? false
  }, [limits, currentTier])

  // Check if user can add a repository
  const canAddRepository = useCallback((): boolean => {
    if (status) return status.can_add_repository
    const tierLimits = TIER_LIMITS[currentTier]
    return tierLimits.max_repositories > 0
  }, [status, currentTier])

  // Check if user can run a scan
  const canRunScan = useCallback((): boolean => {
    if (status) return status.can_run_scan
    const tierLimits = TIER_LIMITS[currentTier]
    return tierLimits.scans_per_week > 0
  }, [status, currentTier])

  // Upgrade subscription tier
  const upgradeTier = useCallback(async (tier: SubscriptionTier): Promise<boolean> => {
    try {
      setError(null)
      const response = await fetch('/api/v1/subscription/upgrade', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ tier }),
      })

      if (!response.ok) {
        const data = await response.json()
        setError(data.detail || 'Failed to upgrade subscription')
        return false
      }

      await refreshStatus()
      return true
    } catch (err) {
      setError('Failed to upgrade subscription')
      return false
    }
  }, [refreshStatus])

  // Start trial
  const startTrial = useCallback(async (): Promise<boolean> => {
    try {
      setError(null)
      const response = await fetch('/api/v1/subscription/start-trial', {
        method: 'POST',
        credentials: 'include',
      })

      if (!response.ok) {
        const data = await response.json()
        setError(data.detail || 'Failed to start trial')
        return false
      }

      await refreshStatus()
      return true
    } catch (err) {
      setError('Failed to start trial')
      return false
    }
  }, [refreshStatus])

  return (
    <SubscriptionContext.Provider
      value={{
        status,
        limits,
        plans,
        isLoading,
        error,
        refreshStatus,
        checkFeature,
        canAddRepository,
        canRunScan,
        upgradeTier,
        startTrial,
      }}
    >
      {children}
    </SubscriptionContext.Provider>
  )
}

export function useSubscription() {
  const context = useContext(SubscriptionContext)
  if (context === undefined) {
    throw new Error('useSubscription must be used within a SubscriptionProvider')
  }
  return context
}
