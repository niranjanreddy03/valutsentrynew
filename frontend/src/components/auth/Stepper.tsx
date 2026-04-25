'use client'

interface StepperProps {
  steps: string[]
  current: number
}

export function Stepper({ steps, current }: StepperProps) {
  const total = steps.length
  const pct = Math.min(100, ((current + 1) / total) * 100)
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-[11px] font-medium uppercase tracking-[0.08em]">
        <span style={{ color: '#e5e5e5' }}>{steps[current]}</span>
        <span style={{ color: '#a3a3a3' }}>
          Step {current + 1} <span style={{ color: '#737373' }}>/ {total}</span>
        </span>
      </div>
      <div
        className="relative h-1 w-full overflow-hidden rounded-full"
        style={{ background: '#262626' }}
      >
        <div
          className="absolute inset-y-0 left-0 rounded-full transition-[width] duration-500 ease-out"
          style={{
            width: `${pct}%`,
            background: '#3b82f6',
            boxShadow: '0 0 12px rgba(59,130,246,0.45)',
          }}
        />
      </div>
    </div>
  )
}

export default Stepper
