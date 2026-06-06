import { AppError, RequestValidationError } from '../errors/AppError.js'
import pdfQuestionImageRepository from '../repositories/pdfQuestionImage.repository.js'
import {
  isContentFileUrlCompatibleWithType,
} from '../utils/contentFile.storage.js'
import totemPdfQuestionSearchService from './totemPdfQuestionSearch.service.js'
import totemQuestionSessionService from './totemQuestionSession.service.js'
import storageService from './storage.service.js'

const MIN_QUESTION_LENGTH = 2
const MAX_QUESTION_LENGTH = 300
const DEFAULT_MIN_QUERY_WORD_COUNT = 3
const DEFAULT_MIN_QUERY_CHARACTER_COUNT = 6
const DEFAULT_MIN_QUERY_WORD_COVERAGE = 0.5
const DEFAULT_MIN_MATCHED_QUESTION_COVERAGE = 0.6
const DEFAULT_MIN_WORD_OVERLAP = 2
const SHORT_QUESTION_ANSWER_TEXT = 'Hazme una pregunta un poco más completa.'
const INCOMPLETE_QUESTION_ANSWER_TEXT = 'Hazme una pregunta un poco más específica.'
const NOT_FOUND_ANSWER_TEXT =
  'No encontré información suficiente para tu pregunta.'
const DIACRITIC_MARKS_REGEX = /[\u0300-\u036f]/g
const NON_ALPHANUMERIC_REGEX = /[^a-z0-9\s]/g

function normalizeFileUrl(fileUrl) {
  if (typeof fileUrl !== 'string') {
    return ''
  }

  return fileUrl.trim()
}

async function isQuestionImageFileAvailable({ fileUrl, filePath, fileProvider }) {
  const normalizedFileUrl = normalizeFileUrl(fileUrl)

  if (!normalizedFileUrl && !normalizeFileUrl(filePath)) {
    return false
  }

  if (normalizedFileUrl && !isContentFileUrlCompatibleWithType(normalizedFileUrl, 'image')) {
    return false
  }

  return storageService.isFileAvailable({ fileProvider, filePath, fileUrl })
}

async function filterAvailableQuestionImages(images) {
  if (!Array.isArray(images) || images.length === 0) {
    return []
  }

  const checks = await Promise.all(
    images.map((image) =>
      isQuestionImageFileAvailable({
        fileProvider: image?.fileProvider,
        filePath: image?.filePath,
        fileUrl: image?.fileUrl,
      })
    )
  )

  return images.filter((_, index) => checks[index])
}

function normalizeQuestionText(questionText) {
  return typeof questionText === 'string' ? questionText.trim() : ''
}

function parsePositiveInteger(rawValue, fallbackValue) {
  const parsedValue = Number(rawValue)

  if (!Number.isInteger(parsedValue) || parsedValue <= 0) {
    return fallbackValue
  }

  return parsedValue
}

function parseRatio(rawValue, fallbackValue) {
  const parsedValue = Number(rawValue)

  if (!Number.isFinite(parsedValue) || parsedValue <= 0 || parsedValue > 1) {
    return fallbackValue
  }

  return parsedValue
}

