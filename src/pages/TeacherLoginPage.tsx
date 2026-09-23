import { FormEvent, useEffect, useRef, useState } from 'react'
import { Sprout } from 'lucide-react'
import { Link } from 'react-router-dom'
import AuthStatus from '../components/teacher/AuthStatus'
import { authErrorMessage, withAuthTimeout } from '../lib/authHelpers'
import { useAuth } from '../lib/auth'
import { getSupabaseSetupMessage, supabase, supabaseConfigured } from '../lib/supabase'

export default function TeacherLoginPage() {
  const auth = useAuth()
  const { session, loading } = auth
  const [pending, setPending] = useState(false)
  const locked = useRef(false)
  const active = useRef(true)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const headingRef = useRef<HTMLHeadingElement>(null)
  useEffect(() => { document.title = 'Teacher sign in · Pip' }, [])
  useEffect(() => { active.current = true; return () => { active.current = false } }, [])
  useEffect(() => { if (!loading) headingRef.current?.focus() }, [loading])
  if (loading || session || auth.error || auth.callbackError || auth.recovery) return <AuthStatus />

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (locked.current) return
    setError('')
    if (!supabaseConfigured || !supabase) { setError(getSupabaseSetupMessage()); return }
    locked.current = true; setPending(true)
    try {
      const result = await withAuthTimeout(supabase.auth.signInWithPassword({ email: email.trim(), password }))
      if (active.current && result.error) setError(authErrorMessage(result.error))
    } catch (failure) { if (active.current) setError(authErrorMessage(failure)) }
    finally { locked.current = false; if (active.current) setPending(false) }
  }
  return <div className="mx-auto w-full max-w-md rounded-[2rem] bg-white p-7 shadow-xl sm:p-10">
    <div className="mb-7 flex items-center gap-2 text-teal"><Sprout size={28} aria-hidden="true" /><span className="text-3xl font-extrabold">pip</span></div>
    <h1 ref={headingRef} className="page-heading text-3xl font-extrabold text-ink" tabIndex={-1}>Teacher sign in</h1>
    <p className="mt-2 font-semibold text-muted">Sign in to see your classroom check-ins.</p>
    <form onSubmit={submit} className="mt-7 space-y-5" aria-busy={pending}>
      <fieldset disabled={pending} className="space-y-5">
      <label className="block font-bold text-ink">Email<input required type="email" autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} className="mt-2 w-full rounded-xl border-2 border-[#d9e3e2] px-4 py-3 text-base" /></label>
      <label className="block font-bold text-ink">Password<input required type="password" autoComplete="current-password" value={password} onChange={e => setPassword(e.target.value)} className="mt-2 w-full rounded-xl border-2 border-[#d9e3e2] px-4 py-3 text-base" /></label>
      <Link to="/teacher/forgot-password" className="block text-right font-bold text-teal">Forgot password?</Link>
      {error && <p role="alert" className="rounded-xl bg-[#fff0ef] px-4 py-3 font-bold text-coral">{error}</p>}
      <button type="submit" className="min-h-14 w-full rounded-xl bg-teal px-5 py-3.5 font-extrabold text-white transition-transform active:translate-y-1">{pending ? 'Signing in…' : 'Sign in'}</button>
      </fieldset>{pending && <p role="status">Signing in…</p>}
    </form>
    <p className="mt-5">New to Pip? <Link to="/teacher/signup" className="font-bold text-teal">Create your teacher account</Link></p>
  </div>
}
