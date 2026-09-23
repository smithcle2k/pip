import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../lib/auth'
import { supabase } from '../lib/supabase'
import { PASSWORD_MIN_LENGTH, authErrorMessage, withAuthTimeout } from '../lib/authHelpers'
import AuthStatus from '../components/teacher/AuthStatus'

export default function TeacherSignupPage() {
  const auth = useAuth()
  const [values, setValues] = useState({ name: '', email: '', password: '', confirm: '' })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [error, setError] = useState('')
  const [pending, setPending] = useState(false)
  const [sent, setSent] = useState('')
  const locked = useRef(false)
  const active = useRef(true)
  const heading = useRef<HTMLHeadingElement>(null)
  useEffect(() => { active.current = true; document.title = 'Create your teacher account · Pip'; return () => { active.current = false } }, [])
  useEffect(() => { if (sent) heading.current?.focus() }, [sent])
  async function submit(event: FormEvent) {
    event.preventDefault()
    if (locked.current) return
    const name = values.name.trim(), email = values.email.trim()
    const next: Record<string, string> = {}
    if (!name || [...name].length > 80 || /[\u0000-\u001f\u007f-\u009f]/.test(name)) next.name = 'Enter your first name using 1–80 characters and no control characters.'
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) next.email = 'Enter a valid email address.'
    if (!values.password) next.password = 'Enter a password.'
    else if (values.password.length < PASSWORD_MIN_LENGTH) next.password = `Use at least ${PASSWORD_MIN_LENGTH} characters.`
    if (!values.confirm || values.confirm !== values.password) next.confirm = 'Passwords must match exactly.'
    setErrors(next); setError('')
    if (Object.keys(next).length) { document.getElementById(`signup-${Object.keys(next)[0]}`)?.focus(); return }
    if (!supabase) { setError('Account creation requires a connection to Pip.'); return }
    locked.current = true; setPending(true)
    try {
      const result = await withAuthTimeout(supabase.auth.signUp({ email, password: values.password, options: { data: { first_name: name }, emailRedirectTo: `${window.location.origin}/teacher/auth/callback` } }))
      if (!active.current) return
      if (result.error && !['user_already_exists', 'email_exists'].includes(result.error.code ?? '')) { setError(authErrorMessage(result.error)); return }
      if (!result.data.session) { setSent(email); setValues(previous => ({ ...previous, password: '', confirm: '' })) }
    } catch (failure) { if (active.current) setError(authErrorMessage(failure)) }
    finally { locked.current = false; if (active.current) setPending(false) }
  }
  if (auth.loading || auth.session || auth.error || auth.callbackError || auth.recovery) return <AuthStatus />
  if (sent) return <section className="mx-auto w-full max-w-md rounded-2xl bg-white p-8"><h1 ref={heading} tabIndex={-1} className="text-3xl font-extrabold">Check your email</h1><p className="mt-4">We sent a confirmation link to {sent}.</p><p className="mt-3">If you already have an account, sign in using your existing password. For privacy, this message does not confirm whether an account exists.</p><Link className="mt-5 inline-block font-bold text-teal" to="/teacher/login">Back to Sign In</Link></section>
  return <section className="mx-auto w-full max-w-md rounded-[2rem] bg-white p-8 shadow-xl"><h1 className="text-3xl font-extrabold text-ink">Create your teacher account</h1>
    <form noValidate onSubmit={submit} className="mt-6 space-y-4" aria-busy={pending}>
      <fieldset disabled={pending} className="space-y-4">
        {([{ key: 'name', label: 'First Name', type: 'text', auto: 'given-name' }, { key: 'email', label: 'Email', type: 'email', auto: 'email' }, { key: 'password', label: 'Password', type: 'password', auto: 'new-password' }, { key: 'confirm', label: 'Confirm Password', type: 'password', auto: 'new-password' }] as const).map(field => <div key={field.key}><label htmlFor={`signup-${field.key}`} className="block font-bold">{field.label}</label><input id={`signup-${field.key}`} name={field.key} required type={field.type} autoComplete={field.auto} value={values[field.key]} onChange={event => setValues({ ...values, [field.key]: event.target.value })} aria-invalid={Boolean(errors[field.key])} aria-describedby={errors[field.key] ? `error-${field.key}` : field.key === 'password' ? 'password-help' : undefined} className="mt-2 w-full rounded-xl border-2 border-[#d9e3e2] px-4 py-3" />{errors[field.key] && <p id={`error-${field.key}`} role="alert" className="mt-1 text-coral">{errors[field.key]}</p>}</div>)}
        <p id="password-help" className="text-sm text-muted">{`Use at least ${PASSWORD_MIN_LENGTH} characters. A longer, unique password is safer.`}</p>
        <button className="min-h-14 w-full rounded-xl bg-teal px-5 py-3 font-extrabold text-white disabled:opacity-60" type="submit">{pending ? 'Creating account…' : 'Create Account'}</button>
      </fieldset>
      {pending && <p role="status">Creating your account…</p>}{error && <p role="alert" className="text-coral">{error}</p>}
    </form><p className="mt-5">Already have an account? <Link to="/teacher/login" className="font-bold text-teal">Sign In</Link></p>
  </section>
}
