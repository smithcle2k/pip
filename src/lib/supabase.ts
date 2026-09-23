import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL?.trim()
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim()

/** The browser client is deliberately limited to Supabase's anonymous key. */
const credentialKeys = ['access_token', 'refresh_token', 'provider_token', 'provider_refresh_token', 'expires_in', 'expires_at', 'token_type', 'type', 'code', 'token', 'token_hash', 'error', 'error_code', 'error_description', 'flow_id']
function captureCallback() {
  const url = new URL(window.location.href)
  const params = new URLSearchParams(url.search)
  new URLSearchParams(url.hash.slice(1)).forEach((value, key) => params.set(key, value))
  return {
    present: credentialKeys.some(key => params.has(key)),
    implicit: ['access_token', 'refresh_token', 'expires_in', 'token_type'].every(key => Boolean(params.get(key))),
    error: ['error', 'error_code', 'error_description'].some(key => params.has(key)),
    recovery: params.get('type') === 'recovery',
  }
}
export const authCallback = captureCallback()
export function cleanAuthUrl() {
  const current = new URL(window.location.href)
  const hash = new URLSearchParams(current.hash.slice(1))
  for (const key of credentialKeys) { current.searchParams.delete(key); hash.delete(key) }
  current.hash = hash.toString()
  window.history.replaceState(window.history.state, '', current.pathname + current.search + current.hash)
}
function makeClient(): SupabaseClient | null {
  if (!url || !anonKey) return null
  try { return createClient(url, anonKey, { auth: { flowType: 'implicit', detectSessionInUrl: true } }) } catch { return null }
}
export const supabase = makeClient()
if (!supabase) cleanAuthUrl()
export const demoMode = import.meta.env.DEV && !supabase

export const supabaseConfigured = Boolean(supabase)

export function getSupabaseSetupMessage(): string {
  return 'Pip is not connected to its classroom database yet. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to .env.local.'
}

/** Keep provider details out of child-facing error messages. */
export function getSupabaseErrorMessage(error: unknown): string {
  if (!supabaseConfigured) return getSupabaseSetupMessage()
  if (error instanceof Error && error.message) return `We could not connect to the classroom database. ${error.message}`
  return 'We could not connect to the classroom database. Please try again.'
}
