import { ConflictError, ForbiddenError, NotFoundError, RequestValidationError } from '../errors/AppError.js'
import authRepository from '../repositories/auth.repository.js'
import usersRepository from '../repositories/users.repository.js'
import campusService from './campus.service.js'
import emailService from './email.service.js'
import {
  createUserInvitationToken,
  hashUserInvitationToken,
} from '../utils/userInvitationToken.js'
import {
  isInvitedStatus,
  normalizeUserStatus,
  statusToInteger,
} from '../utils/userStatus.js'
import { normalizeEmailInput } from '../utils/inputNormalization.js'

const USER_INVITATION_TOKEN_TTL_HOURS = (() => {
  const parsed = Number(process.env.USER_INVITATION_TOKEN_TTL_HOURS ?? 24)

  if (!Number.isInteger(parsed) || parsed < 1) {
    return 24
  }

  if (parsed > 168) {
    return 168
  }

  return parsed
})()
const DEFAULT_FRONTEND_URL = 'http://localhost:5173'
const USER_INVITATION_FRONTEND_PATH = '/set-password'
const USER_EMAIL_DUPLICATE_MESSAGE =
  'Ya existe un usuario con ese correo en el sistema'

function normalizeEmail(email) {
  return normalizeEmailInput(email)
}

function normalizeRole(role) {
  return String(role ?? '').trim().toLowerCase() === 'superadmin'
    ? 'SuperAdmin'
    : 'Admin'
}

function isProtectedSuperAdminSelf(authUser, targetUserId) {
  return (
    authUser?.role === 'SuperAdmin' &&
    Number(authUser?.id) === Number(targetUserId)
  )
}

function isUniqueConstraintError(error) {
  return (
    error?.name === 'SequelizeUniqueConstraintError' ||
    error?.original?.code === '23505' ||
    error?.parent?.code === '23505' ||
    error?.code === '23505'
  )
}

function normalizeSetPasswordPath(pathname) {
  const normalizedPath = String(pathname ?? '').trim()

  if (!normalizedPath) {
    return USER_INVITATION_FRONTEND_PATH
  }

  if (normalizedPath.startsWith('/')) {
    return normalizedPath
  }

  return `/${normalizedPath}`
}

function buildUserInvitationUrl(token) {
  const frontendUrl = String(process.env.FRONTEND_URL ?? DEFAULT_FRONTEND_URL).trim()
  const setPasswordPath = normalizeSetPasswordPath(
    process.env.USER_INVITATION_FRONTEND_PATH ?? USER_INVITATION_FRONTEND_PATH
  )

  try {
    const url = new URL(setPasswordPath, frontendUrl || DEFAULT_FRONTEND_URL)
    url.searchParams.set('token', token)
    return url.toString()
  } catch {
    const base =
      (frontendUrl || DEFAULT_FRONTEND_URL).replace(/\/+$/, '') || DEFAULT_FRONTEND_URL
    const path = setPasswordPath.replace(/^\/+/, '')
    return `${base}/${path}?token=${encodeURIComponent(token)}`
  }
}

function validateStatusTransitionOrThrow(user, nextStatus) {
  const currentStatus = normalizeUserStatus(user.status)

  if (nextStatus === 'invited' && currentStatus !== 'invited') {
    throw new RequestValidationError('No se pudo actualizar el usuario', {
      status:
        'No se permite cambiar manualmente al estado invitado. Usa el flujo de invitación.',
    })
  }
}

function resolveRequestedStatusForUser(user, requestedStatus) {
  if (requestedStatus !== 'active') {
    return requestedStatus
  }

  if (user.passwordHash) {
    return 'active'
  }

  // Si la cuenta aún no tiene contraseña, "activarla" debería devolverla al estado
  // "invitado", para que los flujos de invitación/reenvío puedan continuar.
  return 'invited'
}

function createResendInvitationStatusError(userStatus) {
  const normalizedStatus = normalizeUserStatus(userStatus)

  if (normalizedStatus === 'active') {
    return new RequestValidationError(
      'No se pudo reenviar la invitación porque el usuario ya activó su cuenta',
      {
        status:
          'El usuario ya está activo. Para recuperar acceso debe usar el flujo de "Olvidé mi contraseña".',
      }
    )
  }

  if (normalizedStatus === 'inactive') {
    return new RequestValidationError(
      'No se pudo reenviar la invitación porque el usuario está inactivo',
      {
        status:
          'Activa la cuenta primero para devolverla al estado invitado y poder reenviar acceso.',
      }
    )
  }

  return new RequestValidationError('No se pudo reenviar la invitación', {
    status: 'Solo se puede reenviar invitación a usuarios con estado invitado',
  })
}

class UsersService {
  async listUsers(query) {
    const { count, rows } = await usersRepository.findAllWithPagination(query)

    return {
      items: rows,
      meta: {
        totalItems: count,
        totalPages: count === 0 ? 0 : Math.ceil(count / query.limit),
        currentPage: query.page,
        pageSize: query.limit,
      },
    }
  }

  async getUserById(id) {
    const user = await usersRepository.findById(id)

    if (!user) {
      throw new NotFoundError('El usuario no existe')
    }

    return user
  }

