'use client'

import { getSupabaseClient } from '@/lib/supabase/client'
import type { UpdateUser, User } from '@/lib/supabase/types'
import { Session, SupabaseClient, User as SupabaseUser } from '@supabase/supabase-js'
import { useRouter } from 'next/navigation'
import { createContext, ReactNode, useCallback, useContext, useEffect, useState } from 'react'

// ─────────────────────────────────────────────────────────────────────────────
// Local-dev auth fallback
// ─────────────────────────────────────────────────────────────────────────────
// When NEXT_PUBLIC_SUPABASE_URL still points at the placeholder project
// (YOUR-PROJECT-ID), the real Supabase endpoint can't be reached and every
// auth call fails with `TypeError: Failed to fetch`. We detect that here and
// substitute a localStorage-backed auth so the signup → choose-plan → checkout
// flow is fully exercisable without a real Supabase project.
const SUPABASE_DEAD_KEY = 'vs_supabase_unreachable'

const isSupabaseConfigured = () => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
  if (!url || !key) return false
  if (url.includes('YOUR-PROJECT-ID')) return false
  if (key.includes('YOUR-ANON-PUBLIC-KEY')) return false
  // If a previous Supabase call failed with a network error this session,
  // treat the project as unreachable and use local auth.
  if (typeof window !== 'undefined' && localStorage.getItem(SUPABASE_DEAD_KEY) === '1') {
    return false
  }
  return true
}

// A TypeError from fetch (e.g. DNS failure, CORS, offline) means the
// Supabase project is unreachable — we fall back to local auth for the rest
// of the session.
function isFetchError(err: unknown): boolean {
  if (!err) return false
  const msg = err instanceof Error ? err.message : String(err)
  return (
    (err instanceof TypeError && /fetch/i.test(msg)) ||
    /Failed to fetch/i.test(msg) ||
    /NetworkError/i.test(msg)
  )
}

function markSupabaseDead() {
  try {
    localStorage.setItem(SUPABASE_DEAD_KEY, '1')
    console.warn('[auth] Supabase unreachable — switching to local auth.')
  } catch {
    /* localStorage may be unavailable in SSR */
  }
}

function isCaptchaError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err ?? '')
  return /captcha/i.test(msg)
}

function captchaSetupError(): Error | null {
  if (process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY) return null
  return new Error(
    'Captcha is enabled in Supabase, but NEXT_PUBLIC_TURNSTILE_SITE_KEY is missing in frontend/.env.local. Add your Cloudflare Turnstile site key and restart the dev server.'
  )
}

function withTimeout<T>(promise: Promise<T>, ms: number, message: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(message)), ms)
    promise
      .then(resolve, reject)
      .finally(() => clearTimeout(timer))
  })
}

const LOCAL_OTP = '123456' // Fixed code for local-dev signup verification.
const LOCAL_USERS_KEY = 'vs_local_users'
const LOCAL_PENDING_KEY = 'vs_local_pending'
const LOCAL_SESSION_KEY = 'vs_local_session'

/**
 * Source-of-truth check for whether the current user must complete an MFA
 * challenge before being let into the app.
 *
 * We call listFactors() directly (instead of solely relying on
 * getAuthenticatorAssuranceLevel) because `aal.nextLevel` has been observed
 * returning a stale `aal1` for a few hundred ms right after
 * signInWithPassword — long enough that SIGNED_IN fires, the check
 * resolves false, and the user is routed to `/` with an AAL1 session even
 * though a verified TOTP factor exists for the account.
 *
 * Returns true iff the user has at least one verified TOTP factor AND the
 * current session is not already at AAL2.
 */
async function userHasVerifiedMfa(client: SupabaseClient): Promise<boolean> {
  try {
    const [factors, aal] = await Promise.all([
      client.auth.mfa.listFactors(),
      client.auth.mfa.getAuthenticatorAssuranceLevel(),
    ])
    const verified = factors.data?.totp?.some((f: any) => f.status === 'verified') ?? false
    const alreadyAal2 = aal?.data?.currentLevel === 'aal2'
    return verified && !alreadyAal2
  } catch (err) {
    console.warn('[AUTH] userHasVerifiedMfa check failed:', err)
    return false
  }
}

