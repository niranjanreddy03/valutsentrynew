'use client'

import { forwardRef, SelectHTMLAttributes } from 'react'
import { ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'

interface Option {
  value: string
  label: string
}

interface SelectProps extends Omit<SelectHTMLAttributes<HTMLSelectElement>, 'onChange'> {
  label?: string
  error?: string
  options: Option[]
  placeholder?: string
  onChange?: (value: string) => void
}

const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, label, error, options, placeholder, onChange, id, ...props }, ref) => {
    const selectId = id || label?.toLowerCase().replace(/\s/g, '-')

    return (
      <div className="w-full">
        {label && (
          <label htmlFor={selectId} className="block text-sm text-[var(--text-muted)] mb-1.5">
            {label}
          </label>
        )}
        <div className="relative">
          <select
            id={selectId}
            ref={ref}
            onChange={(e) => onChange?.(e.target.value)}
            className={cn(
              'w-full px-3 py-2 bg-[var(--bg-tertiary)] border rounded text-sm text-[var(--text-primary)]',
              'focus:outline-none focus:border-zinc-600',
              'transition-colors appearance-none cursor-pointer',
              'disabled:opacity-50 disabled:cursor-not-allowed',
              error ? 'border-[#f87171]' : 'border-[var(--border-color)]',
              className
            )}
            {...props}
          >
            {placeholder && (
              <option value="" disabled>
                {placeholder}
              </option>
            )}
            {options.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
          <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)] pointer-events-none" />
        </div>
        {error && (
          <p className="mt-1 text-sm text-[#f87171]">{error}</p>
        )}
      </div>
    )
  }
)

Select.displayName = 'Select'

export default Select
