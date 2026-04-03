/**
 * Get auth headers with the current user's ID for API calls.
 * This ensures per-user data isolation in the backend.
 */
export function getAuthHeaders(): Record<string, string> {
  // Check for demo mode user
  if (typeof window !== 'undefined') {
    const isDemoMode = localStorage.getItem('demo_mode') === 'true'
    if (isDemoMode) {
      return {
        'x-user-id': 'demo-user-id-12345',
        'x-user-email': 'demo@VaultSentry.io',
        'x-user-name': 'Demo User',
      }
    }
  }

  // Try to get user ID from Supabase session stored in localStorage
  if (typeof window !== 'undefined') {
    try {
      // Supabase stores session data in localStorage
      const keys = Object.keys(localStorage)
      const supabaseKey = keys.find(k => k.startsWith('sb-') && k.endsWith('-auth-token'))
      if (supabaseKey) {
        const raw = localStorage.getItem(supabaseKey)
        if (raw) {
          const parsed = JSON.parse(raw)
          const user = parsed?.user || parsed?.currentSession?.user
          const userId = user?.id
          if (userId) {
            return {
              'x-user-id': userId,
              'x-user-email': user?.email || '',
              'x-user-name': user?.user_metadata?.full_name || user?.email?.split('@')[0] || '',
            }
          }
        }
      }
    } catch {
      // Ignore parse errors
    }
  }

  return { 'x-user-id': 'local-user' }
}
