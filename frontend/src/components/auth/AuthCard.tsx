'use client'

import { ReactNode } from 'react'

interface AuthCardProps {
  title: string
  subtitle?: ReactNode
  children: ReactNode
  footer?: ReactNode
  shake?: boolean
}

/**
 * AuthCard — dashboard-matched surface card.
 *   background: #171717 (--bg-secondary)
 *   border:     rgba(82, 82, 82, 0.5) (--border-color)
 *   footer bg:  #262626 (--bg-tertiary)
 */
export function AuthCard({ title, subtitle, children, footer, shake }: AuthCardProps) {
  return (
    <div
      className={[
        'relative w-full overflow-hidden rounded-2xl',
        'animate-scale-in',
        shake ? 'animate-shake' : '',
      ].join(' ')}
      style={{
        background: '#171717',
        border: '1px solid rgba(82, 82, 82, 0.5)',
        boxShadow:
          '0 1px 0 rgba(255,255,255,0.03) inset,' +
          '0 24px 60px -20px rgba(0, 0, 0, 0.65),' +
          '0 8px 24px -8px rgba(0, 0, 0, 0.5)',
      }}
    >
      {/* Subtle accent sheen */}
      <div
        aria-hidden
        className="pointer-events-none absolute -top-40 left-1/2 h-80 w-[140%] -translate-x-1/2 opacity-50"
        style={{
          background:
            'radial-gradient(closest-side, rgba(59,130,246,0.10), transparent 70%)',
        }}
      />

      <div className="relative p-8 sm:p-9">
        <div className="mb-7 space-y-2">
          <h1
            className="text-[28px] font-semibold leading-tight tracking-tight sm:text-[30px]"
            style={{ color: '#fafafa' }}
          >
            {title}
          </h1>
          {subtitle && (
            <p className="text-[13.5px] leading-relaxed" style={{ color: '#a3a3a3' }}>
              {subtitle}
            </p>
          )}
        </div>
        {children}
      </div>

      {footer && (
        <div
          className="relative px-8 py-4 text-center text-xs sm:px-9"
          style={{
            background: '#262626',
            borderTop: '1px solid rgba(82, 82, 82, 0.5)',
            color: '#a3a3a3',
          }}
        >
          {footer}
        </div>
      )}
    </div>
  )
}

export default AuthCard
