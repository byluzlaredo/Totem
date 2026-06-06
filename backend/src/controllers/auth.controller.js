import authService from '../services/auth.service.js'
import { UnauthorizedError } from '../errors/AppError.js'

const SESSION_COOKIE_NAME = process.env.SESSION_COOKIE_NAME?.trim() || 'totem.sid'

function clearSessionCookies(res) {
  res.clearCookie(SESSION_COOKIE_NAME)
}

function regenerateSession(req) {
  return new Promise((resolve, reject) => {
    req.session.regenerate((error) => {
      if (error) {
        reject(error)
        return
      }

      resolve()
    })
  })
}

function saveSession(req) {
  return new Promise((resolve, reject) => {
    req.session.save((error) => {
      if (error) {
        reject(error)
        return
      }

      resolve()
    })
  })
}

function destroySession(req) {
  return new Promise((resolve) => {
    if (!req.session) {
      resolve()
      return
    }

    req.session.destroy(() => resolve())
  })
}

export async function login(req, res) {
  const authenticatedUser = await authService.login(req.validated.body)

  await regenerateSession(req)

  req.session.authUser = {
    id: authenticatedUser.id,
    role: authenticatedUser.role,
    name: authenticatedUser.name,
    email: authenticatedUser.email,
  }

  await saveSession(req)

  res.status(200).json({
    ok: true,
    message: 'Inicio de sesión exitoso',
    data: {
      user: authenticatedUser,
    },
  })
}

export async function forgotPassword(req, res) {
  const result = await authService.requestPasswordReset({
    email: req.validated.body.email,
  })

  res.status(200).json({
    ok: true,
    message: result.message,
  })
}

export async function validateResetPasswordToken(req, res) {
  const result = await authService.validatePasswordResetToken({
    token: req.validated.body.token,
  })

  res.status(200).json({
    ok: true,
    data: {
      valid: result.valid,
    },
  })
}

export async function resetPassword(req, res) {
  const result = await authService.resetPassword({
    token: req.validated.body.token,
    newPassword: req.validated.body.newPassword,
  })

  res.status(200).json({
    ok: true,
    message: 'Contraseña restablecida correctamente',
    data: {
      invalidatedSessions: result.invalidatedSessions,
    },
  })
}

export async function validateUserInvitationToken(req, res) {
  const result = await authService.validateUserInvitationToken({
    token: req.validated.body.token,
  })

  res.status(200).json({
    ok: true,
    data: {
      valid: result.valid,
    },
  })
}

export async function setPasswordFromInvitation(req, res) {
  const result = await authService.activateInvitedUser({
    token: req.validated.body.token,
    newPassword: req.validated.body.newPassword,
  })

  res.status(200).json({
    ok: true,
    message: 'Cuenta activada correctamente',
    data: {
      invalidatedSessions: result.invalidatedSessions,
    },
  })
}

export async function logout(req, res) {
  await destroySession(req)
  clearSessionCookies(res)

  res.status(200).json({
    ok: true,
    message: 'Sesión cerrada correctamente',
  })
}

export async function changePassword(req, res) {
  const sessionUserId = req.session?.authUser?.id ?? req.authUser?.id

  if (!sessionUserId) {
    throw new UnauthorizedError('Debes iniciar sesión para continuar')
  }

  const result = await authService.changePassword({
    userId: sessionUserId,
    currentPassword: req.validated.body.currentPassword,
    newPassword: req.validated.body.newPassword,
    keepSessionId: req.sessionID,
  })
  const currentUser = await authService.getActiveUserById(sessionUserId)

  if (!currentUser) {
    await destroySession(req)
    clearSessionCookies(res)
    throw new UnauthorizedError('Tu sesión ya no es válida')
  }

  await regenerateSession(req)

  req.session.authUser = {
    id: currentUser.id,
    role: currentUser.role,
    name: currentUser.name,
    email: currentUser.email,
  }

  await saveSession(req)

  res.status(200).json({
    ok: true,
    message: 'Contraseña actualizada correctamente',
    data: {
      invalidatedSessions: result.invalidatedSessions,
    },
  })
}

export async function me(req, res) {
  let currentUser = req.authUser ?? null

  if (!currentUser) {
    const sessionUserId = req.session?.authUser?.id

    if (!sessionUserId) {
      throw new UnauthorizedError('Debes iniciar sesión para continuar')
    }

    currentUser = await authService.getActiveUserById(sessionUserId)

    if (!currentUser) {
      await destroySession(req)
      clearSessionCookies(res)
      throw new UnauthorizedError('Tu sesión ya no es válida')
    }
  }

  res.status(200).json({
    ok: true,
    data: {
      user: currentUser,
    },
  })
}
