"use client"

import { ThemeProvider } from "@/contexts/ThemeContext"
import { AuthProvider } from "@/contexts/AuthContext"
import { ToastProvider } from "@/contexts/ToastContext"
import { SubscriptionProvider } from "@/contexts/SubscriptionContext"
import ScheduledScansRunner from "@/components/system/ScheduledScansRunner"
import SessionGuard from "@/components/system/SessionGuard"

export function Providers({ children }) {
  return (
    <ThemeProvider>
      <AuthProvider>
        <SubscriptionProvider>
          <ToastProvider>
            <ScheduledScansRunner />
            <SessionGuard />
            {children}
          </ToastProvider>
        </SubscriptionProvider>
      </AuthProvider>
    </ThemeProvider>
  )
}
