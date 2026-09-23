import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { authCallback, cleanAuthUrl, supabase, supabaseConfigured } from './supabase'
import { authErrorMessage, withAuthTimeout } from './authHelpers'

export type Readiness = { status: 'loading' | 'signed-out' | 'error' | 'no-classroom' | 'incomplete' | 'ready' | 'multiple'; firstName?: string; classroomId?: string }
type AuthContextValue = { session: Session | null; loading: boolean; readiness: Readiness; error: string; callbackError: boolean; recovery: boolean; signOut: () => Promise<void>; resetPassword: (password: string) => Promise<void>; retry: () => void; dismissCallback: () => void }
const AuthContext = createContext<AuthContextValue | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(supabaseConfigured)
  const [error, setError] = useState('')
  const [callbackError, setCallbackError] = useState(false)
  const [recovery, setRecovery] = useState(false)
  const [readiness, setReadiness] = useState<Readiness>({ status: 'loading' })
  const [revision, setRevision] = useState(0)
  const generation = useRef(0)

  useEffect(() => {
    const client = supabase
    if (!client) { cleanAuthUrl(); setReadiness({ status: 'signed-out' }); return }
    let active = true
    let initialized = false
    let eventVersion = 0
    let latest: Session | null = null
    const accept = (next: Session | null) => {
      generation.current++
      setReadiness({ status: next ? 'loading' : 'signed-out' })
      setSession(next)
    }
    const { data: listener } = client.auth.onAuthStateChange((event, next) => {
      if (!active) return
      if (event === 'PASSWORD_RECOVERY' && next) setRecovery(true)
      if (event === 'SIGNED_OUT') setRecovery(false)
      if (event !== 'INITIAL_SESSION') { eventVersion++; latest = next }
      if (initialized) { accept(next); setRevision(value => value + 1) }
    })
    void (async () => {
      try {
        // Cached automatic SDK initialization: never manually exchange a callback.
        const result = await withAuthTimeout(client.auth.initialize())
        if (!active) return
        const invalid = authCallback.present && (Boolean(result.error) || authCallback.error || !authCallback.implicit)
        setCallbackError(invalid)
        if (result.error && !authCallback.present) throw result.error
        if (!invalid && authCallback.recovery && authCallback.implicit) setRecovery(true)
        const version = eventVersion
        const restored = await withAuthTimeout(client.auth.getSession())
        if (!active) return
        if (restored.error) throw restored.error
        initialized = true
        accept(version === eventVersion ? restored.data.session : latest)
      } catch {
        if (active) { setError('We couldn’t restore your sign-in. Reload this page to try again.'); setCallbackError(authCallback.present); setReadiness({ status: 'error' }) }
      } finally { cleanAuthUrl(); if (active) setLoading(false) }
    })()
    return () => { active = false; generation.current++; listener.subscription.unsubscribe() }
  }, [])

  useEffect(() => {
    if (loading || !session || !supabase || error) return
    const client = supabase
    const current = ++generation.current
    setReadiness({ status: 'loading' })
    void (async () => {
      try {
        const profile = await withAuthTimeout(client.rpc('bootstrap_teacher_profile'))
        if (current !== generation.current) return
        if (profile.error) throw profile.error
        const saved = Array.isArray(profile.data) ? profile.data[0] : profile.data
        if (!saved || saved.id !== session.user.id || typeof saved.first_name !== 'string' || !('onboarding_completed_at' in saved)) throw new Error('Invalid profile')
        const memberships = await withAuthTimeout(client.from('classroom_teachers').select('classroom_id').eq('teacher_id', session.user.id))
        if (current !== generation.current) return
        if (memberships.error || !memberships.data) throw new Error('Membership unavailable')
        const rows = memberships.data
        setReadiness({ status: rows.length > 1 ? 'multiple' : rows.length === 0 ? 'no-classroom' : saved.onboarding_completed_at ? 'ready' : 'incomplete', firstName: saved.first_name, classroomId: rows.length === 1 ? rows[0].classroom_id : undefined })
      } catch { if (current === generation.current) setReadiness({ status: 'error' }) }
    })()
    return () => { generation.current++ }
  }, [session, loading, revision, error])
  async function signOut() {
    if (!supabase) return
    const result = await withAuthTimeout(supabase.auth.signOut())
    if (result.error) throw new Error(authErrorMessage(result.error))
    generation.current++; setSession(null); setReadiness({ status: 'signed-out' }); setRecovery(false); setCallbackError(false)
  }
  async function resetPassword(password: string) { if (!supabase || !session || !recovery) throw new Error('recovery_invalid'); const result = await withAuthTimeout(supabase.auth.updateUser({ password })); if (result.error) throw new Error(authErrorMessage(result.error)); setRecovery(false) }
  return <AuthContext.Provider value={{ session, loading, readiness, error, callbackError, recovery, signOut, resetPassword, retry: () => setRevision(value => value + 1), dismissCallback: () => setCallbackError(false) }}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used inside AuthProvider')
  return context
}
