// Synthetic checks for the resumable /teacher/setup wizard (Milestone 5).
// Same server setup as tests/teacher-signup.browser.mjs; run with
// node tests/teacher-setup.browser.mjs.
import { assert, scenario, fixtures, close } from './browser-harness.mjs'
const { origin, room, id } = fixtures

// Provisioning mock: the first successful call "saves" a classroom so later
// membership reads return it, exactly like the idempotent server function.
function provisioning(options) {
  return (path, request, state) => {
    if (path !== '/rest/v1/rpc/provision_teacher_classroom') return null
    state.provisionCalls = (state.provisionCalls ?? 0) + 1
    state.lastName = request.postDataJSON()?.classroom_name
    if (options.fail && state.provisionCalls <= options.fail) return { status: 503, body: { message: 'RAW PRIVATE DETAIL' } }
    state.hasClassroom = true
    return { body: { id: room, name: state.lastName, teacher_name: 'Sarah', created_at: new Date().toISOString() } }
  }
}

// Roster mock: an in-memory students table keyed by ID, plus the completion RPC.
function roster(options = {}) {
  return (path, request, state) => {
    state.students ??= []
    const method = request.method()
    if (path === '/rest/v1/students' && method === 'GET') return { body: state.students.filter(s => s.active) }
    if (path === '/rest/v1/students' && method === 'POST') {
      state.inserts = (state.inserts ?? 0) + 1
      if (options.failInsert && state.inserts <= options.failInsert) return { status: 503, body: { message: 'RAW PRIVATE DETAIL' } }
      const row = { id: `10000000-0000-0000-0000-${String(state.inserts).padStart(12, '0')}`, classroom_id: room, first_name: request.postDataJSON().first_name, last_name: request.postDataJSON().last_name ?? '', active: true }
      state.students.push(row); return { body: row }
    }
    if (path === '/rest/v1/students' && method === 'PATCH') {
      const target = new URL(request.url()).searchParams.get('id')?.replace('eq.', '')
      const patch = request.postDataJSON(); const row = state.students.find(s => s.id === target && s.active)
      if (!row) return { status: 406, body: { code: 'PGRST116', message: 'no rows' } }
      Object.assign(row, patch); return { body: row }
    }
    if (path === '/rest/v1/rpc/complete_teacher_onboarding') {
      state.completions = (state.completions ?? 0) + 1
      if (options.failComplete && state.completions <= options.failComplete) return { status: 400, body: { code: '22023', message: 'Add an active student before finishing setup' } }
      if (!state.students.some(s => s.active)) return { status: 400, body: { code: '22023', message: 'Add an active student before finishing setup' } }
      state.ready = true; return { body: { id, first_name: 'Sarah', created_at: new Date().toISOString(), onboarding_completed_at: new Date().toISOString() } }
    }
    return null
  }
}

