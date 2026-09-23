// Shared synthetic browser harness: a local Vite server plus intercepted
// Supabase requests. Never real accounts, email delivery, or live data.
import assert from 'node:assert/strict'
export { assert }
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright')
const browser = await chromium.launch({ headless: true, ...(process.env.BROWSER_EXECUTABLE ? { executablePath: process.env.BROWSER_EXECUTABLE } : {}) })
const origin = process.env.TEST_APP_URL || 'http://127.0.0.1:5187'
const id = '00000000-0000-0000-0000-000000000001'
const room = '00000000-0000-0000-0000-000000000002'
const user = { id, aud: 'authenticated', role: 'authenticated', email: 'teacher@example.test', email_confirmed_at: new Date().toISOString(), user_metadata: { first_name: 'Sarah' }, app_metadata: { provider: 'email', providers: ['email'] }, created_at: new Date().toISOString() }
const token = [ { alg: 'HS256', typ: 'JWT' }, { sub: id, role: 'authenticated', exp: Math.floor(Date.now() / 1000) + 3600 } ].map(value => Buffer.from(JSON.stringify(value)).toString('base64url')).join('.') + '.synthetic'
const session = { access_token: token, refresh_token: 'synthetic-refresh', token_type: 'bearer', expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600, user }

export async function scenario(name, options, run) {
  const context = await browser.newContext()
  const page = await context.newPage()
  page.setDefaultTimeout(10000)
  const calls = []
  const errors = []
  page.on('pageerror', error => errors.push(error.message))
  // Abort any unexpected external request: a test must never reach real Supabase.
  await context.route('**/*', async route => {
    const url = new URL(route.request().url())
    if (url.origin === origin) return route.continue()
    if (url.hostname !== 'pip-test.invalid') return route.abort()
    const path = url.pathname
    let parsed = null
    try { parsed = route.request().postDataJSON() } catch { parsed = null } // multipart uploads are not JSON
    calls.push({ path, body: parsed })
    let body = []
    let status = 200
    const custom = options.handle?.(path, route.request(), options)
    if (custom) { status = custom.status ?? 200; body = custom.body ?? [] }
    else if (path === '/auth/v1/signup') {
      if (options.offline) return route.abort('internetdisconnected')
      if (options.signupError) { status = options.signupError.status; body = options.signupError.body }
      else body = options.immediate ? session : { ...user, identities: [] }
    } else if (path === '/auth/v1/user') body = user
    else if (path === '/auth/v1/token') body = session
    else if (path === '/auth/v1/logout') body = {}
    else if (path === '/rest/v1/rpc/bootstrap_teacher_profile') {
      if (options.profileError) { status = 503; body = { message: 'Synthetic failure' } }
      else body = { id, first_name: 'Sarah', created_at: user.created_at, onboarding_completed_at: options.ready ? user.created_at : null }
    } else if (path === '/rest/v1/classroom_teachers') {
      body = options.multiple ? [{ classroom_id: room }, { classroom_id: id }] : options.ready || options.hasClassroom ? [{ classroom_id: room, classrooms: { name: 'Test room', teacher_name: 'Sarah' } }] : []
    }
    await route.fulfill({ status, contentType: 'application/json', headers: { 'x-supabase-api-version': '2024-01-01', 'access-control-expose-headers': 'X-Supabase-Api-Version' }, body: JSON.stringify(body) })
  })
  if (options.signedIn) await context.addInitScript(value => localStorage.setItem('sb-pip-test-auth-token', JSON.stringify(value)), session)
  try {
    await run(page, calls, options)
    assert.deepEqual(errors, [], 'No uncaught browser exceptions')
    console.log('PASS ' + name)
  } finally { await context.close() }
}

export const fixtures = { origin, id, room, user, token, session }
export const close = () => browser.close()
