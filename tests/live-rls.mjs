// Live authorization checks against a real Supabase project using ONLY the
// browser (anon/publishable) key and ordinary client sessions. Privileged SQL
// cannot prove RLS; this suite acts as Teacher A, Teacher B, and an anonymous
// visitor. It creates synthetic classrooms/students/check-ins/responses for the
// two test teachers and deactivates what ordinary clients are allowed to touch.
// Student photos are not part of the MVP, so Storage is not exercised here.
// Use disposable test accounts only. Nothing here prints credentials or tokens.
//
// Setup (one time): create two confirmed synthetic teachers in Supabase
// Dashboard → Authentication → Users (e.g. pip-test-a@example.com and
// pip-test-b@example.com). Then put their credentials in .env.test.local
// (ignored by .gitignore; never commit it) or in the environment:
//   PIP_TEST_A_EMAIL=...  PIP_TEST_A_PASSWORD=...
//   PIP_TEST_B_EMAIL=...  PIP_TEST_B_PASSWORD=...
// The project URL and browser key are read from .env.local (VITE_SUPABASE_*).
//
// Run: node tests/live-rls.mjs            (full suite)
//      node tests/live-rls.mjs --anon     (anonymous checks only; no accounts)
// Afterwards, remove synthetic rows with supabase/inspection/cleanup_synthetic_teachers.sql.
import { readFileSync, existsSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'

function readEnvFile(path) {
  if (!existsSync(path)) return {}
  return Object.fromEntries(readFileSync(path, 'utf8').split('\n').filter(line => line.includes('=') && !line.trim().startsWith('#'))
    .map(line => { const i = line.indexOf('='); return [line.slice(0, i).trim(), line.slice(i + 1).trim()] }))
}
const env = { ...readEnvFile('.env.local'), ...readEnvFile('.env.test.local'), ...process.env }
const url = env.VITE_SUPABASE_URL
const key = env.VITE_SUPABASE_ANON_KEY
if (!url || !key) { console.error('Missing VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY'); process.exit(2) }
if (!/^(sb_publishable_|eyJ)/.test(key) || /service_role|sb_secret_/.test(key)) { console.error('Refusing: browser key does not look like a publishable/anon key'); process.exit(2) }
const anonOnly = process.argv.includes('--anon')

const results = []
function record(name, pass, detail = '') {
  results.push({ name, pass })
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? '  (' + detail + ')' : ''}`)
}
const codeOf = error => String(error?.code ?? error?.statusCode ?? error?.status ?? '')
const denied = (r, ...codes) => !!r.error && (codes.length === 0 || codes.includes(codeOf(r.error)))
function expectDenied(name, r, ...codes) { record(name, denied(r, ...codes), r.error ? `denied: ${codeOf(r.error)} ${String(r.error.message).slice(0, 60)}` : 'NOT denied') }
function expectNoRows(name, r) { record(name, !r.error && Array.isArray(r.data) && r.data.length === 0, r.error ? `error ${codeOf(r.error)}` : `${r.data?.length} rows`) }
function expectOk(name, r, check = () => true) { record(name, !r.error && check(r.data), r.error ? `${codeOf(r.error)} ${String(r.error.message).slice(0, 80)}` : '') }

const newClient = () => createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
const uuidRe = /^[0-9a-f-]{36}$/

// ---------------------------------------------------------------- anonymous
{
  const anon = newClient()
  for (const table of ['students', 'classrooms', 'classroom_teachers', 'check_ins', 'teacher_responses', 'teacher_profiles']) {
    const r = await anon.from(table).select('*').limit(1)
    // Either a privilege error (grant removed) or zero rows (policy only). The
    // security migration removes anon grants entirely, so require the error.
    record(`anon cannot read ${table} (grant revoked)`, denied(r, '42501'), r.error ? codeOf(r.error) : `${r.data?.length} rows visible`)
  }
  expectDenied('anon cannot insert check-in', await anon.from('check_ins').insert({ student_id: '00000000-0000-0000-0000-000000000000', emotion: 'happy' }))
  for (const fn of ['bootstrap_teacher_profile', 'complete_teacher_onboarding']) expectDenied(`anon cannot call ${fn}`, await anon.rpc(fn), '42501')
  expectDenied('anon cannot call provision_teacher_classroom', await anon.rpc('provision_teacher_classroom', { classroom_name: 'x' }), '42501')
}

if (!anonOnly) {
  const creds = ['A', 'B'].map(t => ({ email: env[`PIP_TEST_${t}_EMAIL`], password: env[`PIP_TEST_${t}_PASSWORD`] }))
  if (creds.some(c => !c.email || !c.password)) { console.error('Missing PIP_TEST_A_*/PIP_TEST_B_* credentials; run with --anon or provide them'); process.exit(2) }
  const A = newClient(); const B = newClient()
  const signIn = async (client, c) => { const r = await client.auth.signInWithPassword(c); if (r.error) { console.error('Sign-in failed for a test teacher:', codeOf(r.error), r.error.message); process.exit(2) } return r.data.user.id }
  const aId = await signIn(A, creds[0]); const bId = await signIn(B, creds[1])
  if (aId === bId) { console.error('Teacher A and B must be different accounts'); process.exit(2) }

  // Setup through the same RPCs the app uses. Idempotent for reruns.
  const roomA = await A.rpc('provision_teacher_classroom', { classroom_name: 'Live test room A' })
  const roomB = await B.rpc('provision_teacher_classroom', { classroom_name: 'Live test room B' })
  expectOk('A provisions/reuses classroom', roomA, d => uuidRe.test(d?.id)); expectOk('B provisions/reuses classroom', roomB, d => uuidRe.test(d?.id))
  if (roomA.error || roomB.error) { console.error('Cannot continue without classrooms'); process.exit(1) }
  const classA = roomA.data.id; const classB = roomB.data.id
  record('A and B have different classrooms', classA !== classB)
  expectOk('provisioning again returns the same classroom', await A.rpc('provision_teacher_classroom', { classroom_name: 'Different name' }), d => d?.id === classA)
  const sa = await A.from('students').insert({ classroom_id: classA, first_name: 'Live A child', last_name: 'Tester', active: true }).select('id').single()
  const sb = await B.from('students').insert({ classroom_id: classB, first_name: 'Live B child', last_name: 'Tester', active: true }).select('id').single()
  expectOk('A adds own student', sa, d => uuidRe.test(d?.id)); expectOk('B adds own student', sb, d => uuidRe.test(d?.id))
  if (sa.error || sb.error) process.exit(1)
  const SA = sa.data.id; const SB = sb.data.id

  // Profiles and memberships are scoped to the caller.
  expectOk('A reads only own profile', await A.from('teacher_profiles').select('id'), d => d.length === 1 && d[0].id === aId)
  expectOk('A reads only own membership', await A.from('classroom_teachers').select('classroom_id, teacher_id'), d => d.length >= 1 && d.every(m => m.teacher_id === aId))
  expectDenied('A cannot set onboarding_completed_at directly', await A.from('teacher_profiles').update({ onboarding_completed_at: new Date().toISOString() }).eq('id', aId), '42501')
  expectDenied('A cannot insert a profile', await A.from('teacher_profiles').insert({ id: aId, first_name: 'X' }), '42501')
  expectOk('A can edit own first_name', await A.from('teacher_profiles').update({ first_name: 'Live A' }).eq('id', aId).select('first_name'), d => d.length === 1)

  // Membership escalation and classroom writes.
  expectDenied('A cannot self-enroll in B classroom', await A.from('classroom_teachers').insert({ classroom_id: classB, teacher_id: aId }), '42501')
  expectDenied('A cannot enroll B in A classroom', await A.from('classroom_teachers').insert({ classroom_id: classA, teacher_id: bId }), '42501')
  expectDenied('A cannot insert classrooms directly', await A.from('classrooms').insert({ name: 'X', teacher_name: 'X' }), '42501')
  expectDenied('A cannot rename classroom directly', await A.from('classrooms').update({ name: 'X' }).eq('id', classA), '42501')
  expectNoRows('A cannot read B classroom', await A.from('classrooms').select('id').eq('id', classB))

  // Students: cross-classroom reads/writes and identity fields.
  expectNoRows('A cannot read B student by id', await A.from('students').select('id').eq('id', SB))
  expectNoRows('A update of B student affects 0 rows', await A.from('students').update({ first_name: 'Hacked' }).eq('id', SB).select('id'))
  expectDenied('A cannot add student to B classroom', await A.from('students').insert({ classroom_id: classB, first_name: 'Intruder', active: true }), '42501')
  expectDenied('A cannot add inactive student', await A.from('students').insert({ classroom_id: classA, first_name: 'Ghost', active: false }), '42501')
  expectDenied('A cannot move own student to B classroom', await A.from('students').update({ classroom_id: classB }).eq('id', SA), '42501')
  expectDenied('A cannot change student id', await A.from('students').update({ id: crypto.randomUUID() }).eq('id', SA), '42501')
  expectDenied('A cannot change student created_at', await A.from('students').update({ created_at: new Date().toISOString() }).eq('id', SA), '42501')
  expectDenied('A cannot delete student rows', await A.from('students').delete().eq('id', SA), '42501')
  expectOk('A renames own student', await A.from('students').update({ first_name: 'Live A renamed', last_name: 'Renamed' }).eq('id', SA).select('id'), d => d.length === 1)
  expectOk('B still sees own student unchanged', await B.from('students').select('first_name').eq('id', SB).single(), d => d.first_name === 'Live B child')

  // Check-ins and responses.
  expectDenied('A cannot check in B student', await A.from('check_ins').insert({ student_id: SB, emotion: 'happy' }), '42501')
  const ci = await A.from('check_ins').insert({ student_id: SA, emotion: 'sad' }).select('id').single()
  expectOk('A checks in own student', ci, d => uuidRe.test(d?.id))
  if (!ci.error) {
    expectNoRows('B cannot read A check-in', await B.from('check_ins').select('id').eq('id', ci.data.id))
    expectDenied('A cannot forge response teacher_id', await A.from('teacher_responses').insert({ student_id: SA, check_in_id: ci.data.id, teacher_id: bId, response_type: 'no_action_needed' }), '42501')
    expectDenied('A cannot pair response with B student', await A.from('teacher_responses').insert({ student_id: SB, check_in_id: ci.data.id, teacher_id: aId, response_type: 'no_action_needed' }), '42501')
    expectDenied('B cannot respond to A check-in', await B.from('teacher_responses').insert({ student_id: SA, check_in_id: ci.data.id, teacher_id: bId, response_type: 'no_action_needed' }), '42501')
    expectOk('A records legitimate response', await A.from('teacher_responses').insert({ student_id: SA, check_in_id: ci.data.id, teacher_id: aId, response_type: 'no_action_needed' }).select('id').single(), d => uuidRe.test(d?.id))
    expectNoRows('B cannot read A response', await B.from('teacher_responses').select('id').eq('check_in_id', ci.data.id))
    expectDenied('A cannot edit own response', await A.from('teacher_responses').update({ note: 'edited' }).eq('check_in_id', ci.data.id), '42501')
    expectDenied('A cannot delete check-ins', await A.from('check_ins').delete().eq('id', ci.data.id), '42501')
  }


  // Completion: server checks membership and an active student; direct edits denied above.
  expectOk('A completes onboarding with active student', await A.rpc('complete_teacher_onboarding'), d => !!d?.onboarding_completed_at)

  expectOk('A deactivates own student', await A.from('students').update({ active: false }).eq('id', SA).select('id'), d => d.length === 1)
  expectOk('B deactivates own student', await B.from('students').update({ active: false }).eq('id', SB).select('id'), d => d.length === 1)
  expectDenied('A cannot check in inactive student', await A.from('check_ins').insert({ student_id: SA, emotion: 'happy' }), '42501')
  expectOk('A still reads inactive history', await A.from('check_ins').select('id').eq('student_id', SA), d => d.length >= 1)
  expectOk('completion stays complete after empty roster', await A.rpc('complete_teacher_onboarding'), d => !!d?.onboarding_completed_at)
  await A.auth.signOut(); await B.auth.signOut()
}

const failed = results.filter(r => !r.pass)
console.log(`\n${results.length - failed.length}/${results.length} checks passed${failed.length ? '; FAILED: ' + failed.map(f => f.name).join(' | ') : ''}`)
process.exit(failed.length ? 1 : 0)
