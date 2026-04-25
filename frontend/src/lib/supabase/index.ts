/**
 * Barrel for the Supabase client helpers.
 *
 * IMPORTANT: do NOT re-export from './server' here. `server.ts` imports
 * `next/headers`, which is only available in Server Components and Route
 * Handlers. Re-exporting it from the barrel means any client component
 * that does `import { ... } from '@/lib/supabase'` pulls `next/headers`
 * into its client bundle and breaks the build with:
 *
 *   "You're importing a component that needs next/headers. That only works
 *    in a Server Component..."
 *
 * Server consumers must import explicitly:
 *
 *   import { createServerSupabaseClient } from '@/lib/supabase/server'
 */

export { createClient, getSupabaseClient } from './client'
export * from './types'
