export function normalizeTextInputForTyping(value: string) {
  const withNormalizedSpaces = String(value ?? '').replace(/[\t\u00A0]/g, ' ')

  return withNormalizedSpaces.trimStart().replace(/ {2,}/g, ' ')
}

export function normalizeTextInputForSubmit(value: string) {
  return normalizeTextInputForTyping(value).trim()
}

export function normalizeEmailInputForTyping(value: string) {
  return String(value ?? '').replace(/\s+/g, '')
}

export function normalizeEmailInputForSubmit(value: string) {
  return normalizeEmailInputForTyping(value).toLowerCase()
}

export function blockWhitespaceKeyDown(event: {
  key: string
  preventDefault: () => void
}) {
  if (event.key === ' ' || event.key === 'Spacebar' || event.key === '\u00A0') {
    event.preventDefault()
  }
}
