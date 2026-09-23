import { useId, useState, type FormEvent } from 'react'
import { Check, MessageCircle, Moon, Move, Palette, Shield, Sparkles } from 'lucide-react'
import { NOTE_LIMIT, noteLength } from '../../lib/data'
import type { ResponseType } from '../../types'

export const responseOptions: { value: ResponseType; label: string; description: string; icon: typeof Check }[] = [
  { value: 'quick_conversation', label: 'Quick conversation', description: 'Talked with the child for a few minutes.', icon: MessageCircle },
  { value: 'calm_down_break', label: 'Calm-down break', description: 'Gave the child time to reset.', icon: Moon },
  { value: 'movement_break', label: 'Movement break', description: 'Used a short movement activity.', icon: Move },
  { value: 'quiet_space', label: 'Quiet space', description: 'Offered a calm, quiet area.', icon: Shield },
  { value: 'classroom_activity', label: 'Classroom activity', description: 'Used a classroom SEL activity.', icon: Palette },
  { value: 'no_action_needed', label: 'No action needed', description: 'Reviewed the check-in; no follow-up was needed.', icon: Sparkles },
]

export default function TeacherResponseForm({ saving, disabled, error, onSubmit }: { saving: boolean; disabled?: boolean; error: string; onSubmit: (input: { responseType: ResponseType; note: string }) => void }) {
  const [selected, setSelected] = useState<ResponseType>()
  const [note, setNote] = useState('')
  const [localError, setLocalError] = useState('')
  const groupId = useId()
  const count = noteLength(note)
  const message = localError || error

  function submit(event: FormEvent) {
    event.preventDefault()
    if (!selected) { setLocalError('Choose how you responded.'); return }
    if (count > NOTE_LIMIT) { setLocalError(`Notes can be up to ${NOTE_LIMIT} characters.`); return }
    setLocalError('')
    onSubmit({ responseType: selected, note })
  }

  return (
    <form onSubmit={submit} noValidate className="teacher-card mt-5 p-6">
      <fieldset>
        <legend id={groupId} className="text-xl font-extrabold text-ink">How did you respond?</legend>
        <div role="radiogroup" aria-labelledby={groupId} className="mt-4 grid gap-3 sm:grid-cols-2">
          {responseOptions.map(option => {
            const Icon = option.icon
            const checked = selected === option.value
            return (
              <label key={option.value} className={`relative block cursor-pointer rounded-2xl border-2 p-4 focus-within:outline-3 focus-within:outline-teal ${checked ? 'border-teal bg-mint' : 'border-[#e2e8f0] bg-white'}`}>
                <input type="radio" name="response" value={option.value} checked={checked} onChange={() => { setSelected(option.value); setLocalError('') }} disabled={saving} className="sr-only" />
                <Icon size={22} className="text-teal" aria-hidden="true" />
                <span className="mt-2 block font-extrabold text-ink">{option.label}</span>
                <span className="mt-1 block text-sm font-semibold text-muted">{option.description}</span>
              </label>
            )
          })}
        </div>
      </fieldset>
      <label className="mt-5 block font-extrabold text-ink">Optional note
        <textarea value={note} onChange={event => setNote(event.target.value)} disabled={saving} placeholder="Add a short private note..." aria-describedby={`${groupId}-count`} aria-invalid={count > NOTE_LIMIT} className="mt-2 min-h-24 w-full rounded-xl border border-[#cbd5e1] p-3 font-semibold" />
      </label>
      <span id={`${groupId}-count`} className={`mt-1 block text-right text-sm font-bold ${count > NOTE_LIMIT ? 'text-coral' : 'text-muted'}`}>{count} / {NOTE_LIMIT}</span>
      {message && <p role="alert" className="mt-3 font-bold text-coral">{message}</p>}
      {disabled && <p className="mt-3 text-sm font-semibold text-muted">Demo preview: responses can’t be saved without a classroom database.</p>}
      <button type="submit" disabled={disabled || saving} className="mt-4 w-full rounded-xl bg-teal px-5 py-4 font-extrabold text-white disabled:opacity-60">{saving ? 'Saving…' : 'Mark as Checked In With'}</button>
    </form>
  )
}
