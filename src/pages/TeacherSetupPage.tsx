import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../lib/auth'
import { loadClassroom, loadStudents } from '../lib/data'
import { byName } from '../lib/names'
import RosterEditor from '../components/teacher/RosterEditor'
import { supabase } from '../lib/supabase'
import { authErrorMessage, withAuthTimeout } from '../lib/authHelpers'
import AuthStatus, { SignOutButton } from '../components/teacher/AuthStatus'
import type { Classroom, Student } from '../types'

const NAME_LIMIT = 80
function validateClassroomName(value: string) {
  const name = value.trim()
  if (!name || [...name].length > NAME_LIMIT || /[\u0000-\u001f\u007f-\u009f]/.test(name)) return `Enter a classroom name using 1–${NAME_LIMIT} characters.`
  return ''
}

/**
 * Resumable first-time setup. The step shown is decided by saved database state
 * (readiness), never by browser memory: no classroom → welcome and name steps;
 * classroom saved but setup unfinished → roster step. Completed teachers are
 * redirected by AuthStatus before this page renders anything.
 */
export default function TeacherSetupPage() {
  const auth = useAuth()
  const [justFinished, setJustFinished] = useState(false)
  const firstName = auth.readiness.firstName && auth.readiness.firstName !== 'Teacher' ? auth.readiness.firstName : ''
  // After Finish Setup, wait for the shared readiness state to confirm
  // completion, then hand the dashboard its one-time success message.
  if (justFinished && !auth.loading && auth.session && auth.readiness.status === 'ready') return <Navigate to="/teacher" replace state={{ justFinished: true }} />
  if (auth.loading || !auth.session || auth.error || auth.callbackError || auth.recovery || !['no-classroom', 'incomplete'].includes(auth.readiness.status)) return <AuthStatus mode="setup" />
  if (auth.readiness.status === 'no-classroom') return <ClassroomSteps firstName={firstName} onCreated={auth.retry} />
  return <RosterStep classroomId={auth.readiness.classroomId ?? ''} onFinished={() => { setJustFinished(true); auth.retry() }} />
}

function ClassroomSteps({ firstName, onCreated }: { firstName: string; onCreated: () => void }) {
  const [step, setStep] = useState<'welcome' | 'name'>('welcome')
  const [name, setName] = useState('')
  const [fieldError, setFieldError] = useState('')
  const [error, setError] = useState('')
  const [pending, setPending] = useState(false)
  const [uncertain, setUncertain] = useState(false)
  const locked = useRef(false)
  const active = useRef(true)
  const heading = useRef<HTMLHeadingElement>(null)
  useEffect(() => { active.current = true; return () => { active.current = false } }, [])
  useEffect(() => { document.title = 'Set up your classroom · Pip'; heading.current?.focus() }, [step])

  async function create(event: FormEvent) {
    event.preventDefault()
    if (locked.current) return
    const problem = validateClassroomName(name)
    setFieldError(problem); setError('')
    if (problem) return
    if (!supabase) { setError('Classroom setup requires a connection to Pip.'); return }
    locked.current = true; setPending(true)
    try {
      // The server reuses the caller's existing classroom, so a retry after an
      // uncertain outcome can never create a second one.
      const result = await withAuthTimeout(supabase.rpc('provision_teacher_classroom', { classroom_name: name.trim() }))
      if (!active.current) return
      if (result.error) {
        if (result.error.code === 'P0003') { onCreated(); return }
        setError(result.error.code === '22023' ? `Enter a classroom name using 1–${NAME_LIMIT} characters.` : 'Couldn’t save your classroom. Check your connection and try again.')
        return
      }
      onCreated()
    } catch (failure) {
      if (!active.current) return
      const timedOut = failure instanceof Error && failure.message === 'auth_timeout'
      setUncertain(timedOut)
      setError(timedOut ? 'This is taking too long. Your classroom may already be saved.' : authErrorMessage(failure))
    } finally { locked.current = false; if (active.current) setPending(false) }
  }

  if (step === 'welcome') return <section className="mx-auto w-full max-w-md rounded-[2rem] bg-white p-8 shadow-xl">
    <h1 ref={heading} tabIndex={-1} className="page-heading text-3xl font-extrabold text-teal">Welcome to Pip{firstName ? `, ${firstName}` : ''}!</h1>
    <p className="mt-3 text-lg font-bold text-ink">Let's set up your classroom.</p>
    <p className="mt-3 text-muted">It takes about a minute: name your classroom, then add your students.</p>
    <button type="button" onClick={() => setStep('name')} className="mt-6 min-h-14 w-full rounded-xl bg-teal px-5 py-3 font-extrabold text-white">Get Started</button>
    <SignOutButton />
  </section>

  return <section className="mx-auto w-full max-w-md rounded-[2rem] bg-white p-8 shadow-xl">
    <p className="font-bold text-muted">Step 1 of 2</p>
    <h1 ref={heading} tabIndex={-1} className="page-heading mt-1 text-3xl font-extrabold text-ink">What should we call your classroom?</h1>
    <form noValidate onSubmit={create} className="mt-6" aria-busy={pending}>
      <fieldset disabled={pending}>
        <label htmlFor="classroom-name" className="block font-bold text-ink">Classroom Name</label>
        <input id="classroom-name" name="classroomName" required autoComplete="off" maxLength={NAME_LIMIT} placeholder="Room 4" value={name} onChange={event => setName(event.target.value)} aria-invalid={Boolean(fieldError)} aria-describedby={fieldError ? 'classroom-name-error' : undefined} className="mt-2 min-h-12 w-full rounded-xl border-2 border-[#d9e3e2] px-4 py-3" />
        {fieldError && <p id="classroom-name-error" role="alert" className="mt-1 font-bold text-coral">{fieldError}</p>}
        <button type="submit" className="mt-5 min-h-14 w-full rounded-xl bg-teal px-5 py-3 font-extrabold text-white disabled:opacity-60">{pending ? 'Creating classroom…' : 'Create Classroom'}</button>
      </fieldset>
      {pending && <p role="status" className="mt-3">Creating your classroom…</p>}
      {error && <div role="alert" className="mt-3 font-bold text-coral">{error}{uncertain && <button type="button" onClick={onCreated} className="mt-2 block rounded-xl bg-mint px-4 py-2 font-bold text-teal">Check saved setup</button>}</div>}
    </form>
    <button type="button" onClick={() => setStep('welcome')} disabled={pending} className="mt-4 font-bold text-teal">Back</button>
  </section>
}

