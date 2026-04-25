'use client'

import { useEffect, useRef } from 'react'

declare global {
  interface Window {
    turnstile?: {
      render: (
        el: HTMLElement,
        opts: {
          sitekey: string
          theme?: 'light' | 'dark' | 'auto'
          callback?: (token: string) => void
          'error-callback'?: () => void
          'expired-callback'?: () => void
          appearance?: 'always' | 'execute' | 'interaction-only'
        }
      ) => string
      reset: (widgetId?: string) => void
      remove: (widgetId?: string) => void
    }
    onloadTurnstileCallback?: () => void
  }
}

const SCRIPT_ID = 'cf-turnstile-script'
const SCRIPT_SRC = 'https://challenges.cloudflare.com/turnstile/v0/api.js'

function loadScript(): Promise<void> {
  if (typeof window === 'undefined') return Promise.resolve()
  if (window.turnstile) return Promise.resolve()
  const existing = document.getElementById(SCRIPT_ID) as HTMLScriptElement | null
  if (existing) {
    return new Promise((resolve) => {
      if (window.turnstile) return resolve()
      existing.addEventListener('load', () => resolve())
    })
  }
  return new Promise((resolve, reject) => {
    const s = document.createElement('script')
    s.id = SCRIPT_ID
    s.src = SCRIPT_SRC
    s.async = true
    s.defer = true
    s.onload = () => resolve()
    s.onerror = () => reject(new Error('Failed to load Turnstile'))
    document.head.appendChild(s)
  })
}

interface TurnstileProps {
  onVerify: (token: string) => void
  onExpire?: () => void
  onError?: () => void
  theme?: 'light' | 'dark' | 'auto'
  className?: string
  resetKey?: number | string
}

export function Turnstile({
  onVerify,
  onExpire,
  onError,
  theme = 'dark',
  className,
  resetKey,
}: TurnstileProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const widgetIdRef = useRef<string | null>(null)
  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY

  useEffect(() => {
    if (!siteKey) return
    let cancelled = false
    loadScript()
      .then(() => {
        if (cancelled || !containerRef.current || !window.turnstile) return
        widgetIdRef.current = window.turnstile.render(containerRef.current, {
          sitekey: siteKey,
          theme,
          callback: (token: string) => onVerify(token),
          'expired-callback': () => {
            onExpire?.()
          },
          'error-callback': () => {
            onError?.()
          },
        })
      })
      .catch(() => onError?.())

    return () => {
      cancelled = true
      if (widgetIdRef.current && window.turnstile) {
        try {
          window.turnstile.remove(widgetIdRef.current)
        } catch {
          /* noop */
        }
        widgetIdRef.current = null
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [siteKey, theme])

  useEffect(() => {
    if (resetKey === undefined) return
    if (widgetIdRef.current && window.turnstile) {
      try {
        window.turnstile.reset(widgetIdRef.current)
      } catch {
        /* noop */
      }
    }
  }, [resetKey])

  if (!siteKey) {
    return (
      <div
        className={className}
        style={{
          border: '1px dashed rgba(239, 68, 68, 0.4)',
          background: 'rgba(239, 68, 68, 0.05)',
          color: '#fca5a5',
          borderRadius: 12,
          padding: '10px 12px',
          fontSize: 12,
        }}
      >
        Turnstile site key missing. Set <code>NEXT_PUBLIC_TURNSTILE_SITE_KEY</code>.
      </div>
    )
  }

  return <div ref={containerRef} className={className} />
}
