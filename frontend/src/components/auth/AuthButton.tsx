'use client'

import { ButtonHTMLAttributes, ReactNode } from 'react'
import { Loader2 } from 'lucide-react'

interface AuthButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  loading?: boolean
  variant?: 'primary' | 'secondary' | 'ghost'
  fullWidth?: boolean
  leadingIcon?: ReactNode
}

const base =
  'group relative inline-flex items-center justify-center gap-2 rounded-xl text-[14px] font-medium transition-all duration-200 ease-out select-none' +
  ' focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400/60 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0a0a0a]' +
  ' disabled:cursor-not-allowed disabled:opacity-60 active:scale-[0.985]'

const variants: Record<NonNullable<AuthButtonProps['variant']>, string> = {
  primary:
    'text-white shadow-[0_8px_28px_-8px_rgba(59,130,246,0.55),0_2px_0_rgba(255,255,255,0.08)_inset]' +
    ' bg-[#3b82f6] hover:bg-[#60a5fa]' +
    ' hover:shadow-[0_10px_32px_-6px_rgba(59,130,246,0.65),0_2px_0_rgba(255,255,255,0.12)_inset]',
  secondary:
    'border text-[#fafafa] transition-colors' +
    ' [background:#262626] [border-color:rgba(82,82,82,0.5)]' +
    ' hover:[background:#2f2f2f] hover:[border-color:rgba(115,115,115,0.6)]',
  ghost:
    'text-[#a3a3a3] hover:text-[#fafafa] hover:[background:rgba(255,255,255,0.04)]',
}

export function AuthButton({
  loading,
  variant = 'primary',
  fullWidth = true,
  leadingIcon,
  children,
  className = '',
  disabled,
  ...rest
}: AuthButtonProps) {
  return (
    <button
      {...rest}
      disabled={disabled || loading}
      className={[
        base,
        variants[variant],
        fullWidth ? 'w-full' : '',
        'h-11 px-5',
        className,
      ].join(' ')}
    >
      {variant === 'primary' && (
        <span aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden rounded-xl">
          <span className="absolute inset-x-0 top-0 h-1/2 bg-gradient-to-b from-white/15 to-transparent" />
        </span>
      )}
      <span className="relative inline-flex items-center gap-2">
        {loading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          leadingIcon && <span className="flex h-4 w-4 items-center justify-center">{leadingIcon}</span>
        )}
        <span>{children}</span>
      </span>
    </button>
  )
}

export default AuthButton
