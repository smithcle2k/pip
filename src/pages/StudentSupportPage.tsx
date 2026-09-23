import { ArrowLeft } from 'lucide-react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useCallback, useEffect, useState } from 'react'
import { emotions } from '../data/emotions'
import { formatTime, isToday, loadStudentHistory, loadStudents, saveTeacherResponse } from '../lib/data'
import { supabaseConfigured } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { useRefreshOnReturn } from '../lib/useRefreshOnReturn'
import CheckInHistory from '../components/teacher/CheckInHistory'
import SupportStatusBadge from '../components/teacher/SupportStatusBadge'
import TeacherResponseForm, { responseOptions } from '../components/teacher/TeacherResponseForm'
import type { CheckIn, ResponseType, Student, TeacherResponse } from '../types'
import StudentAvatar from '../components/child/StudentAvatar'
import { fullName } from '../lib/names'

type PageState =
  | { kind: 'loading' }
  | { kind: 'unavailable' }
  | { kind: 'ready'; student: Student; checkIns: CheckIn[]; responses: TeacherResponse[]; historyError?: string }

export default function StudentSupportPage() {
  const { studentId = '' } = useParams()
  const navigate = useNavigate()
  const { session } = useAuth()
  const [state, setState] = useState<PageState>({ kind: 'loading' })
  const [saveError, setSaveError] = useState('')
  const [saving, setSaving] = useState(false)
  // Re-derived on every render so a day change on return is reflected without stale "today" values.
  const [, setTick] = useState(0)

  const load = useCallback(async () => {
    const [roster, history] = await Promise.all([loadStudents({ includeInactive: true }), loadStudentHistory(studentId)])
    const student = roster.students.find(item => item.id === studentId)
    if (roster.error || !student) { setState({ kind: 'unavailable' }); return }
    setState({ kind: 'ready', student, checkIns: history.checkIns, responses: history.responses, historyError: history.error })
  }, [studentId])

  useEffect(() => { setState({ kind: 'loading' }); load() }, [load])
  useRefreshOnReturn(useCallback(() => { setTick(t => t + 1); load() }, [load]))

  if (state.kind === 'loading') return <p role="status" className="text-center font-bold text-muted">Loading student support…</p>
  if (state.kind === 'unavailable') return (
    <div className="mx-auto max-w-xl">
      <Link to="/teacher" className="inline-flex min-h-11 items-center gap-2 rounded-lg py-2 pr-3 font-bold text-teal"><ArrowLeft size={18} aria-hidden="true" /> Back to dashboard</Link>
      <p className="mt-8 teacher-card p-6 font-bold text-muted">This student isn’t available.</p>
    </div>
  )

  const { student, checkIns, responses, historyError } = state
  const latest = checkIns.find(item => isToday(item.createdAt))
  const response = latest && responses.find(item => item.checkInId === latest.id)
  const emotion = latest && emotions.find(item => item.id === latest.emotion)
  const status = latest ? (response ? 'checked_in_with' : ['sad', 'mad', 'sick'].includes(latest.emotion) ? 'needs_check_in' : null) : null

  async function submit(input: { responseType: ResponseType; note: string }) {
    // The response always targets the check-in the teacher reviewed, captured before the save starts.
    if (!latest || !session?.user.id) { setSaveError('Couldn’t save this check-in. Please try again.'); return }
    const target = latest
    setSaving(true); setSaveError('')
    const result = await saveTeacherResponse({ studentId, checkInId: target.id, teacherId: session.user.id, responseType: input.responseType, note: input.note.trim() || null })
    setSaving(false)
    if (result.duplicate) {
      // Someone already completed this check-in: show their saved response instead of overwriting it.
      const history = await loadStudentHistory(studentId)
      setState(prev => prev.kind === 'ready' ? { ...prev, checkIns: history.checkIns, responses: history.responses, historyError: history.error } : prev)
      setSaveError(history.error ? 'This check-in was already recorded, but the saved response couldn’t be loaded.' : '')
      return
    }
    if (result.error) { setSaveError(result.error); return }
    navigate('/teacher', { state: { success: `Check-in recorded for ${fullName(student)}.` } })
  }

  return (
    <div className="teacher-page -mx-5 -my-6 min-h-full px-5 py-6 sm:-mx-10 sm:px-10 sm:py-8">
      <div className="mx-auto max-w-3xl">
        <Link to="/teacher" className="inline-flex min-h-11 items-center gap-2 rounded-lg py-2 pr-3 font-bold text-teal"><ArrowLeft size={18} aria-hidden="true" /> Back to dashboard</Link>
        <section className="teacher-card mt-5 p-6">
          <div className="flex items-center gap-4">
            <StudentAvatar student={student} variant="compact" className="size-16 text-2xl" />
            <div>
              <h1 className="text-3xl font-extrabold text-ink">{fullName(student)}</h1>
              {!student.active && <p className="mb-2 rounded-lg bg-[#fff4d6] px-3 py-2 text-sm font-extrabold text-ink">Inactive student · history is read-only</p>}
              {emotion && latest
                ? <p className="mt-1 flex flex-wrap items-center gap-2 font-bold text-muted">Today: <span role="img" aria-label={emotion.label}>{emotion.emoji}</span> {emotion.label} · {formatTime(latest.createdAt)}<SupportStatusBadge status={status} /></p>
                : <p className="mt-1 font-bold text-muted">Not checked in today.</p>}
            </div>
          </div>
        </section>

        {historyError && <p role="alert" className="mt-5 rounded-2xl bg-white px-5 py-4 font-bold text-coral">{historyError}</p>}
        <CheckInHistory checkIns={checkIns} latestId={latest?.id} />

        {student.active && latest && !response && !historyError && (
          <TeacherResponseForm saving={saving} disabled={!supabaseConfigured} error={saveError} onSubmit={submit} />
        )}
        {latest && !response && historyError && <p className="mt-5 teacher-card p-6 font-semibold text-muted">Responses are unavailable until student history loads. Try again in a moment.</p>}

        {response && (
          <section aria-labelledby="response-title" className="teacher-card mt-5 p-6">
            <h2 id="response-title" className="font-extrabold text-teal">✓ Checked in with at {formatTime(response.createdAt)}</h2>
            {saveError && <p role="alert" className="mt-2 text-sm font-bold text-coral">{saveError}</p>}
            <p className="mt-3 font-bold text-ink">{responseOptions.find(option => option.value === response.responseType)?.label}</p>
            {response.note && <p className="mt-2 font-semibold text-muted">{response.note}</p>}
          </section>
        )}
      </div>
    </div>
  )
}
