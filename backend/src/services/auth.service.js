import bcrypt from 'bcrypt'
import authRepository from '../repositories/auth.repository.js'
import emailService from './email.service.js'
import {
  RequestValidationError,
  UnauthorizedError,
} from '../errors/AppError.js'
import {
  createPasswordResetToken,
  hashPasswordResetToken,
} from '../utils/passwordResetToken.js'
import {
  hashUserInvitationToken,
} from '../utils/userInvitationToken.js'
import {
  isActiveStatus,
  isInvitedStatus,
  normalizeUserStatus,
} from '../utils/userStatus.js'

const ALLOWED_ROLES = ['Admin', 'SuperAdmin']
const PASSWORD_SALT_ROUNDS = Number(process.env.PASSWORD_SALT_ROUNDS ?? 12)
const PASSWORD_RESET_TOKEN_TTL_MINUTES = (() => {
  const parsed = Number(process.env.PASSWORD_RESET_TOKEN_TTL_MINUTES ?? 30)

  if (!Number.isInteger(parsed) || parsed < 5) {
    return 30
  }

  if (parsed > 120) {
    return 120
  }

  return parsed
})()
const PASSWORD_RESET_GENERIC_MESSAGE =
  'Si la cuenta existe, te enviamos un enlace para restablecer tu contraseña.'
const DEFAULT_FRONTEND_URL = 'http://localhost:5173'
const PASSWORD_RESET_FRONTEND_PATH = '/admin/reset-password'

function normalizeRole(role) {
  const value = String(role ?? '').trim().toLowerCase()

  if (value === 'admin') {
    return 'Admin'
  }

  if (value === 'superadmin') {
    return 'SuperAdmin'
  }

  return null
}

function isDeleted(user) {
  return Boolean(user?.deletedAt)
}

function isAllowedRole(role) {
  return Boolean(role && ALLOWED_ROLES.includes(role))
}

function isUserEligibleForAuthentication(user) {
  if (!user || isDeleted(user) || !isActiveStatus(user.status) || !user.passwordHash) {
    return false
  }

  const normalizedRole = normalizeRole(user.role)

  return isAllowedRole(normalizedRole)
}

function isUserEligibleForInvitationActivation(user) {
  if (!user || isDeleted(user) || !isInvitedStatus(user.status)) {
    return false
  }

  const normalizedRole = normalizeRole(user.role)

  return isAllowedRole(normalizedRole)
}

function normalizeResetPath(pathname) {
  const normalizedPath = String(pathname ?? '').trim()

  if (!normalizedPath) {
    return PASSWORD_RESET_FRONTEND_PATH
  }

  if (normalizedPath.startsWith('/')) {
    return normalizedPath
  }

  return `/${normalizedPath}`
}

function buildPasswordResetUrl(token) {
  const frontendUrl = String(process.env.FRONTEND_URL ?? DEFAULT_FRONTEND_URL).trim()
  const resetPath = normalizeResetPath(
    process.env.PASSWORD_RESET_FRONTEND_PATH ?? PASSWORD_RESET_FRONTEND_PATH
  )

  try {
    const url = new URL(resetPath, frontendUrl || DEFAULT_FRONTEND_URL)
    url.searchParams.set('token', token)
    return url.toString()
  } catch {
    const base =
      (frontendUrl || DEFAULT_FRONTEND_URL).replace(/\/+$/, '') || DEFAULT_FRONTEND_URL
    const path = resetPath.replace(/^\/+/, '')
    return `${base}/${path}?token=${encodeURIComponent(token)}`
  }
}

function createInvalidTokenError() {
  return new RequestValidationError('No se pudo restablecer la contraseña', {
    token: 'El enlace de recuperación no es válido o ya expiró',
  })
}

function createInvalidInvitationTokenError() {
  return new RequestValidationError('No se pudo activar la cuenta', {
    token: 'El enlace de activación no es válido, expiró o fue revocado',
  })
}

