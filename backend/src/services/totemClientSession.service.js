import crypto from 'node:crypto'
import { AppError } from '../errors/AppError.js'
import { sequelize } from '../config/db.js'
import totemDeviceSessionRepository from '../repositories/totemDeviceSession.repository.js'
import totemRepository from '../repositories/totem.repository.js'

const DEFAULT_ACCESS_TOKEN_TTL_SECONDS = 15 * 60
const DEFAULT_REFRESH_TOKEN_TTL_SECONDS = 60 * 60 * 24 * 365 * 5

function parsePositiveInteger(rawValue, fallbackValue) {
  const parsedValue = Number(rawValue)

  if (!Number.isInteger(parsedValue) || parsedValue <= 0) {
    return fallbackValue
  }

  return parsedValue
}

function nowDate() {
  return new Date()
}

function addSeconds(baseDate, seconds) {
  return new Date(baseDate.getTime() + seconds * 1000)
}

function hashToken(rawToken) {
  return crypto.createHash('sha256').update(rawToken).digest('hex')
}

function generateOpaqueToken(prefix) {
  return `${prefix}_${crypto.randomBytes(48).toString('base64url')}`
}

function normalizeCredential(rawValue) {
  if (typeof rawValue !== 'string') {
    return ''
  }

  return rawValue.trim()
}

function normalizeLinkCode(rawValue) {
  if (typeof rawValue !== 'string') {
    return ''
  }

  return rawValue.toUpperCase().replace(/[\s-]+/g, '').trim()
}

function mapTotemClientPayload(totem) {
  return {
    id: totem.id,
    code: totem.code,
    name: totem.name,
    campusId: totem.campusId ?? totem.campus?.id ?? null,
    campusName: totem.campus?.name ?? null,
    headquarters: totem.campus?.name ?? null,
    state: totem.state,
    connectionStatus: totem.connectionStatus,
    lastSeenAt: totem.lastSeenAt,
  }
}

class TotemClientSessionService {
  constructor() {
    this.accessTokenTtlSeconds = parsePositiveInteger(
      process.env.TOTEM_CLIENT_ACCESS_TOKEN_TTL_SECONDS,
      DEFAULT_ACCESS_TOKEN_TTL_SECONDS
    )
    this.refreshTokenTtlSeconds = parsePositiveInteger(
      process.env.TOTEM_CLIENT_REFRESH_TOKEN_TTL_SECONDS,
      DEFAULT_REFRESH_TOKEN_TTL_SECONDS
    )
  }

  issueTokenBundle(baseDate = nowDate()) {
    const accessToken = generateOpaqueToken('totem_at')
    const refreshToken = generateOpaqueToken('totem_rt')
    const accessTokenExpiresAt = addSeconds(baseDate, this.accessTokenTtlSeconds)
    const refreshTokenExpiresAt = addSeconds(baseDate, this.refreshTokenTtlSeconds)

    return {
      accessToken,
      refreshToken,
      accessTokenHash: hashToken(accessToken),
      refreshTokenHash: hashToken(refreshToken),
      accessTokenExpiresAt,
      refreshTokenExpiresAt,
    }
  }

  buildSessionTokensPayload(tokenBundle) {
    return {
      tokenType: 'Bearer',
      accessToken: tokenBundle.accessToken,
      refreshToken: tokenBundle.refreshToken,
      accessTokenExpiresAt: tokenBundle.accessTokenExpiresAt.toISOString(),
      refreshTokenExpiresAt: tokenBundle.refreshTokenExpiresAt.toISOString(),
    }
  }

  buildAuthPayload(totem, tokenBundle, linkedAt) {
    return {
      totem: mapTotemClientPayload(totem),
      session: this.buildSessionTokensPayload(tokenBundle),
      linkedAt,
    }
  }

  async markTotemOnline(totem, options = {}) {
    const nowIso = nowDate().toISOString()

    return totemRepository.update(
      totem,
      {
        connectionStatus: 'online',
        lastSeenAt: nowIso,
      },
      options
    )
  }

  async markTotemOfflineById(totemId, options = {}) {
    const totem = await totemRepository.findById(totemId, options)

    if (!totem || totem.connectionStatus === 'offline') {
      return totem
    }

    return totemRepository.update(
      totem,
      {
        connectionStatus: 'offline',
      },
      options
    )
  }

  async ensureTotemOfflineIfNoActiveSession(totemId, options = {}) {
    const activeSession = await totemDeviceSessionRepository.findActiveByTotemId(
      totemId,
      options
    )

    if (activeSession) {
      return null
    }

    return this.markTotemOfflineById(totemId, options)
  }

  ensureTotemIsActive(totem) {
    if (totem?.state === 'active') {
      return
    }

    throw new AppError(
      403,
      'El tótem no está habilitado',
      'TOTEM_INACTIVE'
    )
  }

