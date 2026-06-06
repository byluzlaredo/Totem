import { AppError, NotFoundError } from '../errors/AppError.js'
import totemQuestionSessionRepository from '../repositories/totemQuestionSession.repository.js'

const DEFAULT_INACTIVITY_TIMEOUT_SECONDS = 20

function parsePositiveInteger(rawValue, fallbackValue) {
  const parsedValue = Number(rawValue)

  if (!Number.isInteger(parsedValue) || parsedValue <= 0) {
    return fallbackValue
  }

  return parsedValue
}

function toDateWithOffset(seconds) {
  return new Date(Date.now() + seconds * 1000)
}

function toIsoStringOrNull(value) {
  if (!value) {
    return null
  }

  const asDate = value instanceof Date ? value : new Date(value)
  return Number.isNaN(asDate.getTime()) ? null : asDate.toISOString()
}

function resolveTimeoutSeconds() {
  return parsePositiveInteger(
    process.env.TOTEM_QUESTION_SESSION_IDLE_TIMEOUT_SECONDS,
    parsePositiveInteger(
      process.env.TOTEM_QUESTION_MODE_IDLE_TIMEOUT_SECONDS,
      DEFAULT_INACTIVITY_TIMEOUT_SECONDS
    )
  )
}

class TotemQuestionSessionService {
  constructor() {
    this.inactivityTimeoutSeconds = resolveTimeoutSeconds()
  }

  mapSession(session) {
    const inactivityDeadlineAt = toIsoStringOrNull(session.inactivityDeadlineAt)
    const lastActivityAt = toIsoStringOrNull(session.lastActivityAt)
    const now = Date.now()
    const deadlineEpoch = inactivityDeadlineAt ? Date.parse(inactivityDeadlineAt) : null
    const isExpired =
      deadlineEpoch !== null && Number.isFinite(deadlineEpoch) ? deadlineEpoch <= now : false

    return {
      id: session.id,
      totemId: session.totemId,
      status: session.status,
      startedAt: toIsoStringOrNull(session.startedAt),
      lastActivityAt,
      inactivityTimeoutSeconds: session.inactivityTimeoutSeconds,
      inactivityDeadlineAt,
      endedAt: toIsoStringOrNull(session.endedAt),
      endReason: session.endReason ?? null,
      isExpired,
    }
  }

  hasExpired(session) {
    const deadline = Date.parse(String(session.inactivityDeadlineAt))

    if (!Number.isFinite(deadline)) {
      return false
    }

    return deadline <= Date.now()
  }

  async expireIfIdle(session) {
    if (!session || session.status !== 'active') {
      return session
    }

    if (!this.hasExpired(session)) {
      return session
    }

    const now = new Date()

    await totemQuestionSessionRepository.update(session, {
      status: 'expired',
      endedAt: now,
      endReason: 'timeout',
    })

    return session
  }

  async findSessionOrThrow(sessionId, totemId) {
    const session = await totemQuestionSessionRepository.findByIdAndTotem(sessionId, totemId)

    if (!session) {
      throw new NotFoundError('La sesión de preguntas no existe para este tótem')
    }

    return session
  }

  async startSession(totemId) {
    const now = new Date()
    const activeSession = await totemQuestionSessionRepository.findActiveByTotemId(totemId)

    if (activeSession) {
      await this.expireIfIdle(activeSession)

      if (activeSession.status === 'active') {
        await totemQuestionSessionRepository.update(activeSession, {
          lastActivityAt: now,
          inactivityDeadlineAt: toDateWithOffset(activeSession.inactivityTimeoutSeconds),
        })

        return this.mapSession(activeSession)
      }
    }

    const createdSession = await totemQuestionSessionRepository.create({
      totemId,
      status: 'active',
      startedAt: now,
      lastActivityAt: now,
      inactivityTimeoutSeconds: this.inactivityTimeoutSeconds,
      inactivityDeadlineAt: toDateWithOffset(this.inactivityTimeoutSeconds),
      endedAt: null,
      endReason: null,
    })

    return this.mapSession(createdSession)
  }

  async touchSession(sessionId, totemId) {
    const session = await this.findSessionOrThrow(sessionId, totemId)
    await this.expireIfIdle(session)

    if (session.status !== 'active') {
      throw new AppError(
        409,
        'La sesión de preguntas ya no está activa',
        'QUESTION_SESSION_INACTIVE',
        {
          session: this.mapSession(session),
        }
      )
    }

    const now = new Date()

    await totemQuestionSessionRepository.update(session, {
      lastActivityAt: now,
      inactivityDeadlineAt: toDateWithOffset(session.inactivityTimeoutSeconds),
    })

    return this.mapSession(session)
  }

  async touchActiveSessionByTotemId(totemId) {
    const activeSession = await totemQuestionSessionRepository.findActiveByTotemId(totemId)

    if (!activeSession) {
      return null
    }

    await this.expireIfIdle(activeSession)

    if (activeSession.status !== 'active') {
      return this.mapSession(activeSession)
    }

    const now = new Date()

    await totemQuestionSessionRepository.update(activeSession, {
      lastActivityAt: now,
      inactivityDeadlineAt: toDateWithOffset(activeSession.inactivityTimeoutSeconds),
    })

    return this.mapSession(activeSession)
  }

  async getActiveSessionByTotemId(totemId) {
    const activeSession = await totemQuestionSessionRepository.findActiveByTotemId(totemId)

    if (!activeSession) {
      return null
    }

    await this.expireIfIdle(activeSession)

    if (activeSession.status !== 'active') {
      return null
    }

    return this.mapSession(activeSession)
  }

  async ensureActiveSession(sessionId, totemId) {
    const session = await this.findSessionOrThrow(sessionId, totemId)
    await this.expireIfIdle(session)

    if (session.status !== 'active') {
      throw new AppError(
        409,
        'La sesión de preguntas no está activa',
        'QUESTION_SESSION_INACTIVE',
        {
          session: this.mapSession(session),
        }
      )
    }

    return session
  }

  async endSession(sessionId, totemId, reason = 'manual') {
    const session = await this.findSessionOrThrow(sessionId, totemId)
    await this.expireIfIdle(session)

    if (session.status === 'active') {
      await totemQuestionSessionRepository.update(session, {
        status: reason === 'timeout' ? 'expired' : 'ended',
        endedAt: new Date(),
        endReason: reason,
      })
    }

    return this.mapSession(session)
  }

  async endActiveSessionByTotemId(totemId, reason = 'manual') {
    const session = await totemQuestionSessionRepository.findActiveByTotemId(totemId)

    if (!session) {
      return null
    }

    await this.expireIfIdle(session)

    if (session.status !== 'active') {
      return this.mapSession(session)
    }

    await totemQuestionSessionRepository.update(session, {
      status: reason === 'timeout' ? 'expired' : 'ended',
      endedAt: new Date(),
      endReason: reason,
    })

    return this.mapSession(session)
  }
}

export default new TotemQuestionSessionService()
