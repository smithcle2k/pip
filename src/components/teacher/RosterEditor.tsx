import { MoreVertical, Plus, Trash2 } from 'lucide-react'
import { FormEvent, useEffect, useRef, useState } from 'react'
import { createStudent, updateStudentName, deactivateStudent, validateStudentName, NAME_LIMIT } from '../../lib/data'
import { fullName } from '../../lib/names'
import { supabaseConfigured } from '../../lib/supabase'
import type { Classroom, Student } from '../../types'
import StudentAvatar from '../child/StudentAvatar'

/**
 * Shared active-roster editor used by /teacher/students and first-time setup.
 * Every operation is keyed by student ID and saved through the same data
 * helpers, so setup and later management edit the same records.
 */
export default function RosterEditor({ classroom, students, reload, heading = 'Add Student', onBusy }: { classroom: Classroom; students: Student[]; reload: () => Promise<void>; heading?: string; onBusy?: (busy: boolean) => void }) {
  const [first, setFirst] = useState('')
  const [last, setLast] = useState('')
  const [editing, setEditing] = useState<Student | null>(null)
  const [menu, setMenu] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [uncertain, setUncertain] = useState(false)
  const [saving, setSaving] = useState(false)
  const locked = useRef(false)
  const firstRef = useRef<HTMLInputElement>(null)
  useEffect(() => { if (editing) { setFirst(editing.firstName); setLast(editing.lastName); firstRef.current?.focus() } }, [editing])
  useEffect(() => { onBusy?.(saving) }, [saving, onBusy])
  const busy = !supabaseConfigured || saving
  const clear = () => { setFirst(''); setLast(''); setEditing(null) }

  async function run(task: () => Promise<{ error?: string; warning?: string }>, options: { keepInput?: boolean } = {}) {
    if (locked.current) return
    locked.current = true; setSaving(true); setError(''); setUncertain(false)
    try {
      const result = await task()
      // Add/rename failures keep the typed name and offer a refresh: the request
      // may have reached the server even though the reply was lost.
      if (result.error) { setError(result.error); setUncertain(Boolean(options.keepInput)); return }
      clear()
      await reload()
      if (result.warning) setError(result.warning)
    } catch { setError('Something went wrong. Refresh the list to see what was saved before trying again.'); setUncertain(true) }
    finally { locked.current = false; setSaving(false); setMenu(null) }
  }
  function submit(event: FormEvent) {
    event.preventDefault()
    const problem = validateStudentName(first, last)
    if (problem) { setError(problem); return }
    // A failed add keeps the typed name and offers a refresh instead of
    // resubmitting blindly: an uncertain network outcome may already be saved.
    void run(() => editing ? updateStudentName(editing.id, first, last) : createStudent(first, last, classroom.id), { keepInput: true })
  }
  function removeStudent(student: Student) {
    if (!window.confirm(`Remove ${fullName(student)}? Previous classroom records will remain.`)) return
    void run(() => deactivateStudent(student.id))
  }
  const cancel = () => { clear(); setError(''); setUncertain(false) }
  const inputClass = 'mt-2 min-h-12 w-full rounded-xl border-2 border-[#d9e3e2] px-4'

  return <div>
    <div className="flex flex-wrap items-center justify-between gap-3">
      <span className="font-bold text-muted">{students.length === 1 ? '1 student' : `${students.length} students`}</span>
      <button type="button" disabled={busy} onClick={() => { cancel(); firstRef.current?.focus() }} className="inline-flex min-h-12 items-center gap-2 rounded-xl bg-coral px-5 py-3 font-extrabold text-white disabled:opacity-60"><Plus size={19} aria-hidden="true" /> {heading}</button>
    </div>
    {!supabaseConfigured && <p role="status" className="mt-5 rounded-2xl bg-white p-4 font-bold text-muted">Preview mode · connect Supabase to save student changes.</p>}
    <form onSubmit={submit} noValidate className="teacher-card mt-5 p-5" aria-label={editing ? 'Edit student name' : 'Add student'} aria-busy={saving}>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="student-first-name" className="block font-bold text-ink">First Name</label>
          <input id="student-first-name" ref={firstRef} maxLength={NAME_LIMIT} value={first} onChange={event => setFirst(event.target.value)} disabled={busy} autoComplete="off" aria-invalid={Boolean(error) && !uncertain} aria-describedby={error ? 'student-name-error' : undefined} className={inputClass} placeholder="e.g. Thomas" />
        </div>
        <div>
          <label htmlFor="student-last-name" className="block font-bold text-ink">Last Name</label>
          <input id="student-last-name" maxLength={NAME_LIMIT} value={last} onChange={event => setLast(event.target.value)} disabled={busy} autoComplete="off" aria-invalid={Boolean(error) && !uncertain} aria-describedby={error ? 'student-name-error' : undefined} className={inputClass} placeholder="e.g. Edwards" />
        </div>
      </div>
      <p className="mt-2 text-sm text-muted">Children see their first name and last initial, like “Thomas E.”</p>
      {error && <div id="student-name-error" role="alert" className="mt-3 font-bold text-coral">{error}{uncertain && <button type="button" disabled={saving} onClick={() => { setError(''); setUncertain(false); void reload() }} className="mt-2 block rounded-xl bg-mint px-4 py-2 font-bold text-teal">Refresh list</button>}</div>}
      <div className="mt-4 flex gap-2">
        <button type="submit" disabled={busy} className="min-h-11 rounded-xl bg-teal px-4 font-extrabold text-white disabled:opacity-60">{saving ? 'Saving…' : editing ? 'Save Name' : 'Add Student'}</button>
        {(first || last || editing) && <button type="button" disabled={saving} onClick={cancel} className="min-h-11 rounded-xl px-4 font-bold text-teal">Cancel</button>}
      </div>
    </form>
    <ul className="mt-5 space-y-3" aria-label="Students">
      {students.map(student => <li key={student.id} className="teacher-card relative flex items-center gap-4 p-4">
        <StudentAvatar student={student} variant="compact" className="size-14 text-xl" />
        <span className="min-w-0 flex-1">
          <span className="block font-extrabold text-ink">{fullName(student)}</span>
          <span className="block text-sm font-semibold text-muted">Shows as “{student.displayName}”</span>
        </span>
        <button type="button" disabled={saving} aria-label={`Student options for ${fullName(student)}`} aria-expanded={menu === student.id} onClick={() => setMenu(menu === student.id ? null : student.id)} className="min-h-11 min-w-11 rounded-xl p-2 text-teal"><MoreVertical aria-hidden="true" /></button>
        {menu === student.id && <div className="absolute right-4 top-16 z-10 w-48 rounded-2xl border border-[#d9e3e2] bg-white p-2 shadow-lg">
          <button type="button" onClick={() => { setEditing(student); setMenu(null); setError('') }} className="block w-full rounded-xl px-3 py-3 text-left font-bold text-teal hover:bg-mint">Rename student</button>
        </div>}
        <button type="button" disabled={saving} aria-label={`Remove ${fullName(student)}`} onClick={() => removeStudent(student)} className="min-h-11 min-w-11 rounded-xl p-2 text-coral"><Trash2 aria-hidden="true" /></button>
      </li>)}
      {!students.length && <li className="teacher-card p-8 text-center font-bold text-muted">No students yet. Add your first classroom friend above.</li>}
    </ul>
  </div>
}
