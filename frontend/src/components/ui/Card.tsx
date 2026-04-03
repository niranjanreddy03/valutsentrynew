import { ReactNode } from 'react'
import { cn } from '@/lib/utils'

interface CardProps {
  children: ReactNode
  className?: string
  hover?: boolean
  gradient?: boolean
  noPadding?: boolean
}

const Card = ({ children, className, hover = false, gradient = false, noPadding = false }: CardProps) => {
  return (
    <div
      className={cn(
        'bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-md',
        !noPadding && 'p-4',
        hover && 'transition-colors hover:border-[var(--border-hover)]',
        className
      )}
    >
      {children}
    </div>
  )
}

interface CardHeaderProps {
  title: string
  description?: string
  action?: ReactNode
  className?: string
}

const CardHeader = ({ title, description, action, className }: CardHeaderProps) => {
  return (
    <div className={cn('flex items-start justify-between mb-3', className)}>
      <div>
        <h3 className="text-sm font-medium text-[var(--text-primary)]">{title}</h3>
        {description && <p className="mt-0.5 text-xs text-[var(--text-muted)]">{description}</p>}
      </div>
      {action && <div>{action}</div>}
    </div>
  )
}

Card.Header = CardHeader

export default Card
