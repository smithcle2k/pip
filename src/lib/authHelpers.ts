export function withAuthTimeout<T>(request: PromiseLike<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = window.setTimeout(() => reject(new Error('auth_timeout')), 20000)
    Promise.resolve(request).then(resolve, reject).finally(() => clearTimeout(timer))
  })
}
/** Verified against the live project on 2026-09-16: Auth requires at least 6 characters and no specific character classes. Update if the Supabase password policy changes. */
export const PASSWORD_MIN_LENGTH = 6
export function safeTeacherReturn(value: unknown): string {
  return typeof value === 'string' && /^\/teacher(?:\/students|\/student\/[a-zA-Z0-9-]+)?$/.test(value) ? value : '/teacher'
}
export function authErrorMessage(error: unknown): string {
  const item = error as { code?: string; reasons?: string[]; message?: string } | null
  switch (item?.code) {
    case 'weak_password': {
      const reasons = item.reasons ?? []
      return [reasons.includes('length') ? `Use at least ${PASSWORD_MIN_LENGTH} characters.` : '', reasons.includes('characters') ? 'Use a mix of uppercase and lowercase letters, numbers, and symbols.' : '', reasons.includes('pwned') ? 'Choose a password that has not appeared in a data breach.' : ''].filter(Boolean).join(' ') || 'Choose a stronger password that meets your account’s security requirements.'
    }
    case 'over_email_send_rate_limit': case 'over_request_rate_limit': return 'Too many attempts. Please wait a few minutes and try again.'
    case 'signup_disabled': case 'email_provider_disabled': return 'Account creation is currently unavailable. Please try again later.'
    case 'email_address_invalid': return 'Enter a valid email address.'
    case 'invalid_credentials': return 'That email or password did not work. Please try again.'
    case 'email_not_confirmed': return 'Please confirm your email using the link in your inbox before signing in.'
    default: return item?.message === 'auth_timeout' ? 'This is taking too long. The request may still finish. Check your email or try signing in before submitting again.' : 'We couldn’t complete that request. Check your connection and try again.'
  }
}
