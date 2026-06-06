import { RequestValidationError } from "../errors/AppError.js";
import { COMPUTED_TEMPORAL_STATUSES } from "../utils/assignmentAvailability.js";

const ALLOWED_STATUSES = ['active', 'inactive']
const ALLOWED_LIST_STATUSES = COMPUTED_TEMPORAL_STATUSES
const ALLOWED_CONTENT_TYPES = ['image', 'video', 'news', 'advertisement', 'pdf']
const ALLOWED_ASSIGNMENT_MODES = ['single', 'multiple', 'all']
const MAX_PAGE_SIZE = 100
const MIN_LIST_SEARCH_CHARS = 3

const FIELD_LABELS = {
    id: 'identificador',
    page: 'página',
    limit: 'límite',
    totemId: 'tótem',
    totemIds: 'tótems',
    contentId: 'contenido',
    contentIds: 'contenidos',
    assignmentMode: 'modo de asignación',
    status: 'estado',
    startAt: 'fecha de inicio',
    endAt: 'fecha de fin',
    priority: 'prioridad',
    sortOrder: 'orden',
    campusId: 'campus',
    totemSearch: 'búsqueda de tótem',
    contentSearch: 'búsqueda de contenido',
    contentType: 'tipo de contenido',
}

const CONTENT_TYPE_LABELS = {
    image: 'imagen',
    video: 'video',
    news: 'noticia',
    advertisement: 'publicidad',
    pdf: 'PDF',
}

const STATUS_LABELS = {
    active: 'activo',
    inactive: 'inactivo',
    scheduled: 'programado',
    expired: 'expirado',
    expiringSoon: 'próximo a expirar',
}

const ASSIGNMENT_MODE_LABELS = {
    single: 'individual',
    multiple: 'múltiple',
    all: 'todos',
}

