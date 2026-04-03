import { createBrowserClient } from '@supabase/ssr'
import { createClient as createSupabaseClient, SupabaseClient } from '@supabase/supabase-js'
import { Database, Tables } from './types'

export type TypedSupabaseClient = SupabaseClient<Database>

// Use the standard Supabase client for better type inference
export function createClient(): TypedSupabaseClient {
  return createSupabaseClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
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