  async resolveTotemByDeviceToken(deviceToken) {
    const normalizedDeviceToken = normalizeCredential(deviceToken)

    if (!normalizedDeviceToken) {
      throw new AppError(
        401,
        'No se envió token de dispositivo',
        'DEVICE_TOKEN_REQUIRED'
      )
    }

    const totem = await totemRepository.findByDeviceToken(normalizedDeviceToken)

    if (!totem) {
      throw new AppError(
        401,
        'Token de dispositivo inválido',
        'DEVICE_TOKEN_INVALID'
      )
    }

    this.ensureTotemIsActive(totem)

    return {
      normalizedDeviceToken,
      totem,
    }
  }

  async resolveTotemByLinkCode(linkCode, options = {}) {
    const normalizedLinkCode = normalizeLinkCode(linkCode)

    if (!normalizedLinkCode) {
      throw new AppError(
        401,
        'Debes ingresar un código temporal de vinculación',
        'TOTEM_LINK_CODE_REQUIRED'
      )
    }

    const totem = await totemRepository.findByLinkingCode(normalizedLinkCode, options)

    if (!totem || !totem.linkingCode) {
      throw new AppError(
        401,
        'Código de vinculación inválido',
        'TOTEM_LINK_CODE_INVALID'
      )
    }

    this.ensureTotemIsActive(totem)

    if (totem.linkingCodeUsedAt) {
      throw new AppError(
        409,
        'El código de vinculación ya fue utilizado',
        'TOTEM_LINK_CODE_USED'
      )
    }

    const expiresAt = totem.linkingCodeExpiresAt
      ? new Date(totem.linkingCodeExpiresAt)
      : null

    if (!expiresAt || Number.isNaN(expiresAt.getTime()) || expiresAt <= nowDate()) {
      throw new AppError(
        410,
        'El código de vinculación venció',
        'TOTEM_LINK_CODE_EXPIRED'
      )
    }

    return {
      normalizedLinkCode,
      totem,
    }
  }

  async createLinkedSessionForTotem(totem, now, options = {}) {
    const tokenBundle = this.issueTokenBundle(now)

    await totemDeviceSessionRepository.revokeByTotemId(
      totem.id,
      now,
      'relinked_by_device',
      options
    )

    await totemDeviceSessionRepository.create(
      {
        totemId: totem.id,
        accessTokenHash: tokenBundle.accessTokenHash,
        refreshTokenHash: tokenBundle.refreshTokenHash,
        accessTokenExpiresAt: tokenBundle.accessTokenExpiresAt,
        refreshTokenExpiresAt: tokenBundle.refreshTokenExpiresAt,
        linkedAt: now,
        lastAccessAt: now,
        lastRefreshedAt: now,
        revokedAt: null,
        revokedReason: null,
      },
      options
    )

    const updatedTotem = await this.markTotemOnline(totem, options)

    return {
      updatedTotem,
      tokenBundle,
    }
  }

  ensureSessionHasTotem(session) {
    if (session?.totem) {
      return session.totem
    }

    throw new AppError(
      403,
      'La sesión del dispositivo fue revocada',
      'TOTEM_ACCESS_REVOKED'
    )
  }

  async ensureTotemIsActiveOrRevoke(session, totem, reason) {
    if (totem.state === 'active') {
      return
    }

    const revokedAt = nowDate()

    await totemDeviceSessionRepository.update(session, {
      revokedAt,
      revokedReason: reason,
    })
    await this.ensureTotemOfflineIfNoActiveSession(totem.id)

    throw new AppError(
      403,
      'El tótem no está habilitado',
      'TOTEM_INACTIVE'
    )
  }

  ensureSessionIsNotRevoked(session) {
    if (!session.revokedAt) {
      return
    }

    throw new AppError(
      403,
      'La sesión del dispositivo fue revocada',
      'TOTEM_ACCESS_REVOKED'
    )
  }

  async ensureRefreshIsValidOrRevoke(session) {
    if (session.refreshTokenExpiresAt > nowDate()) {
      return
    }

    const revokedAt = nowDate()

    await totemDeviceSessionRepository.update(session, {
      revokedAt,
      revokedReason: 'refresh_token_expired',
    })
    await this.ensureTotemOfflineIfNoActiveSession(session.totemId)

    throw new AppError(
      401,
      'La sesión del dispositivo expiró y debe vincularse nuevamente',
      'TOTEM_REFRESH_TOKEN_EXPIRED'
    )
  }

  ensureAccessIsValid(session) {
    if (session.accessTokenExpiresAt > nowDate()) {
      return
    }

    throw new AppError(
      401,
      'El token de acceso del dispositivo expiró',
      'TOTEM_ACCESS_TOKEN_EXPIRED'
    )
  }

  async linkDeviceByToken(deviceToken) {
    const { totem } = await this.resolveTotemByDeviceToken(deviceToken)
    const now = nowDate()
    const { updatedTotem, tokenBundle } = await this.createLinkedSessionForTotem(
      totem,
      now
    )

    return this.buildAuthPayload(updatedTotem, tokenBundle, now.toISOString())
  }

