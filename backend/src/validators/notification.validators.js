import { RequestValidationError } from '../errors/AppError.js'
import { normalizeTextInput } from '../utils/inputNormalization.js'

const ALLOWED_TYPES = ['normal', 'urgent']
const ALLOWED_SCOPE = ['all', 'campus', 'totems']
const ALLOWED_STATUSES = ['active', 'inactive', 'all']
const MAX_PAGE_SIZE = 100
const MAX_LIST_SEARCH_CHARS = 150
const MIN_LIST_SEARCH_CHARS = 3
const MAX_MESSAGE_LENGTH = 500

const FIELD_LABELS = {
  id: 'identificador',
  title: 'título',
  message: 'mensaje',
  createdBy: 'usuario creador',
  durationMinutes: 'duración',
  startAt: 'fecha de inicio',
  type: 'tipo de notificación',
  status: 'estado',
  targetScope: 'destino',
  targetCampusId: 'campus de destino',
  targetTotemIds: 'tótems de destino',
  campusId: 'campus',
  page: 'página',
  limit: 'límite',
}

const TYPE_LABELS = {
  normal: 'normal',
  urgent: 'urgente',
}

const STATUS_LABELS = {
  active: 'activo',
  inactive: 'inactivo',
  all: 'todos',
}

const SCOPE_LABELS = {
  all: 'todos',
  campus: 'campus',
  totems: 'tótems',
}

function normalizedText(value) {
  return normalizeTextInput(value)
}

function assertAllowedFields(payload, allowedFields) {
  const extraFields = Object.keys(payload).filter((field) => !allowedFields.includes(field))

  if (extraFields.length > 0) {
    throw new RequestValidationError('La solicitud contiene campos no permitidos')
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
    throw new RequestValidationError(`El campo ${getFieldLabel(fieldName)} debe ser un entero positivo`)
  }

  return parsed
}

function pickAlias(source, camelKey, snakeKey) {
  const hasCamel = Object.prototype.hasOwnProperty.call(source, camelKey)
  const hasSnake = Object.prototype.hasOwnProperty.call(source, snakeKey)

  if (hasCamel && hasSnake) {
    throw new RequestValidationError('No puedes enviar dos variantes del mismo campo al mismo tiempo')
  }

  if (hasCamel) {
    return source[camelKey]
  }

  if (hasSnake) {
    return source[snakeKey]
  }

  return undefined
}

function normalizeDate(value, fieldName) {
  if (value === undefined) {
    return undefined
  }

  if (value === null) {
    return null
  }

  if (typeof value !== 'string') {
    throw new RequestValidationError(`El campo ${getFieldLabel(fieldName)} debe ser una fecha válida en formato ISO`)
  }

  const trimmed = value.trim()

  if (trimmed.length === 0) {
    return null
  }

  const parsed = new Date(trimmed)

  if (Number.isNaN(parsed.getTime())) {
    throw new RequestValidationError(`El campo ${getFieldLabel(fieldName)} debe ser una fecha válida`)
  }

  return parsed.toISOString()
}

function normalizeTotemIds(value, fieldName) {
  if (value === undefined || value === null) {
    return undefined
  }

  if (!Array.isArray(value)) {
    throw new RequestValidationError(`El campo ${getFieldLabel(fieldName)} debe ser una lista de ids de tótems`)
  }

  if (value.length === 0) {
    throw new RequestValidationError(`El campo ${getFieldLabel(fieldName)} debe incluir al menos un tótem`)
  }

  const parsedIds = value.map((item) => parsePositiveInteger(item, fieldName))
  return [...new Set(parsedIds)]
}

function normalizeCampusId(value, fieldName) {
  if (value === undefined || value === null || value === '') {
    return undefined
  }

  return parsePositiveInteger(value, fieldName)
}

function validateTitle(title) {
  if (!title || title.length < 3 || title.length > 200) {
    throw new RequestValidationError('El título debe tener entre 3 y 200 caracteres')
  }
}

function validateMessage(message) {
  if (!message || message.length < 5) {
    throw new RequestValidationError('El mensaje debe tener al menos 5 caracteres')
  }

  if (message.length > MAX_MESSAGE_LENGTH) {
    throw new RequestValidationError(
      `El mensaje debe tener máximo ${MAX_MESSAGE_LENGTH} caracteres`
    )
  }
}

function validateStartAtNotPast(startAt) {
  if (!startAt) {
    return
  }

  const parsedStartAt = new Date(startAt)

  if (parsedStartAt < new Date()) {
    throw new RequestValidationError(
      'La fecha de inicio debe ser mayor o igual a la fecha y hora actual'
    )
  }
}

function validateType(type) {
  if (!ALLOWED_TYPES.includes(type)) {
    throw new RequestValidationError(`El tipo de notificación solo puede ser: ${formatOptions(ALLOWED_TYPES, TYPE_LABELS)}`)
  }
}

