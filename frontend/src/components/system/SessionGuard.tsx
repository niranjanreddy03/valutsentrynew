'use client'

/**
 * Mounts the session-anomaly heartbeat when (and only when) the user is
 * authenticated. Renders nothing.
 *
 * Lives inside <Providers> so the entire app benefits, but it reads from
 * AuthContext so pre-login pages (which have no session) don't spam the
 * heartbeat endpoint.
 */

import { useAuth } from '@/contexts/AuthContext'
import { useSessionGuard } from '@/hooks/useSessionGuard'

export default function SessionGuard() {
  const { isAuthenticated } = useAuth()
  useSessionGuard(isAuthenticated)
  return null
}
