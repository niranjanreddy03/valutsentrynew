'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Shield, Mail, Lock, Eye, EyeOff, Loader2, User, Check, Moon, Sun, ArrowLeft, KeyRound } from 'lucide-react'
import { useToast } from '@/contexts/ToastContext'
import { useTheme } from '@/contexts/ThemeContext'
import { useAuth } from '@/contexts/AuthContext'

type Step = 'register' | 'verify'

export default function RegisterPage() {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [agreeTerms, setAgreeTerms] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [errors, setErrors] = useState<{ name?: string; email?: string; password?: string; confirmPassword?: string }>({})
  const [step, setStep] = useState<Step>('register')
  const [otp, setOtp] = useState(['', '', '', '', '', ''])
  const [resendCooldown, setResendCooldown] = useState(0)
  const otpRefs = useRef<(HTMLInputElement | null)[]>([])
  const router = useRouter()
  const toast = useToast()
  const { theme, toggleTheme } = useTheme()
  const { register, verifyOtp, resendOtp, loginWithOAuth, isAuthenticated } = useAuth()

  useEffect(() => {
    if (isAuthenticated) {
      // If user just registered (flag set), send to choose-plan
      const isNewUser = localStorage.getItem('vs_new_user') === 'true'
      if (isNewUser) {
        router.push('/choose-plan')
      } else {
        router.push('/')
      }
    }
  }, [isAuthenticated, router])

  // Countdown timer for resend
  useEffect(() => {
    if (resendCooldown > 0) {
      const timer = setTimeout(() => setResendCooldown(resendCooldown - 1), 1000)
      return () => clearTimeout(timer)
    }
  }, [resendCooldown])

  const passwordRequirements = [
    { label: '8+ chars', met: password.length >= 8 },
    { label: 'Uppercase', met: /[A-Z]/.test(password) },
    { label: 'Lowercase', met: /[a-z]/.test(password) },
    { label: 'Number', met: /\d/.test(password) },
  ]

  const validate = () => {
    const newErrors: typeof errors = {}
    if (!name) newErrors.name = 'Name is required'
    if (!email) {
      newErrors.email = 'Email is required'
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      newErrors.email = 'Invalid email format'
    }
    if (!password) {
      newErrors.password = 'Password is required'
    } else if (!passwordRequirements.every(r => r.met)) {
      newErrors.password = 'Password does not meet requirements'
    }
    if (password !== confirmPassword) {
      newErrors.confirmPassword = 'Passwords do not match'
    }
    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!validate()) return
    if (!agreeTerms) {
      toast.error('Terms required', 'Please agree to the terms and conditions')
      return
    }

    setIsLoading(true)
    try {
      await register(email, password, name)
      toast.success('Verification code sent!', `We sent a 6-digit code to ${email}`)
      setStep('verify')
      setResendCooldown(60)
      // Focus first OTP input
      setTimeout(() => otpRefs.current[0]?.focus(), 100)
    } catch (error: any) {
      toast.error('Registration failed', error.message || 'Please try again')
    } finally {
      setIsLoading(false)
    }
  }

  const handleOtpChange = (index: number, value: string) => {
    // Only allow digits
    const digit = value.replace(/\D/g, '').slice(-1)
    const newOtp = [...otp]
    newOtp[index] = digit
    setOtp(newOtp)

    // Auto-focus next input
    if (digit && index < 5) {
      otpRefs.current[index + 1]?.focus()
    }
  }

  const handleOtpKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      otpRefs.current[index - 1]?.focus()
    }
  }

  const handleOtpPaste = (e: React.ClipboardEvent) => {
    e.preventDefault()
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6)
    if (pasted.length > 0) {
      const newOtp = [...otp]
      for (let i = 0; i < pasted.length && i < 6; i++) {
        newOtp[i] = pasted[i]
      }
      setOtp(newOtp)
      const focusIndex = Math.min(pasted.length, 5)
      otpRefs.current[focusIndex]?.focus()
    }
  }

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault()
    const code = otp.join('')
    if (code.length !== 6) {
      toast.error('Invalid code', 'Please enter the full 6-digit code')
      return
    }

    setIsLoading(true)
    try {
      await verifyOtp(email, code)
      toast.success('Account verified!', 'Welcome to VaultSentry!')
      // Mark as new user so they see the plan selection page
      localStorage.setItem('vs_new_user', 'true')
      router.push('/choose-plan')
    } catch (error: any) {
      toast.error('Verification failed', error.message || 'Invalid or expired code')
      setOtp(['', '', '', '', '', ''])
      otpRefs.current[0]?.focus()
    } finally {
      setIsLoading(false)
    }
  }

  const handleResendOtp = async () => {
    if (resendCooldown > 0) return
    try {
      await resendOtp(email)
      toast.success('Code resent', `A new code was sent to ${email}`)
      setResendCooldown(60)
      setOtp(['', '', '', '', '', ''])
      otpRefs.current[0]?.focus()
    } catch (error: any) {
      toast.error('Resend failed', error.message || 'Please try again')
    }
  }

  const handleOAuthLogin = async (provider: 'github' | 'google') => {
    try {
      await loginWithOAuth(provider)
    } catch (error: any) {
      toast.error('Registration failed', error.message || 'OAuth registration failed')
    }
  }

  return (
    <div className="min-h-screen bg-zinc-100 dark:bg-zinc-950">
      {/* Theme Toggle */}
      <button
        onClick={toggleTheme}
        className="fixed top-4 right-4 z-50 p-2.5 rounded-lg bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors shadow-sm"
        title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
      >
        {theme === 'dark' ? (
          <Sun className="w-4 h-4 text-zinc-400" />
        ) : (
          <Moon className="w-4 h-4 text-zinc-600" />
        )}
      </button>

      {/* Content */}
      <div className="min-h-screen flex items-center justify-center p-4 py-8">
        <div className="w-full max-w-md">
          {/* Logo */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-xl bg-zinc-900 dark:bg-white mb-4">
              <Shield className="w-7 h-7 text-white dark:text-zinc-900" />
            </div>
            {step === 'register' ? (
              <>
                <h1 className="text-2xl font-semibold text-zinc-900 dark:text-white mb-1">
                  Create your account
                </h1>
                <p className="text-zinc-500 dark:text-zinc-400">
                  Start scanning your code for secrets today
                </p>
              </>
            ) : (
              <>
                <h1 className="text-2xl font-semibold text-zinc-900 dark:text-white mb-1">
                  Verify your email
                </h1>
                <p className="text-zinc-500 dark:text-zinc-400">
                  Enter the 6-digit code sent to <strong className="text-zinc-700 dark:text-zinc-200">{email}</strong>
                </p>
              </>
            )}
          </div>

          {/* Form Card */}
          <div className="bg-white dark:bg-zinc-900 rounded-xl p-6 sm:p-8 border border-zinc-200 dark:border-zinc-800 shadow-sm">
            
            {step === 'register' ? (
              <>
                <form onSubmit={handleSubmit} className="space-y-4">
                  {/* Name */}
                  <div>
                    <label htmlFor="name" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
                      Full name
                    </label>
                    <div className="relative">
                      <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-400" />
                      <input
                        id="name"
                        type="text"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="John Doe"
                        className={`
                          w-full pl-11 pr-4 py-3 bg-zinc-50 dark:bg-zinc-800 border rounded-lg 
                          text-zinc-900 dark:text-white placeholder-zinc-400 dark:placeholder-zinc-500
                          focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-white focus:border-transparent
                          transition-all
                          ${errors.name ? 'border-red-500' : 'border-zinc-200 dark:border-zinc-700'}
                        `}
                      />
                    </div>
                    {errors.name && <p className="mt-2 text-sm text-red-500">{errors.name}</p>}
                  </div>

                  {/* Email */}
                  <div>
                    <label htmlFor="email" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
                      Email address
                    </label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-400" />
                      <input
                        id="email"
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="you@example.com"
                        className={`
                          w-full pl-11 pr-4 py-3 bg-zinc-50 dark:bg-zinc-800 border rounded-lg 
                          text-zinc-900 dark:text-white placeholder-zinc-400 dark:placeholder-zinc-500
                          focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-white focus:border-transparent
                          transition-all
                          ${errors.email ? 'border-red-500' : 'border-zinc-200 dark:border-zinc-700'}
                        `}
                      />
                    </div>
                    {errors.email && <p className="mt-2 text-sm text-red-500">{errors.email}</p>}
                  </div>

                  {/* Password */}
                  <div>
                    <label htmlFor="password" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
                      Password
                    </label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-400" />
                      <input
                        id="password"
                        type={showPassword ? 'text' : 'password'}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="Create a strong password"
                        className={`
                          w-full pl-11 pr-12 py-3 bg-zinc-50 dark:bg-zinc-800 border rounded-lg 
                          text-zinc-900 dark:text-white placeholder-zinc-400 dark:placeholder-zinc-500
                          focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-white focus:border-transparent
                          transition-all
                          ${errors.password ? 'border-red-500' : 'border-zinc-200 dark:border-zinc-700'}
                        `}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors"
                      >
                        {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                      </button>
                    </div>
                    
                    {/* Password Requirements */}
                    <div className="mt-3 flex flex-wrap gap-2">
                      {passwordRequirements.map((req, i) => (
                        <div 
                          key={i} 
                          className={`flex items-center gap-1 px-2 py-1 rounded text-xs transition-all ${
                            req.met 
                              ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400' 
                              : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-500'
                          }`}
                        >
                          <Check className={`w-3 h-3 ${req.met ? 'opacity-100' : 'opacity-40'}`} />
                          {req.label}
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Confirm Password */}
                  <div>
                    <label htmlFor="confirmPassword" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
                      Confirm password
                    </label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-400" />
                      <input
                        id="confirmPassword"
                        type={showPassword ? 'text' : 'password'}
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder="Confirm your password"
                        className={`
                          w-full pl-11 pr-4 py-3 bg-zinc-50 dark:bg-zinc-800 border rounded-lg 
                          text-zinc-900 dark:text-white placeholder-zinc-400 dark:placeholder-zinc-500
                          focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-white focus:border-transparent
                          transition-all
                          ${errors.confirmPassword ? 'border-red-500' : 'border-zinc-200 dark:border-zinc-700'}
                        `}
                      />
                    </div>
                    {errors.confirmPassword && <p className="mt-2 text-sm text-red-500">{errors.confirmPassword}</p>}
                  </div>

                  {/* Terms */}
                  <div className="flex items-start gap-3 pt-2">
                    <input
                      type="checkbox"
                      id="terms"
                      checked={agreeTerms}
                      onChange={(e) => setAgreeTerms(e.target.checked)}
                      className="mt-0.5 w-4 h-4 rounded border-zinc-300 dark:border-zinc-600 bg-zinc-50 dark:bg-zinc-800 text-zinc-900 focus:ring-zinc-900 dark:focus:ring-white"
                    />
                    <label htmlFor="terms" className="text-sm text-zinc-600 dark:text-zinc-400 leading-tight">
                      I agree to the{' '}
                      <Link href="/terms" className="text-zinc-900 dark:text-white hover:underline">Terms of Service</Link>
                      {' '}and{' '}
                      <Link href="/privacy" className="text-zinc-900 dark:text-white hover:underline">Privacy Policy</Link>
                    </label>
                  </div>

                  {/* Submit Button */}
                  <button
                    type="submit"
                    disabled={isLoading}
                    className="
                      w-full py-3 px-4 rounded-lg font-medium mt-2
                      bg-zinc-900 dark:bg-white text-white dark:text-zinc-900
                      hover:bg-zinc-800 dark:hover:bg-zinc-100
                      focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-zinc-900 dark:focus:ring-white
                      disabled:opacity-50 disabled:cursor-not-allowed
                      transition-colors flex items-center justify-center gap-2
                    "
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="w-5 h-5 animate-spin" />
                        Creating account...
                      </>
                    ) : (
                      'Create account'
                    )}
                  </button>
                </form>

                {/* Divider */}
                <div className="relative my-6">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-zinc-200 dark:border-zinc-700" />
                  </div>
                  <div className="relative flex justify-center text-sm">
                    <span className="px-4 bg-white dark:bg-zinc-900 text-zinc-500">or continue with</span>
                  </div>
                </div>

                {/* OAuth Buttons */}
                <div className="grid grid-cols-2 gap-3">
                  <button 
                    type="button"
                    onClick={() => handleOAuthLogin('github')}
                    className="flex items-center justify-center gap-2 py-2.5 px-4 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg text-sm font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-700 transition-colors"
                  >
                    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
                    </svg>
                    GitHub
                  </button>
                  <button 
                    type="button"
                    onClick={() => handleOAuthLogin('google')}
                    className="flex items-center justify-center gap-2 py-2.5 px-4 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg text-sm font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-700 transition-colors"
                  >
                    <svg className="w-5 h-5" viewBox="0 0 24 24">
                      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                    </svg>
                    Google
                  </button>
                </div>
              </>
            ) : (
              /* ─── OTP Verification Step ─── */
              <form onSubmit={handleVerifyOtp} className="space-y-6">
                {/* OTP Icon */}
                <div className="flex justify-center">
                  <div className="w-16 h-16 rounded-2xl bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
                    <KeyRound className="w-8 h-8 text-emerald-600 dark:text-emerald-400" />
                  </div>
                </div>

                {/* OTP Inputs */}
                <div className="flex justify-center gap-3" onPaste={handleOtpPaste}>
                  {otp.map((digit, i) => (
                    <input
                      key={i}
                      ref={(el) => { otpRefs.current[i] = el }}
                      type="text"
                      inputMode="numeric"
                      maxLength={1}
                      value={digit}
                      onChange={(e) => handleOtpChange(i, e.target.value)}
                      onKeyDown={(e) => handleOtpKeyDown(i, e)}
                      className={`
                        w-12 h-14 text-center text-xl font-bold rounded-lg border-2
                        bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-white
                        focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-white focus:border-transparent
                        transition-all
                        ${digit ? 'border-emerald-500 dark:border-emerald-400' : 'border-zinc-200 dark:border-zinc-700'}
                      `}
                    />
                  ))}
                </div>

                {/* Timer & Resend */}
                <div className="text-center text-sm text-zinc-500 dark:text-zinc-400">
                  {resendCooldown > 0 ? (
                    <p>Resend code in <span className="font-medium text-zinc-900 dark:text-white">{resendCooldown}s</span></p>
                  ) : (
                    <p>
                      Didn&apos;t receive the code?{' '}
                      <button
                        type="button"
                        onClick={handleResendOtp}
                        className="font-medium text-zinc-900 dark:text-white hover:underline"
                      >
                        Resend
                      </button>
                    </p>
                  )}
                </div>

                {/* Verify Button */}
                <button
                  type="submit"
                  disabled={isLoading || otp.join('').length !== 6}
                  className="
                    w-full py-3 px-4 rounded-lg font-medium
                    bg-zinc-900 dark:bg-white text-white dark:text-zinc-900
                    hover:bg-zinc-800 dark:hover:bg-zinc-100
                    focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-zinc-900 dark:focus:ring-white
                    disabled:opacity-50 disabled:cursor-not-allowed
                    transition-colors flex items-center justify-center gap-2
                  "
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Verifying...
                    </>
                  ) : (
                    'Verify & Create Account'
                  )}
                </button>

                {/* Back Button */}
                <button
                  type="button"
                  onClick={() => { setStep('register'); setOtp(['', '', '', '', '', '']) }}
                  className="w-full flex items-center justify-center gap-2 text-sm text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition-colors"
                >
                  <ArrowLeft className="w-4 h-4" />
                  Back to registration
                </button>
              </form>
            )}
          </div>

          {/* Sign In Link */}
          <p className="mt-6 text-center text-zinc-600 dark:text-zinc-400">
            Already have an account?{' '}
            <Link href="/login" className="font-medium text-zinc-900 dark:text-white hover:underline">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