  async createUser(data) {
    const email = normalizeEmail(data.email)
    const role = normalizeRole(data.role)
    const existingUser = await usersRepository.findByEmail(email)

    if (existingUser) {
      throw new ConflictError(USER_EMAIL_DUPLICATE_MESSAGE, {
        email: USER_EMAIL_DUPLICATE_MESSAGE,
      })
    }

    await campusService.assertCampusIdExists(data.campusId)

    let createdUser

    try {
      createdUser = await usersRepository.create({
        name: data.name,
        email,
        passwordHash: null,
        role,
        status: statusToInteger('invited'),
        campusId: data.campusId,
      })
    } catch (error) {
      if (isUniqueConstraintError(error)) {
        throw new ConflictError(USER_EMAIL_DUPLICATE_MESSAGE, {
          email: USER_EMAIL_DUPLICATE_MESSAGE,
        })
      }

      throw error
    }

    const { invitationEmailSent } = await this.issueInvitationForUser(createdUser)

    return {
      user: createdUser,
      invitationEmailSent,
    }
  }

  async issueInvitationForUser(user) {
    const rawToken = createUserInvitationToken()
    const tokenHash = hashUserInvitationToken(rawToken)
    const expiresAt = new Date(Date.now() + USER_INVITATION_TOKEN_TTL_HOURS * 60 * 60 * 1000)

    await authRepository.createUserInvitation({
      userId: user.id,
      tokenHash,
      expiresAt,
    })

    const activationUrl = buildUserInvitationUrl(rawToken)

    try {
      const invitationEmailSent = await emailService.sendUserInvitationEmail({
        to: user.email,
        recipientName: user.name,
        activationUrl,
        expiresInHours: USER_INVITATION_TOKEN_TTL_HOURS,
      })

      return {
        invitationEmailSent,
      }
    } catch (error) {
      console.error('[ERROR] No se pudo enviar el correo de invitación:', error)
      return {
        invitationEmailSent: false,
      }
    }
  }

  async resendUserInvitation(id, authUser = null) {
    if (isProtectedSuperAdminSelf(authUser, id)) {
      throw new ForbiddenError('No puedes reenviarte una invitación a ti mismo')
    }

    const user = await usersRepository.findByIdWithPasswordHash(id)

    if (!user) {
      throw new NotFoundError('El usuario no existe')
    }

    if (!isInvitedStatus(user.status)) {
      throw createResendInvitationStatusError(user.status)
    }

    const userView = await usersRepository.findById(user.id)

    if (!userView) {
      throw new NotFoundError('El usuario no existe')
    }

    const { invitationEmailSent } = await this.issueInvitationForUser(userView)

    return {
      user: userView,
      invitationEmailSent,
    }
  }

  async updateUser(id, data, authUser = null) {
    if (isProtectedSuperAdminSelf(authUser, id)) {
      throw new ForbiddenError('No puedes editar tu propio usuario siendo SuperAdmin')
    }

    const user = await usersRepository.findByIdWithPasswordHash(id)

    if (!user) {
      throw new NotFoundError('El usuario no existe')
    }

    const updateData = {}

    if (data.name !== undefined) {
      updateData.name = data.name
    }

    if (data.email !== undefined) {
      const normalizedEmail = normalizeEmail(data.email)
      const duplicatedEmail = await usersRepository.findByEmail(normalizedEmail, {
        excludeId: id,
      })

      if (duplicatedEmail) {
        throw new ConflictError(USER_EMAIL_DUPLICATE_MESSAGE, {
          email: USER_EMAIL_DUPLICATE_MESSAGE,
        })
      }

      updateData.email = normalizedEmail
    }

    if (data.role !== undefined) {
      updateData.role = normalizeRole(data.role)
    }

    if (data.status !== undefined) {
      const requestedStatus = normalizeUserStatus(data.status)
      validateStatusTransitionOrThrow(user, requestedStatus)
      const effectiveStatus = resolveRequestedStatusForUser(user, requestedStatus)
      updateData.status = statusToInteger(effectiveStatus)
    }

    if (data.campusId !== undefined) {
      await campusService.assertCampusIdExists(data.campusId)
      updateData.campusId = data.campusId
    }

    try {
      return await usersRepository.update(user, updateData)
    } catch (error) {
      if (isUniqueConstraintError(error)) {
        throw new ConflictError(USER_EMAIL_DUPLICATE_MESSAGE, {
          email: USER_EMAIL_DUPLICATE_MESSAGE,
        })
      }

      throw error
    }
  }

  async changeUserStatus(id, status, authUser = null) {
    if (isProtectedSuperAdminSelf(authUser, id)) {
      throw new ForbiddenError('No puedes cambiar tu propio estado siendo SuperAdmin')
    }

    const user = await usersRepository.findByIdWithPasswordHash(id)

    if (!user) {
      throw new NotFoundError('El usuario no existe')
    }

    const requestedStatus = normalizeUserStatus(status)
    validateStatusTransitionOrThrow(user, requestedStatus)

    const effectiveStatus = resolveRequestedStatusForUser(user, requestedStatus)
    const nextStatusValue = statusToInteger(effectiveStatus)

    if (user.status === nextStatusValue) {
      return usersRepository.findById(id)
    }

    return usersRepository.update(user, { status: nextStatusValue })
  }

  async deleteUser(id, authUser = null) {
    if (isProtectedSuperAdminSelf(authUser, id)) {
      throw new ForbiddenError('No puedes eliminar tu propio usuario siendo SuperAdmin')
    }

    const user = await usersRepository.findByIdWithPasswordHash(id)

    if (!user) {
      throw new NotFoundError('El usuario no existe')
    }

    await usersRepository.softDelete(user)
  }
}

export default new UsersService()
