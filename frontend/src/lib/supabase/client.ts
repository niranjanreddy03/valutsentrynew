import { createBrowserClient } from '@supabase/ssr'
import { SupabaseClient } from '@supabase/supabase-js'
import { Database, Tables } from './types'

export type TypedSupabaseClient = SupabaseClient<Database>

// ─────────────────────────────────────────────────────────────────────────────
// Navigator-Locks bypass
// ─────────────────────────────────────────────────────────────────────────────
// @supabase/auth-js v2.95+ uses `navigator.locks` to serialise auth state
// across tabs. During Next.js dev hot-reload (and React StrictMode's double
// mount) the lock's abort signal fires without a reason, surfacing as:
//     "AbortError: signal is aborted without reason"
// Supplying a no-op `lock` makes auth-js skip the LockManager code path.
// Cross-tab sync still works via the storage event + onAuthStateChange.
const noopLock = async <R>(_name: string, _timeout: number, fn: () => Promise<R>): Promise<R> => {
  return await fn()
}

// Use the SSR browser client so OAuth callback sessions stored in cookies are
// visible to client-side auth checks after `/auth/callback` redirects back.
export function createClient(): TypedSupabaseClient {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        lock: noopLock,
      },
    }
  )
}

// Singleton instance for client-side usage
let supabaseClient: TypedSupabaseClient | null = null

export function getSupabaseClient(): TypedSupabaseClient {
  if (!supabaseClient) {
    supabaseClient = createClient()
  }
  return supabaseClient
}

// Helper type for table names
export type TableName = keyof Database['public']['Tables']
