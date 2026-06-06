const MAX_QUESTION_LENGTH = 500
const MAX_ANSWER_LENGTH = 2000
const MAX_PAIRS = 800

function normalizeWhitespace(value) {
  return value.replace(/\s+/g, ' ').trim()
}

function normalizeExtractedText(text) {
  return String(text ?? '')
    .replace(/\u00a0/g, ' ')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/[ \t\f\v]+/g, ' ')
    .replace(/[ \t]*\n[ \t]*/g, '\n')
    .trim()
}

function splitMeaningfulLines(text) {
  return text
    .split('\n')
    .map((line) => normalizeWhitespace(line))
    .filter((line) => line.length > 0)
}

function isLikelyQuestion(line) {
  if (!line || line.length < 3 || line.length > MAX_QUESTION_LENGTH) {
    return false
  }

  if (!line.endsWith('?')) {
    return false
  }

  return true
}

function sanitizeQuestion(line) {
  return normalizeWhitespace(line).slice(0, MAX_QUESTION_LENGTH)
}

function sanitizeAnswer(text) {
  return normalizeWhitespace(text).slice(0, MAX_ANSWER_LENGTH)
}

function pairByQuestionDelimiters(text) {
  const pairs = []
  let cursor = 0

  while (cursor < text.length && pairs.length < MAX_PAIRS) {
    const questionStart = text.indexOf('¿', cursor)

    if (questionStart === -1) {
      break
    }

    const questionEnd = text.indexOf('?', questionStart + 1)
    const nestedQuestionStart = text.indexOf('¿', questionStart + 1)

    if (questionEnd === -1) {
      cursor = questionStart + 1
      continue
    }

    if (nestedQuestionStart !== -1 && nestedQuestionStart < questionEnd) {
      cursor = nestedQuestionStart
      continue
    }

    const question = sanitizeQuestion(text.slice(questionStart, questionEnd + 1))
    const nextQuestionStart = text.indexOf('¿', questionEnd + 1)
    const answerSource =
      nextQuestionStart === -1
        ? text.slice(questionEnd + 1)
        : text.slice(questionEnd + 1, nextQuestionStart)
    const answer = sanitizeAnswer(answerSource)

    if (question.length > 0 && answer.length > 0) {
      pairs.push({
        questionText: question,
        answerText: answer,
      })
    }

    cursor = nextQuestionStart === -1 ? text.length : nextQuestionStart
  }

  return pairs
}

function pairByAlternatingLines(lines) {
  const pairs = []

  for (let index = 0; index + 1 < lines.length && pairs.length < MAX_PAIRS; index += 2) {
    const question = sanitizeQuestion(lines[index])
    const answer = sanitizeAnswer(lines[index + 1])

    if (question.length === 0 || answer.length === 0) {
      continue
    }

    pairs.push({
      questionText: question,
      answerText: answer,
    })
  }

  return pairs
}

function dedupePairs(pairs) {
  const seen = new Set()
  const deduped = []

  for (const pair of pairs) {
    const key = `${pair.questionText.toLowerCase()}::${pair.answerText.toLowerCase()}`

    if (seen.has(key)) {
      continue
    }

    seen.add(key)
    deduped.push(pair)
  }

  return deduped
}

class PdfQuestionExtractionService {
  extractPairs(rawText) {
    const normalizedText = normalizeExtractedText(rawText)

    if (normalizedText.length === 0) {
      return []
    }

    const markerPairs = pairByQuestionDelimiters(normalizedText)

    if (markerPairs.length > 0 || normalizedText.includes('¿')) {
      return dedupePairs(markerPairs)
    }

    const lines = splitMeaningfulLines(normalizedText)
    return dedupePairs(pairByAlternatingLines(lines))
  }
}

export default new PdfQuestionExtractionService()