  async linkDeviceByLinkCode(linkCode) {
    const now = nowDate()
    const transaction = await sequelize.transaction()

    try {
      const { totem } = await this.resolveTotemByLinkCode(linkCode, {
        transaction,
        lock: transaction.LOCK.UPDATE,
      })
      const { updatedTotem, tokenBundle } = await this.createLinkedSessionForTotem(
        totem,
        now,
        { transaction }
      )

      await totemRepository.update(
        updatedTotem,
        {
          linkingCodeUsedAt: now,
        },
        { transaction }
      )
      const linkedTotem =
        await totemRepository.findById(updatedTotem.id, { transaction })

      await transaction.commit()

      return this.buildAuthPayload(
        linkedTotem ?? updatedTotem,
        tokenBundle,
        now.toISOString()
      )
    } catch (error) {
      await transaction.rollback()
      throw error
    }
  }

  async refreshSessionByToken(refreshToken) {
    const normalizedRefreshToken = normalizeCredential(refreshToken)

    if (!normalizedRefreshToken) {
      throw new AppError(
        401,
        'No se envió token de actualización del dispositivo',
        'TOTEM_REFRESH_TOKEN_REQUIRED'
      )
    }

    const refreshTokenHash = hashToken(normalizedRefreshToken)
    const session = await totemDeviceSessionRepository.findByRefreshTokenHash(
      refreshTokenHash
    )

    if (!session) {
      throw new AppError(
        401,
        'Token de actualización inválido',
        'TOTEM_REFRESH_TOKEN_INVALID'
      )
    }

    this.ensureSessionIsNotRevoked(session)
    await this.ensureRefreshIsValidOrRevoke(session)

    const totem = this.ensureSessionHasTotem(session)
    await this.ensureTotemIsActiveOrRevoke(session, totem, 'totem_inactive')

    const now = nowDate()
    const tokenBundle = this.issueTokenBundle(now)

    await totemDeviceSessionRepository.update(session, {
      accessTokenHash: tokenBundle.accessTokenHash,
      refreshTokenHash: tokenBundle.refreshTokenHash,
      accessTokenExpiresAt: tokenBundle.accessTokenExpiresAt,
      refreshTokenExpiresAt: tokenBundle.refreshTokenExpiresAt,
      lastAccessAt: now,
      lastRefreshedAt: now,
      revokedAt: null,
      revokedReason: null,
    })

    const updatedTotem = await this.markTotemOnline(totem)

    return this.buildAuthPayload(updatedTotem, tokenBundle, session.linkedAt.toISOString())
  }

  async authenticateAccessToken(accessToken) {
    const normalizedAccessToken = normalizeCredential(accessToken)

    if (!normalizedAccessToken) {
      throw new AppError(
        401,
        'No se envió token de acceso del dispositivo',
        'TOTEM_ACCESS_TOKEN_REQUIRED'
      )
    }

    const accessTokenHash = hashToken(normalizedAccessToken)
    const session = await totemDeviceSessionRepository.findByAccessTokenHash(
      accessTokenHash
    )

    if (!session) {
      throw new AppError(
        401,
        'Token de acceso inválido',
        'TOTEM_ACCESS_TOKEN_INVALID'
      )
    }

    this.ensureSessionIsNotRevoked(session)
    this.ensureAccessIsValid(session)

    const totem = this.ensureSessionHasTotem(session)
    await this.ensureTotemIsActiveOrRevoke(session, totem, 'totem_inactive')

    await totemDeviceSessionRepository.update(session, {
      lastAccessAt: nowDate(),
    })

    return {
      session,
      totem,
    }
  }

  async unlinkSessionByAccessToken(accessToken, reason = 'device_unlinked') {
    const normalizedAccessToken = normalizeCredential(accessToken)

    if (!normalizedAccessToken) {
      throw new AppError(
        401,
        'No se envió token de acceso del dispositivo',
        'TOTEM_ACCESS_TOKEN_REQUIRED'
      )
    }

    const accessTokenHash = hashToken(normalizedAccessToken)
    const session = await totemDeviceSessionRepository.findByAccessTokenHash(
      accessTokenHash
    )

    if (!session) {
      throw new AppError(
        401,
        'Token de acceso inválido',
        'TOTEM_ACCESS_TOKEN_INVALID'
      )
    }

    const revokedAt = nowDate()

    await totemDeviceSessionRepository.update(session, {
      revokedAt,
      revokedReason: reason,
    })
    await this.ensureTotemOfflineIfNoActiveSession(session.totemId)

    return {
      totem: session.totem ? mapTotemClientPayload(session.totem) : null,
      revokedAt: revokedAt.toISOString(),
    }
  }

  async revokeSessionsByTotemId(
    totemId,
    reason = 'totem_access_revoked',
    options = {}
  ) {
    const revokedAt = nowDate()

    await totemDeviceSessionRepository.revokeByTotemId(
      totemId,
      revokedAt,
      reason,
      options
    )
    await this.ensureTotemOfflineIfNoActiveSession(totemId, options)

    return revokedAt
  }
}

export default new TotemClientSessionService()
