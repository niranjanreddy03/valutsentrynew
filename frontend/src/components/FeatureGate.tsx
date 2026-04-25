'use client'

/**
 * FeatureGate — gate UI on subscription tier.
 *
 * Usage:
 *   <FeatureGate feature="team_management" title="Team management">
 *     <TeamsContent />
 *   </FeatureGate>
 *
 * New users signing up default to the `basic` tier and see an UpgradePrompt in
 * place of gated features. Demo users (premium_plus) see everything.
 *
 * For inline gating inside a page (e.g. a single premium button), use
 * `<InlineLock feature="..." />` or the `useFeature(feature)` hook.
 */

import Link from 'next/link'
import { ReactNode } from 'react'
import { Lock, Sparkles, ArrowRight, Check } from 'lucide-react'
import { useSubscription } from '@/contexts/SubscriptionContext'

export interface FeatureGateProps {
  feature: string
  title?: string
  description?: string
  /** Features to highlight inside the upgrade card (bullet list). */
  perks?: string[]
  /** What tier unlocks this? Used for the "Upgrade to …" CTA label. */
  requiredTier?: 'premium' | 'premium_plus'
  /** Hide the entire gate (renders nothing). Useful for conditional sections. */
  hideWhenLocked?: boolean
  children: ReactNode
}

export function FeatureGate({
  feature,
  title,
  description,
  perks,
  requiredTier = 'premium',
  hideWhenLocked = false,
  children,
}: FeatureGateProps) {
  const { checkFeature, isLoading } = useSubscription()

  // While the subscription status is loading we render nothing to avoid
  // flashing the upgrade prompt for a premium user.
  if (isLoading) return null

  if (checkFeature(feature)) {
    return <>{children}</>
  }

  if (hideWhenLocked) return null

  return (
    <UpgradePrompt
      title={title || 'Upgrade to unlock this feature'}
      description={
        description ||
        'This feature is part of our paid plans. Upgrade to access advanced scanning, integrations, and automation.'
      }
      perks={perks}
      requiredTier={requiredTier}
    />
  )
}

/** Hook for imperative checks (e.g. disabling a button). */
export function useFeature(feature: string): boolean {
  const { checkFeature } = useSubscription()
  return checkFeature(feature)
}

/** A small lock badge you can put next to a feature label. */
export function InlineLock({
  feature,
  label = 'Premium',
}: {
  feature: string
  label?: string
}) {
  const unlocked = useFeature(feature)
  if (unlocked) return null
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide"
      style={{
        background: 'rgba(168,85,247,0.15)',
        color: '#a78bfa',
        border: '1px solid rgba(168,85,247,0.35)',
      }}
      title={`${label} feature — upgrade to unlock`}
    >
      <Lock className="h-2.5 w-2.5" />
      {label}
    </span>
  )
}

/* --------------------------------- Prompt --------------------------------- */

export interface UpgradePromptProps {
  title: string
  description: string
  perks?: string[]
  requiredTier?: 'premium' | 'premium_plus'
  compact?: boolean
}

export function UpgradePrompt({
  title,
  description,
  perks,
  requiredTier = 'premium',
  compact = false,
}: UpgradePromptProps) {
  const tierLabel = requiredTier === 'premium_plus' ? 'Premium Plus' : 'Premium'

  return (
    <div
      className={`mx-auto w-full rounded-2xl p-8 ${
        compact ? 'max-w-xl' : 'max-w-2xl'
      }`}
      style={{
        background:
          'linear-gradient(135deg, rgba(99,102,241,0.12), rgba(139,92,246,0.08))',
        border: '1px solid var(--accent)',
      }}
    >
      <div className="flex items-start gap-4">
        <div
          className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl"
          style={{ background: 'rgba(139,92,246,0.18)' }}
        >
          <Sparkles className="h-6 w-6" style={{ color: 'var(--accent)' }} />
        </div>
        <div className="flex-1">
          <div className="mb-2 flex items-center gap-2">
            <Lock className="h-4 w-4" style={{ color: 'var(--accent)' }} />
            <span
              className="text-xs font-semibold uppercase tracking-wider"
              style={{ color: 'var(--accent)' }}
            >
              {tierLabel} feature
            </span>
          </div>
          <h2
            className="mb-2 text-xl font-bold"
            style={{ color: 'var(--text-primary)' }}
          >
            {title}
          </h2>
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
            {description}
          </p>

          {perks && perks.length > 0 && (
            <ul className="mt-4 space-y-2">
              {perks.map((perk) => (
                <li
                  key={perk}
                  className="flex items-start gap-2 text-sm"
                  style={{ color: 'var(--text-secondary)' }}
                >
                  <Check
                    className="mt-0.5 h-4 w-4 flex-shrink-0"
                    style={{ color: 'var(--accent)' }}
                  />
                  {perk}
                </li>
              ))}
            </ul>
          )}

          <div className="mt-6 flex flex-wrap items-center gap-3">
            <Link
              href="/pricing"
              className="inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90"
              style={{ background: 'var(--accent)' }}
            >
              Upgrade to {tierLabel}
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              href="/pricing"
              className="text-sm font-medium hover:underline"
              style={{ color: 'var(--text-muted)' }}
            >
              Compare plans →
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}

export default FeatureGate
