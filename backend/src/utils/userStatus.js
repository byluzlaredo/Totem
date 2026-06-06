export const USER_STATUS = Object.freeze({
  INACTIVE: 0,
  ACTIVE: 1,
  INVITED: 2,
})

export const USER_STATUS_LABELS = Object.freeze({
  [USER_STATUS.INACTIVE]: 'inactive',
  [USER_STATUS.ACTIVE]: 'active',
  [USER_STATUS.INVITED]: 'invited',
})

export const ALLOWED_USER_STATUSES = Object.freeze([
  'active',
  'inactive',
  'invited',
])

function normalizeText(value) {
  return String(value ?? '').trim().toLowerCase()
}

export function normalizeUserStatus(status) {
  if (
    status === USER_STATUS.ACTIVE ||
    status === '1' ||
    status === true ||
    normalizeText(status) === 'active'
  ) {
    return 'active'
  }

  if (
    status === USER_STATUS.INVITED ||
    status === '2' ||
    normalizeText(status) === 'invited'
  ) {
    return 'invited'
  }

  return 'inactive'
}

export function statusToInteger(status) {
  const normalized = normalizeUserStatus(status)

  if (normalized === 'active') {
    return USER_STATUS.ACTIVE
  }

  if (normalized === 'invited') {
    return USER_STATUS.INVITED
  }

  return USER_STATUS.INACTIVE
}

export function isActiveStatus(status) {
  return statusToInteger(status) === USER_STATUS.ACTIVE
}

export function isInactiveStatus(status) {
  return statusToInteger(status) === USER_STATUS.INACTIVE
}

export function isInvitedStatus(status) {
  return statusToInteger(status) === USER_STATUS.INVITED
}
