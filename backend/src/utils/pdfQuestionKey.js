import crypto from 'crypto'

const DIACRITIC_MARKS_REGEX = /[\u0300-\u036f]/g
const NON_ALPHANUMERIC_REGEX = /[^a-z0-9\s]/g

function normalizeWhitespace(value) {
  return value.replace(/\s+/g, ' ').trim()
}

export function normalizeQuestionTextForKey(questionText) {
  const normalized = String(questionText ?? '')
    .normalize('NFD')
    .replace(DIACRITIC_MARKS_REGEX, '')
    .toLowerCase()
    .replace(NON_ALPHANUMERIC_REGEX, ' ')

  return normalizeWhitespace(normalized)
}

export function buildQuestionKeyFromText(questionText) {
  const normalizedQuestion = normalizeQuestionTextForKey(questionText)
  const sourceText = normalizedQuestion || normalizeWhitespace(String(questionText ?? ''))

  return crypto.createHash('sha1').update(sourceText).digest('hex')
}

export function buildStableQuestionKeysFromPairs(pairs) {
  const keyOccurrences = new Map()

  return pairs.map((pair) => {
    const baseKey = buildQuestionKeyFromText(pair.questionText)
    const nextOccurrence = (keyOccurrences.get(baseKey) ?? 0) + 1
    keyOccurrences.set(baseKey, nextOccurrence)

    const questionKey =
      nextOccurrence === 1 ? baseKey : `${baseKey}-${nextOccurrence}`

    return {
      ...pair,
      questionKey,
    }
  })
}