function normalizedText(value) {
    return typeof value === 'string' ? value.trim() : value
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

function normalizeTimestamp(value, fieldName) {
    if (value === undefined) return undefined
    if (value === null) return null

    if (typeof value !== 'string') {
        throw new RequestValidationError(
            `El campo ${getFieldLabel(fieldName)} debe ser una fecha en formato ISO o null`
        )
    }

    const normalized = value.trim()

    if (normalized.length === 0) {
        return null
    }

    const parsedDate = new Date(normalized)

    if (Number.isNaN(parsedDate.getTime())) {
        throw new RequestValidationError(`El campo ${getFieldLabel(fieldName)} debe ser una fecha válida`)
    }

    return parsedDate.toISOString()
}

function normalizeOptionalPositiveInteger(value, fieldName) {
    if (value === undefined) return undefined
    if (value === null || value === '') return null

    return parsePositiveInteger(value, fieldName)
}

function validateStatus(status) {
    if (status === undefined || status === null) {
        throw new RequestValidationError('El estado es obligatorio')
    }

    if (!ALLOWED_STATUSES.includes(status)) {
        throw new RequestValidationError(
            `El estado solo puede ser: ${formatOptions(ALLOWED_STATUSES, STATUS_LABELS)}`
        )
    }
}

function validateAssignmentMode(mode) {
    if (!ALLOWED_ASSIGNMENT_MODES.includes(mode)) {
        throw new RequestValidationError(
            `El modo de asignación solo puede ser: ${formatOptions(ALLOWED_ASSIGNMENT_MODES, ASSIGNMENT_MODE_LABELS)}`
        )
    }
}

function normalizePositiveIntegerArray(value, fieldName) {
    if (value === undefined) return undefined
    if (!Array.isArray(value)) {
        throw new RequestValidationError(
            `El campo ${getFieldLabel(fieldName)} debe ser un arreglo de enteros positivos`
        )
    }

    if (value.length === 0) {
        return []
    }

    const parsedIds = value.map((item) => parsePositiveInteger(item, fieldName))
    return [...new Set(parsedIds)]
}

function validateDateRange(startAt, endAt) {
    if (startAt && endAt && new Date(startAt) > new Date(endAt)) {
        throw new RequestValidationError('La fecha de inicio no puede ser mayor a la fecha de fin')
    }
}

function validateTemporalBoundaries(startAt, endAt, options = {}) {
    const { validateEndAtWhenStartMissing = false } = options
    const now = new Date()

    if (startAt && new Date(startAt) < now) {
        throw new RequestValidationError(
            'La fecha de inicio debe ser mayor o igual a la fecha y hora actual'
        )
    }

    if (validateEndAtWhenStartMissing && !startAt && endAt && new Date(endAt) <= now) {
        throw new RequestValidationError(
            'Cuando no envías fecha de inicio, la fecha de fin debe ser mayor a la fecha y hora actual'
        )
    }
}

export function validateTotemContentIdParam(req, res, next) {
    const id = parsePositiveInteger(req.params.id, 'id')

    req.validated = {
        ...(req.validated ?? {}),
        params: { id },
    }

    next()
}

export function validateCreateTotemContent(req, res, next) {
    const payload = req.body ?? {}

    assertAllowedFields(payload, [
        'totemId',
        'totem_id',
        'totemIds',
        'totem_ids',
        'assignmentMode',
        'assignment_mode',
        'contentId',
        'content_id',
        'contentIds',
        'content_ids',
        'status',
        'startAt',
        'start_at',
        'endAt',
        'end_at',
        'priority',
        'sortOrder',
        'sort_order',
    ])

    const assignmentModeRaw = pickAlias(payload, 'assignmentMode', 'assignment_mode')
    const assignmentMode = normalizedText(assignmentModeRaw ?? 'single')

    validateAssignmentMode(assignmentMode)

    const rawTotemId = pickAlias(payload, 'totemId', 'totem_id')
    const rawTotemIds = pickAlias(payload, 'totemIds', 'totem_ids')
    const totemIds = normalizePositiveIntegerArray(rawTotemIds, 'totemIds')

    const rawContentId = pickAlias(payload, 'contentId', 'content_id')
    const rawContentIds = pickAlias(payload, 'contentIds', 'content_ids')
    const contentIds = normalizePositiveIntegerArray(rawContentIds, 'contentIds')

    const statusRaw = payload.status !== undefined ? normalizedText(payload.status) : undefined
    const startAt = normalizeTimestamp(pickAlias(payload, 'startAt', 'start_at'), 'startAt')
    const endAt = normalizeTimestamp(pickAlias(payload, 'endAt', 'end_at'), 'endAt')
    const priority = normalizeOptionalPositiveInteger(payload.priority, 'priority')
    const sortOrder = normalizeOptionalPositiveInteger(
        pickAlias(payload, 'sortOrder', 'sort_order'),
        'sortOrder'
    )

    if (statusRaw !== undefined) {
        validateStatus(statusRaw)
    }

    validateDateRange(startAt, endAt)
    validateTemporalBoundaries(startAt, endAt, {
        validateEndAtWhenStartMissing: true,
    })

    let totemId = undefined

    if (assignmentMode === 'single') {
        if (rawTotemId === undefined) {
            throw new RequestValidationError('Debes seleccionar un tótem para la asignación individual')
        }

        if (rawTotemIds !== undefined) {
            throw new RequestValidationError('No debes enviar varios tótems cuando el modo de asignación es individual')
        }

        totemId = parsePositiveInteger(rawTotemId, 'totemId')
    }

    if (assignmentMode === 'multiple') {
        if (rawTotemId !== undefined) {
            throw new RequestValidationError('No debes enviar un tótem único cuando el modo de asignación es múltiple')
        }

        if (!totemIds || totemIds.length === 0) {
            throw new RequestValidationError('Debes seleccionar al menos un tótem')
        }
    }

    if (assignmentMode === 'all') {
        if (rawTotemId !== undefined || rawTotemIds !== undefined) {
            throw new RequestValidationError('No debes enviar tótems específicos cuando el modo de asignación es todos')
        }
    }

    if (rawContentId !== undefined && rawContentIds !== undefined) {
        throw new RequestValidationError('No debes enviar un contenido y varios contenidos al mismo tiempo')
    }

    let contentId = undefined

    if (rawContentId !== undefined) {
        contentId = parsePositiveInteger(rawContentId, 'contentId')
    }

    if (rawContentIds !== undefined && (!contentIds || contentIds.length === 0)) {
        throw new RequestValidationError('Debes seleccionar al menos un contenido')
    }

    if (contentId === undefined && contentIds === undefined) {
        throw new RequestValidationError('Debes seleccionar uno o varios contenidos')
    }

    req.validated = {
        ...(req.validated ?? {}),
        body: {
            assignmentMode,
            ...(totemId !== undefined ? { totemId } : {}),
            ...(totemIds !== undefined ? { totemIds } : {}),
            ...(contentId !== undefined ? { contentId } : {}),
            ...(contentIds !== undefined ? { contentIds } : {}),
            ...(statusRaw !== undefined ? { status: statusRaw } : {}),
            ...(startAt !== undefined ? { startAt } : {}),
            ...(endAt !== undefined ? { endAt } : {}),
            ...(priority !== undefined ? { priority } : {}),
            ...(sortOrder !== undefined ? { sortOrder } : {}),
        },
    }

    next()
}

export function validateUpdateTotemContent(req, res, next) {
    const payload = req.body ?? {}

    assertAllowedFields(payload, [
        'totemId',
        'totem_id',
        'contentId',
        'content_id',
        'status',
        'startAt',
        'start_at',
        'endAt',
        'end_at',
        'priority',
        'sortOrder',
        'sort_order',
    ])

    const data = {}

    const rawTotemId = pickAlias(payload, 'totemId', 'totem_id')
    if (rawTotemId !== undefined) {
        data.totemId = parsePositiveInteger(rawTotemId, 'totemId')
    }

    const rawContentId = pickAlias(payload, 'contentId', 'content_id')
    if (rawContentId !== undefined) {
        data.contentId = parsePositiveInteger(rawContentId, 'contentId')
    }

    if (payload.status !== undefined) {
        const status = normalizedText(payload.status)
        validateStatus(status)
        data.status = status
    }

    const rawStartAt = pickAlias(payload, 'startAt', 'start_at')
    if (rawStartAt !== undefined) {
        data.startAt = normalizeTimestamp(rawStartAt, 'startAt')
    }

    const rawEndAt = pickAlias(payload, 'endAt', 'end_at')
    if (rawEndAt !== undefined) {
        data.endAt = normalizeTimestamp(rawEndAt, 'endAt')
    }

    if (payload.priority !== undefined) {
        data.priority = parsePositiveInteger(payload.priority, 'priority')
    }

    const rawSortOrder = pickAlias(payload, 'sortOrder', 'sort_order')
    if (rawSortOrder !== undefined) {
        data.sortOrder = parsePositiveInteger(rawSortOrder, 'sortOrder')
    }

    if (data.startAt !== undefined && data.endAt !== undefined) {
        validateDateRange(data.startAt, data.endAt)
    }

    if (Object.keys(data).length === 0) {
        throw new RequestValidationError(
            'Debes enviar al menos un campo para actualizar'
        )
    }

    req.validated = {
        ...(req.validated ?? {}),
        body: data,
    }

    next()
}

export function validateListTotemContents(req, res, next) {
    const page = req.query.page !== undefined ? parsePositiveInteger(req.query.page, 'page') : 1
    const limit = req.query.limit !== undefined ? parsePositiveInteger(req.query.limit, 'limit') : 10

    if (limit > MAX_PAGE_SIZE) {
        throw new RequestValidationError(
            `El límite no puede ser mayor a ${MAX_PAGE_SIZE}`
        )
    }

    const totemIdRaw = pickAlias(req.query, 'totemId', 'totem_id')
    const contentIdRaw = pickAlias(req.query, 'contentId', 'content_id')
    const totemSearch = normalizedText(
        pickAlias(req.query, 'totemSearch', 'totem_search')
    )
    const contentSearch = normalizedText(
        pickAlias(req.query, 'contentSearch', 'content_search')
    )
    const contentType = normalizedText(
        pickAlias(req.query, 'contentType', 'content_type')
    )
    const campusIdRaw = pickAlias(req.query, 'campusId', 'campus_id')
    const status = normalizedText(req.query.status)

    if (status !== undefined && status !== '' && !ALLOWED_LIST_STATUSES.includes(status)) {
        throw new RequestValidationError(
            `El filtro de estado solo puede ser: ${formatOptions(ALLOWED_LIST_STATUSES, STATUS_LABELS)}`
        )
    }

    if (
        contentType !== undefined &&
        contentType !== '' &&
        !ALLOWED_CONTENT_TYPES.includes(contentType)
    ) {
        throw new RequestValidationError(
            `El filtro de tipo de contenido solo puede ser: ${formatOptions(ALLOWED_CONTENT_TYPES, CONTENT_TYPE_LABELS)}`
        )
    }

    if (
        typeof totemSearch === 'string' &&
        totemSearch.length > 150
    ) {
        throw new RequestValidationError(
            'La búsqueda de tótem debe tener máximo 150 caracteres'
        )
    }

    if (
        typeof contentSearch === 'string' &&
        contentSearch.length > 150
    ) {
        throw new RequestValidationError(
            'La búsqueda de contenido debe tener máximo 150 caracteres'
        )
    }

    const normalizedTotemSearch =
        typeof totemSearch === 'string' && totemSearch.length >= MIN_LIST_SEARCH_CHARS
            ? totemSearch
            : undefined
    const normalizedContentSearch =
        typeof contentSearch === 'string' && contentSearch.length >= MIN_LIST_SEARCH_CHARS
            ? contentSearch
            : undefined

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
            totemId:
                totemIdRaw !== undefined && totemIdRaw !== ''
                    ? parsePositiveInteger(totemIdRaw, 'totemId')
                    : undefined,
            contentId:
                contentIdRaw !== undefined && contentIdRaw !== ''
                    ? parsePositiveInteger(contentIdRaw, 'contentId')
                    : undefined,
            totemSearch: normalizedTotemSearch,
            contentSearch: normalizedContentSearch,
            contentType: contentType || undefined,
            campusId:
                campusIdRaw !== undefined && campusIdRaw !== null && campusIdRaw !== ''
                    ? parsePositiveInteger(campusIdRaw, 'campusId')
                    : undefined,
            status: status || undefined,
        },
    }

    next()
}
