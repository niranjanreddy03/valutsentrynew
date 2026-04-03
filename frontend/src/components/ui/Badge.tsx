import { cn } from '@/lib/utils'

interface BadgeProps {
  variant?: 'critical' | 'high' | 'medium' | 'low' | 'info' | 'success' | 'warning' | 'default'
  size?: 'sm' | 'md'
  children: React.ReactNode
  className?: string
  dot?: boolean
}

const Badge = ({ variant = 'default', size = 'md', children, className, dot = false }: BadgeProps) => {
  const variants = {
    critical: 'bg-[#f87171]/10 text-[#f87171]',
    high: 'bg-[#fb923c]/10 text-[#fb923c]',
    medium: 'bg-[#fbbf24]/10 text-[#fbbf24]',
    low: 'bg-[#4ade80]/10 text-[#4ade80]',
    info: 'bg-[#60a5fa]/10 text-[#60a5fa]',
    success: 'bg-[#4ade80]/10 text-[#4ade80]',
    warning: 'bg-[#fbbf24]/10 text-[#fbbf24]',
    default: 'bg-[var(--bg-tertiary)] text-[var(--text-secondary)]',
  }

  const dotColors = {
    critical: 'bg-[#f87171]',
    high: 'bg-[#fb923c]',
    medium: 'bg-[#fbbf24]',
    low: 'bg-[#4ade80]',
    info: 'bg-[#60a5fa]',
    success: 'bg-[#4ade80]',
    warning: 'bg-[#fbbf24]',
    default: 'bg-[var(--text-muted)]',
  }

  const sizes = {
    sm: 'px-1.5 py-0.5 text-xs',
    md: 'px-2 py-0.5 text-xs',
  }

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded font-medium',
        variants[variant],
        sizes[size],
        className
      )}
    >
      {dot && <span className={cn('w-1.5 h-1.5 rounded-full', dotColors[variant])} />}
      {children}
    </span>
  )
}

export default Badge
