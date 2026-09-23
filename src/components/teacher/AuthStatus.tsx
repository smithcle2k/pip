import { useRef, useState } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../../lib/auth'
import { safeTeacherReturn } from '../../lib/authHelpers'
import { authCallback } from '../../lib/supabase'

export function SignOutButton() {
  const { signOut } = useAuth()
  const navigate = useNavigate()
  const [pending, setPending] = useState(false)
  const [error, setError] = useState('')
  const locked = useRef(false)
  return <div><button disabled={pending} className="mt-5 rounded-xl bg-teal px-5 py-3 font-bold text-white disabled:opacity-60" onClick={async () => {
    if (locked.current) return
    locked.current = true; setPending(true); setError('')
    try { await signOut(); navigate('/teacher/login', { replace: true }) } catch { setError('Couldn’t sign out. Check your connection and try again.') } finally { locked.current = false; setPending(false) }
  }}>{pending ? 'Signing out…' : 'Sign Out'}</button>{error && <p role="alert">{error}</p>}</div>
}

/** Shared decisions for public auth forms, callback, setup, and protected routes. */
export default function AuthStatus({ mode = 'public' }: { mode?: 'public' | 'protected' | 'setup' | 'callback' }) {
  const { session, loading, readiness, error, callbackError: callbackFailed, recovery, retry, dismissCallback } = useAuth()
  const callbackError = callbackFailed || (mode === 'callback' && !authCallback.present)
  const location = useLocation()
  if (loading) return <p role="status">Checking teacher sign-in…</p>
  if (callbackError) return <section className="rounded-2xl bg-white p-8"><h1 className="text-3xl font-extrabold">This link couldn’t be verified</h1><p role="alert">The link may be invalid, expired, or already used. Please sign in, or check your inbox for a newer confirmation link.</p><button className="mt-5 rounded-xl bg-teal p-3 text-white" onClick={() => { dismissCallback(); window.location.replace('/teacher/login') }}>Back to Sign In</button></section>
  if (error) return <div role="alert">{error}<button className="block rounded-xl bg-teal p-3 text-white" onClick={() => window.location.reload()}>Reload</button></div>
  if (recovery) return <Navigate to="/teacher/reset-password" replace />
  if (!session) return mode === 'public' ? null : <Navigate to="/teacher/login" replace state={{ from: safeTeacherReturn(location.pathname) }} />
  if (readiness.status === 'loading') return <p role="status">Loading your classroom…</p>
  if (readiness.status === 'error' || readiness.status === 'multiple') return <section className="rounded-2xl bg-white p-8"><h1 className="text-2xl font-extrabold">{readiness.status === 'multiple' ? 'More than one classroom found' : 'Couldn’t load your classroom'}</h1><p role="alert">{readiness.status === 'multiple' ? 'Pip currently supports one classroom per teacher. Please contact your school’s Pip administrator for help.' : 'Your saved setup has not been changed. Please try again.'}</p><button className="mt-4 rounded-xl bg-teal p-3 text-white" onClick={retry}>Try again</button><SignOutButton /></section>
  if (readiness.status === 'ready') return mode === 'protected' ? null : <Navigate to={safeTeacherReturn((location.state as { from?: unknown } | null)?.from)} replace />
  return mode === 'setup' ? null : <Navigate to="/teacher/setup" replace />
}
