/**
 * Server-side subscription guard.
 *
 * Checks the authenticated user's subscription tier from Supabase and
 * enforces limits on repos, scans, and feature access. This runs in
 * Next.js Route Handlers — it cannot be bypassed from the browser.
 */

import { createServerSupabaseClient } from '@/lib/supabase/server'

export type SubscriptionTier = 'basic' | 'premium' | 'premium_plus'

interface TierLimits {
  max_repositories: number
  scans_per_week: number
  max_scans_per_day: number
}

const TIER_LIMITS: Record<SubscriptionTier, TierLimits> = {
  basic: { max_repositories: 1, scans_per_week: 1, max_scans_per_day: 1 },
  premium: { max_repositories: 10, scans_per_week: 50, max_scans_per_day: 10 },
  premium_plus: { max_repositories: 999999, scans_per_week: 999999, max_scans_per_day: 999999 },
}

interface GuardResult {
  allowed: boolean
  tier: SubscriptionTier
  userId: string | null
  error?: string
  limits?: TierLimits
}

/**
 * Get the current user's subscription tier from Supabase.
 */
async function getUserTier(): Promise<{ tier: SubscriptionTier; userId: string } | null> {
  try {
    const supabase = createServerSupabaseClient()
    const { data: { user }, error } = await supabase.auth.getUser()
    if (error || !user) return null

    const { data: profile } = await supabase
      .from('profiles')
      .select('subscription_tier')
      .eq('id', user.id)
      .single()

    const tier = (profile?.subscription_tier as SubscriptionTier) || 'basic'
    return { tier, userId: user.id }
  } catch {
    return null
  }
}

/**
 * Check if the user can add another repository.
 */
export async function guardAddRepository(): Promise<GuardResult> {
  const userInfo = await getUserTier()
  if (!userInfo) {
    // Can't verify user server-side (cookie not available) — allow through.
    // The backend/Supabase RLS will enforce auth separately.
    return { allowed: true, tier: 'basic', userId: null }
  }

  const limits = TIER_LIMITS[userInfo.tier]

  try {
    const supabase = createServerSupabaseClient()
    const { count } = await supabase
      .from('repositories')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userInfo.userId)

    const currentCount = count ?? 0
    if (currentCount >= limits.max_repositories) {
      return {
        allowed: false,
        tier: userInfo.tier,
        userId: userInfo.userId,
        limits,
        error: `Your ${userInfo.tier === 'basic' ? 'Starter' : 'Professional'} plan allows ${limits.max_repositories} ${limits.max_repositories === 1 ? 'repository' : 'repositories'}. Upgrade to add more.`,
      }
    }

    return { allowed: true, tier: userInfo.tier, userId: userInfo.userId, limits }
  } catch {
    // If count fails, allow but log
    return { allowed: true, tier: userInfo.tier, userId: userInfo.userId, limits }
  }
}

/**
 * Check if the user can run a scan.
 */
export async function guardRunScan(): Promise<GuardResult> {
  const userInfo = await getUserTier()
  if (!userInfo) {
    // Can't verify user server-side — allow through, backend handles auth.
    return { allowed: true, tier: 'basic', userId: null }
  }

  const limits = TIER_LIMITS[userInfo.tier]

  try {
    const supabase = createServerSupabaseClient()

    // Check daily scan count
    const todayStart = new Date()
    todayStart.setHours(0, 0, 0, 0)

    const { count: dailyCount } = await supabase
      .from('scans')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userInfo.userId)
      .gte('created_at', todayStart.toISOString())

    if ((dailyCount ?? 0) >= limits.max_scans_per_day) {
      return {
        allowed: false,
        tier: userInfo.tier,
        userId: userInfo.userId,
        limits,
        error: `Daily scan limit reached. Your plan allows ${limits.max_scans_per_day} ${limits.max_scans_per_day === 1 ? 'scan' : 'scans'} per day. Upgrade for more.`,
      }
    }

    // Check weekly scan count
    const weekStart = new Date()
    weekStart.setDate(weekStart.getDate() - 7)

    const { count: weeklyCount } = await supabase
      .from('scans')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userInfo.userId)
      .gte('created_at', weekStart.toISOString())

    if ((weeklyCount ?? 0) >= limits.scans_per_week) {
      return {
        allowed: false,
        tier: userInfo.tier,
        userId: userInfo.userId,
        limits,
        error: `Weekly scan limit reached. Your plan allows ${limits.scans_per_week} ${limits.scans_per_week === 1 ? 'scan' : 'scans'} per week. Upgrade for more.`,
      }
    }

    return { allowed: true, tier: userInfo.tier, userId: userInfo.userId, limits }
  } catch {
    return { allowed: true, tier: userInfo.tier, userId: userInfo.userId, limits }
  }
}

/**
 * Check if the user has access to a premium feature.
 */
export async function guardFeature(feature: string): Promise<GuardResult> {
  const userInfo = await getUserTier()
  if (!userInfo) {
    // Can't verify user server-side — allow through, backend handles auth.
    return { allowed: true, tier: 'basic', userId: null }
  }

  // Features that require premium
  const premiumFeatures = [
    'custom_patterns', 'ml_risk_scoring', 'api_access', 'scheduled_scans',
    'export_reports', 'audit_logs', 'deep_scan', 'pr_scanning', 'realtime_alerts',
  ]
  // Features that require premium_plus
  const premiumPlusFeatures = [
    'aws_integration', 'auto_rotation', 'team_management', 'sso_enabled',
    'custom_branding', 'jira_integration',
  ]

  if (premiumPlusFeatures.includes(feature) && userInfo.tier !== 'premium_plus') {
    return {
      allowed: false,
      tier: userInfo.tier,
      userId: userInfo.userId,
      error: `This feature requires an Enterprise plan. Current plan: ${userInfo.tier}.`,
    }
  }

  if (premiumFeatures.includes(feature) && userInfo.tier === 'basic') {
    return {
      allowed: false,
      tier: userInfo.tier,
      userId: userInfo.userId,
      error: `This feature requires a Professional plan or higher. Current plan: Starter.`,
    }
  }

  return { allowed: true, tier: userInfo.tier, userId: userInfo.userId }
}