function validateStatus(status, options = {}) {
  const { isFilter = false } = options

  if (isFilter) {
    if (!ALLOWED_STATUSES.includes(status)) {
      throw new RequestValidationError(`El filtro de estado solo puede ser: ${formatOptions(ALLOWED_STATUSES, STATUS_LABELS)}`)
    }
    return
  }

  if (!['active', 'inactive'].includes(status)) {
    throw new RequestValidationError('El estado solo puede ser activo o inactivo')
  }
}

function validateTargetScope(scope) {
  if (!ALLOWED_SCOPE.includes(scope)) {
    throw new RequestValidationError(`El destino solo puede ser: ${formatOptions(ALLOWED_SCOPE, SCOPE_LABELS)}`)
  }
}

function resolveTargets(payload, isUpdate) {
  const targetScope = normalizedText(pickAlias(payload, 'targetScope', 'target_scope'))
  const targetCampusId = normalizeCampusId(
    pickAlias(payload, 'targetCampusId', 'target_campus_id'),
    'targetCampusId'
  )
  const targetTotemIds = normalizeTotemIds(
    pickAlias(payload, 'targetTotemIds', 'target_totem_ids'),
    'targetTotemIds'
  )

  if (!isUpdate && !targetScope) {
    throw new RequestValidationError('El destino es obligatorio')
  }

  if (targetScope !== undefined && targetScope !== null) {
    validateTargetScope(targetScope)

    if (targetScope === 'all') {
      if (targetCampusId !== undefined || targetTotemIds !== undefined) {
        throw new RequestValidationError(
          'No debes seleccionar campus de destino ni tótems específicos cuando el destino es todos'
        )
      }

      return {
        targetScope: 'all',
        targets: [{ targetType: 'all', totemId: null, campusId: null }],
      }
    }

    if (targetScope === 'campus') {
      if (!targetCampusId) {
        throw new RequestValidationError('Debes seleccionar un campus de destino cuando el destino es campus')
      }

      if (targetTotemIds !== undefined) {
        throw new RequestValidationError(
          'No debes seleccionar tótems específicos cuando el destino es campus'
        )
      }

      return {
        targetScope: 'campus',
        targets: [{ targetType: 'campus', totemId: null, campusId: targetCampusId }],
      }
    }

    if (!targetTotemIds || targetTotemIds.length === 0) {
      throw new RequestValidationError('Debes seleccionar al menos un tótem cuando el destino es tótems')
    }

    if (targetCampusId !== undefined) {
      throw new RequestValidationError(
        'No debes seleccionar un campus de destino cuando el destino es tótems específicos'
      )
    }

    return {
      targetScope: 'totems',
      targets: targetTotemIds.map((totemId) => ({
        targetType: 'totem',
        totemId,
        campusId: null,
      })),
    }
  }

  if (targetCampusId !== undefined && targetTotemIds !== undefined) {
    throw new RequestValidationError(
      'No puedes seleccionar campus de destino y tótems específicos al mismo tiempo sin definir destino'
    )
  }

  if (targetCampusId !== undefined) {
    return {
      targetScope: 'campus',
      targets: [{ targetType: 'campus', totemId: null, campusId: targetCampusId }],
    }
  }

  if (targetTotemIds !== undefined) {
    return {
      targetScope: 'totems',
      targets: targetTotemIds.map((totemId) => ({
        targetType: 'totem',
        totemId,
        campusId: null,
      })),
    }
  }

  return undefined
}

export function validateNotificationIdParam(req, res, next) {
  const id = parsePositiveInteger(req.params.id, 'id')

  req.validated = {
    ...(req.validated ?? {}),
    params: { id },
  }

  next()
}

export function validateCreateNotification(req, res, next) {
  const payload = req.body ?? {}

  assertAllowedFields(payload, [
    'title',
    'message',
    'createdBy',
    'created_by',
    'durationMinutes',
    'duration_minutes',
    'startAt',
    'start_at',
    'type',
    'status',
    'targetScope',
    'target_scope',
    'targetCampusId',
    'target_campus_id',
    'targetTotemIds',
    'target_totem_ids',
  ])

  const title = normalizedText(payload.title)
  const message = normalizedText(payload.message)
  const type = normalizedText(payload.type)
  const status = normalizedText(payload.status ?? 'active')

  validateTitle(title)
  validateMessage(message)
  validateType(type)
  validateStatus(status)

  const createdByRaw = pickAlias(payload, 'createdBy', 'created_by')
  const durationMinutesRaw = pickAlias(payload, 'durationMinutes', 'duration_minutes')
  const startAtRaw = pickAlias(payload, 'startAt', 'start_at')

  if (createdByRaw === undefined) {
    throw new RequestValidationError('El usuario creador es obligatorio')
  }

  if (durationMinutesRaw === undefined) {
    throw new RequestValidationError('La duración es obligatoria')
  }

  const createdBy = parsePositiveInteger(createdByRaw, 'createdBy')
  const durationMinutes = parsePositiveInteger(durationMinutesRaw, 'durationMinutes')
  const startAt = normalizeDate(startAtRaw, 'startAt')
  validateStartAtNotPast(startAt)
  const targetResolution = resolveTargets(payload, false)

  req.validated = {
    ...(req.validated ?? {}),
    body: {
      title,
      message,
      createdBy,
      durationMinutes,
      type,
      status,
      startAt,
      targetScope: targetResolution.targetScope,
      targets: targetResolution.targets,
    },
  }

  next()
}

