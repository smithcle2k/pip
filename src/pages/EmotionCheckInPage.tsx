import { useEffect, useRef, useState } from 'react'
import { ArrowLeft, ArrowRight } from 'lucide-react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import CheckInHeader from '../components/child/CheckInHeader'
import EmotionCard from '../components/child/EmotionCard'
import { emotions } from '../data/emotions'
import { saveCheckIn } from '../lib/data'
import { playPrompt } from '../lib/audio'
import type { Emotion, Student } from '../types'
import { useKioskRoster as useKioskStudents } from '../lib/KioskRoster'

function StudentEmotionCheckIn({ student }: { student: Student }) {
  const mounted = useRef(false)
  useEffect(() => { mounted.current = true; return () => { mounted.current = false } }, [])
  const [selectedEmotion, setSelectedEmotion] = useState<Emotion | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const navigate = useNavigate()

  function selectEmotion(emotion: Emotion) {
    if (saving) return
    setSelectedEmotion(emotion)
    setError('')
    playPrompt(emotion.label, emotion.audioSrc)
  }

  function continueToNextStudent() {
    if (!selectedEmotion || saving) return
    setSaving(true)
    saveCheckIn(student.id, selectedEmotion.id).then(result => {
      if (!mounted.current) return
      if (result.error) { setError(result.error); setSaving(false); return }
      navigate(`/checkin/${student.id}/complete?emotion=${selectedEmotion.id}`)
    }).catch(() => { if (mounted.current) { setError('Let’s try again.'); setSaving(false) } })
  }

  return (
    <section aria-labelledby="checkin-title">
      <CheckInHeader student={student} />
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 sm:gap-5" role="group" aria-label="Choose a feeling" aria-busy={saving}>
        {emotions.map(emotion => (
          <EmotionCard key={emotion.id} emotion={emotion} selected={selectedEmotion?.id === emotion.id} onSelect={() => selectEmotion(emotion)} />
        ))}
      </div>
      {error && <p role="alert" className="mt-4 text-center text-lg font-bold text-coral">{error}</p>}
      <div className="mt-4 flex flex-col items-center gap-3 sm:flex-row-reverse sm:justify-between">
        <p role="status" className="min-h-8 text-center text-xl font-bold text-teal">
          {selectedEmotion ? `You feel ${selectedEmotion.label} today.` : ''}
        </p>
        {selectedEmotion ? (
          <Link
            to={`/checkin/${student.id}/complete?emotion=${selectedEmotion.id}`}
            autoFocus
            aria-disabled={saving}
            onClick={event => {
              event.preventDefault()
              continueToNextStudent()
            }}
            className="inline-flex min-h-16 items-center justify-center gap-3 rounded-2xl bg-teal px-7 py-4 text-xl font-extrabold text-white shadow-[0_4px_0_#123f46] transition-transform active:translate-y-1 active:shadow-none"
          >
            {saving ? 'Saving…' : 'Next'}
            <ArrowRight size={26} aria-hidden="true" />
          </Link>
        ) : (
          <Link to="/checkin" className="inline-flex min-h-14 items-center justify-center gap-3 rounded-2xl px-5 py-3 text-lg font-bold text-teal active:bg-mint">
            <ArrowLeft size={24} aria-hidden="true" />
            Back to pictures
          </Link>
        )}
      </div>
    </section>
  )
}

export default function EmotionCheckInPage() {
  const { studentId } = useParams()
  const { students, loading, error } = useKioskStudents()
  const student = students.find(student => student.id === studentId)
  const headingRef = useRef<HTMLHeadingElement>(null)

  useEffect(() => {
    if (!student) {
      document.title = 'Choose your picture · Pip'
      headingRef.current?.focus()
    }
  }, [student])

  // A new student gets fresh selection state, including during route changes.
  if (loading) return <p role="status" className="text-center font-bold text-muted">Loading our friends…</p>
  if (student) return <StudentEmotionCheckIn key={student.id} student={student} />

  return (
    <section aria-labelledby="checkin-title" className="welcome-card mx-auto w-full max-w-2xl rounded-[2.5rem] border border-white bg-white/80 px-6 py-10 text-center sm:py-14">
      <h1 ref={headingRef} tabIndex={-1} id="checkin-title" className="page-heading text-4xl font-extrabold tracking-tight sm:text-5xl">Let’s find your picture.</h1>
      <p className="mt-4 text-xl text-muted">{error || 'Go back and tap your picture.'}</p>
      <Link to="/checkin" className="mt-8 inline-flex min-h-14 items-center justify-center gap-3 rounded-2xl bg-teal px-6 py-4 text-lg font-bold text-white active:scale-95">
        <ArrowLeft size={24} aria-hidden="true" />
        Back to pictures
      </Link>
    </section>
  )
}
