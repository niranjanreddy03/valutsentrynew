"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { AuthProvider, useAuth as useProductionAuth } from "@/contexts/AuthContext"

export { AuthProvider }

export function useAuth() {
  const auth = useProductionAuth()
  return {
    ...auth,
    user: auth.user
      ? {
          ...auth.user,
          name: auth.user.full_name || auth.user.email?.split("@")[0] || "User",
        }
      : auth.isLoading
        ? undefined
        : null,
  }
}

export function AuthGuard({ children }) {
  const { isAuthenticated, isLoading } = useProductionAuth()
  const router = useRouter()

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.replace("/login")
    }
  }, [isAuthenticated, isLoading, router])

  if (isLoading || !isAuthenticated) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100vh", color: "var(--muted)", fontFamily: "Inter, sans-serif" }}>
        Loading...
      </div>
    )
  }

  return children
}
