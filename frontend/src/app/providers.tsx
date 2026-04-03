'use client'

import { ReactNode } from 'react'
import { ThemeProvider } from '@/contexts/ThemeContext'
import { AuthProvider } from '@/contexts/AuthContext'
import { ToastProvider } from '@/contexts/ToastContext'
import { SubscriptionProvider } from '@/contexts/SubscriptionContext'

export function Providers({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider>
      <AuthProvider>
        <SubscriptionProvider>
          <ToastProvider>
            {children}
          </ToastProvider>
        </SubscriptionProvider>
      </AuthProvider>
    </ThemeProvider>
  )
}
