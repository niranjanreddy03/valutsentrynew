'use client'

import Link from 'next/link'
import { Shield } from 'lucide-react'
import { ReactNode } from 'react'

interface AuthLayoutProps {
  children: ReactNode
  /** Optional left-side marketing panel (hidden on < lg) */
  aside?: ReactNode
}

/**
 * Dashboard tokens (dark mode, from globals.css):
 *   --bg-primary:   #0a0a0a
 *   --bg-secondary: #171717
 *   --bg-tertiary:  #262626
 *   --text-primary: #fafafa
 *   --text-muted:   #a3a3a3
 *   --border-color: rgba(82, 82, 82, 0.5)
 *   --accent:       #3b82f6  (hover #60a5fa)
 *   --accent-glow:  rgba(59, 130, 246, 0.25)
 */
export function AuthLayout({ children, aside }: AuthLayoutProps) {
  return (
    <div
      className="relative min-h-screen w-full overflow-hidden font-sans antialiased"
      style={{ background: '#0a0a0a', color: '#fafafa' }}
    >
      {/* Soft accent glow (dashboard blue) */}
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-0 h-[520px] w-[900px] -translate-x-1/2 rounded-full blur-[120px]"
        style={{
          background:
            'radial-gradient(closest-side, rgba(59, 130, 246, 0.18), rgba(59, 130, 246, 0.06) 50%, transparent 75%)',
        }}
      />

      {/* Header */}
      <header
        className="relative z-10 mx-auto flex max-w-[1220px] items-center justify-between px-6 py-5 sm:px-10"
        style={{ borderBottom: '1px solid rgba(82, 82, 82, 0.3)' }}
      >
        <Link href="/" className="inline-flex items-center gap-3">
          <div
            className="flex h-9 w-9 items-center justify-center rounded-md"
            style={{ background: '#262626', border: '1px solid rgba(82, 82, 82, 0.5)' }}
          >
            <Shield className="h-4 w-4" style={{ color: '#fafafa' }} />
          </div>
          <span className="text-[15px] font-semibold tracking-tight" style={{ color: '#fafafa' }}>
            VaultSentry
          </span>
        </Link>
        <Link
          href="/"
          className="text-sm transition-colors hover:opacity-100"
          style={{ color: '#a3a3a3' }}
        >
          ← Back to site
        </Link>
      </header>

      {/* Main */}
      <main
        className={[
          'relative z-10 mx-auto flex min-h-[calc(100vh-80px)] w-full max-w-[1220px] items-center px-6 pb-16 pt-6',
          aside ? 'lg:grid lg:grid-cols-[1.1fr_minmax(0,460px)] lg:gap-14' : 'justify-center',
        ].join(' ')}
      >
        {aside && <aside className="hidden lg:block">{aside}</aside>}
        <div className="w-full max-w-[460px] lg:mx-0 lg:w-auto">
          <div className="mx-auto w-full max-w-[460px]">{children}</div>
        </div>
      </main>
    </div>
  )
}

export default AuthLayout
