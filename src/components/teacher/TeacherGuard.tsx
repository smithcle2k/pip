import { Outlet } from 'react-router-dom'
import { useAuth } from '../../lib/auth'
import { demoMode } from '../../lib/supabase'
import AuthStatus from './AuthStatus'

export default function TeacherGuard() {
  const auth = useAuth()
  if (demoMode) return <Outlet />
  if (!auth.loading && auth.session && !auth.error && !auth.callbackError && !auth.recovery && auth.readiness.status === 'ready') return <Outlet key={auth.session.user.id} />
  return <AuthStatus mode="protected" />
}
