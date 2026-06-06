import { ForbiddenError } from '../errors/AppError.js'

const SUPER_ADMIN_ROLE = 'SuperAdmin'

export function isSuperAdmin(authUser) {
  return String(authUser?.role ?? '') === SUPER_ADMIN_ROLE
}

export function requireCampusScopeId(authUser) {
  if (!authUser) {
    return null
  }

  if (isSuperAdmin(authUser)) {
    return null
  }

  const campusId = Number(authUser?.campusId)

  if (!Number.isInteger(campusId) || campusId <= 0) {
    throw new ForbiddenError('Tu cuenta no tiene un campus asignado válido')
  }

  return campusId
}

export function applyCampusScopeToQuery(query, authUser) {
  const scopedCampusId = requireCampusScopeId(authUser)

  if (scopedCampusId === null) {
    return { ...query }
  }

  return {
    ...query,
    campusId: scopedCampusId,
  }
}

export function normalizeScopedCampusIdInput(campusId, authUser) {
  const scopedCampusId = requireCampusScopeId(authUser)

  if (scopedCampusId === null) {
    return campusId
  }

  if (campusId !== undefined && Number(campusId) !== scopedCampusId) {
    throw new ForbiddenError('No tienes permisos para operar sobre otro campus')
  }

  return scopedCampusId
}

export function assertCampusAccessById(campusId, authUser) {
  const scopedCampusId = requireCampusScopeId(authUser)

  if (scopedCampusId === null) {
    return
  }

  if (Number(campusId) !== scopedCampusId) {
    throw new ForbiddenError('No tienes permisos para operar sobre otro campus')
  }
}
