import { ArrowLeft } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { loadClassroom, loadStudents } from '../lib/data'
import { byName } from '../lib/names'
import { supabaseConfigured } from '../lib/supabase'
import RosterEditor from '../components/teacher/RosterEditor'
import type { Classroom, Student } from '../types'

type State = { kind: 'loading' } | { kind: 'error'; message: string } | { kind: 'membership'; message: string } | { kind: 'ready'; classroom: Classroom; students: Student[] }

export default function ManageStudentsPage() {
  const [state, setState] = useState<State>({ kind: 'loading' })
  const load = useCallback(async () => {
    if (!supabaseConfigured) return setState({ kind: 'ready', classroom: { id: 'preview', name: 'Preview classroom', teacherName: 'Teacher' }, students: [] })
    const classroom = await loadClassroom()
    if (classroom.error) return setState({ kind: 'error', message: classroom.error })
    if (classroom.status !== 'ok' || !classroom.classroom) return setState({ kind: 'membership', message: classroom.status === 'multiple' ? 'Your account has more than one classroom. Ask an administrator to fix the assignment.' : 'Your account is not assigned to a classroom yet.' })
    const roster = await loadStudents()
    if (roster.error) return setState({ kind: 'error', message: roster.error })
    setState({ kind: 'ready', classroom: classroom.classroom, students: roster.students.sort(byName) })
  }, [])
  useEffect(() => { document.title = 'My Classroom · Pip'; void load() }, [load])
  if (state.kind === 'loading') return <p role="status" className="text-center font-bold text-muted">Loading your classroom…</p>
  if (state.kind === 'error' || state.kind === 'membership') return <div className="teacher-page -mx-5 -my-6 min-h-full px-5 py-8"><Link to="/teacher" className="inline-flex min-h-11 items-center gap-2 font-bold text-teal"><ArrowLeft size={18} aria-hidden="true" /> Back to dashboard</Link><p role="alert" className="teacher-card mt-6 p-6 font-bold text-ink">{state.message}</p></div>
  return <div className="teacher-page -mx-5 -my-6 min-h-full px-5 py-8"><div className="mx-auto max-w-3xl">
    <Link to="/teacher" className="inline-flex min-h-11 items-center gap-2 font-bold text-teal"><ArrowLeft size={18} aria-hidden="true" /> Back to dashboard</Link>
    <header className="mt-5"><h1 className="page-heading text-4xl font-extrabold text-ink">My Classroom</h1><p className="mt-2 font-bold text-muted">{state.classroom.name}</p></header>
    <div className="mt-6"><RosterEditor classroom={state.classroom} students={state.students} reload={load} /></div>
  </div></div>
}
