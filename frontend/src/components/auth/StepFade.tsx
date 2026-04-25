'use client'

import { ReactNode, useEffect, useState } from 'react'

interface StepFadeProps {
  /** A value that changes when the step changes. Used as the keyed mount boundary. */
  stepKey: string | number
  children: ReactNode
  /** ms */
  duration?: number
}

/**
 * StepFade — fade + subtle rise when the step changes.
 * Works without animation libraries — just keyed remount + CSS.
 */
export function StepFade({ stepKey, children, duration = 260 }: StepFadeProps) {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    setVisible(false)
    const id = requestAnimationFrame(() => setVisible(true))
    return () => cancelAnimationFrame(id)
  }, [stepKey])

  return (
    <div
      key={stepKey}
      className="transition-all ease-out will-change-transform"
      style={{
        transitionDuration: `${duration}ms`,
        opacity: visible ? 1 : 0,
        transform: visible ? 'translateY(0)' : 'translateY(8px)',
      }}
    >
      {children}
    </div>
  )
}

export default StepFade