interface LocalStoredUser {
  id: string
  email: string
  passwordHash: string
  fullName: string
  tier: 'basic' | 'premium' | 'premium_plus'
  subscription_started_at: string | null
  subscription_expires_at: string | null
  is_trial: boolean
  trial_ends_at: string | null
  createdAt: string
}

async function hashPassword(pw: string): Promise<string> {
  const data = new TextEncoder().encode(pw)
  const digest = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

function readLocalUsers(): LocalStoredUser[] {
  try {
    return JSON.parse(localStorage.getItem(LOCAL_USERS_KEY) || '[]')
  } catch {
    return []
  }
}

function writeLocalUsers(users: LocalStoredUser[]) {
  localStorage.setItem(LOCAL_USERS_KEY, JSON.stringify(users))
}

function localStoredToUser(u: LocalStoredUser): User {
  return {
    id: u.id,
    email: u.email,
    full_name: u.fullName,
    avatar_url: null,
    role: 'admin',
    company: null,
    timezone: 'UTC',
    subscription_tier: u.tier,
    subscription_started_at: u.subscription_started_at,
    subscription_expires_at: u.subscription_expires_at,
    is_trial: u.is_trial,
    trial_ends_at: u.trial_ends_at,
    scans_this_week: 0,
    scans_today: 0,
    created_at: u.createdAt,
    updated_at: u.createdAt,
  } as unknown as User
}

interface AuthContextType {
  user: User | null
  supabaseUser: SupabaseUser | null
  session: Session | null
  isLoading: boolean
  isAuthenticated: boolean
  login: (email: string, password: string, captchaToken?: string) => Promise<void>
  loginWithOAuth: (provider: 'github' | 'gitlab' | 'google') => Promise<void>
  register: (email: string, password: string, fullName: string, captchaToken?: string) => Promise<void>
  verifyOtp: (email: string, token: string, type?: 'signup' | 'recovery') => Promise<void>
  resendOtp: (email: string, type?: 'signup' | 'recovery') => Promise<void>
  logout: () => Promise<void>
  forgotPassword: (email: string, captchaToken?: string) => Promise<void>
  resetPassword: (newPassword: string) => Promise<void>
  updateProfile: (updates: Partial<User>) => Promise<void>
  refreshSession: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [supabaseUser, setSupabaseUser] = useState<SupabaseUser | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const router = useRouter()
  const supabase = getSupabaseClient()
  // Tracks whether local auth is active. Starts from the env-based detection,
  // but can flip to true at runtime if a Supabase call fails with a fetch
  // error (marks the project dead for the session).
  const [localAuthActive, setLocalAuthActive] = useState<boolean>(!isSupabaseConfigured())
  const useLocalAuth = localAuthActive

  const promoteToLocalAuth = useCallback(() => {
    markSupabaseDead()
    setLocalAuthActive(true)
  }, [])

  // Fetch user profile from database
  const fetchUserProfile = useCallback(async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', userId)
        .single()

      if (error) {
        console.error('Error fetching user profile:', error)
        return null
      }
      
      // Ensure user has a basic subscription tier if not set
      if (data && !data.subscription_tier) {
        const { data: updatedData } = await supabase
          .from('users')
          .update({
            subscription_tier: 'basic',
            subscription_started_at: new Date().toISOString()
          })
          .eq('id', userId)
          .select()
          .single()
        
        return updatedData || { ...data, subscription_tier: 'basic' }
      }
      
      return data
    } catch (error) {
      console.error('Error fetching user profile:', error)
      return null
    }
  }, [supabase])

  // Initialize auth state
  useEffect(() => {
    const initializeAuth = async () => {
      try {
        // Local-dev auth: rehydrate from localStorage session if Supabase
        // credentials are placeholders.
        if (useLocalAuth) {
          try {
            const sessRaw = localStorage.getItem(LOCAL_SESSION_KEY)
            if (sessRaw) {
              const { userId } = JSON.parse(sessRaw) as { userId: string }
              const stored = readLocalUsers().find((u) => u.id === userId)
              if (stored) {
                const localUser = localStoredToUser(stored)
                setUser(localUser)
                setSupabaseUser({
                  id: stored.id,
                  email: stored.email,
                  app_metadata: {},
                  user_metadata: { full_name: stored.fullName },
                  aud: 'authenticated',
                  created_at: stored.createdAt,
                } as SupabaseUser)
              }
            }
          } catch (e) {
            console.warn('[local-auth] rehydrate failed', e)
          }
          setIsLoading(false)
          return
        }

        // Check for demo mode first
        const isDemoMode = localStorage.getItem('demo_mode') === 'true'
        if (isDemoMode) {
          const demoUser: User = {
            id: 'demo-user-id-12345',
            email: 'demo@VaultSentry.io',
            full_name: 'Demo User',
            avatar_url: null,
            role: 'admin',
            company: 'Vault Sentry Demo',
            timezone: 'UTC',
            subscription_tier: 'premium_plus',
            subscription_started_at: new Date().toISOString(),
            subscription_expires_at: null,
            is_trial: false,
            trial_ends_at: null,
            scans_this_week: 0,
            scans_today: 0,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          }
          setUser(demoUser)
          setSupabaseUser({
            id: demoUser.id,
            email: demoUser.email,
            app_metadata: {},
            user_metadata: { full_name: demoUser.full_name },
            aud: 'authenticated',
            created_at: demoUser.created_at,
          } as SupabaseUser)
          setIsLoading(false)
          return
        }

        // Get initial session from Supabase
        const { data: { session: initialSession } } = await supabase.auth.getSession()
        
        if (initialSession?.user) {
          setSession(initialSession)
          setSupabaseUser(initialSession.user)
          const profile = await fetchUserProfile(initialSession.user.id)
          setUser(profile)
        }
      } catch (error) {
        console.error('Error initializing auth:', error)
      } finally {
        setIsLoading(false)
      }
    }

    initializeAuth()

    // In local-dev auth mode, skip Supabase's onAuthStateChange listener —
    // it fires INITIAL_SESSION with null and would wipe our local user.
    if (useLocalAuth) {
      return () => {}
    }

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, currentSession) => {
        console.log('Auth state changed:', event)
        
        setSession(currentSession)
        setSupabaseUser(currentSession?.user ?? null)

        if (currentSession?.user) {
          const profile = await fetchUserProfile(currentSession.user.id)
          setUser(profile)
        } else {
          setUser(null)
        }

        // Handle specific events
        if (event === 'SIGNED_OUT') {
          router.push('/login')
        } else if (event === 'SIGNED_IN') {
          // If the user has a verified TOTP factor, require the challenge
          // before entering the app. MFA_CHALLENGE_VERIFIED lifts the session
          // to AAL2 and fires SIGNED_IN again — that second firing passes
          // the check and lands on /.
          //
          // We use listFactors() + AAL as a belt-and-braces check because
          // getAuthenticatorAssuranceLevel alone has been observed returning
          // stale nextLevel='aal1' right after password sign-in.
          try {
            const needsChallenge = await userHasVerifiedMfa(supabase)
            if (needsChallenge) {
              router.push('/mfa-challenge')
              return
            }
          } catch (err) {
            console.warn('[AUTH] MFA check on SIGNED_IN failed:', err)
          }
          router.push('/')
        } else if (event === 'MFA_CHALLENGE_VERIFIED') {
          router.push('/')
        } else if (event === 'PASSWORD_RECOVERY') {
          router.push('/reset-password')
        }
      }
    )

    return () => {
      subscription.unsubscribe()
    }
  }, [supabase, fetchUserProfile, router, useLocalAuth])

  // Demo mode credentials
  const DEMO_EMAIL = 'demo@thevaultsentry.com'
  const DEMO_PASSWORD = 'Demo@2024!'

  const login = async (email: string, password: string, captchaToken?: string) => {
    setIsLoading(true)
    try {
      // Local-dev auth: verify against users stored in localStorage.
      if (useLocalAuth && email.toLowerCase() !== DEMO_EMAIL) {
        const users = readLocalUsers()
        const stored = users.find((u) => u.email.toLowerCase() === email.toLowerCase())
        if (!stored) throw new Error('No account with that email. Please register first.')
        const hash = await hashPassword(password)
        if (hash !== stored.passwordHash) throw new Error('Incorrect password.')
        const localUser = localStoredToUser(stored)
        setUser(localUser)
        setSupabaseUser({
          id: stored.id,
          email: stored.email,
          app_metadata: {},
          user_metadata: { full_name: stored.fullName },
          aud: 'authenticated',
          created_at: stored.createdAt,
        } as SupabaseUser)
        localStorage.setItem(LOCAL_SESSION_KEY, JSON.stringify({ userId: stored.id }))
        // Ensure a stale demo flag from an earlier session doesn't bleed into
        // this real account (see note in the Supabase login path).
        localStorage.removeItem('demo_mode')
        router.push('/')
        return
      }

      // Demo mode bypass - for presentations without Supabase
      if (email.toLowerCase() === DEMO_EMAIL && password === DEMO_PASSWORD) {
        const demoUser: User = {
          id: 'demo-user-id-12345',
          email: email,
          full_name: 'Demo User',
          avatar_url: null,
          role: 'admin',
          company: 'Vault Sentry Demo',
          timezone: 'UTC',
          subscription_tier: 'premium_plus',
          subscription_started_at: new Date().toISOString(),
          subscription_expires_at: null,
          is_trial: false,
          trial_ends_at: null,
          scans_this_week: 0,
          scans_today: 0,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }
        setUser(demoUser)
        setSupabaseUser({
          id: demoUser.id,
          email: demoUser.email,
          app_metadata: {},
          user_metadata: { full_name: demoUser.full_name },
          aud: 'authenticated',
          created_at: demoUser.created_at,
        } as SupabaseUser)
        // Store demo mode flag
        localStorage.setItem('demo_mode', 'true')
        router.push('/')
        return
      }

      try {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
          options: captchaToken ? { captchaToken } : undefined,
        })
        if (error) throw error
        // A prior session may have left the demo-mode flag set in localStorage
        // (e.g. the user clicked "Try demo" earlier on this browser). Real
        // logins should never inherit that — it causes fake demo data to bleed
        // into API keys, audit logs, etc.
        localStorage.removeItem('demo_mode')

        // Session rotation: mint a fresh CSRF token pair bound to the new
        // session so any token issued to a prior (possibly compromised)
        // session on this device is invalidated. Fire-and-forget: failure
        // just means CSRF issuance happens on the first API call instead.
        fetch('/api/csrf', {
          method: 'GET',
          credentials: 'include',
          cache: 'no-store',
        }).catch(() => {})

        // If the user has a verified TOTP factor, their session is at AAL1 —
        // we must challenge + verify the 6-digit code before letting them in.
        //
        // We check listFactors() directly (instead of relying solely on
        // getAuthenticatorAssuranceLevel) because the AAL claim is populated
        // lazily after signInWithPassword and can race the redirect. A
        // verified factor in auth.mfa_factors is the ground truth.
        const needsChallenge = await userHasVerifiedMfa(supabase)
        console.log('[AUTH] Post-login MFA check → needsChallenge:', needsChallenge)
        if (needsChallenge) {
          router.push('/mfa-challenge')
          return
        }
      } catch (err) {
        if (isCaptchaError(err)) {
          throw captchaSetupError() ?? err
        }
        if (isFetchError(err)) {
          // Supabase unreachable — fall back to local auth.
          promoteToLocalAuth()
          const users = readLocalUsers()
          const stored = users.find((u) => u.email.toLowerCase() === email.toLowerCase())
          if (!stored) throw new Error('No account with that email. Please register first.')
          const hash = await hashPassword(password)
          if (hash !== stored.passwordHash) throw new Error('Incorrect password.')
          const localUser = localStoredToUser(stored)
          setUser(localUser)
          setSupabaseUser({
            id: stored.id,
            email: stored.email,
            app_metadata: {},
            user_metadata: { full_name: stored.fullName },
            aud: 'authenticated',
            created_at: stored.createdAt,
          } as SupabaseUser)
          localStorage.setItem(LOCAL_SESSION_KEY, JSON.stringify({ userId: stored.id }))
          localStorage.removeItem('demo_mode')
          router.push('/')
          return
        }
        throw err
      }
    } finally {
      setIsLoading(false)
    }
  }

  const loginWithOAuth = async (provider: 'github' | 'gitlab' | 'google') => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    })
    if (error) throw error
  }

  const register = async (email: string, password: string, fullName: string, captchaToken?: string) => {
    setIsLoading(true)
    try {
      // Local-dev auth: create a pending signup in localStorage. The user
      // then enters LOCAL_OTP (123456) on the verify screen to activate.
      if (useLocalAuth) {
        const users = readLocalUsers()
        if (users.find((u) => u.email.toLowerCase() === email.toLowerCase())) {
          throw new Error('An account with that email already exists.')
        }
        const passwordHash = await hashPassword(password)
        localStorage.setItem(
          LOCAL_PENDING_KEY,
          JSON.stringify({ email, passwordHash, fullName, otp: LOCAL_OTP })
        )
        // Surface the code in the console for discoverability.
        console.info(`[local-auth] signup OTP for ${email}: ${LOCAL_OTP}`)
        return
      }

      try {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { full_name: fullName },
            emailRedirectTo: `${window.location.origin}/auth/callback`,
            ...(captchaToken ? { captchaToken } : {}),
          },
        })
        if (error) throw error
      } catch (err) {
        if (isCaptchaError(err)) {
          throw captchaSetupError() ?? err
        }
        if (isFetchError(err)) {
          // Supabase unreachable — promote to local auth and retry locally.
          promoteToLocalAuth()
          const users = readLocalUsers()
          if (users.find((u) => u.email.toLowerCase() === email.toLowerCase())) {
            throw new Error('An account with that email already exists.')
          }
          const passwordHash = await hashPassword(password)
          localStorage.setItem(
            LOCAL_PENDING_KEY,
            JSON.stringify({ email, passwordHash, fullName, otp: LOCAL_OTP })
          )
          console.info(`[local-auth] signup OTP for ${email}: ${LOCAL_OTP}`)
          return
        }
        throw err
      }
    } finally {
      setIsLoading(false)
    }
  }

  const verifyOtp = async (email: string, token: string, type: 'signup' | 'recovery' = 'signup') => {
    setIsLoading(true)
    try {
      // Helper: run the local-auth OTP verification path.
      const runLocalOtpVerify = async () => {
        const pendingRaw = localStorage.getItem(LOCAL_PENDING_KEY)
        if (!pendingRaw) throw new Error('No pending signup. Please register again.')
        const pending = JSON.parse(pendingRaw) as {
          email: string; passwordHash: string; fullName: string; otp: string
        }
        if (pending.email.toLowerCase() !== email.toLowerCase())
          throw new Error('Email does not match pending signup.')
        if (token !== pending.otp) throw new Error('Invalid verification code.')
        const now = new Date().toISOString()
        const newUser: LocalStoredUser = {
          id: (crypto as any).randomUUID?.() || `local-${Date.now()}`,
          email: pending.email,
          passwordHash: pending.passwordHash,
          fullName: pending.fullName,
          tier: 'basic',
          subscription_started_at: null,
          subscription_expires_at: null,
          is_trial: false,
          trial_ends_at: null,
          createdAt: now,
        }
        const allUsers = readLocalUsers()
        allUsers.push(newUser)
        writeLocalUsers(allUsers)
        localStorage.removeItem(LOCAL_PENDING_KEY)
        localStorage.setItem(LOCAL_SESSION_KEY, JSON.stringify({ userId: newUser.id }))
        // Brand-new real account — drop any lingering demo flag so they see
        // their own (empty) data rather than the demo fixtures.
        localStorage.removeItem('demo_mode')
        setUser(localStoredToUser(newUser))
        setSupabaseUser({
          id: newUser.id, email: newUser.email, app_metadata: {},
          user_metadata: { full_name: newUser.fullName },
          aud: 'authenticated', created_at: newUser.createdAt,
        } as SupabaseUser)
      }

      if (useLocalAuth && type === 'recovery') {
        throw new Error('Password reset requires Supabase auth in this environment.')
      }

      // Local-dev auth: verify signup OTP from localStorage.
      if (useLocalAuth) {
        await runLocalOtpVerify()
        return
      }

      try {
        const { data, error } = await withTimeout(
          supabase.auth.verifyOtp({ email, token, type }),
          15000,
          'Verification timed out. Please request a new code and try again.'
        )
        if (error) throw error
        if (data.session) {
          setSession(data.session)
          setSupabaseUser(data.user ?? data.session.user)
          if (type === 'signup' && data.session.user?.id) {
            const profile = await fetchUserProfile(data.session.user.id)
            setUser(profile)
          }
        }
      } catch (err) {
        if (isFetchError(err) && type === 'signup') {
          promoteToLocalAuth()
          await runLocalOtpVerify()
          return
        }
        throw err
      }
    } finally {
      setIsLoading(false)
    }
  }

  const resendOtp = async (email: string, type: 'signup' | 'recovery' = 'signup') => {
    if (type === 'recovery') {
      await forgotPassword(email)
      return
    }

    if (useLocalAuth) {
      // Nothing to send — the OTP is static. Log it again for convenience.
      console.info(`[local-auth] signup OTP for ${email}: ${LOCAL_OTP}`)
      return
    }
    const { error } = await supabase.auth.resend({
      type: 'signup',
      email,
    })
    if (error) throw error
  }

  const logout = async () => {
    setIsLoading(true)
    try {
      // Clear demo mode flag
      localStorage.removeItem('demo_mode')
      localStorage.removeItem(LOCAL_SESSION_KEY)

      // Clear state first
      setUser(null)
      setSupabaseUser(null)
      setSession(null)

      // Skip the network call in local-dev auth mode.
      if (!useLocalAuth) {
        try {
          const signOutPromise = supabase.auth.signOut({ scope: 'local' })
          const timeoutPromise = new Promise((resolve) => setTimeout(resolve, 3000))
          await Promise.race([signOutPromise, timeoutPromise])
        } catch (error) {
          console.error('Logout error (continuing):', error)
        }
      }

      router.push('/login')
    } finally {
      setIsLoading(false)
    }
  }

  const forgotPassword = async (email: string, captchaToken?: string) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
      ...(captchaToken ? { captchaToken } : {}),
    })
    if (error) throw error
  }

  const resetPassword = async (newPassword: string) => {
    const {
      data: { session: currentSession },
      error: sessionError,
    } = await withTimeout(
      supabase.auth.getSession(),
      10000,
      'Could not confirm your reset session. Please request a new reset code.'
    )
    if (sessionError) throw sessionError
    if (!currentSession) {
      throw new Error('Your password reset session expired. Please request a new reset code.')
    }

    const { error } = await withTimeout(
      supabase.auth.updateUser({ password: newPassword }),
      15000,
      'Password update timed out. Please try again.'
    )
    if (error) throw error
  }

  const updateProfile = async (updates: Partial<User>) => {
    if (!supabaseUser) throw new Error('Not authenticated')

    // Local-dev auth: update the stored user in localStorage + React state.
    if (useLocalAuth) {
      const users = readLocalUsers()
      const idx = users.findIndex((u) => u.id === supabaseUser.id)
      if (idx === -1) throw new Error('Local user not found')
      const stored = users[idx]
      if (updates.subscription_tier)
        stored.tier = updates.subscription_tier as LocalStoredUser['tier']
      if (updates.subscription_started_at !== undefined)
        stored.subscription_started_at = updates.subscription_started_at as string | null
      if (updates.subscription_expires_at !== undefined)
        stored.subscription_expires_at = updates.subscription_expires_at as string | null
      if (updates.is_trial !== undefined) stored.is_trial = !!updates.is_trial
      if (updates.trial_ends_at !== undefined)
        stored.trial_ends_at = updates.trial_ends_at as string | null
      if (updates.full_name !== undefined) stored.fullName = updates.full_name as string
      users[idx] = stored
      writeLocalUsers(users)
      setUser(localStoredToUser(stored))
      return
    }

    const { data, error } = await supabase
      .from('users')
      // @ts-expect-error - Supabase type inference issue
      .update(updates as UpdateUser)
      .eq('id', supabaseUser.id)
      .select()
      .single()

    if (error) throw error
    setUser(data as User)
  }

  const refreshSession = async () => {
    const { data: { session: newSession }, error } = await withTimeout(
      supabase.auth.getSession(),
      10000,
      'Could not load your session. Please refresh the page or request a new reset link.'
    )
    if (error) throw error
    setSession(newSession)
    setSupabaseUser(newSession?.user ?? null)
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        supabaseUser,
        session,
        isLoading,
        isAuthenticated: !!session || !!user,
        login,
        loginWithOAuth,
        register,
        verifyOtp,
        resendOtp,
        logout,
        forgotPassword,
        resetPassword,
        updateProfile,
        refreshSession,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}

// Custom hook for checking if user has specific role
export function useRole() {
  const { user } = useAuth()
  
  return {
    isAdmin: user?.role === 'admin',
    isDeveloper: user?.role === 'developer',
    isViewer: user?.role === 'viewer',
    role: user?.role,
    hasRole: (roles: Array<'admin' | 'developer' | 'viewer'>) => 
      user?.role ? roles.includes(user.role) : false,
  }
}
