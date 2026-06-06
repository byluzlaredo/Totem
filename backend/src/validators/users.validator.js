import { RequestValidationError } from '../errors/AppError.js'
import {
  normalizeEmailInput,
  normalizeTextInput,
} from '../utils/inputNormalization.js'

const ALLOWED_ROLES = ['Admin', 'SuperAdmin']
const ALLOWED_STATUSES = ['active', 'inactive', 'invited']
const ALLOWED_STATUS_TOGGLE = ['active', 'inactive']
const MAX_PAGE_SIZE = 100
const MIN_LIST_SEARCH_CHARS = 3

const FIELD_LABELS = {
  id: 'identificador',
  campusId: 'campus',
  page: 'página',
  limit: 'límite',
}

const STATUS_LABELS = {
  active: 'activo',
  inactive: 'inactivo',
  invited: 'invitado',
}

function assertAllowedFields(payload, allowedFields) {
  const extraFields = Object.keys(payload).filter(
    (field) => !allowedFields.includes(field)
  )

  if (extraFields.length > 0) {
    throw new RequestValidationError(
      'La solicitud contiene campos no permitidos'
    )
  }
}

function getFieldLabel(fieldName) {
  return FIELD_LABELS[fieldName] ?? fieldName
}

function formatOptions(values, labels = {}) {
  return values.map((value) => labels[value] ?? value).join(', ')
}

function parsePositiveInteger(value, fieldName) {
  const parsed = Number(value)

  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new RequestValidationError(
      `El campo ${getFieldLabel(fieldName)} debe ser un entero positivo`
    )
  }

  return parsed
}

function pickAlias(source, camelKey, snakeKey) {
  const hasCamel = Object.prototype.hasOwnProperty.call(source, camelKey)
  const hasSnake = Object.prototype.hasOwnProperty.call(source, snakeKey)

  if (hasCamel && hasSnake) {
    throw new RequestValidationError(
      'No puedes enviar dos variantes del mismo campo al mismo tiempo'
    )
  }

  if (hasCamel) {
    return source[camelKey]
  }

  if (hasSnake) {
    return source[snakeKey]
  }

  return undefined
}

function normalizeText(value) {
  return normalizeTextInput(value)
}

function normalizeEmail(email) {
  return normalizeEmailInput(email)
}

function normalizeRole(role) {
  const normalized = String(normalizeTextInput(role) ?? '').toLowerCase()

  if (normalized === 'admin') {
    return 'Admin'
  }

  if (normalized === 'superadmin') {
    return 'SuperAdmin'
  }

  return role
}

function normalizeStatus(status) {
  return String(normalizeTextInput(status) ?? '').toLowerCase()
}

function validateCampusId(campusId, errors, isRequired = false) {
  if (campusId === undefined) {
    if (isRequired) {
      errors.campusId = 'El campus es obligatorio'
    }
    return
  }

  const parsedCampusId = Number(campusId)

  if (!Number.isInteger(parsedCampusId) || parsedCampusId <= 0) {
    errors.campusId = 'El campus debe ser un entero positivo'
  }
}

function validateName(name, errors, isRequired = false) {
  if (name === undefined) {
    if (isRequired) {
      errors.name = 'El nombre es obligatorio'
    }
    return
  }

  if (typeof name !== 'string' || name.length === 0) {
    errors.name = 'El nombre es obligatorio'
    return
  }

  if (name.length < 3 || name.length > 100) {
    errors.name = 'El nombre debe tener entre 3 y 100 caracteres'
  }
}

function validateEmail(email, errors, isRequired = false) {
  if (email === undefined) {
    if (isRequired) {
      errors.email = 'El correo es obligatorio'
    }
    return
  }

  if (typeof email !== 'string' || email.length === 0) {
    errors.email = 'El correo es obligatorio'
    return
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    errors.email = 'El correo no tiene un formato válido'
  }
}

function validateRole(role, errors, isRequired = false) {
  if (role === undefined) {
    if (isRequired) {
      errors.role = 'El rol es obligatorio'
    }
    return
  }

  if (!ALLOWED_ROLES.includes(role)) {
    errors.role = 'El rol solo puede ser Admin o SuperAdmin'
  }
}

function validateStatus(status, errors, isRequired = false) {
  if (status === undefined) {
    if (isRequired) {
      errors.status = 'El estado es obligatorio'
    }
    return
  }

  if (!ALLOWED_STATUSES.includes(status)) {
    errors.status = `El estado solo puede ser: ${formatOptions(ALLOWED_STATUSES, STATUS_LABELS)}`
  }
}

function normalizeCreatePayload(payload) {
  const campusIdRaw = pickAlias(payload, 'campusId', 'campus_id')

  return {
    name: normalizeText(payload.name),
    email: normalizeEmail(payload.email),
    role: normalizeRole(payload.role),
    campusId:
      campusIdRaw === undefined || campusIdRaw === null || campusIdRaw === ''
        ? campusIdRaw
        : parsePositiveInteger(campusIdRaw, 'campusId'),
  }
}