function toPublicUser(user) {
  const normalizedRole = normalizeRole(user.role)

  if (!normalizedRole) {
    return null
  }

  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: normalizedRole,
    status: normalizeUserStatus(user.status),
    campusId: user.campusId ?? user.campus?.id ?? null,
    campus: user.campus
      ? {
        id: user.campus.id,
        name: user.campus.name,
      }
      : null,
    lastLoginAt: user.lastLoginAt ?? null,
  }
}

class AuthService {
  async login({ email, password }) {
    const user = await authRepository.findByEmailWithPassword(email)

    if (!user) {
      throw new UnauthorizedError('Credenciales incorrectas')
    }

    if (isDeleted(user)) {
      throw new UnauthorizedError(
        'No tienes permiso para iniciar sesión con esta cuenta'
      )
    }

    if (isInvitedStatus(user.status)) {
      throw new UnauthorizedError(
        'Tu cuenta aún no está activada. Revisa tu correo para configurar tu contraseña'
      )
    }

    if (!isActiveStatus(user.status)) {
      throw new UnauthorizedError(
        'No tienes permiso para iniciar sesión con esta cuenta'
      )
    }

    const normalizedRole = normalizeRole(user.role)

    if (!isAllowedRole(normalizedRole)) {
      throw new UnauthorizedError(
        'No tienes permiso para iniciar sesión con esta cuenta'
      )
    }

    if (!user.passwordHash) {
      throw new UnauthorizedError('Credenciales incorrectas')
    }

    const isPasswordValid = await bcrypt.compare(password, user.passwordHash)

    if (!isPasswordValid) {
      throw new UnauthorizedError('Credenciales incorrectas')
    }

    const updatedUser = await authRepository.touchLastLoginAtById(user.id)

    if (!updatedUser) {
      throw new UnauthorizedError('No se pudo completar el inicio de sesión')
    }

    const publicUser = toPublicUser(updatedUser)

    if (!publicUser) {
      throw new UnauthorizedError(
        'No tienes permiso para iniciar sesión con esta cuenta'
      )
    }

    return publicUser
  }

  async getActiveUserById(id) {
    const user = await authRepository.findById(id, { paranoid: false })

    if (!user || isDeleted(user) || !isActiveStatus(user.status)) {
      return null
    }

    const normalizedRole = normalizeRole(user.role)

    if (!isAllowedRole(normalizedRole)) {
      return null
    }

    return toPublicUser({
      ...user.get({ plain: true }),
      role: normalizedRole,
    })
  }

  async changePassword({ userId, currentPassword, newPassword, keepSessionId }) {
    const user = await authRepository.findByIdWithPasswordHash(userId, {
      paranoid: false,
    })

    if (!user || isDeleted(user) || !isActiveStatus(user.status) || !user.passwordHash) {
      throw new UnauthorizedError('Tu sesión ya no es válida')
    }

    const normalizedRole = normalizeRole(user.role)

    if (!isAllowedRole(normalizedRole)) {
      throw new UnauthorizedError('Tu sesión ya no es válida')
    }

    const isCurrentPasswordValid = await bcrypt.compare(
      currentPassword,
      user.passwordHash
    )

    if (!isCurrentPasswordValid) {
      throw new RequestValidationError('No se pudo cambiar la contraseña', {
        currentPassword: 'La contraseña actual es incorrecta',
      })
    }

    const isSamePassword = await bcrypt.compare(newPassword, user.passwordHash)

    if (isSamePassword) {
      throw new RequestValidationError('No se pudo cambiar la contraseña', {
        newPassword:
          'La nueva contraseña debe ser diferente a la contraseña actual',
      })
    }

    const newPasswordHash = await bcrypt.hash(newPassword, PASSWORD_SALT_ROUNDS)
    const invalidatedSessions =
      await authRepository.updatePasswordAndInvalidateOtherSessions({
        userId: user.id,
        newPasswordHash,
        keepSessionId,
      })

    if (invalidatedSessions === null) {
      throw new UnauthorizedError('Tu sesión ya no es válida')
    }

    return {
      invalidatedSessions,
    }
  }

