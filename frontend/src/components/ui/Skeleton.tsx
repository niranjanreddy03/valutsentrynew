import { cn } from '@/lib/utils'

interface SkeletonProps {
  className?: string
  variant?: 'text' | 'circular' | 'rectangular'
  width?: string | number
  height?: string | number
}

const Skeleton = ({ className, variant = 'text', width, height }: SkeletonProps) => {
  const variants = {
    text: 'rounded',
    circular: 'rounded-full',
    rectangular: 'rounded-lg',
  }

  return (
    <div
      className={cn(
        'bg-[var(--bg-tertiary)] animate-pulse',
        variants[variant],
        className
      )}
      style={{
        width: width,
        height: height || (variant === 'text' ? '1em' : undefined),
      }}
    />
  )
}

// Preset skeleton components
const SkeletonCard = ({ className }: { className?: string }) => (
  <div className={cn('bg-[var(--bg-secondary)] rounded-md border border-[var(--border-color)] p-6', className)}>
    <Skeleton variant="text" className="h-4 w-1/3 mb-4" />
    <Skeleton variant="text" className="h-8 w-2/3 mb-2" />
    <Skeleton variant="text" className="h-3 w-1/2" />
  </div>
)

const SkeletonTable = ({ rows = 5, columns = 4 }: { rows?: number; columns?: number }) => (
  <div className="overflow-x-auto rounded-md border border-[var(--border-color)]">
    <div className="bg-[var(--bg-secondary)] p-4">
      <div className="flex gap-4">
        {[...Array(columns)].map((_, i) => (
          <Skeleton key={i} variant="text" className="h-4 flex-1" />
        ))}
      </div>
    </div>
    <div className="divide-y divide-[var(--border-color)]">
      {[...Array(rows)].map((_, i) => (
        <div key={i} className="p-4 flex gap-4">
          {[...Array(columns)].map((_, j) => (
            <Skeleton key={j} variant="text" className="h-4 flex-1" />
          ))}
        </div>
      ))}
    </div>
  </div>
)

const SkeletonChart = ({ className }: { className?: string }) => (
  <div className={cn('bg-[var(--bg-secondary)] rounded-md border border-[var(--border-color)] p-6', className)}>
    <Skeleton variant="text" className="h-4 w-1/4 mb-6" />
    <div className="flex items-end gap-2 h-48">
      {[...Array(7)].map((_, i) => (
        <Skeleton
          key={i}
          variant="rectangular"
          className="flex-1"
          height={`${Math.random() * 60 + 40}%`}
        />
      ))}
    </div>
  </div>
)

Skeleton.Card = SkeletonCard
Skeleton.Table = SkeletonTable
Skeleton.Chart = SkeletonChart

export default Skeleton
