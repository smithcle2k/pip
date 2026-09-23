import { useEffect, useRef } from 'react'
import { Check, ArrowRight } from 'lucide-react'
import { Link, Navigate, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { emotions } from '../data/emotions'
import { useKioskRoster } from '../lib/KioskRoster'
import StudentAvatar from '../components/child/StudentAvatar'

export default function CheckInCompletePage() {
  const { studentId } = useParams()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const headingRef = useRef<HTMLHeadingElement>(null)
  const { students, loading } = useKioskRoster()
  const student = students.find(item => item.id === studentId)
  const emotion = emotions.find(item => item.id === searchParams.get('emotion'))

  useEffect(() => {
    if (!student || !emotion) return
    document.title = `Thanks, ${student.firstName}! · Pip`
    headingRef.current?.focus()
    const timer = window.setTimeout(() => navigate('/checkin', { replace: true }), 2000)
    return () => window.clearTimeout(timer)
  }, [emotion, navigate, student?.id, student?.firstName])

  if (!emotion) return <Navigate to="/checkin" replace />
  if (loading) return <p role="status" className="text-center font-bold text-muted">Loading our friends…</p>
  if (!student) return <Navigate to="/checkin" replace />

  return (
    <section aria-labelledby="complete-title" className="welcome-card mx-auto w-full max-w-xl rounded-[2.5rem] border border-white bg-white/90 px-6 py-12 text-center sm:px-12 sm:py-16">
      <div className="mx-auto mb-6 flex size-28 items-center justify-center rounded-full bg-[#d9f0e4] text-teal sm:size-32" aria-hidden="true">
        <Check size={72} strokeWidth={3} />
      </div>
      <StudentAvatar student={student} className="mx-auto mb-5 size-24 text-lg" />
      <h1 ref={headingRef} tabIndex={-1} id="complete-title" className="page-heading text-4xl font-extrabold tracking-tight sm:text-5xl">Thanks, {student.firstName}!</h1>
      <p className="mt-4 text-xl font-semibold text-muted sm:text-2xl">You feel {emotion.label} today.</p>
      <Link to="/checkin" replace className="mt-8 inline-flex min-h-14 items-center justify-center gap-3 rounded-2xl bg-teal px-7 py-4 text-lg font-extrabold text-white shadow-[0_4px_0_#123f46] active:translate-y-1 active:shadow-none">
        Done <ArrowRight size={24} aria-hidden="true" />
      </Link>
      <p className="mt-4 text-sm font-semibold text-muted">Returning to our friends soon…</p>
    </section>
  )
}