  async requestPasswordReset({ email }) {
    const user = await authRepository.findByEmailWithPassword(email)

    if (!isUserEligibleForAuthentication(user)) {
      return {
        message: PASSWORD_RESET_GENERIC_MESSAGE,
      }
    }

    const rawToken = createPasswordResetToken()
    const tokenHash = hashPasswordResetToken(rawToken)
    const expiresAt = new Date(Date.now() + PASSWORD_RESET_TOKEN_TTL_MINUTES * 60 * 1000)

    await authRepository.createPasswordResetToken({
      userId: user.id,
      tokenHash,
      expiresAt,
    })

    const resetUrl = buildPasswordResetUrl(rawToken)

    try {
      await emailService.sendPasswordResetEmail({
        to: user.email,
        recipientName: user.name,
        resetUrl,
        expiresInMinutes: PASSWORD_RESET_TOKEN_TTL_MINUTES,
      })
    } catch (error) {
      console.error('[ERROR] No se pudo enviar el correo de recuperación:', error)
    }

    return {
      message: PASSWORD_RESET_GENERIC_MESSAGE,
    }
  }

  async validatePasswordResetToken({ token }) {
    const tokenHash = hashPasswordResetToken(token)
    const tokenRecord = await authRepository.findValidPasswordResetTokenByHash(tokenHash)
    const user = tokenRecord?.user

    if (!isUserEligibleForAuthentication(user)) {
      return {
        valid: false,
      }
    }

    return {
      valid: true,
    }
  }

  async resetPassword({ token, newPassword }) {
    const tokenHash = hashPasswordResetToken(token)
    const tokenRecord = await authRepository.findValidPasswordResetTokenByHash(tokenHash)
    const user = tokenRecord?.user

    if (!isUserEligibleForAuthentication(user)) {
      throw createInvalidTokenError()
    }

    const isSamePassword = await bcrypt.compare(newPassword, user.passwordHash)

    if (isSamePassword) {
      throw new RequestValidationError('No se pudo restablecer la contraseña', {
        newPassword:
          'La nueva contraseña debe ser diferente a la contraseña actual',
      })
    }

    const newPasswordHash = await bcrypt.hash(newPassword, PASSWORD_SALT_ROUNDS)
    const result = await authRepository.consumePasswordResetTokenAndUpdatePassword({
      tokenHash,
      newPasswordHash,
    })

    if (result.outcome !== 'success') {
      throw createInvalidTokenError()
    }

    return {
      invalidatedSessions: result.invalidatedSessions,
    }
  }

  async validateUserInvitationToken({ token }) {
    const tokenHash = hashUserInvitationToken(token)
    const tokenRecord = await authRepository.findValidUserInvitationByHash(tokenHash)
    const user = tokenRecord?.user

    if (!isUserEligibleForInvitationActivation(user)) {
      return {
        valid: false,
      }
    }

    return {
      valid: true,
    }
  }

  async activateInvitedUser({ token, newPassword }) {
    const tokenHash = hashUserInvitationToken(token)
    const tokenRecord = await authRepository.findValidUserInvitationByHash(tokenHash)
    const user = tokenRecord?.user

    if (!isUserEligibleForInvitationActivation(user)) {
      throw createInvalidInvitationTokenError()
    }

    const newPasswordHash = await bcrypt.hash(newPassword, PASSWORD_SALT_ROUNDS)
    const result = await authRepository.consumeUserInvitationAndActivateUser({
      tokenHash,
      newPasswordHash,
    })

    if (result.outcome !== 'success') {
      throw createInvalidInvitationTokenError()
    }

    return {
      invalidatedSessions: result.invalidatedSessions,
    }
  }
}

export default new AuthService()