function RosterStep({ classroomId, onFinished }: { classroomId: string; onFinished: () => void }) {
  const [state, setState] = useState<{ kind: 'loading' } | { kind: 'error' } | { kind: 'ready'; classroom: Classroom; students: Student[] }>({ kind: 'loading' })
  const [busy, setBusy] = useState(false)
  const [finishing, setFinishing] = useState(false)
  const [error, setError] = useState('')
  const locked = useRef(false)
  const active = useRef(true)
  const heading = useRef<HTMLHeadingElement>(null)
  const load = useCallback(async () => {
    const classroom = await loadClassroom()
    if (classroom.error || classroom.status !== 'ok' || !classroom.classroom || classroom.classroom.id !== classroomId) { if (active.current) setState({ kind: 'error' }); return }
    const roster = await loadStudents()
    if (roster.error) { if (active.current) setState({ kind: 'error' }); return }
    if (active.current) setState({ kind: 'ready', classroom: classroom.classroom, students: roster.students.sort(byName) })
  }, [classroomId])
  useEffect(() => { active.current = true; document.title = 'Add your students · Pip'; void load().then(() => heading.current?.focus()); return () => { active.current = false } }, [load])

  async function finish() {
    if (locked.current || state.kind !== 'ready' || !supabase) return
    locked.current = true; setFinishing(true); setError('')
    try {
      // The server re-checks membership and an active student and is idempotent.
      const result = await withAuthTimeout(supabase.rpc('complete_teacher_onboarding'))
      if (!active.current) return
      if (result.error) {
        if (result.error.code === '22023') { setError('Add at least one student before finishing setup.'); await load(); return }
        if (result.error.code === 'P0003') { onFinished(); return }
        setError('Couldn’t finish setup. Check your connection and try again.'); return
      }
      onFinished()
    } catch (failure) { if (active.current) setError(failure instanceof Error && failure.message === 'auth_timeout' ? 'This is taking too long. Your setup may already be complete; try again.' : authErrorMessage(failure)) }
    finally { locked.current = false; if (active.current) setFinishing(false) }
  }

  const canFinish = state.kind === 'ready' && state.students.length > 0 && !busy && !finishing
  return <section className="mx-auto w-full max-w-2xl">
    <div className="rounded-[2rem] bg-white p-8 shadow-xl">
      <p className="font-bold text-muted">Step 2 of 2</p>
      <h1 ref={heading} tabIndex={-1} className="page-heading mt-1 text-3xl font-extrabold text-ink">Add your students</h1>
      {state.kind === 'ready' && <p className="mt-2 font-bold text-teal">{state.classroom.name}</p>}
      {state.kind === 'loading' && <p role="status" className="mt-3 text-muted">Loading your classroom…</p>}
      {state.kind === 'error' && <div role="alert" className="mt-3 font-bold text-coral">Couldn’t load your classroom. Your saved setup has not been changed.<button type="button" onClick={() => { setState({ kind: 'loading' }); void load() }} className="mt-2 block rounded-xl bg-mint px-4 py-2 font-bold text-teal">Try again</button></div>}
      {state.kind === 'ready' && <>
        <p className="mt-3 text-muted">Add each child’s first and last name. Children will see their first name and last initial.</p>
        <div className="mt-6"><RosterEditor classroom={state.classroom} students={state.students} reload={load} onBusy={setBusy} /></div>
        <div className="mt-8 border-t border-[#e6eeed] pt-6">
          <button type="button" onClick={() => void finish()} disabled={!canFinish} aria-describedby="finish-help" className="min-h-14 w-full rounded-xl bg-teal px-5 py-3 font-extrabold text-white disabled:opacity-60">{finishing ? 'Finishing…' : 'Finish Setup'}</button>
          <p id="finish-help" className="mt-2 text-sm text-muted">{state.students.length ? 'You can change students later from your dashboard.' : 'Add at least one student to finish setup.'}</p>
          {finishing && <p role="status">Finishing your setup…</p>}
          {error && <p role="alert" className="mt-2 font-bold text-coral">{error}</p>}
        </div>
      </>}
    </div>
    <div className="px-8"><SignOutButton /></div>
  </section>
}