export function validateUpdateNotification(req, res, next) {
  const payload = req.body ?? {}

  assertAllowedFields(payload, [
    'title',
    'message',
    'durationMinutes',
    'duration_minutes',
    'startAt',
    'start_at',
    'type',
    'status',
    'targetScope',
    'target_scope',
    'targetCampusId',
    'target_campus_id',
    'targetTotemIds',
    'target_totem_ids',
  ])

  const data = {}

  if (payload.title !== undefined) {
    const title = normalizedText(payload.title)
    validateTitle(title)
    data.title = title
  }

  if (payload.message !== undefined) {
    const message = normalizedText(payload.message)
    validateMessage(message)
    data.message = message
  }

  const durationMinutesRaw = pickAlias(payload, 'durationMinutes', 'duration_minutes')
  if (durationMinutesRaw !== undefined) {
    data.durationMinutes = parsePositiveInteger(durationMinutesRaw, 'durationMinutes')
  }

  const startAtRaw = pickAlias(payload, 'startAt', 'start_at')
  if (startAtRaw !== undefined) {
    data.startAt = normalizeDate(startAtRaw, 'startAt')
  }

  if (payload.type !== undefined) {
    const type = normalizedText(payload.type)
    validateType(type)
    data.type = type
  }

  if (payload.status !== undefined) {
    const status = normalizedText(payload.status)
    validateStatus(status)
    data.status = status
  }

  const targetResolution = resolveTargets(payload, true)
  if (targetResolution !== undefined) {
    data.targetScope = targetResolution.targetScope
    data.targets = targetResolution.targets
  }

  if (Object.keys(data).length === 0) {
    throw new RequestValidationError('Debes enviar al menos un campo para actualizar')
  }

  req.validated = {
    ...(req.validated ?? {}),
    body: data,
  }

  next()
}

export function validateChangeNotificationStatus(req, res, next) {
  const payload = req.body ?? {}

  assertAllowedFields(payload, ['status'])

  const status = normalizedText(payload.status)

  if (status === undefined || status === null || status === '') {
    throw new RequestValidationError('El estado es obligatorio')
  }

  validateStatus(status)

  req.validated = {
    ...(req.validated ?? {}),
    body: { status },
  }

  next()
}

export function validateListNotifications(req, res, next) {
  const query = req.query ?? {}

  assertAllowedFields(query, ['search', 'type', 'scope', 'campusId', 'campus_id', 'status', 'page', 'limit'])

  const page = query.page !== undefined ? parsePositiveInteger(query.page, 'page') : 1
  const limit = query.limit !== undefined ? parsePositiveInteger(query.limit, 'limit') : 10

  if (limit > MAX_PAGE_SIZE) {
    throw new RequestValidationError(`El límite no puede ser mayor a ${MAX_PAGE_SIZE}`)
  }

  const searchRaw = normalizedText(query.search)
  const type = normalizedText(query.type)
  const scope = normalizedText(query.scope)
  const campusId = normalizeCampusId(pickAlias(query, 'campusId', 'campus_id'), 'campusId')
  const status = normalizedText(query.status)

  if (searchRaw !== undefined && searchRaw !== '' && typeof searchRaw !== 'string') {
    throw new RequestValidationError('El filtro de búsqueda debe ser texto')
  }

  if (
    typeof searchRaw === 'string' &&
    searchRaw.length > MAX_LIST_SEARCH_CHARS
  ) {
    throw new RequestValidationError(
      `El filtro de búsqueda debe tener máximo ${MAX_LIST_SEARCH_CHARS} caracteres`
    )
  }

  const search =
    typeof searchRaw === 'string' && searchRaw.length >= MIN_LIST_SEARCH_CHARS
      ? searchRaw
      : undefined

  if (type !== undefined && type !== '' && !ALLOWED_TYPES.includes(type)) {
    throw new RequestValidationError(`El filtro de tipo solo puede ser: ${formatOptions(ALLOWED_TYPES, TYPE_LABELS)}`)
  }

  if (scope !== undefined && scope !== '' && !ALLOWED_SCOPE.includes(scope)) {
    throw new RequestValidationError(`El filtro de destino solo puede ser: ${formatOptions(ALLOWED_SCOPE, SCOPE_LABELS)}`)
  }

  if (status !== undefined && status !== '') {
    validateStatus(status, { isFilter: true })
  }

  req.validated = {
    ...(req.validated ?? {}),
    query: {
      page,
      limit,
      search,
      type: type || undefined,
      scope: scope || undefined,
      campusId: campusId || undefined,
      status: status || 'active',
    },
  }

  next()
}
