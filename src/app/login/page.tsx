'use client'

import { createClient } from '@/lib/supabase/browser'
import { useState } from 'react'
import { RiGoogleFill, RiMailLine, RiLockLine } from '@remixicon/react'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [magicSent, setMagicSent] = useState(false)
  const [mode, setMode] = useState<'password' | 'magic'>('password')

  const supabase = createClient()

  async function handlePasswordLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      setError(error.message)
      setLoading(false)
    } else {
      window.location.href = '/'
    }
  }

  async function handleMagicLink(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
    })

    if (error) {
      setError(error.message)
    } else {
      setMagicSent(true)
    }
    setLoading(false)
  }

  async function handleGoogleLogin() {
    setLoading(true)
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    })
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--background)]">
      <div className="w-full max-w-sm px-6">
        {/* Logo / Brand */}
        <div className="mb-8 text-center">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-[var(--primary)] mb-4">
            <span className="text-white font-bold text-lg">T</span>
          </div>
          <h1 className="text-title-h2 text-[var(--foreground)]">Twibbonize CRM</h1>
          <p className="text-sm text-[var(--foreground-subtle)] mt-1">Sign in to your workspace</p>
        </div>

        {magicSent ? (
          <div className="rounded-xl border border-[var(--border)] bg-background p-6 text-center">
            <p className="text-[var(--foreground)] font-medium">Check your email ✉️</p>
            <p className="text-sm text-[var(--foreground-subtle)] mt-1">
              We sent a magic link to <strong>{email}</strong>
            </p>
          </div>
        ) : (
          <div className="rounded-xl border border-[var(--border)] bg-background p-6 space-y-4">
            {/* Google */}
            <button
              onClick={handleGoogleLogin}
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 rounded-full border border-[var(--border)] bg-white py-2.5 text-sm font-medium text-[var(--foreground)] hover:bg-background-subtle transition-colors disabled:opacity-50"
            >
              <RiGoogleFill className="w-4 h-4" />
              Continue with Google
            </button>

            <div className="flex items-center gap-3">
              <div className="flex-1 h-px bg-[var(--border)]" />
              <span className="text-xs text-[var(--foreground-subtle)]">or</span>
              <div className="flex-1 h-px bg-[var(--border)]" />
            </div>

            {/* Email form */}
            <form onSubmit={mode === 'password' ? handlePasswordLogin : handleMagicLink} className="space-y-3">
              <div className="relative">
                <RiMailLine className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--foreground-subtle)]" />
                <input
                  type="email"
                  placeholder="you@twibbonize.com"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  required
                  className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] pl-9 pr-3 py-2.5 text-sm text-[var(--foreground)] placeholder:text-[var(--foreground-subtle)] focus:outline-none focus:ring-2 focus:ring-[var(--ring)]"
                />
              </div>

              {mode === 'password' && (
                <div className="relative">
                  <RiLockLine className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--foreground-subtle)]" />
                  <input
                    type="password"
                    placeholder="Password"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    required
                    className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] pl-9 pr-3 py-2.5 text-sm text-[var(--foreground)] placeholder:text-[var(--foreground-subtle)] focus:outline-none focus:ring-2 focus:ring-[var(--ring)]"
                  />
                </div>
              )}

              {error && (
                <p className="text-xs text-[var(--destructive)]">{error}</p>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-full bg-[var(--primary)] py-2.5 text-sm font-semibold text-white hover:bg-[var(--primary-hover)] transition-colors disabled:opacity-50"
              >
                {loading ? 'Signing in…' : mode === 'password' ? 'Sign in' : 'Send magic link'}
              </button>
            </form>

            <button
              type="button"
              onClick={() => setMode(m => m === 'password' ? 'magic' : 'password')}
              className="w-full text-center text-xs text-[var(--foreground-subtle)] hover:text-[var(--foreground)] transition-colors"
            >
              {mode === 'password' ? 'Sign in with magic link instead' : 'Sign in with password instead'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
