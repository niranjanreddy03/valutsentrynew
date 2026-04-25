'use client'

import { InputHTMLAttributes, ReactNode, forwardRef, useId, useState } from 'react'
import { Eye, EyeOff } from 'lucide-react'

interface AuthInputProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string
  icon?: ReactNode
  error?: string
  hint?: ReactNode
  trailing?: ReactNode
  togglePassword?: boolean
}

/**
 * AuthInput — floating-label field using dashboard tokens.
 *   field bg:      #1f1f1f (--input-bg)
 *   border:        rgba(82, 82, 82, 0.5) (--border-color)
 *   focus accent:  #3b82f6 with rgba(59,130,246,0.25) glow
 *   text primary:  #fafafa
 *   text muted:    #a3a3a3
 */
export const AuthInput = forwardRef<HTMLInputElement, AuthInputProps>(function AuthInput(
  { label, icon, error, hint, trailing, togglePassword, type = 'text', id, className = '', value, onFocus, onBlur, ...rest },
  ref,
) {
  const [reveal, setReveal] = useState(false)
  const [focused, setFocused] = useState(false)
  const reactId = useId()
  const inputId = id || rest.name || reactId
  const isPassword = type === 'password'
  const effectiveType = togglePassword && isPassword ? (reveal ? 'text' : 'password') : type
  const hasValue = value !== undefined && value !== null && String(value).length > 0
  const floatActive = focused || hasValue

  const wrapStyle: React.CSSProperties = error
    ? {
        background: '#1f1f1f',
        border: '1px solid rgba(239, 68, 68, 0.7)',
        boxShadow: '0 0 0 4px rgba(239, 68, 68, 0.12)',
      }
    : focused
    ? {
        background: '#1f1f1f',
        border: '1px solid #3b82f6',
        boxShadow: '0 0 0 4px rgba(59, 130, 246, 0.25)',
      }
    : {
        background: '#1f1f1f',
        border: '1px solid rgba(82, 82, 82, 0.5)',
      }

  return (
    <div className="space-y-1.5">
      {trailing && (
        <div className="flex items-center justify-end">
          <div>{trailing}</div>
        </div>
      )}

      <div
        className="group relative flex items-center rounded-xl transition-all duration-200 ease-out"
        style={wrapStyle}
      >
        {icon && (
          <span
            className="pointer-events-none absolute left-3.5 flex h-4 w-4 items-center justify-center transition-colors"
            style={{ color: focused ? '#60a5fa' : '#a3a3a3' }}
          >
            {icon}
          </span>
        )}

        {/* Floating label */}
        <label
          htmlFor={inputId}
          className={[
            'pointer-events-none absolute select-none transition-all duration-200 ease-out',
            icon ? 'left-10' : 'left-3.5',
            floatActive
              ? 'top-1.5 text-[10.5px] font-medium uppercase tracking-[0.08em]'
              : 'top-1/2 -translate-y-1/2 text-sm',
          ].join(' ')}
          style={{ color: '#a3a3a3' }}
        >
          {label}
        </label>

        <input
          ref={ref}
          id={inputId}
          type={effectiveType}
          value={value}
          onFocus={(e) => {
            setFocused(true)
            onFocus?.(e)
          }}
          onBlur={(e) => {
            setFocused(false)
            onBlur?.(e)
          }}
          className={[
            'peer w-full bg-transparent text-[14.5px] caret-blue-400 placeholder-transparent focus:outline-none',
            'pt-5 pb-1.5',
            icon ? 'pl-10' : 'pl-3.5',
            togglePassword && isPassword ? 'pr-11' : 'pr-3.5',
            className,
          ].join(' ')}
          style={{ color: '#fafafa' }}
          {...rest}
        />

        {togglePassword && isPassword && (
          <button
            type="button"
            onClick={() => setReveal((v) => !v)}
            tabIndex={-1}
            className="absolute right-3 flex h-7 w-7 items-center justify-center rounded-md transition-colors"
            style={{ color: '#a3a3a3' }}
            aria-label={reveal ? 'Hide password' : 'Show password'}
          >
            {reveal ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        )}
      </div>

      {error ? (
        <p className="flex items-center gap-1 text-xs" style={{ color: '#f87171' }}>{error}</p>
      ) : hint ? (
        <p className="text-xs" style={{ color: '#a3a3a3' }}>{hint}</p>
      ) : null}
    </div>
  )
})

export default AuthInput
