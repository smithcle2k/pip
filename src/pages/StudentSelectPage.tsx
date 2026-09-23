import { useEffect, useRef } from 'react'
import StudentCard from '../components/child/StudentCard'
import { supabaseConfigured } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { Link } from 'react-router-dom'
import { useKioskRoster as useKioskStudents } from '../lib/KioskRoster'

export default function StudentSelectPage() {
  const headingRef = useRef<HTMLHeadingElement>(null)
  const { students, loading, error } = useKioskStudents()
  const { session, loading: authLoading } = useAuth()

  useEffect(() => {
    document.title = 'Who are you? · Pip'
    headingRef.current?.focus()
  }, [])

  if (supabaseConfigured && !authLoading && !session) return <section className="welcome-card mx-auto max-w-xl rounded-[2rem] bg-white/90 p-8 text-center"><h1 className="text-3xl font-extrabold text-ink">Teacher setup needed</h1><p className="mt-3 font-semibold text-muted">A teacher needs to sign in on this classroom device before children can check in.</p><Link to="/teacher/login" className="mt-6 inline-flex min-h-12 items-center rounded-xl bg-teal px-5 py-3 font-extrabold text-white">Teacher sign in</Link></section>

  return (
    <section aria-labelledby="student-select-title">
      <div className="mb-7 text-center sm:mb-9">
        <h1 ref={headingRef} tabIndex={-1} id="student-select-title" className="page-heading text-4xl font-extrabold tracking-tight sm:text-5xl">Who are you?</h1>
        <p className="mt-3 text-lg font-semibold text-muted sm:text-xl">Tap your name.</p>
      </div>
      {error && <p role="alert" className="mb-5 rounded-2xl bg-white px-5 py-4 text-center font-bold text-coral">{error}</p>}
      {loading && <p role="status" className="rounded-2xl bg-white/80 px-5 py-6 text-center text-lg font-bold text-muted">Loading our friends…</p>}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 sm:gap-5" aria-busy={loading}>
        {students.map(student => <StudentCard key={student.id} student={student} />)}
      </div>
    </section>
  )
}
