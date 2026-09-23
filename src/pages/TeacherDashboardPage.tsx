import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { CalendarDays, Download, LogOut, Sprout } from 'lucide-react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../lib/auth'
import { emotions } from '../data/emotions'
import { mockCheckIns, type MockCheckIn } from '../data/mockCheckIns'
import { students as mockStudents } from '../data/students'
import { loadClassroom, loadResponses, loadStudents, loadTodayCheckIns, mockClassroom } from '../lib/data'
import { supabaseConfigured } from '../lib/supabase'
import { useRefreshOnReturn } from '../lib/useRefreshOnReturn'
import type { Classroom, Student } from '../types'
import EmotionSummary from '../components/teacher/EmotionSummary'
import NeedsAttention from '../components/teacher/NeedsAttention'
import StudentStatusCard from '../components/teacher/StudentStatusCard'
import CheckInExportDialog from '../components/teacher/CheckInExportDialog'

// Live data is never mixed with the demo snapshot: the page is either loading, ready, blocked, or failed.
type DashboardState =
  | { kind: 'loading' }
  | { kind: 'error'; message: string }
  | { kind: 'no-classroom' }
  | { kind: 'multiple-classrooms' }
  | { kind: 'ready'; classroom: Classroom; students: Student[]; checkIns: MockCheckIn[]; responseIds: Set<string>; responseError?: string }

const noClassroomMessage = 'Your account isn’t assigned to a classroom yet. Ask your Pip administrator to add you to your classroom, then sign in again.'
const multipleClassroomsMessage = 'Your account is assigned to more than one classroom. Pip currently supports one classroom per teacher; ask your Pip administrator to fix the assignment.'

async function loadDashboard(): Promise<DashboardState> {
  if (!supabaseConfigured) {
    return { kind: 'ready', classroom: mockClassroom, students: mockStudents, checkIns: mockCheckIns, responseIds: new Set() }
  }
  const classroom = await loadClassroom()
  if (classroom.error) return { kind: 'error', message: classroom.error }
  if (classroom.status === 'none') return { kind: 'no-classroom' }
  if (classroom.status === 'multiple' || !classroom.classroom) return { kind: 'multiple-classrooms' }

  const [roster, today] = await Promise.all([loadStudents(), loadTodayCheckIns()])
  if (roster.error || today.error) return { kind: 'error', message: roster.error ?? today.error ?? 'Could not load classroom data.' }
  const checkIns = today.checkIns.map(item => ({ id: item.id, createdAt: item.createdAt, studentId: item.studentId, emotion: item.emotion, time: new Date(item.createdAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) }))
  const loaded = await loadResponses(checkIns.map(item => item.id))
  return { kind: 'ready', classroom: classroom.classroom, students: roster.students, checkIns, responseIds: new Set(loaded.responses.map(r => r.checkInId)), responseError: loaded.error }
}

