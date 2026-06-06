import { RequestValidationError } from "../errors/AppError.js";
import { normalizeTextInput } from "../utils/inputNormalization.js";

const ALLOWED_STATES = ['active', 'inactive']
const ALLOWED_CONNECTION_STATUSES = ['online', 'offline']
const MAX_PAGE_SIZE = 100
const MAX_LIST_SEARCH_CHARS = 150
const MIN_LIST_SEARCH_CHARS = 3
const MIN_LINKING_CODE_TTL_MINUTES = 3
const MAX_LINKING_CODE_TTL_MINUTES = 30

const FIELD_LABELS = {
    id: 'identificador',
    code: 'código',
    name: 'nombre',
    state: 'estado del tótem',
    campusId: 'campus',
    page: 'página',
    limit: 'límite',
    ttlMinutes: 'duración del código temporal',
    message: 'mensaje',
}

function normalizedText(value) {
    return normalizeTextInput(value)
}

function isBlank(value) {
    const normalized = normalizedText(value)
    return typeof normalized !== 'string' || normalized.length === 0
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

function validateCode(code) {
    if (code === undefined || code === null) {
        throw new RequestValidationError('El código es obligatorio')
    }

    if (isBlank(code)) {
        throw new RequestValidationError(
            'El código no puede estar vacío ni contener solo espacios'
        )
    }

    if (code.length < 3) {
        throw new RequestValidationError(
            'El código debe tener mínimo 3 caracteres'
        )
    }

    if (code.length > 50) {
        throw new RequestValidationError(
            'El código debe tener máximo 50 caracteres'
        )
    }
}

function validateName(name) {
    if (name === undefined || name === null) {
        throw new RequestValidationError('El nombre es obligatorio')
    }

    if (isBlank(name)) {
        throw new RequestValidationError(
            'El nombre no puede estar vacío ni contener solo espacios'
        )
    }

    if (name.length < 3) {
        throw new RequestValidationError(
            'El nombre debe tener mínimo 3 caracteres'
        )
    }

    if (name.length > 100) {
        throw new RequestValidationError(
            'El nombre debe tener máximo 100 caracteres'
        )
    }
}

function validateCampusId(campusId, fieldName = 'campusId') {
    if (campusId === undefined || campusId === null || campusId === '') {
        throw new RequestValidationError(`El campo ${getFieldLabel(fieldName)} es obligatorio`)
    }

    parsePositiveInteger(campusId, fieldName)
}

function validateState(state) {
    if (state === undefined || state === null) {
        throw new RequestValidationError('El estado del tótem es obligatorio')
    }

    if (isBlank(state)) {
        throw new RequestValidationError(
            'El estado del tótem no puede estar vacío ni contener solo espacios'
        )
    }

    if (!ALLOWED_STATES.includes(state)) {
        throw new RequestValidationError(
            'El estado del tótem solo puede ser activo o inactivo'
        )
    }
}

export function validateTotemIdParam(req, res, next) {
    const id = parsePositiveInteger(req.params.id, 'id')

    req.validated = {
        ...(req.validated ?? {}),
        params: { id },
    }

    next()
}

export function validateCreateTotem(req, res, next) {
    const payload = req.body ?? {}

    assertAllowedFields(payload, [
        'code',
        'name',
        'campusId',
        'campus_id',
    ])

    const code = normalizedText(payload.code)
    const name = normalizedText(payload.name)
    const campusIdRaw = pickAlias(payload, 'campusId', 'campus_id')

    validateCode(code)
    validateName(name)
    validateCampusId(campusIdRaw, 'campusId')

    req.validated = {
        ...(req.validated ?? {}),
        body: {
            code,
            name,
            campusId: parsePositiveInteger(campusIdRaw, 'campusId'),
        },
    }

    next()
}

export function validateUpdateTotem(req, res, next) {
    const payload = req.body ?? {}

    assertAllowedFields(payload, [
        'code',
        'name',
        'campusId',
        'campus_id',
    ])

    const data = {}

    if (payload.code !== undefined) {
        const code = normalizedText(payload.code)
        validateCode(code)
        data.code = code
    }

    if (payload.name !== undefined) {
        const name = normalizedText(payload.name)
        validateName(name)
        data.name = name
    }

    const campusIdRaw = pickAlias(payload, 'campusId', 'campus_id')
    if (campusIdRaw !== undefined) {
        validateCampusId(campusIdRaw, 'campusId')
        data.campusId = parsePositiveInteger(campusIdRaw, 'campusId')
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

export function validateChangeTotemState(req, res, next) {
    const payload = req.body ?? {}

    assertAllowedFields(payload, ['state'])

    const state = normalizedText(payload.state)

    validateState(state)

    req.validated = {
        ...(req.validated ?? {}),
        body: { state },
    }

    next()
}

export function validateGenerateTotemLinkingCode(req, res, next) {
    const payload = req.body ?? {}

    assertAllowedFields(payload, ['ttlMinutes', 'ttl_minutes'])

    const rawTtlMinutes = pickAlias(payload, 'ttlMinutes', 'ttl_minutes')
    let ttlMinutes

    if (rawTtlMinutes !== undefined && rawTtlMinutes !== null && rawTtlMinutes !== '') {
        ttlMinutes = parsePositiveInteger(rawTtlMinutes, 'ttlMinutes')

        if (
            ttlMinutes < MIN_LINKING_CODE_TTL_MINUTES ||
            ttlMinutes > MAX_LINKING_CODE_TTL_MINUTES
        ) {
            throw new RequestValidationError(
                `La duración del código temporal debe estar entre ${MIN_LINKING_CODE_TTL_MINUTES} y ${MAX_LINKING_CODE_TTL_MINUTES} minutos`
            )
        }
    }

    req.validated = {
        ...(req.validated ?? {}),
        body: ttlMinutes ? { ttlMinutes } : {},
    }

    next()
}

export function validateListTotems(req, res, next) {
    const page = req.query.page !== undefined ? parsePositiveInteger(req.query.page, 'page') : 1

    const limit = req.query.limit !== undefined ? parsePositiveInteger(req.query.limit, 'limit') : 10

    if (limit > MAX_PAGE_SIZE) {
        throw new RequestValidationError(
            `El límite no puede ser mayor a ${MAX_PAGE_SIZE}`
        )
    }

    const searchRaw = normalizedText(req.query.search)
    const campusIdRaw = pickAlias(req.query, 'campusId', 'campus_id')
    const state = normalizedText(req.query.state)
    const rawConnectionStatus = pickAlias(req.query, 'connectionStatus', 'connection_status')
    const connectionStatus = normalizedText(rawConnectionStatus)

    if (searchRaw !== undefined && searchRaw !== '' && typeof searchRaw !== 'string') {
        throw new RequestValidationError(
            'El filtro de búsqueda debe ser texto'
        )
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

    if (
        campusIdRaw !== undefined &&
        campusIdRaw !== null &&
        campusIdRaw !== ''
    ) {
        validateCampusId(campusIdRaw)
    }

    if (state !== undefined && state !== '' && !ALLOWED_STATES.includes(state)) {
        throw new RequestValidationError(
            'El filtro de estado solo puede ser activo o inactivo'
        )
    }

    if (
        connectionStatus !== undefined &&
        connectionStatus !== '' &&
        !ALLOWED_CONNECTION_STATUSES.includes(connectionStatus)
    ) {
        throw new RequestValidationError(
            'El filtro de conexión solo puede ser en línea o fuera de línea'
        )
    }

    req.validated = {
        ...(req.validated ?? {}),
        query: {
            page,
            limit,
            search,
            campusId:
                campusIdRaw !== undefined && campusIdRaw !== null && campusIdRaw !== ''
                    ? parsePositiveInteger(campusIdRaw, 'campusId')
                    : undefined,
            state: state || undefined,
            connectionStatus: connectionStatus || undefined,
        },
    }

    next()
}

export function validateSendEmergency(req, res, next) {
    const { message } = req.body

    if (message === undefined || message === null) {
        throw new RequestValidationError('El mensaje es obligatorio')
    }

    if (isBlank(message)) {
        throw new RequestValidationError(
            'El mensaje no puede estar vacío ni contener solo espacios'
        )
    }

    if (message.length < 10) {
        throw new RequestValidationError(
            'El mensaje debe tener mínimo 10 caracteres'
        )
    }

    if (message.length > 500) {
        throw new RequestValidationError(
            'El mensaje debe tener máximo 500 caracteres'
        )
    }

    req.validated = {
        ...(req.validated ?? {}),
        body: { message: normalizedText(message) },
    }

    next()
}
