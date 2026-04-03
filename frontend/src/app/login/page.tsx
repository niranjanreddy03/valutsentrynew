'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Shield, Mail, Lock, Eye, EyeOff, Loader2, Moon, Sun } from 'lucide-react'
import { useToast } from '@/contexts/ToastContext'
import { useTheme } from '@/contexts/ThemeContext'
import { useAuth } from '@/contexts/AuthContext'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({})
  const router = useRouter()
  const toast = useToast()
  const { theme, toggleTheme } = useTheme()
  const { login, loginWithOAuth, isAuthenticated } = useAuth()

  useEffect(() => {
    if (isAuthenticated) {
      router.push('/')
    }
  }, [isAuthenticated, router])

  const validate = () => {
    const newErrors: { email?: string; password?: string } = {}
    if (!email) {
      newErrors.email = 'Email is required'
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      newErrors.email = 'Invalid email format'
    }
    if (!password) {
      newErrors.password = 'Password is required'
    } else if (password.length < 6) {
      newErrors.password = 'Password must be at least 6 characters'
    }
    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!validate()) return

    setIsLoading(true)
    try {
      await login(email, password)
      toast.success('Welcome back!', 'Redirecting to dashboard...')
      // Hard redirect after successful login - more reliable than router.push
      setTimeout(() => {
        window.location.href = '/'
      }, 500)
    } catch (error: any) {
      console.error('Login error:', error)
      toast.error('Login failed', error.message || 'Invalid email or password')
      setIsLoading(false)
    }
  }

  const handleOAuthLogin = async (provider: 'github' | 'google') => {
    try {
      await loginWithOAuth(provider)
    } catch (error: any) {
      toast.error('Login failed', error.message || 'OAuth login failed')
    }
  }

  return (
    <div className="min-h-screen relative overflow-hidden bg-zinc-100 dark:bg-zinc-950">
      <div className="pointer-events-none absolute -top-32 right-0 h-72 w-72 rounded-full bg-cyan-400/20 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-40 left-0 h-96 w-96 rounded-full bg-emerald-400/20 blur-3xl" />

      {/* Theme Toggle */}
      <button
        onClick={toggleTheme}
        className="fixed top-4 right-4 z-50 p-2.5 rounded-lg bg-white/80 dark:bg-zinc-900/80 border border-zinc-200/80 dark:border-zinc-800 hover:bg-white dark:hover:bg-zinc-800 transition-colors shadow-sm backdrop-blur"
        title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
      >
        {theme === 'dark' ? (
          <Sun className="w-4 h-4 text-zinc-400" />
        ) : (
          <Moon className="w-4 h-4 text-zinc-600" />
        )}
      </button>

      {/* Content */}
      <div className="relative min-h-screen flex items-center justify-center px-4 py-6">
        <div className="w-full max-w-6xl grid gap-10 lg:grid-cols-[1.1fr_0.9fr] items-center">
          <section className="hidden lg:block">
            <div className="space-y-6">
              <div
                className="inline-flex items-center gap-2 rounded-full border border-zinc-200/70 dark:border-zinc-800 bg-white/70 dark:bg-zinc-900/60 px-3 py-1 text-xs uppercase tracking-[0.2em] text-zinc-500 dark:text-zinc-400 animate-slide-up"
                style={{ animationDelay: '0ms' }}
              >
                <span className="h-2 w-2 rounded-full bg-emerald-500 shadow-glow-success" />
                Enterprise Risk & Compliance Platform
              </div>
              <h1
                className="font-display text-4xl leading-tight text-zinc-900 dark:text-white animate-slide-up"
                style={{ animationDelay: '120ms' }}
              >
                Centralized secret governance for security, risk, and compliance leaders.
              </h1>
              <p
                className="text-lg text-zinc-600 dark:text-zinc-300 max-w-xl animate-slide-up"
                style={{ animationDelay: '220ms' }}
              >
                Consolidate detection, remediation, and policy enforcement in one control plane.
                Maintain continuous visibility with audit-ready records across teams and environments.
              </p>
              <div
                className="grid gap-4 sm:grid-cols-2 animate-slide-up"
                style={{ animationDelay: '320ms' }}
              >
                <div className="rounded-2xl border border-zinc-200/70 dark:border-zinc-800 bg-white/70 dark:bg-zinc-900/60 p-4 shadow-sm backdrop-blur">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-zinc-900 dark:bg-white">
                      <Shield className="h-5 w-5 text-white dark:text-zinc-900" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-zinc-900 dark:text-white">Access Governance</p>
                      <p className="text-sm text-zinc-500 dark:text-zinc-400">Standardize least-privilege access at scale.</p>
                    </div>
                  </div>
                </div>
                <div className="rounded-2xl border border-zinc-200/70 dark:border-zinc-800 bg-white/70 dark:bg-zinc-900/60 p-4 shadow-sm backdrop-blur">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-zinc-900 dark:bg-white">
                      <Lock className="h-5 w-5 text-white dark:text-zinc-900" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-zinc-900 dark:text-white">Control Assurance</p>
                      <p className="text-sm text-zinc-500 dark:text-zinc-400">Demonstrate control health with traceable evidence.</p>
                    </div>
                  </div>
                </div>
              </div>
              <div
                className="flex items-center gap-6 text-sm text-zinc-500 dark:text-zinc-400 animate-slide-up"
                style={{ animationDelay: '420ms' }}
              >
                <span>Audit-ready evidence trails</span>
                <span>Policy-enforced workflows</span>
                <span>Automated credential rotation</span>
              </div>
            </div>
          </section>

          <div className="relative">
            <div className="absolute -inset-4 rounded-[32px] bg-gradient-to-br from-cyan-400/10 via-transparent to-emerald-400/10" />
            <div className="relative bg-white/85 dark:bg-zinc-900/70 rounded-3xl p-6 sm:p-8 border border-zinc-200/80 dark:border-zinc-800 shadow-xl backdrop-blur max-h-[90vh] overflow-y-auto">
              <div className="text-center mb-6 animate-slide-up" style={{ animationDelay: '80ms' }}>
                <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-zinc-900 dark:bg-white mb-4">
                  <Shield className="w-7 h-7 text-white dark:text-zinc-900" />
                </div>
                <h2 className="font-display text-2xl text-zinc-900 dark:text-white">Welcome back</h2>
                <p className="text-sm text-zinc-500 dark:text-zinc-400">
                  Sign in with your organization credentials.
                </p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="animate-slide-up" style={{ animationDelay: '160ms' }}>
                  <label htmlFor="email" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
                    Email address
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-400" />
                    <input
                      id="email"
                      name="email"
                      type="email"
                      autoComplete="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="you@example.com"
                      aria-invalid={Boolean(errors.email)}
                      className={`
                        w-full pl-11 pr-4 py-3 bg-white/80 dark:bg-zinc-800/80 border rounded-xl 
                        text-zinc-900 dark:text-white placeholder-zinc-400 dark:placeholder-zinc-500
                        focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-white focus:border-transparent
                        transition-all
                        ${errors.email ? 'border-red-500' : 'border-zinc-200/80 dark:border-zinc-700'}
                      `}
                    />
                  </div>
                  {errors.email && (
                    <p className="mt-2 text-sm text-red-500" role="alert">
                      {errors.email}
                    </p>
                  )}
                </div>

                <div className="animate-slide-up" style={{ animationDelay: '240ms' }}>
                  <label htmlFor="password" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
                    Password
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-400" />
                    <input
                      id="password"
                      name="password"
                      type={showPassword ? 'text' : 'password'}
                      autoComplete="current-password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Enter your password"
                      aria-invalid={Boolean(errors.password)}
                      className={`
                        w-full pl-11 pr-12 py-3 bg-white/80 dark:bg-zinc-800/80 border rounded-xl 
                        text-zinc-900 dark:text-white placeholder-zinc-400 dark:placeholder-zinc-500
                        focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-white focus:border-transparent
                        transition-all
                        ${errors.password ? 'border-red-500' : 'border-zinc-200/80 dark:border-zinc-700'}
                      `}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors"
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                    >
                      {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                  </div>
                  {errors.password && (
                    <p className="mt-2 text-sm text-red-500" role="alert">
                      {errors.password}
                    </p>
                  )}
                </div>

                <div className="flex items-center justify-between animate-slide-up" style={{ animationDelay: '320ms' }}>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      className="w-4 h-4 rounded border-zinc-300 dark:border-zinc-600 bg-white/80 dark:bg-zinc-800 text-zinc-900 dark:text-white focus:ring-zinc-900 dark:focus:ring-white"
                    />
                    <span className="text-sm text-zinc-600 dark:text-zinc-400">Remember me</span>
                  </label>
                  <Link
                    href="/forgot-password"
                    className="text-sm text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition-colors"
                  >
                    Forgot password?
                  </Link>
                </div>

                <button
                  type="submit"
                  disabled={isLoading}
                  className="
                    w-full py-3 px-4 rounded-xl font-medium
                    bg-zinc-900 dark:bg-white text-white dark:text-zinc-900
                    hover:bg-zinc-800 dark:hover:bg-zinc-100
                    focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-zinc-900 dark:focus:ring-white
                    disabled:opacity-50 disabled:cursor-not-allowed
                    transition-colors flex items-center justify-center gap-2
                  animate-slide-up"
                  style={{ animationDelay: '400ms' }}
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Signing in...
                    </>
                  ) : (
                    'Sign in'
                  )}
                </button>
              </form>

              <div className="text-center mt-3 animate-slide-up" style={{ animationDelay: '440ms' }}>
                <p className="text-sm text-zinc-600 dark:text-zinc-400">
                  Don&apos;t have an account?{' '}
                  <Link
                    href="/register"
                    className="font-semibold text-zinc-900 dark:text-white hover:underline underline-offset-4 transition-colors"
                  >
                    Create an account →
                  </Link>
                </p>
              </div>

              <div className="relative my-5 animate-slide-up" style={{ animationDelay: '480ms' }}>
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-zinc-200/70 dark:border-zinc-700" />
                </div>
                <div className="relative flex justify-center text-sm">
                  <span className="px-4 bg-white/90 dark:bg-zinc-900/80 text-zinc-500">or continue with</span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => {
                  setEmail('demo@vaultsentry.io')
                  setPassword('Demo@2024!')
                }}
                className="w-full mb-4 py-2.5 px-4 bg-emerald-50/80 dark:bg-emerald-900/20 border border-emerald-200/80 dark:border-emerald-800 rounded-xl text-sm font-medium text-emerald-700 dark:text-emerald-400 hover:bg-emerald-100/80 dark:hover:bg-emerald-900/30 transition-colors animate-slide-up"
                style={{ animationDelay: '560ms' }}
              >
                Fill demo credentials (demo@vaultsentry.io / Demo@2024!)
              </button>

              <div className="grid grid-cols-2 gap-3 animate-slide-up" style={{ animationDelay: '640ms' }}>
                <button
                  type="button"
                  onClick={() => handleOAuthLogin('github')}
                  className="flex items-center justify-center gap-2 py-2.5 px-4 bg-zinc-50/80 dark:bg-zinc-800 border border-zinc-200/80 dark:border-zinc-700 rounded-xl text-sm font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100/80 dark:hover:bg-zinc-700 transition-colors"
                >
                  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
                  </svg>
                  GitHub
                </button>
                <button
                  type="button"
                  onClick={() => handleOAuthLogin('google')}
                  className="flex items-center justify-center gap-2 py-2.5 px-4 bg-zinc-50/80 dark:bg-zinc-800 border border-zinc-200/80 dark:border-zinc-700 rounded-xl text-sm font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100/80 dark:hover:bg-zinc-700 transition-colors"
                >
                  <svg className="w-5 h-5" viewBox="0 0 24 24">
                    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                  </svg>
                  Google
                </button>
              </div>
            </div>


          </div>
        </div>
      </div>
    </div>
  )
}
