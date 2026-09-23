import { createContext, useContext, useEffect, useState } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import { useAuth } from './auth'
import { loadStudents } from './data'
import { supabaseConfigured } from './supabase'
import type { Student } from '../types'

const empty: Student[] = []
const Context = createContext({ students: empty, loading: true, error: '' })
export const useKioskRoster = () => useContext(Context)

export default function KioskRoster() {
  const { session, loading: authLoading, signOut } = useAuth()
  const owner = supabaseConfigured ? session?.user.id ?? '' : 'demo'
  const [state, setState] = useState({ owner: '', students: empty, loading: true, error: '' })
  const { pathname } = useLocation()
  useEffect(() => {
    if (!supabaseConfigured || !session) return
    const timeoutMs = 15 * 60 * 1000
    let timer = window.setTimeout(() => { void signOut() }, timeoutMs)
    const reset = () => { window.clearTimeout(timer); timer = window.setTimeout(() => { void signOut() }, timeoutMs) }
    const events = ['pointerdown', 'keydown', 'touchstart'] as const
    events.forEach(event => window.addEventListener(event, reset, { passive: true }))
    return () => { window.clearTimeout(timer); events.forEach(event => window.removeEventListener(event, reset)) }
  }, [session, signOut])
  useEffect(() => {
    if (authLoading || !owner) return
    let active = true
    let busy = false
    async function refresh() {
      if (busy || !active) return
      busy = true
      try {
        const result = await loadStudents()
        if (active) setState({ owner, students: result.students, loading: false, error: result.error ?? '' })
      } catch {
        if (active) setState({ owner, students: empty, loading: false, error: 'Couldn’t load our friends. Please try again.' })
      } finally { busy = false }
    }
    const onReturn = () => { if (document.visibilityState === 'visible') void refresh() }
    void refresh()
    const interval = window.setInterval(onReturn, 15000)
    window.addEventListener('focus', onReturn)
    document.addEventListener('visibilitychange', onReturn)
    return () => { active = false; clearInterval(interval); window.removeEventListener('focus', onReturn); document.removeEventListener('visibilitychange', onReturn) }
  }, [owner, authLoading, pathname === '/checkin'])
  const value = owner && state.owner === owner ? state : { students: empty, loading: authLoading || Boolean(owner), error: '' }
  return <Context.Provider value={value}><Outlet /></Context.Provider>
}
