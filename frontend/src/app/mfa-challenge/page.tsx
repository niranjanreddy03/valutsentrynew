'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ShieldCheck, ArrowLeft } from 'lucide-react'
import { supabase } from '@/services/supabase'
import { useToast } from '@/contexts/ToastContext'
import { AuthLayout, AuthCard, AuthButton, OtpInput } from '@/components/auth'

/**
 * MFA challenge — shown after signInWithPassword when the user has a verified
 * TOTP factor but the session is still at AAL1. Verifying lifts it to AAL2
 * and lets the user into the app.
 */
export default function MfaChallengePage() {
  const router = useRouter()
  const { showToast } = useToast()

  const [factorId, setFactorId] = useState<string | null>(null)
  const [code, setCode] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [initializing, setInitializing] = useState(true)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        // Must be signed in (AAL1) to reach this screen.
        const { data: sessionData } = await supabase.auth.getSession()
        if (!sessionData.session) {
          router.replace('/login')
          return
        }

        const { data, error: listErr } = await supabase.auth.mfa.listFactors()
        if (listErr) throw listErr
        if (cancelled) return

        const verified = data?.totp?.find((f: any) => f.status === 'verified')
        if (!verified) {
          // No verified factor — nothing to challenge. Send them to the app.
          router.replace('/')
          return
        }
        setFactorId(verified.id)
      } catch (err: any) {
        setError(err?.message || 'Could not load MFA state.')
      } finally {
        if (!cancelled) setInitializing(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [router])

  const handleVerify = async (value?: string) => {
    const v = value ?? code
    if (v.length !== 6 || !factorId) return
    setError(null)
    setLoading(true)
    try {
      const { data: challenge, error: challengeErr } =
        await supabase.auth.mfa.challenge({ factorId })
      if (challengeErr) throw challengeErr

      const { error: verifyErr } = await supabase.auth.mfa.verify({
        factorId,
        challengeId: challenge.id,
        code: v,
      })
      if (verifyErr) throw verifyErr

      showToast('Signed in', 'success')
      router.replace('/')
    } catch (err: any) {
      setError(err?.message || 'Invalid code. Please try again.')
      setCode('')
    } finally {
      setLoading(false)
    }
  }

  const cancel = async () => {
    await supabase.auth.signOut()
    router.replace('/login')
  }

  return (
    <AuthLayout>
      <AuthCard
        title="Two-factor authentication"
        subtitle="Open your authenticator app and enter the 6-digit code for VaultSentry."
      >
        <div className="flex flex-col items-center gap-5">
          <div className="flex h-14 w-14 items-center justify-center rounded-full border border-cyber-cyan/30 bg-cyber-cyan/10">
            <ShieldCheck className="h-7 w-7 text-cyber-cyan" />
          </div>

          <OtpInput
            value={code}
            onChange={setCode}
            onComplete={(v) => handleVerify(v)}
            error={!!error}
            disabled={loading || initializing}
          />

          {error && (
            <div className="w-full rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-300">
              {error}
            </div>
          )}

          <AuthButton
            type="button"
            loading={loading}
            disabled={code.length !== 6 || initializing}
            onClick={() => handleVerify()}
          >
            Verify and continue
          </AuthButton>

          <button
            type="button"
            onClick={cancel}
            className="inline-flex items-center gap-1.5 text-xs text-slate-400 transition-colors hover:text-slate-200"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Cancel and sign out
          </button>
        </div>
      </AuthCard>
    </AuthLayout>
  )
}
