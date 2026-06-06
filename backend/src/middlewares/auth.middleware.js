import authService from '../services/auth.service.js'
import { ForbiddenError, UnauthorizedError } from '../errors/AppError.js'

function destroySession(req) {
  return new Promise((resolve) => {
    if (!req.session) {
      resolve()
      return
    }

    req.session.destroy(() => resolve())
  })
}

function buildSessionAuthUser(user) {
  return {
    id: user.id,
    role: user.role,
    name: user.name,
    email: user.email,
  }
}

function hasSessionAuthUserChanged(currentSessionUser, nextSessionUser) {
  if (!currentSessionUser) {
    return true
  }

  return (
    Number(currentSessionUser.id) !== Number(nextSessionUser.id)
    || currentSessionUser.role !== nextSessionUser.role
    || currentSessionUser.name !== nextSessionUser.name
    || currentSessionUser.email !== nextSessionUser.email
  )
}

export async function requireAuthenticatedUser(req, res, next) {
  const sessionUser = req.session?.authUser

  if (!sessionUser?.id) {
    throw new UnauthorizedError('Debes iniciar sesión para continuar')
  }

  const currentUser = await authService.getActiveUserById(sessionUser.id)

  if (!currentUser) {
    await destroySession(req)
    throw new UnauthorizedError('Tu sesión ya no es válida')
  }

  req.authUser = currentUser
  const nextSessionAuthUser = buildSessionAuthUser(currentUser)

  if (hasSessionAuthUserChanged(sessionUser, nextSessionAuthUser)) {
    req.session.authUser = nextSessionAuthUser
  }

  next()
}

export function requireRoles(...allowedRoles) {
  return (req, res, next) => {
    const role = req.authUser?.role

    if (!role) {
      throw new UnauthorizedError('Debes iniciar sesión para continuar')
    }

    if (!allowedRoles.includes(role)) {
      throw new ForbiddenError('No tienes permisos para acceder a este recurso')
    }

    next()
  }
}
