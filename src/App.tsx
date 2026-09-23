import { Sprout } from 'lucide-react'
import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { lazy, Suspense, type ReactNode } from 'react'
import { Analytics } from '@vercel/analytics/react'
const StudentSelectPage = lazy(() => import('./pages/StudentSelectPage'))
const EmotionCheckInPage = lazy(() => import('./pages/EmotionCheckInPage'))
const CheckInCompletePage = lazy(() => import('./pages/CheckInCompletePage'))
const TeacherDashboardPage = lazy(() => import('./pages/TeacherDashboardPage'))
const TeacherLoginPage = lazy(() => import('./pages/TeacherLoginPage'))
const StudentSupportPage = lazy(() => import('./pages/StudentSupportPage'))
import TeacherGuard from './components/teacher/TeacherGuard'
import { AuthProvider, useAuth } from './lib/auth'
import { demoMode, supabaseConfigured } from './lib/supabase'
const TeacherSignupPage = lazy(() => import('./pages/TeacherSignupPage'))
const TeacherSetupPage = lazy(() => import('./pages/TeacherSetupPage'))
const TeacherResetPasswordPage = lazy(() => import('./pages/TeacherResetPasswordPage'))
const TeacherForgotPasswordPage = lazy(() => import('./pages/TeacherForgotPasswordPage'))
import AuthStatus from './components/teacher/AuthStatus'
const ManageStudentsPage = lazy(() => import('./pages/ManageStudentsPage'))
import KioskRoster from './lib/KioskRoster'

function AuthBoundary({ children }: { children: ReactNode }) {
  const auth = useAuth()
  const location = useLocation()
  if (location.pathname === '/teacher/reset-password') return children
  if (auth.loading || auth.error || auth.callbackError) return <AuthStatus />
  if (auth.recovery) return <Navigate to="/teacher/reset-password" replace />
  if (location.pathname.startsWith('/checkin') && auth.session && auth.readiness.status !== 'ready') return <AuthStatus mode="protected" />
  return children
}

export default function App() {
  if (!supabaseConfigured && !demoMode) return <main className="mx-auto max-w-lg p-10"><h1 className="text-3xl font-extrabold text-teal">Pip is temporarily unavailable</h1><p className="mt-4" role="alert">The classroom connection is not configured. Please contact your school’s Pip administrator.</p></main>
  return (
    <BrowserRouter>
      <AuthProvider>
      <div className="flex min-h-dvh flex-col">
        <a href="#main" className="skip-link">Skip to content</a>
        <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-5 sm:px-10">
          <div className="flex items-center gap-2">
            <Sprout className="text-teal" size={32} aria-hidden="true" />
            <span className="text-4xl font-extrabold tracking-tight text-teal">pip</span>
          </div>
          <span className="rounded-full bg-white/70 px-4 py-2 font-bold text-teal">Pip</span>
        </header>
        <main id="main" className="mx-auto flex w-full max-w-5xl flex-1 flex-col justify-center px-5 py-6 sm:px-10" tabIndex={-1}>
          <AuthBoundary><Suspense fallback={<p className="mx-auto rounded-2xl bg-white px-6 py-4 font-bold text-teal" role="status">Loading Pip…</p>}><Routes>
            <Route path="/" element={<Navigate to="/checkin" replace />} />
            <Route element={<KioskRoster />}>
            <Route path="/checkin" element={<StudentSelectPage />} />
            <Route path="/checkin/:studentId" element={<EmotionCheckInPage />} />
            <Route path="/checkin/:studentId/complete" element={<CheckInCompletePage />} />
            </Route>
            <Route path="/teacher/login" element={<TeacherLoginPage />} />
            <Route path="/teacher/signup" element={<TeacherSignupPage />} />
            <Route path="/teacher/forgot-password" element={<TeacherForgotPasswordPage />} />
            <Route path="/teacher/setup" element={<TeacherSetupPage />} />
            <Route path="/teacher/auth/callback" element={<AuthStatus mode="callback" />} />
            <Route path="/teacher/reset-password" element={<TeacherResetPasswordPage />} />
            <Route element={<TeacherGuard />}><Route path="/teacher" element={<TeacherDashboardPage />} /></Route>
            <Route element={<TeacherGuard />}><Route path="/teacher/students" element={<ManageStudentsPage />} /></Route>
            <Route element={<TeacherGuard />}><Route path="/teacher/student/:studentId" element={<StudentSupportPage />} /></Route>
            <Route path="*" element={<Navigate to="/checkin" replace />} />
          </Routes></Suspense></AuthBoundary>
        </main>
        <footer className="px-6 py-5 text-center text-sm font-semibold text-muted">Pip · A gentle start to the day</footer>
      </div>
      <Analytics />
      </AuthProvider>
    </BrowserRouter>
  )
}