try {
  await scenario('roster step: add, rename, remove, re-add, finish → dashboard ready message', { signedIn: true, hasClassroom: true, handle: roster() }, async (page, calls, state) => {
    await page.goto(origin + '/teacher/setup')
    await page.getByRole('heading', { name: 'Add your students' }).waitFor()
    const finish = page.getByRole('button', { name: 'Finish Setup' })
    assert.equal(await finish.isEnabled(), false, 'Finish Setup disabled with no students')
    await page.getByLabel('First Name').fill('  Chloe  ')
    await page.getByLabel('Last Name').fill('Edwards')
    await page.getByRole('button', { name: 'Add Student', exact: true }).last().dblclick()
    await page.getByRole('list', { name: 'Students' }).getByText('Chloe Edwards').waitFor()
    assert.equal(state.inserts, 1, 'double-click adds once')
    assert.equal(await page.getByLabel('First Name').inputValue(), '', 'form cleared after save')
    assert.equal(await page.getByLabel('Last Name').inputValue(), '', 'form cleared after save')
    await page.getByText('Shows as “Chloe E.”').waitFor()
    await finish.isEnabled()
    await page.getByRole('button', { name: 'Student options for Chloe Edwards' }).click()
    await page.getByRole('button', { name: 'Rename student' }).click()
    await page.getByLabel('First Name').fill('Chloé')
    await page.getByLabel('Last Name').fill('Edwards')
    await page.getByRole('button', { name: 'Save Name' }).click()
    await page.getByRole('list', { name: 'Students' }).getByText('Chloé Edwards').waitFor()
    page.once('dialog', dialog => dialog.accept())
    await page.getByRole('button', { name: 'Remove Chloé Edwards' }).click()
    await page.getByText('No students yet').waitFor()
    assert.equal(state.students[0].active, false, 'soft deactivation, row kept')
    assert.equal(await finish.isEnabled(), false, 'Finish Setup disabled again')
    await page.getByLabel('First Name').fill('Sam')
    await page.getByLabel('Last Name').fill('Edwards')
    await page.getByRole('button', { name: 'Add Student', exact: true }).last().click()
    await page.getByRole('list', { name: 'Students' }).getByText('Sam Edwards').waitFor()
    await finish.dblclick()
    await page.waitForURL(origin + '/teacher')
    await page.getByText('Your classroom is ready!').waitFor()
    assert.equal(state.completions, 1)
    await page.reload()
    await page.getByRole('heading', { name: /Good morning|Teacher dashboard/ }).waitFor()
    assert.equal(await page.getByText('Your classroom is ready!').count(), 0, 'message shown once')
  })
  await scenario('failed add keeps the name and offers a refresh instead of a blind retry', { signedIn: true, hasClassroom: true, handle: roster({ failInsert: 1 }) }, async (page, calls, state) => {
    await page.goto(origin + '/teacher/setup')
    await page.getByLabel('First Name').fill('Chloe')
    await page.getByLabel('Last Name').fill('Edwards')
    await page.getByRole('button', { name: 'Add Student', exact: true }).last().click()
    await page.getByRole('button', { name: 'Refresh list' }).waitFor()
    assert.equal(await page.getByText('RAW PRIVATE DETAIL').count(), 0)
    assert.equal(await page.getByLabel('First Name').inputValue(), 'Chloe')
    await page.getByRole('button', { name: 'Refresh list' }).click()
    await page.waitForTimeout(300)
    assert.equal(state.inserts, 1, 'refresh does not resubmit')
    await page.getByRole('button', { name: 'Add Student', exact: true }).last().click()
    await page.getByRole('list', { name: 'Students' }).getByText('Chloe Edwards').waitFor()
  })
  await scenario('server rejects completion when the roster changed; page reloads roster', { signedIn: true, hasClassroom: true, handle: roster({ failComplete: 1 }) }, async (page, calls, state) => {
    await page.goto(origin + '/teacher/setup')
    await page.getByLabel('First Name').fill('Chloe')
    await page.getByLabel('Last Name').fill('Edwards')
    await page.getByRole('button', { name: 'Add Student', exact: true }).last().click()
    await page.getByRole('list', { name: 'Students' }).getByText('Chloe Edwards').waitFor()
    await page.getByRole('button', { name: 'Finish Setup' }).click()
    await page.getByText('Add at least one student before finishing setup.').waitFor()
    assert.equal(new URL(page.url()).pathname, '/teacher/setup')
    await page.getByRole('button', { name: 'Finish Setup' }).click()
    await page.waitForURL(origin + '/teacher')
    assert.equal(state.completions, 2)
  })
  await scenario('new teacher: welcome → classroom name → saved roster step, one provisioning call', { signedIn: true, handle: provisioning({}) }, async (page, calls, state) => {
    await page.goto(origin + '/teacher/setup')
    await page.getByRole('heading', { name: 'Welcome to Pip, Sarah!' }).waitFor()
    await page.getByText("Let's set up your classroom.").waitFor()
    await page.getByRole('button', { name: 'Get Started' }).click()
    await page.getByRole('heading', { name: 'What should we call your classroom?' }).waitFor()
    assert.equal(await page.getByLabel('Classroom Name').getAttribute('placeholder'), 'Room 4')
    await page.getByRole('button', { name: 'Create Classroom' }).click()
    await page.getByRole('alert').waitFor()
    assert.equal(state.provisionCalls ?? 0, 0, 'empty name never reaches the server')
    await page.getByLabel('Classroom Name').fill('  Sunflower Room  ')
    await page.getByRole('button', { name: 'Create Classroom' }).dblclick()
    await page.getByRole('heading', { name: 'Add your students' }).waitFor()
    await page.getByText('Test room').waitFor()
    assert.equal(state.provisionCalls, 1)
    assert.equal(state.lastName, 'Sunflower Room')
    // Reload resumes at the saved step without provisioning again.
    await page.reload()
    await page.getByRole('heading', { name: 'Add your students' }).waitFor()
    assert.equal(state.provisionCalls, 1)
    assert.equal(new URL(page.url()).pathname, '/teacher/setup')
  })
  await scenario('provisioning failure is recoverable without raw errors; retry succeeds', { signedIn: true, handle: provisioning({ fail: 1 }) }, async (page, calls, state) => {
    await page.goto(origin + '/teacher/setup')
    await page.getByRole('button', { name: 'Get Started' }).click()
    await page.getByLabel('Classroom Name').fill('Room 4')
    await page.getByRole('button', { name: 'Create Classroom' }).click()
    await page.getByRole('alert').waitFor()
    assert.equal(await page.getByText('RAW PRIVATE DETAIL').count(), 0)
    assert.equal(await page.getByRole('button', { name: 'Create Classroom' }).isEnabled(), true)
    assert.equal(await page.getByLabel('Classroom Name').inputValue(), 'Room 4', 'typed name is kept')
    await page.getByRole('button', { name: 'Create Classroom' }).click()
    await page.getByRole('heading', { name: 'Add your students' }).waitFor()
    assert.equal(state.provisionCalls, 2)
  })
  await scenario('teacher with a saved classroom resumes directly at the roster step', { signedIn: true, hasClassroom: true }, async (page, calls, state) => {
    await page.goto(origin + '/teacher/setup')
    await page.getByRole('heading', { name: 'Add your students' }).waitFor()
    assert.equal(await page.getByRole('heading', { name: /welcome/i }).count(), 0)
    assert.equal(state.provisionCalls ?? 0, 0)
  })
  await scenario('completed teacher skips setup', { signedIn: true, ready: true }, async page => {
    await page.goto(origin + '/teacher/setup')
    await page.waitForURL(origin + '/teacher')
  })
  await scenario('unfinished teacher cannot deep-link into the dashboard', { signedIn: true, hasClassroom: true }, async page => {
    await page.goto(origin + '/teacher/students')
    await page.waitForURL('**/teacher/setup')
    await page.getByRole('heading', { name: 'Add your students' }).waitFor()
  })
  await scenario('signed-out visitor is sent to login', {}, async page => {
    await page.goto(origin + '/teacher/setup')
    await page.waitForURL('**/teacher/login')
  })
  await scenario('multiple memberships stay an explicit error, not a loop', { signedIn: true, multiple: true }, async page => {
    await page.goto(origin + '/teacher/setup')
    await page.getByText(/more than one classroom/i).waitFor()
    assert.equal(new URL(page.url()).pathname, '/teacher/setup')
  })
  await scenario('readiness failure shows retry and keeps saved state', { signedIn: true, profileError: true }, async (page, calls, options) => {
    await page.goto(origin + '/teacher/setup')
    await page.getByRole('button', { name: 'Try again' }).waitFor()
    options.profileError = false
    await page.getByRole('button', { name: 'Try again' }).click()
    await page.getByRole('heading', { name: 'Welcome to Pip, Sarah!' }).waitFor()
  })
  await scenario('sign out from setup returns to login', { signedIn: true }, async page => {
    await page.goto(origin + '/teacher/setup')
    await page.getByRole('button', { name: 'Sign Out' }).click()
    await page.waitForURL('**/teacher/login')
  })
  console.log('All synthetic setup wizard checks passed.')
} finally { await close() }
