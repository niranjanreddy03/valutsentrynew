'use client'

import { Loader2 } from 'lucide-react'

interface OAuthButtonsProps {
  onProvider: (provider: 'github' | 'google') => void | Promise<void>
  loading?: 'github' | 'google' | null
  disabled?: boolean
  verb?: string
}

const GithubIcon = () => (
  <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" fill="currentColor" aria-hidden>
    <path d="M12 .5C5.73.5.77 5.46.77 11.73c0 4.94 3.2 9.12 7.64 10.6.56.1.77-.24.77-.54 0-.27-.01-.98-.02-1.92-3.11.67-3.77-1.5-3.77-1.5-.51-1.29-1.25-1.64-1.25-1.64-1.02-.7.08-.69.08-.69 1.13.08 1.72 1.16 1.72 1.16 1 1.72 2.64 1.22 3.29.93.1-.73.39-1.22.71-1.5-2.48-.28-5.09-1.24-5.09-5.52 0-1.22.44-2.22 1.16-3-.12-.28-.5-1.42.11-2.96 0 0 .94-.3 3.09 1.15.9-.25 1.86-.38 2.82-.38.96 0 1.92.13 2.82.38 2.15-1.45 3.09-1.15 3.09-1.15.61 1.54.23 2.68.11 2.96.72.78 1.15 1.78 1.15 3 0 4.29-2.61 5.23-5.1 5.51.4.34.76 1.02.76 2.06 0 1.49-.01 2.68-.01 3.05 0 .3.2.65.78.54 4.44-1.48 7.64-5.66 7.64-10.6C23.23 5.46 18.27.5 12 .5Z" />
  </svg>
)

const GoogleIcon = () => (
  <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" aria-hidden>
    <path fill="#EA4335" d="M12 10.2v3.8h5.4c-.24 1.4-1.67 4.1-5.4 4.1-3.25 0-5.9-2.7-5.9-6s2.65-6 5.9-6c1.85 0 3.1.8 3.8 1.45l2.6-2.5C16.75 3.5 14.6 2.5 12 2.5 6.95 2.5 2.85 6.6 2.85 12S6.95 21.5 12 21.5c6.9 0 9.15-4.85 9.15-7.35 0-.5-.05-.95-.13-1.3H12Z" />
  </svg>
)

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
        icon={<GithubIcon />}
        onClick={() => onProvider('github')}
        loading={loading === 'github'}
        disabled={disabled || loading === 'google'}
      />
      <OAuthButton
        provider="google"
        label="Google"
        icon={<GoogleIcon />}
        onClick={() => onProvider('google')}
        loading={loading === 'google'}
        disabled={disabled || loading === 'github'}
      />
    </div>
  )
}

export default OAuthButtons
