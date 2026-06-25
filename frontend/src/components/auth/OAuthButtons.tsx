'use client'

import { Loader2 } from 'lucide-react'
import { ProviderLogo } from './ProviderLogo'

interface OAuthButtonsProps {
  onProvider: (provider: 'github' | 'google') => void | Promise<void>
  loading?: 'github' | 'google' | null
  disabled?: boolean
  verb?: string
}

function OAuthButton({
  provider,
  label,
  icon,
  onClick,
  loading,
  disabled,
}: {
  provider: string
  label: string
  icon: React.ReactNode
  onClick: () => void
  loading?: boolean
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || loading}
      className={[
        'group relative flex h-11 w-full items-center justify-center gap-2.5 rounded-xl',
        'text-[13.5px] font-medium',
        'transition-all duration-200 ease-out',
        'hover:-translate-y-[1px] hover:[background:#2f2f2f] hover:[border-color:rgba(115,115,115,0.7)]',
        'active:translate-y-0 active:scale-[0.985]',
        'disabled:cursor-not-allowed disabled:opacity-60',
        'focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400/50 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0a0a0a]',
      ].join(' ')}
      style={{
        background: '#262626',
        border: '1px solid rgba(82, 82, 82, 0.5)',
        color: '#fafafa',
      }}
      aria-label={`${label} with ${provider}`}
    >
      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : icon}
      <span>{label}</span>
    </button>
  )
}

export function OAuthButtons({
  onProvider,
  loading,
  disabled,
  verb = 'Continue with',
}: OAuthButtonsProps) {
  return (
    <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
      <OAuthButton
        provider="github"
        label="GitHub"
        icon={<ProviderLogo provider="github" />}
        onClick={() => onProvider('github')}
        loading={loading === 'github'}
        disabled={disabled || loading === 'google'}
      />
      <OAuthButton
        provider="google"
        label="Google"
        icon={<ProviderLogo provider="google" />}
        onClick={() => onProvider('google')}
        loading={loading === 'google'}
        disabled={disabled || loading === 'github'}
      />
    </div>
  )
}

export default OAuthButtons
