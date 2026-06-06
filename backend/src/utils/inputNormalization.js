export function normalizeTextInput(value) {
  if (typeof value !== 'string') {
    return value
  }

  const withNormalizedSpaces = value.replace(/[\t\u00A0]/g, ' ')
  return withNormalizedSpaces.trimStart().replace(/ {2,}/g, ' ').trim()
}

export function normalizeEmailInput(value) {
  return String(value ?? '').replace(/\s+/g, '').toLowerCase()
}
