'use client'

import { Check, X } from 'lucide-react'

export interface PasswordRule {
  key: string
  label: string
  test: (pw: string) => boolean
}

export const defaultRules: PasswordRule[] = [
  { key: 'len', label: 'At least 8 characters', test: (p) => p.length >= 8 },
  { key: 'upper', label: 'One uppercase letter', test: (p) => /[A-Z]/.test(p) },
  { key: 'num', label: 'One number', test: (p) => /\d/.test(p) },
  { key: 'special', label: 'One special character', test: (p) => /[^A-Za-z0-9]/.test(p) },
]

export function scoreOf(password: string, rules: PasswordRule[] = defaultRules) {
  return rules.reduce((n, r) => n + (r.test(password) ? 1 : 0), 0)
}

interface PasswordStrengthProps {
  password: string
  rules?: PasswordRule[]
  showWhenEmpty?: boolean
}

export function PasswordStrength({
  password,
  rules = defaultRules,
  showWhenEmpty = false,
}: PasswordStrengthProps) {
  if (!password && !showWhenEmpty) return null

  const score = scoreOf(password, rules)
  const pct = Math.round((score / rules.length) * 100)
  const tones: [string, string] = [
    score <= 1
      ? 'from-red-500 to-red-400'
      : score === 2
      ? 'from-orange-500 to-amber-400'
      : score === 3
      ? 'from-amber-400 to-yellow-300'
      : 'from-emerald-500 to-green-400',
    score <= 1 ? 'Weak' : score === 2 ? 'Fair' : score === 3 ? 'Good' : 'Strong',
  ]

  return (
    <div className="animate-fade-in space-y-2">
      <div className="flex items-center gap-3">
        <div
          className="h-1.5 flex-1 overflow-hidden rounded-full"
          style={{ background: '#262626' }}
        >
          <div
            className={`h-full rounded-full bg-gradient-to-r ${tones[0]} transition-all duration-300`}
            style={{ width: `${pct}%` }}
          />
        </div>
        <span className="w-12 text-right text-[11px] font-medium" style={{ color: '#a3a3a3' }}>
          {tones[1]}
        </span>
      </div>
      <ul className="grid grid-cols-2 gap-x-3 gap-y-1.5">
        {rules.map((r) => {
          const ok = r.test(password)
          return (
            <li
              key={r.key}
              className="flex items-center gap-1.5 text-[11.5px] transition-colors"
              style={{ color: ok ? '#34d399' : '#a3a3a3' }}
            >
              {ok ? (
                <Check className="h-3 w-3" strokeWidth={2.8} />
              ) : (
                <X className="h-3 w-3 opacity-60" strokeWidth={2.8} />
              )}
              <span>{r.label}</span>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

export default PasswordStrength
