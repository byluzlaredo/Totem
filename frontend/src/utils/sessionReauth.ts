export type AdminSessionInvalidationReason = 'expired' | 'invalid'

export const ADMIN_SESSION_NOTICE_STORAGE_KEY = 'totem-admin.session-notice'
export const SESSION_EXPIRED_LOGIN_MESSAGE =
  'Tu sesión expiró. Inicia sesión nuevamente.'
export const SESSION_INVALID_LOGIN_MESSAGE =
  'Sesión inválida. Inicia sesión nuevamente.'

const SESSION_REAUTH_MESSAGES = new Set([
  'Debes iniciar sesión para continuar',
  'Tu sesión ya no es válida',
  'No autenticado',
])

function normalizeMessage(message: unknown) {
  return String(message ?? '').trim()
}

export function isSessionReauthMessage(message: unknown) {
  return SESSION_REAUTH_MESSAGES.has(normalizeMessage(message))
}

export function resolveAdminSessionInvalidationReason(
  message: unknown
): AdminSessionInvalidationReason {
  const normalizedMessage = normalizeMessage(message)

  if (normalizedMessage === 'Tu sesión ya no es válida') {
    return 'invalid'
  }

  return 'expired'
}

export function getAdminSessionNoticeMessage(
  reason: AdminSessionInvalidationReason
) {
  return reason === 'invalid'
    ? SESSION_INVALID_LOGIN_MESSAGE
    : SESSION_EXPIRED_LOGIN_MESSAGE
}

export function persistAdminSessionNotice(
  reason: AdminSessionInvalidationReason
) {
  if (typeof window === 'undefined') {
    return
  }

  window.sessionStorage.setItem(ADMIN_SESSION_NOTICE_STORAGE_KEY, reason)
}

export function consumeAdminSessionNotice():
  | AdminSessionInvalidationReason
  | null {
  if (typeof window === 'undefined') {
    return null
  }

  const rawValue =
    window.sessionStorage.getItem(ADMIN_SESSION_NOTICE_STORAGE_KEY)

  if (!rawValue) {
    return null
  }

  window.sessionStorage.removeItem(ADMIN_SESSION_NOTICE_STORAGE_KEY)

  if (rawValue === 'invalid' || rawValue === 'expired') {
    return rawValue
  }

  return null
}

