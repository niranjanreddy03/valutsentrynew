'use client'

import { ClipboardEvent, KeyboardEvent, useEffect, useRef, useState } from 'react'

interface OtpInputProps {
  length?: number
  value?: string
  onChange?: (value: string) => void
  onComplete?: (value: string) => void
  error?: boolean
  disabled?: boolean
  autoFocus?: boolean
}

export function OtpInput({
  length = 6,
  value = '',
  onChange,
  onComplete,
  error,
  disabled,
  autoFocus = true,
}: OtpInputProps) {
  const [digits, setDigits] = useState<string[]>(() =>
    Array.from({ length }, (_, i) => value[i] || ''),
  )
  const refs = useRef<Array<HTMLInputElement | null>>([])

  useEffect(() => {
    if (autoFocus) refs.current[0]?.focus()
  }, [autoFocus])

  useEffect(() => {
    const next = Array.from({ length }, (_, i) => value[i] || '')
    setDigits((prev) => (prev.join('') === next.join('') ? prev : next))
  }, [value, length])

  const emit = (next: string[]) => {
    const joined = next.join('')
    onChange?.(joined)
    if (joined.length === length && next.every(Boolean)) onComplete?.(joined)
  }

  const handleChange = (i: number, raw: string) => {
    const char = raw.replace(/\D/g, '').slice(-1)
    const next = [...digits]
    next[i] = char
    setDigits(next)
    emit(next)
    if (char && i < length - 1) refs.current[i + 1]?.focus()
  }

  const handleKeyDown = (i: number, e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !digits[i] && i > 0) {
      const next = [...digits]
      next[i - 1] = ''
      setDigits(next)
      emit(next)
      refs.current[i - 1]?.focus()
    } else if (e.key === 'ArrowLeft' && i > 0) {
      refs.current[i - 1]?.focus()
    } else if (e.key === 'ArrowRight' && i < length - 1) {
      refs.current[i + 1]?.focus()
    }
  }

  const handlePaste = (e: ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault()
    const text = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, length)
    if (!text) return
    const next = Array.from({ length }, (_, i) => text[i] || '')
    setDigits(next)
    emit(next)
    refs.current[Math.min(text.length, length - 1)]?.focus()
  }

  return (
    <div className="flex items-center justify-between gap-2 sm:gap-3">
      {digits.map((d, i) => (
        <input
          key={i}
          ref={(el) => {
            refs.current[i] = el
          }}
          type="text"
          inputMode="numeric"
          maxLength={1}
          value={d}
          disabled={disabled}
          onChange={(e) => handleChange(i, e.target.value)}
          onKeyDown={(e) => handleKeyDown(i, e)}
          onPaste={handlePaste}
          className={[
            'h-14 w-12 rounded-xl text-center text-xl font-semibold caret-blue-400',
            'transition-all duration-150 focus:outline-none',
            error
              ? '[border:1px_solid_rgba(239,68,68,0.7)] shadow-[0_0_0_4px_rgba(239,68,68,0.12)]'
              : '[border:1px_solid_rgba(82,82,82,0.5)] hover:[border-color:rgba(115,115,115,0.7)] focus:[border-color:#3b82f6] focus:shadow-[0_0_0_4px_rgba(59,130,246,0.25)]',
            disabled ? 'opacity-60' : '',
          ].join(' ')}
          style={{ background: '#1f1f1f', color: '#fafafa' }}
          aria-label={`Digit ${i + 1}`}
        />
      ))}
    </div>
  )
}

export default OtpInput
