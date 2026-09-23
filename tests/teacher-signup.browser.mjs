// Synthetic API/browser checks, never real accounts or email delivery.
// Start Vite with VITE_SUPABASE_URL=https://pip-test.invalid and a synthetic key.
// Run with node tests/teacher-signup.browser.mjs. PLAYWRIGHT_MODULE can point to
// an existing Playwright index.mjs; BROWSER_EXECUTABLE can select installed Chromium.
import { assert, scenario, fixtures, close } from './browser-harness.mjs'
const { origin, token, session } = fixtures

async function fillSignup(page, password = '  Valid password 42!  ') {
  await page.goto(origin + '/teacher/signup')
  await page.getByLabel('First Name', { exact: true }).fill('  Sarah  ')
  await page.getByLabel('Email', { exact: true }).fill('teacher@example.test')
  await page.getByLabel('Password', { exact: true }).fill(password)
  await page.getByLabel('Confirm Password', { exact: true }).fill(password)
}

try {
  await scenario('matching passwords required before sending signup', {}, async (page, calls) => {
    await fillSignup(page)
    await page.getByLabel('Confirm Password', { exact: true }).fill('different')
    await page.getByRole('button', { name: 'Create Account', exact: true }).click()
    await page.getByText(/passwords.*match/i).waitFor()
    assert.equal(calls.filter(call => call.path === '/auth/v1/signup').length, 0)
  })
  await scenario('confirmation-required signup preserves passwords and stays unauthenticated', {}, async (page, calls) => {
    await fillSignup(page)
    await page.getByRole('button', { name: 'Create Account', exact: true }).dblclick()
    await page.getByRole('heading', { name: 'Check your email' }).waitFor()
    const signup = calls.filter(call => call.path === '/auth/v1/signup')
    assert.equal(signup.length, 1)
    assert.equal(signup[0].body.password, '  Valid password 42!  ')
    assert.equal(signup[0].body.data.first_name, 'Sarah')
    assert.equal(calls.some(call => call.path.includes('bootstrap_teacher_profile')), false)
    await page.getByRole('link', { name: 'Back to Sign In' }).waitFor()
  })
  await scenario('passwords shorter than the configured minimum never reach Auth', {}, async (page, calls) => {
    await fillSignup(page, 'abc')
    await page.getByRole('button', { name: 'Create Account', exact: true }).click()
    await page.getByRole('alert').filter({ hasText: /at least 6 characters/i }).waitFor()
    assert.equal(calls.filter(call => call.path === '/auth/v1/signup').length, 0)
  })
  await scenario('provider weak-password rejection is friendly', { signupError: { status: 422, body: { code: 'weak_password', msg: 'RAW PRIVATE DETAIL', weak_password: { reasons: ['pwned'] } } } }, async page => {
    await fillSignup(page)
    await page.getByRole('button', { name: 'Create Account', exact: true }).click()
    await page.getByText(/data breach/i).waitFor()
    assert.equal(await page.getByText('RAW PRIVATE DETAIL').count(), 0)
  })
  await scenario('duplicate account response uses neutral confirmation view', { signupError: { status: 422, body: { code: 'user_already_exists', msg: 'RAW PRIVATE DETAIL' } } }, async page => {
    await fillSignup(page)
    await page.getByRole('button', { name: 'Create Account', exact: true }).click()
    await page.getByRole('heading', { name: 'Check your email' }).waitFor()
    assert.equal(await page.getByText('RAW PRIVATE DETAIL').count(), 0)
  })
  await scenario('rate limiting is recoverable without raw provider details', { signupError: { status: 429, body: { code: 'over_email_send_rate_limit', msg: 'RAW PRIVATE DETAIL' } } }, async page => {
    await fillSignup(page)
    await page.getByRole('button', { name: 'Create Account', exact: true }).click()
    await page.getByRole('alert').waitFor()
    assert.equal(await page.getByRole('button', { name: 'Create Account', exact: true }).isEnabled(), true)
    assert.equal(await page.getByText('RAW PRIVATE DETAIL').count(), 0)
  })
  await scenario('immediate session bootstraps profile and reaches unfinished setup', { immediate: true }, async (page, calls) => {
    await fillSignup(page)
    await page.getByRole('button', { name: 'Create Account', exact: true }).click()
    await page.waitForURL('**/teacher/setup')
    await page.getByRole('heading', { name: /welcome.*Sarah/i }).waitFor()
    assert.ok(calls.some(call => call.path.includes('bootstrap_teacher_profile')))
  })
  await scenario('existing completed teacher skips signup', { signedIn: true, ready: true }, async page => {
    await page.goto(origin + '/teacher/signup')
    await page.waitForURL(origin + '/teacher')
  })
  await scenario('valid confirmation processed once and credentials removed', {}, async (page, calls) => {
    const fragment = new URLSearchParams({ access_token: token, refresh_token: session.refresh_token, expires_in: '3600', token_type: 'bearer', type: 'signup' })
    await page.goto(origin + '/teacher/auth/callback#' + fragment)
    await page.waitForURL('**/teacher/setup')
    assert.equal(new URL(page.url()).hash, '')
    assert.equal(new URL(page.url()).search, '')
    assert.equal(calls.filter(call => call.path === '/auth/v1/user').length, 1)
  })
  await scenario('expired link does not silently succeed through an existing session', { signedIn: true, ready: true }, async page => {
    await page.goto(origin + '/teacher/auth/callback#error=access_denied&error_code=otp_expired&error_description=RAW_PRIVATE_DETAIL')
    await page.getByRole('button', { name: /sign in/i }).first().waitFor()
    assert.equal(new URL(page.url()).pathname, '/teacher/auth/callback')
    assert.equal(new URL(page.url()).hash, '')
    assert.equal(await page.getByText('RAW_PRIVATE_DETAIL').count(), 0)
  })
  await scenario('readiness query errors do not become empty classrooms; retry recovers', { signedIn: true, profileError: true }, async (page, calls, options) => {
    await page.goto(origin + '/teacher/signup')
    await page.getByRole('button', { name: /try again|retry/i }).waitFor()
    assert.equal(new URL(page.url()).pathname, '/teacher/signup')
    options.profileError = false
    await page.getByRole('button', { name: /try again|retry/i }).click()
    await page.waitForURL('**/teacher/setup')
    assert.ok(calls.filter(call => call.path.includes('bootstrap_teacher_profile')).length >= 2)
  })
  await scenario('multiple classrooms remain an explicit error', { signedIn: true, multiple: true }, async page => {
    await page.goto(origin + '/teacher/signup')
    await page.getByText(/more than one classroom|multiple classrooms/i).waitFor()
    assert.equal(new URL(page.url()).pathname, '/teacher/signup')
  })
  console.log('All synthetic browser checks passed. Live email and deployed RLS remain separate checks.')
} finally { await close() }