export default function TeacherDashboardPage() {
  const { signOut } = useAuth()
  const [signOutPending, setSignOutPending] = useState(false)
  const [signOutError, setSignOutError] = useState('')
  const [exportOpen, setExportOpen] = useState(false)
  const signOutLock = useRef(false)
  async function handleSignOut() {
    if (signOutLock.current) return
    signOutLock.current = true; setSignOutPending(true); setSignOutError('')
    try { setExportOpen(false); await signOut(); navigate('/teacher/login', { replace: true }) }
    catch { setSignOutError('Couldn’t sign out. Check your connection and try again.') }
    finally { signOutLock.current = false; setSignOutPending(false) }
  }
  const navigate = useNavigate()
  const location = useLocation()
  const headingRef = useRef<HTMLHeadingElement>(null)
  const [state, setState] = useState<DashboardState>({ kind: 'loading' })
  // One-time success message passed back from the student support page.
  const [success, setSuccess] = useState<string>(() => { const passed = location.state as { success?: string; justFinished?: boolean } | null; return passed?.justFinished ? 'Your classroom is ready!' : passed?.success ?? '' })

  useEffect(() => {
    document.title = 'Teacher dashboard · Pip'
    headingRef.current?.focus()
    const passed = location.state as { success?: string; justFinished?: boolean } | null
    if (passed?.success || passed?.justFinished) navigate(location.pathname, { replace: true, state: null })
    let active = true
    loadDashboard().then(next => { if (active) setState(next) })
    return () => { active = false }
  }, [])

  // Returning to the tab re-queries today's records so a new day never shows yesterday's status.
  useRefreshOnReturn(useCallback(() => { loadDashboard().then(setState) }, []))

  const ready = state.kind === 'ready' ? state : undefined
  const students = ready?.students ?? []
  const responseIds = ready?.responseIds ?? new Set<string>()
  const latestCheckIns = useMemo(() => { const activeIds = new Set(students.map(student => student.id)); return Array.from((ready?.checkIns ?? []).filter(item => activeIds.has(item.studentId)).reduce((map, item) => { if (!map.has(item.studentId)) map.set(item.studentId, item); return map }, new Map<string, MockCheckIn>()).values()) }, [ready?.checkIns, students])
  const counts = useMemo(() => Object.fromEntries(emotions.map(emotion => [emotion.id, latestCheckIns.filter(checkIn => checkIn.emotion === emotion.id).length])) as Record<(typeof emotions)[number]['id'], number>, [latestCheckIns])
  const checkedIn = latestCheckIns.length
  const needCount = latestCheckIns.filter(item => ['sad', 'mad', 'sick'].includes(item.emotion) && (!item.id || !responseIds.has(item.id))).length
  const completedCount = latestCheckIns.filter(item => item.id && responseIds.has(item.id)).length
  const classroom = ready?.classroom ?? (supabaseConfigured ? undefined : mockClassroom)

  return (
    <div className="teacher-page -mx-5 -my-6 rounded-[2rem] px-5 py-6 sm:-mx-10 sm:-my-6 sm:px-10 sm:py-8">
      <div className="mx-auto max-w-6xl">
        <header className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="mb-3 flex items-center gap-2 text-teal"><Sprout size={24} aria-hidden="true" /><span className="text-xl font-extrabold">pip</span>{classroom && <span className="text-muted">· {classroom.name}</span>}</div>
            <h1 ref={headingRef} tabIndex={-1} className="page-heading text-3xl font-extrabold tracking-tight text-ink sm:text-4xl">{classroom ? `Good morning, ${classroom.teacherName}` : 'Teacher dashboard'}</h1>
            <p className="mt-2 font-semibold text-muted">Here’s how your classroom is feeling today.</p>
          </div>
          <div className="flex flex-wrap gap-2"><button type="button" disabled={!classroom} onClick={() => setExportOpen(true)} className="inline-flex items-center gap-2 rounded-xl bg-coral px-4 py-3 text-sm font-bold text-white"><Download size={17} aria-hidden="true" />Download check-ins</button><Link to="/teacher/students" className="inline-flex items-center gap-2 rounded-xl bg-white px-4 py-3 text-sm font-bold text-teal shadow-sm">Manage students</Link><Link to="/checkin" className="inline-flex items-center gap-2 rounded-xl bg-white px-4 py-3 text-sm font-bold text-teal shadow-sm">Child check-in</Link><button disabled={signOutPending} onClick={handleSignOut} className="inline-flex items-center gap-2 rounded-xl bg-teal px-4 py-3 text-sm font-bold text-white"><LogOut size={17} aria-hidden="true" />{signOutPending ? 'Signing out…' : 'Sign out'}</button>{signOutError && <p role="alert">{signOutError}</p>}</div>
        </header>

        {success && <p role="status" className="mt-5 flex items-center justify-between gap-3 rounded-2xl bg-mint px-5 py-4 font-bold text-teal">{success}<button type="button" onClick={() => setSuccess('')} className="rounded-lg px-2 py-1 text-sm font-extrabold hover:bg-white/60">Dismiss</button></p>}

        {state.kind === 'loading' && <p role="status" className="mt-8 text-center font-bold text-muted">Loading today’s check-ins…</p>}
        {state.kind === 'error' && <div className="mt-5 rounded-2xl bg-white px-5 py-4"><p role="alert" className="font-bold text-coral">{state.message}</p><button type="button" onClick={() => { setState({ kind: 'loading' }); loadDashboard().then(setState) }} className="mt-3 min-h-11 rounded-xl bg-teal px-4 font-extrabold text-white">Try again</button></div>}
        {state.kind === 'no-classroom' && <p role="alert" className="mt-5 rounded-2xl bg-white px-5 py-4 font-bold text-ink">{noClassroomMessage}</p>}
        {state.kind === 'multiple-classrooms' && <p role="alert" className="mt-5 rounded-2xl bg-white px-5 py-4 font-bold text-ink">{multipleClassroomsMessage}</p>}

        {ready && (
          <>
            {ready.responseError && <p role="alert" className="mt-5 rounded-2xl bg-white px-5 py-4 font-bold text-coral">{ready.responseError} Follow-up badges may be incomplete.</p>}

            <div className="mt-8 grid gap-5 lg:grid-cols-[1.5fr_1fr]">
              <section aria-labelledby="today-title" className="teacher-card p-5 sm:p-6">
                <div id="today-title" className="flex items-center gap-2 text-sm font-extrabold tracking-wide text-teal uppercase"><CalendarDays size={18} aria-hidden="true" /> Today’s check-in</div>
                <div className="mt-4 flex items-end gap-3"><span className="text-5xl font-extrabold text-ink">{checkedIn}</span><span className="pb-1 text-lg font-bold text-muted">of {students.length} checked in</span></div>
                <div className="mt-5 h-3 overflow-hidden rounded-full bg-[#e2e8f0]"><div className="h-full rounded-full bg-teal transition-all" style={{ width: `${students.length ? (checkedIn / students.length) * 100 : 0}%` }} /></div>
                <p className="mt-3 text-sm font-semibold text-muted">{students.length === 0 ? 'No active students in this classroom yet.' : `${students.length - checkedIn} students not yet checked in`}</p>
              </section>
              <NeedsAttention students={students} checkIns={latestCheckIns} responseIds={ready.responseError ? undefined : responseIds} />
            </div>

            {!ready.responseError && <section aria-labelledby="followups-title" className="teacher-card mt-5 p-5 sm:p-6"><h2 id="followups-title" className="text-xl font-extrabold text-ink">Today’s follow-ups</h2><div className="mt-4 grid grid-cols-2 gap-3"><a href="#attention-title" className="rounded-2xl bg-[#fff0ed] p-4"><span className="block text-3xl font-extrabold text-coral">{needCount}</span><span className="font-bold text-muted">Need check-in</span></a><div className="rounded-2xl bg-mint p-4"><span className="block text-3xl font-extrabold text-teal">{completedCount}</span><span className="font-bold text-muted">Checked in with</span></div></div></section>}

            <div className="mt-5"><EmotionSummary counts={counts} /></div>

            <section aria-labelledby="roster-title" className="teacher-card mt-5 p-5 sm:p-6">
              <div className="flex items-center justify-between gap-3"><h2 id="roster-title" className="text-xl font-extrabold text-ink">Student check-ins</h2><span className="text-sm font-bold text-muted">{students.length} students</span></div>
              {students.length ? <ul className="mt-2">{students.map(student => <StudentStatusCard key={student.id} student={student} checkIn={latestCheckIns.find(item => item.studentId === student.id)} responseIds={responseIds} />)}</ul> : <p className="mt-4 font-semibold text-muted">No active students yet.</p>}
            </section>
            {!supabaseConfigured && <p className="mt-5 text-center text-xs font-semibold text-muted">Demo preview · not connected to a classroom database</p>}
          </>
        )}
      </div>
      {exportOpen && <CheckInExportDialog classroom={classroom} onClose={() => setExportOpen(false)} />}
    </div>
  )
}