function normalizeUpdatePayload(payload) {
  const data = {}

  if (payload.name !== undefined) {
    data.name = normalizeText(payload.name)
  }

  if (payload.email !== undefined) {
    data.email = normalizeEmail(payload.email)
  }

  if (payload.role !== undefined) {
    data.role = normalizeRole(payload.role)
  }

  if (payload.status !== undefined) {
    data.status = normalizeStatus(payload.status)
  }

  const campusIdRaw = pickAlias(payload, 'campusId', 'campus_id')
  if (campusIdRaw !== undefined) {
    data.campusId = parsePositiveInteger(campusIdRaw, 'campusId')
  }

  return data
}

function validateCreatePayload(data) {
  const errors = {}

  validateName(data.name, errors, true)
  validateEmail(data.email, errors, true)
  validateRole(data.role, errors, true)
  validateCampusId(data.campusId, errors, true)

  if (Object.keys(errors).length > 0) {
    throw new RequestValidationError('Datos inválidos', errors)
  }
}

function validateUpdatePayload(data) {
  const errors = {}
  const normalized = { ...data }

  validateName(normalized.name, errors)
  validateEmail(normalized.email, errors)
  validateRole(normalized.role, errors)
  validateStatus(normalized.status, errors)
  validateCampusId(normalized.campusId, errors)

  if (Object.keys(normalized).length === 0) {
    throw new RequestValidationError(
      'Debes enviar al menos un campo para actualizar'
    )
  }

  if (Object.keys(errors).length > 0) {
    throw new RequestValidationError('Datos inválidos', errors)
  }

  return normalized
}

export function validateListUsers(req, res, next) {
  const page =
    req.query.page !== undefined
      ? parsePositiveInteger(req.query.page, 'page')
      : 1

  const limit =
    req.query.limit !== undefined
      ? parsePositiveInteger(req.query.limit, 'limit')
      : 10

  if (limit > MAX_PAGE_SIZE) {
    throw new RequestValidationError(
      `El límite no puede ser mayor a ${MAX_PAGE_SIZE}`
    )
  }

  const searchRaw = normalizeText(req.query.search)
  const roleRaw = req.query.role !== undefined ? normalizeRole(req.query.role) : undefined
  const statusRaw =
    req.query.status !== undefined ? normalizeStatus(req.query.status) : undefined
  const campusIdRaw = pickAlias(req.query, 'campusId', 'campus_id')

  if (searchRaw !== undefined && typeof searchRaw !== 'string') {
    throw new RequestValidationError('El filtro de búsqueda debe ser texto')
  }

  if (typeof searchRaw === 'string' && searchRaw.length > 150) {
    throw new RequestValidationError(
      'El filtro de búsqueda debe tener máximo 150 caracteres'
    )
  }

  const search =
    typeof searchRaw === 'string' && searchRaw.length >= MIN_LIST_SEARCH_CHARS
      ? searchRaw
      : undefined

  if (roleRaw !== undefined && roleRaw !== '' && !ALLOWED_ROLES.includes(roleRaw)) {
    throw new RequestValidationError(
      'El filtro de rol solo puede ser Admin o SuperAdmin'
    )
  }

  if (
    statusRaw !== undefined &&
    statusRaw !== '' &&
    !ALLOWED_STATUSES.includes(statusRaw)
  ) {
    throw new RequestValidationError(
      `El filtro de estado solo puede ser: ${formatOptions(ALLOWED_STATUSES, STATUS_LABELS)}`
    )
  }

  if (
    campusIdRaw !== undefined &&
    campusIdRaw !== null &&
    campusIdRaw !== ''
  ) {
    parsePositiveInteger(campusIdRaw, 'campusId')
  }

  req.validated = {
    ...(req.validated ?? {}),
    query: {
      page,
      limit,
      search,
      role: roleRaw || undefined,
      status: statusRaw || undefined,
      campusId:
        campusIdRaw !== undefined && campusIdRaw !== null && campusIdRaw !== ''
          ? parsePositiveInteger(campusIdRaw, 'campusId')
          : undefined,
    },
  }

  next()
}

export function validateCreateUser(req, res, next) {
  const payload = req.body ?? {}

  assertAllowedFields(payload, [
    'name',
    'email',
    'role',
    'campusId',
    'campus_id',
  ])

  const data = normalizeCreatePayload(payload)
  validateCreatePayload(data)

  req.validated = {
    ...(req.validated ?? {}),
    body: data,
  }

  next()
}

export function validateUpdateUser(req, res, next) {
  const payload = req.body ?? {}

  assertAllowedFields(payload, [
    'name',
    'email',
    'role',
    'status',
    'campusId',
    'campus_id',
  ])

  const data = normalizeUpdatePayload(payload)
  const validatedData = validateUpdatePayload(data)

  req.validated = {
    ...(req.validated ?? {}),
    body: validatedData,
  }

  next()
}

export function validateChangeUserStatus(req, res, next) {
  const payload = req.body ?? {}

  assertAllowedFields(payload, ['status'])

  const status = normalizeStatus(payload.status)

  if (!ALLOWED_STATUS_TOGGLE.includes(status)) {
    throw new RequestValidationError(
      `El estado solo puede ser: ${formatOptions(ALLOWED_STATUS_TOGGLE, STATUS_LABELS)}`
    )
  }

  req.validated = {
    ...(req.validated ?? {}),
    body: { status },
  }

  next()
}

export function validateUserIdParam(req, res, next) {
  const id = parsePositiveInteger(req.params.id, 'id')

  req.validated = {
    ...(req.validated ?? {}),
    params: { id },
  }

  next()
}
