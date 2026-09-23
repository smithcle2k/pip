import { useEffect, useMemo, useRef, useState } from 'react'
import type { Classroom, Student } from '../../types'
import { loadCheckInExport, loadStudents, recordCheckInExport } from '../../lib/data'
import { exportFilename, selectedStudentIds, serializeCheckInsCsv } from '../../lib/checkInExport'
import { formatDateKey, presetDates, resolveExportDates, type ExportPreset } from '../../lib/exportDates'
import { supabaseConfigured } from '../../lib/supabase'

export default function CheckInExportDialog({ classroom, onClose }: { classroom?: Classroom; onClose: () => void }) {
  const initial = presetDates('last30')
  const [preset, setPreset] = useState<ExportPreset>('last30')
  const [startDate, setStartDate] = useState(initial.startDate)
  const [endDate, setEndDate] = useState(initial.endDate)
  const [students, setStudents] = useState<Student[]>([])
  const [includeInactive, setIncludeInactive] = useState(false)
  const [selected, setSelected] = useState<string[]>([])
  const [status, setStatus] = useState<'loading' | 'ready' | 'exporting' | 'error'>('loading')
  const [message, setMessage] = useState('')
  const dialogRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLElement | null>(document.activeElement as HTMLElement)
  const abortRef = useRef<AbortController | null>(null)
  useEffect(() => {
    dialogRef.current?.focus()
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') { event.preventDefault(); onClose(); return }
      if (event.key !== 'Tab' || !dialogRef.current) return
      const focusable = Array.from(dialogRef.current.querySelectorAll<HTMLElement>('button, input, [href], select, textarea, [tabindex]:not([tabindex="-1"])')).filter(element => !element.hasAttribute('disabled'))
      if (!focusable.length) return
      const first = focusable[0]; const last = focusable[focusable.length - 1]
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus() }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus() }
    }
    document.addEventListener('keydown', onKeyDown)
    let active = true
    loadStudents({ includeInactive: true }).then(result => { if (!active) return; if (result.error) { setStatus('error'); setMessage(result.error); return }; setStudents(result.students); setSelected(selectedStudentIds(result.students, false)); setStatus('ready') })
    return () => { active = false; document.removeEventListener('keydown', onKeyDown); abortRef.current?.abort(); triggerRef.current?.focus() }
  }, [])
  const activeStudents = useMemo(() => students.filter(student => student.active), [students])
  const inactiveStudents = useMemo(() => students.filter(student => !student.active), [students])
  const range = resolveExportDates(startDate, endDate)
  function choosePreset(next: ExportPreset) { setPreset(next); if (next !== 'custom') { const dates = presetDates(next); setStartDate(dates.startDate); setEndDate(dates.endDate) } }
  function toggleStudent(id: string) { setSelected(current => current.includes(id) ? current.filter(value => value !== id) : [...current, id]) }
  function toggleInactive(value: boolean) { setIncludeInactive(value); if (!value) setSelected(current => current.filter(id => students.find(student => student.id === id)?.active)) }
  async function download() {
    if (!supabaseConfigured) { setStatus('error'); setMessage('Demo mode: downloads require a connected classroom.'); return }
    if (!classroom || !range.range || !selected.length || status === 'exporting') return
    setStatus('exporting'); setMessage('Preparing your CSV…'); const controller = new AbortController(); abortRef.current = controller
    const loaded = await loadCheckInExport({ classroomId: classroom.id, bounds: range.range, selectedStudentIds: selected, includeInactive, signal: controller.signal })
    if (loaded.error) { if (!controller.signal.aborted) { setStatus('error'); setMessage(loaded.error) }; return }
    if (!loaded.rows.length) { setStatus('ready'); setMessage('No check-ins match those dates and students. Nothing was downloaded.'); return }
    const audited = await recordCheckInExport({ classroomId: classroom.id, startDate, endDate, timeZone: range.range.timeZone, selectedStudentIds: selected, includeInactive, rowCount: loaded.rows.length })
    if (audited.error) { setStatus('error'); setMessage(audited.error); return }
    if (controller.signal.aborted) return
    const url = URL.createObjectURL(new Blob([serializeCheckInsCsv(loaded.rows, range.range.timeZone)], { type: 'text/csv;charset=utf-8' }))
    const link = document.createElement('a'); link.href = url; link.download = exportFilename(startDate, endDate); link.click(); setTimeout(() => URL.revokeObjectURL(url), 0)
    setStatus('ready'); setMessage(`${loaded.rows.length} check-in${loaded.rows.length === 1 ? '' : 's'} downloaded.`)
  }
  return <div className="fixed inset-0 z-20 flex items-center justify-center bg-teal/40 p-4" role="presentation"><div ref={dialogRef} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby="export-title" className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-3xl bg-white p-6 shadow-xl sm:p-8">
    <div className="flex items-start justify-between gap-4"><div><h2 id="export-title" className="text-2xl font-extrabold text-ink">Download check-ins</h2><p className="mt-1 text-sm font-semibold text-muted">Choose the records to include in your CSV.</p></div><button type="button" onClick={onClose} className="rounded-xl px-3 py-2 font-bold text-teal">Close</button></div>
    {status === 'loading' && <p role="status" className="mt-6 font-bold text-muted">Loading your classroom roster…</p>}
    {status !== 'loading' && <form onSubmit={event => { event.preventDefault(); void download() }}>
      <fieldset className="mt-6"><legend className="font-extrabold text-ink">Date range</legend><div className="mt-2 flex flex-wrap gap-2">{([['last7', 'Last 7 days'], ['last30', 'Last 30 days'], ['custom', 'Custom dates']] as const).map(([value, label]) => <button key={value} type="button" aria-pressed={preset === value} onClick={() => choosePreset(value)} className={`rounded-xl px-3 py-2 text-sm font-extrabold ${preset === value ? 'bg-teal text-white' : 'bg-[#eef4f2] text-teal'}`}>{label}</button>)}</div>{preset === 'custom' && <div className="mt-3 grid gap-3 sm:grid-cols-2"><label className="font-bold">Start date<input type="date" value={startDate} onChange={event => { setPreset('custom'); setStartDate(event.target.value) }} className="mt-1 block w-full rounded-xl border border-slate-300 p-3" /></label><label className="font-bold">End date<input type="date" value={endDate} onChange={event => { setPreset('custom'); setEndDate(event.target.value) }} className="mt-1 block w-full rounded-xl border border-slate-300 p-3" /></label></div>}<p className="mt-3 text-sm font-semibold text-muted">{range.range ? `${formatDateKey(startDate)} through ${formatDateKey(endDate)} · ${range.range.timeZone}` : range.error}</p></fieldset>
      <fieldset className="mt-6"><legend className="font-extrabold text-ink">Students</legend><label className="mt-3 flex items-center gap-3 font-bold"><input type="checkbox" checked={selected.filter(id => activeStudents.some(student => student.id === id)).length === activeStudents.length} onChange={event => setSelected(event.target.checked ? [...new Set([...selected.filter(id => !activeStudents.some(student => student.id === id)), ...activeStudents.map(student => student.id)])] : selected.filter(id => !activeStudents.some(student => student.id === id)))} />All active students</label><div className="mt-2 grid gap-2 sm:grid-cols-2">{students.map(student => <label key={student.id} className={`flex items-center gap-3 rounded-xl p-2 font-semibold ${student.active ? 'bg-[#f7f9fa]' : 'bg-[#fff7e1]'}`}><input type="checkbox" checked={selected.includes(student.id)} disabled={!student.active && !includeInactive} onChange={() => toggleStudent(student.id)} />{student.firstName} {student.lastName}{!student.active && ' (inactive)'}</label>)}</div><label className="mt-4 flex items-center gap-3 font-bold"><input type="checkbox" checked={includeInactive} onChange={event => toggleInactive(event.target.checked)} />Include inactive students</label><p className="mt-2 text-sm font-semibold text-muted">{selected.length} student{selected.length === 1 ? '' : 's'} selected ({inactiveStudents.length} inactive available).</p></fieldset>
      <p className="mt-6 rounded-2xl bg-[#fff7e1] p-4 text-sm font-bold text-ink">Contains student information. Store and share according to your school’s policy.</p>
      {!supabaseConfigured && <p className="mt-4 rounded-2xl bg-[#eef4f2] p-4 text-sm font-bold text-teal">Demo preview: downloads require a connected classroom.</p>}
      {(message || status === 'error') && <p role={status === 'error' ? 'alert' : 'status'} className={`mt-4 font-bold ${status === 'error' ? 'text-coral' : 'text-teal'}`}>{message}</p>}
      <div className="mt-6 flex flex-wrap justify-end gap-3"><button type="button" onClick={onClose} className="rounded-xl px-4 py-3 font-extrabold text-teal">Cancel</button><button disabled={!supabaseConfigured || status === 'exporting' || !classroom || !range.range || !selected.length} className="rounded-xl bg-teal px-5 py-3 font-extrabold text-white">{status === 'exporting' ? 'Preparing…' : 'Download CSV'}</button></div>
    </form>}
  </div></div>
}