function normalizeForWordMatching(text) {
  return String(text ?? '')
    .normalize('NFD')
    .replace(DIACRITIC_MARKS_REGEX, '')
    .toLowerCase()
    .replace(NON_ALPHANUMERIC_REGEX, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function tokenizeQuestionText(text) {
  const normalized = normalizeForWordMatching(text)

  if (!normalized) {
    return []
  }

  return normalized.split(' ').filter((word) => word.length > 1)
}

function uniqueWords(text) {
  return Array.from(new Set(tokenizeQuestionText(text)))
}

function calculateCoverageMetrics(userQuestionText, matchedQuestionText) {
  const queryWords = uniqueWords(userQuestionText)
  const matchedQuestionWords = uniqueWords(matchedQuestionText)
  const matchedWordSet = new Set(matchedQuestionWords)
  const overlapWords = queryWords.filter((word) => matchedWordSet.has(word))

  const queryWordCount = queryWords.length
  const matchedQuestionWordCount = matchedQuestionWords.length
  const overlapWordCount = overlapWords.length

  return {
    queryWordCount,
    matchedQuestionWordCount,
    overlapWordCount,
    queryCoverage:
      queryWordCount > 0 ? overlapWordCount / queryWordCount : 0,
    matchedQuestionCoverage:
      matchedQuestionWordCount > 0
        ? overlapWordCount / matchedQuestionWordCount
        : 0,
  }
}

class TotemQuestionAnswerService {
  constructor() {
    this.minQueryWordCount = parsePositiveInteger(
      process.env.TOTEM_QA_MIN_QUERY_WORD_COUNT,
      DEFAULT_MIN_QUERY_WORD_COUNT
    )
    this.minQueryCharacterCount = parsePositiveInteger(
      process.env.TOTEM_QA_MIN_QUERY_CHARACTER_COUNT,
      DEFAULT_MIN_QUERY_CHARACTER_COUNT
    )
    this.minQueryWordCoverage = parseRatio(
      process.env.TOTEM_QA_MIN_QUERY_WORD_COVERAGE,
      DEFAULT_MIN_QUERY_WORD_COVERAGE
    )
    this.minMatchedQuestionCoverage = parseRatio(
      process.env.TOTEM_QA_MIN_MATCHED_QUESTION_COVERAGE,
      DEFAULT_MIN_MATCHED_QUESTION_COVERAGE
    )
    this.minWordOverlap = parsePositiveInteger(
      process.env.TOTEM_QA_MIN_WORD_OVERLAP,
      DEFAULT_MIN_WORD_OVERLAP
    )
  }

  async buildNoMatchResponse({
    totemId,
    sessionId,
    normalizedQuestionText,
    answerText,
    coverage,
    reason,
    matchMetrics = null,
  }) {
    const activeSession = await totemQuestionSessionService.touchSession(
      sessionId,
      totemId
    )

    return {
      session: activeSession,
      questionText: normalizedQuestionText,
      answerText,
      questionImages: [],
      hasMatch: false,
      source: null,
      coverage,
      reason,
      matchMetrics,
    }
  }

  shouldRejectByQuestionLength(normalizedQuestionText) {
    const words = uniqueWords(normalizedQuestionText)

    return (
      normalizedQuestionText.length < this.minQueryCharacterCount ||
      words.length < this.minQueryWordCount
    )
  }

  shouldRejectByCoverage(matchMetrics) {
    return (
      matchMetrics.overlapWordCount < this.minWordOverlap ||
      matchMetrics.queryCoverage < this.minQueryWordCoverage ||
      matchMetrics.matchedQuestionCoverage < this.minMatchedQuestionCoverage
    )
  }

  async answerQuestion({ totemId, sessionId, questionText }) {
    const normalizedQuestionText = normalizeQuestionText(questionText)

    if (normalizedQuestionText.length < MIN_QUESTION_LENGTH) {
      throw new RequestValidationError(
        `La pregunta debe tener al menos ${MIN_QUESTION_LENGTH} caracteres`
      )
    }

    if (normalizedQuestionText.length > MAX_QUESTION_LENGTH) {
      throw new RequestValidationError(
        `La pregunta no puede superar ${MAX_QUESTION_LENGTH} caracteres`
      )
    }

    await totemQuestionSessionService.ensureActiveSession(sessionId, totemId)
    const searchResult = await totemPdfQuestionSearchService.search(
      totemId,
      normalizedQuestionText
    )
    const coverage = searchResult.coverage

    if (this.shouldRejectByQuestionLength(normalizedQuestionText)) {
      return this.buildNoMatchResponse({
        totemId,
        sessionId,
        normalizedQuestionText,
        answerText: SHORT_QUESTION_ANSWER_TEXT,
        coverage,
        reason: 'query_too_short',
      })
    }

    if (coverage.assignedPdfCount === 0) {
      throw new AppError(
        422,
        'El tótem no tiene contenidos PDF activos asignados para responder preguntas',
        'TOTEM_HAS_NO_ACTIVE_PDFS',
        coverage
      )
    }

    if (coverage.processedPdfCount === 0) {
      throw new AppError(
        409,
        'Los PDFs activos del tótem aún no están procesados para búsqueda',
        'TOTEM_PDFS_NOT_PROCESSED',
        coverage
      )
    }

    if (!searchResult.match) {
      return this.buildNoMatchResponse({
        totemId,
        sessionId,
        normalizedQuestionText,
        answerText: NOT_FOUND_ANSWER_TEXT,
        coverage,
        reason: 'no_match',
      })
    }

    const matchMetrics = calculateCoverageMetrics(
      normalizedQuestionText,
      searchResult.match.matchedQuestionText
    )

    if (this.shouldRejectByCoverage(matchMetrics)) {
      return this.buildNoMatchResponse({
        totemId,
        sessionId,
        normalizedQuestionText,
        answerText: INCOMPLETE_QUESTION_ANSWER_TEXT,
        coverage,
        reason: 'low_coverage',
        matchMetrics,
      })
    }

    const activeSession = await totemQuestionSessionService.touchSession(sessionId, totemId)
    const questionImages = await pdfQuestionImageRepository.findActiveByChunkId(
      searchResult.match.chunkId
    )
    const availableQuestionImages = await filterAvailableQuestionImages(questionImages)

    return {
      session: activeSession,
      questionText: normalizedQuestionText,
      answerText: searchResult.match.answerText,
      questionImages: availableQuestionImages.map((image) => ({
        id: image.id,
        fileUrl: image.fileUrl,
        sortOrder: image.sortOrder,
      })),
      hasMatch: true,
      source: {
        chunkId: searchResult.match.chunkId,
        pdfDocumentId: searchResult.match.pdfDocumentId,
        contentId: searchResult.match.contentId,
        contentTitle: searchResult.match.contentTitle,
        matchedQuestionText: searchResult.match.matchedQuestionText,
        combinedScore: searchResult.match.combinedScore,
        ftsRank: searchResult.match.ftsRank,
        trigramScore: searchResult.match.trigramScore,
      },
      coverage,
      reason: 'matched',
      matchMetrics,
    }
  }
}

export default new TotemQuestionAnswerService()
