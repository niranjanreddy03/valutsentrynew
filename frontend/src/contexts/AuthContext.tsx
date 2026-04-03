'use client'

import { getSupabaseClient } from '@/lib/supabase/client'
import type { UpdateUser, User } from '@/lib/supabase/types'
import { Session, User as SupabaseUser } from '@supabase/supabase-js'
import { useRouter } from 'next/navigation'
import { createContext, ReactNode, useCallback, useContext, useEffect, useState } from 'react'

interface AuthContextType {
  user: User | null
  supabaseUser: SupabaseUser | null
  session: Session | null
  isLoading: boolean
  isAuthenticated: boolean
  login: (email: string, password: string) => Promise<void>
  loginWithOAuth: (provider: 'github' | 'gitlab' | 'google') => Promise<void>
  register: (email: string, password: string, fullName: string) => Promise<void>
  verifyOtp: (email: string, token: string) => Promise<void>
  resendOtp: (email: string) => Promise<void>
  logout: () => Promise<void>
  forgotPassword: (email: string) => Promise<void>
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
          router.push('/')
        } else if (event === 'PASSWORD_RECOVERY') {
          router.push('/reset-password')
        }
      }
    )

    return () => {
      subscription.unsubscribe()
    }
  }, [supabase, fetchUserProfile, router])

  // Demo mode credentials
  const DEMO_EMAIL = 'demo@vaultsentry.io'
  const DEMO_PASSWORD = 'Demo@2024!'

  const login = async (email: string, password: string) => {
    setIsLoading(true)
    try {
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

      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      })
      if (error) throw error
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

  const register = async (email: string, password: string, fullName: string) => {
    setIsLoading(true)
    try {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: fullName,
          },
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        },
      })
      if (error) throw error
    } finally {
      setIsLoading(false)
    }
  }

  const verifyOtp = async (email: string, token: string) => {
    setIsLoading(true)
    try {
      const { error } = await supabase.auth.verifyOtp({
        email,
        token,
        type: 'signup',
      })
      if (error) throw error
    } finally {
      setIsLoading(false)
    }
  }

  const resendOtp = async (email: string) => {
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
      
      // Clear state first
      setUser(null)
      setSupabaseUser(null)
      setSession(null)
      
      // Sign out from Supabase with timeout (don't block on network)
      try {
        const signOutPromise = supabase.auth.signOut({ scope: 'local' })
        const timeoutPromise = new Promise((resolve) => setTimeout(resolve, 3000))
        await Promise.race([signOutPromise, timeoutPromise])
      } catch (error) {
        console.error('Logout error (continuing):', error)
      }
      
      // Force redirect to login
      router.push('/login')
    } finally {
      setIsLoading(false)
    }
  }

  const forgotPassword = async (email: string) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    })
    if (error) throw error
  }

  const resetPassword = async (newPassword: string) => {
    const { error } = await supabase.auth.updateUser({
      password: newPassword,
    })
    if (error) throw error
  }

  const updateProfile = async (updates: Partial<User>) => {
    if (!supabaseUser) throw new Error('Not authenticated')

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
    const { data: { session: newSession }, error } = await supabase.auth.refreshSession()
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
