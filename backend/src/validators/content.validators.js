import { RequestValidationError } from "../errors/AppError.js";
import { isFileRequiredForContentType } from "../utils/contentFile.storage.js";
import { normalizeTextInput } from "../utils/inputNormalization.js";

const ALLOWED_CONTENT_TYPES = ['image', 'video', 'news', 'advertisement', 'pdf']
const ALLOWED_STATUSES = ['active', 'inactive']
const ALLOWED_LIST_STATUSES = ALLOWED_STATUSES
const ALLOWED_OPERATIONAL_STATUSES = [
    'activeWithoutAssignment',
    'activeWithUnavailableFile',
]
const ALLOWED_PDF_QUESTION_IMAGE_STATUSES = ['active', 'inactive']
const MAX_PAGE_SIZE = 100
const MAX_LIST_TITLE_CHARS = 150
const MIN_LIST_TITLE_CHARS = 3
const NEWS_DESCRIPTION_MIN_LENGTH = 5
const DESCRIPTION_MAX_LENGTH = 500

const FIELD_LABELS = {
    id: 'identificador',
    chunkId: 'fragmento del PDF',
    imageId: 'imagen',
    title: 'título',
    description: 'descripción',
    contentType: 'tipo de contenido',
    status: 'estado',
    operationalStatus: 'estado operativo',
    campusId: 'campus',
    page: 'página',
    limit: 'límite',
    sortOrder: 'orden',
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
}

const OPERATIONAL_STATUS_LABELS = {
    activeWithoutAssignment: 'activos sin asignación vigente',
    activeWithUnavailableFile: 'activos con archivo no disponible',
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

function formatOptions(values, labels = {}) {
    return values.map((value) => labels[value] ?? value).join(', ')
}

function getContentTypeLabel(contentType) {
    return CONTENT_TYPE_LABELS[contentType] ?? String(contentType)
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

function normalizeOptionalText(value, fieldName) {
    if (value === undefined) return undefined
    if (value === null) return null

    if (typeof value !== 'string') {
        throw new RequestValidationError(`El campo ${getFieldLabel(fieldName)} debe ser texto o null`)
    }

    const text = normalizeTextInput(value)
    return text.length === 0 ? null : text
}

function validateTitle(title) {
    if (title === undefined || title === null) {
        throw new RequestValidationError('El título es obligatorio')
    }

    if (isBlank(title)) {
        throw new RequestValidationError(
            'El título no puede estar vacío ni contener solo espacios'
        )
    }

    if (title.length < 3) {
        throw new RequestValidationError(
            'El título debe tener mínimo 3 caracteres'
        )
    }

    if (title.length > 180) {
        throw new RequestValidationError(
            'El título debe tener máximo 180 caracteres'
        )
    }
}

function validateContentType(contentType) {
    if (contentType === undefined || contentType === null) {
        throw new RequestValidationError('El tipo de contenido es obligatorio')
    }

    if (!ALLOWED_CONTENT_TYPES.includes(contentType)) {
        throw new RequestValidationError(
            `El tipo de contenido solo puede ser: ${formatOptions(ALLOWED_CONTENT_TYPES, CONTENT_TYPE_LABELS)}`
        )
    }
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

function validateCampusId(campusId, fieldName = 'campusId') {
    if (campusId === undefined || campusId === null || campusId === '') {
        throw new RequestValidationError(`El campo ${getFieldLabel(fieldName)} es obligatorio`)
    }

    parsePositiveInteger(campusId, fieldName)
}

function validateFileRequired(contentType, file) {
    if (isFileRequiredForContentType(contentType) && !file) {
        throw new RequestValidationError(
            `Debes adjuntar un archivo para el tipo de contenido ${getContentTypeLabel(contentType)}`
        )
    }
}

function validateDescriptionMaxLength(description) {
    if (description === null || description === undefined) {
        return
    }

    if (description.length > DESCRIPTION_MAX_LENGTH) {
        throw new RequestValidationError(
            `La descripción debe tener máximo ${DESCRIPTION_MAX_LENGTH} caracteres`
        )
    }
}

function validateDescriptionRequiredForNews(contentType, description) {
    if (contentType !== 'news') {
        return
    }

    if (description === null || description === undefined) {
        throw new RequestValidationError(
            `La descripción es obligatoria cuando el tipo de contenido es noticia y debe tener mínimo ${NEWS_DESCRIPTION_MIN_LENGTH} caracteres`
        )
    }

    if (String(normalizedText(description)).length < NEWS_DESCRIPTION_MIN_LENGTH) {
        throw new RequestValidationError(
            `La descripción debe tener mínimo ${NEWS_DESCRIPTION_MIN_LENGTH} caracteres cuando el tipo de contenido es noticia`
        )
    }
}

export function validateContentIdParam(req, res, next) {
    const id = parsePositiveInteger(req.params.id, 'id')

    req.validated = {
        ...(req.validated ?? {}),
        params: { id },
    }

    next()
}

export function validatePdfChunkIdParam(req, res, next) {
    const chunkId = parsePositiveInteger(req.params.chunkId, 'chunkId')

    req.validated = {
        ...(req.validated ?? {}),
        params: {
            ...(req.validated?.params ?? {}),
            chunkId,
        },
    }

    next()
}

export function validatePdfQuestionImageIdParam(req, res, next) {
    const imageId = parsePositiveInteger(req.params.imageId, 'imageId')

    req.validated = {
        ...(req.validated ?? {}),
        params: {
            ...(req.validated?.params ?? {}),
            imageId,
        },
    }

    next()
}

export function validateCreateContent(req, res, next) {
    const payload = req.body ?? {}

    assertAllowedFields(payload, [
        'title',
        'description',
        'contentType',
        'content_type',
        'status',
        'campusId',
        'campus_id',
    ])

    const title = normalizedText(payload.title)
    const description = normalizeOptionalText(payload.description, 'description')
    const contentType = normalizedText(pickAlias(payload, 'contentType', 'content_type'))
    const statusRaw = payload.status !== undefined ? normalizedText(payload.status) : undefined
    const campusIdRaw = pickAlias(payload, 'campusId', 'campus_id')

    validateTitle(title)
    validateContentType(contentType)
    validateCampusId(campusIdRaw)

    if (statusRaw !== undefined) {
        validateStatus(statusRaw)
    }

    validateFileRequired(contentType, req.file)
    validateDescriptionMaxLength(description)
    validateDescriptionRequiredForNews(contentType, description)

    req.validated = {
        ...(req.validated ?? {}),
        body: {
            title,
            description,
            contentType,
            campusId: parsePositiveInteger(campusIdRaw, 'campusId'),
            ...(statusRaw !== undefined ? { status: statusRaw } : {}),
        },
    }

    next()
}

export function validateUpdateContent(req, res, next) {
    const payload = req.body ?? {}

    assertAllowedFields(payload, [
        'title',
        'description',
        'contentType',
        'content_type',
        'status',
        'campusId',
        'campus_id',
    ])

    const data = {}

    if (payload.title !== undefined) {
        const title = normalizedText(payload.title)
        validateTitle(title)
        data.title = title
    }

    if (payload.description !== undefined) {
        data.description = normalizeOptionalText(payload.description, 'description')
        validateDescriptionMaxLength(data.description)
    }

    const rawContentType = pickAlias(payload, 'contentType', 'content_type')
    if (rawContentType !== undefined) {
        const contentType = normalizedText(rawContentType)
        validateContentType(contentType)
        data.contentType = contentType
    }

    if (payload.status !== undefined) {
        const status = normalizedText(payload.status)
        validateStatus(status)
        data.status = status
    }

    const campusIdRaw = pickAlias(payload, 'campusId', 'campus_id')
    if (campusIdRaw !== undefined) {
        validateCampusId(campusIdRaw)
        data.campusId = parsePositiveInteger(campusIdRaw, 'campusId')
    }

    if (data.contentType === 'news' && data.description !== undefined) {
        validateDescriptionRequiredForNews(data.contentType, data.description)
    }

    if (Object.keys(data).length === 0 && !req.file) {
        throw new RequestValidationError(
            'Debes enviar al menos un campo para actualizar o adjuntar un archivo'
        )
    }

    req.validated = {
        ...(req.validated ?? {}),
        body: data,
    }

    next()
}

export function validateListContents(req, res, next) {
    const page = req.query.page !== undefined ? parsePositiveInteger(req.query.page, 'page') : 1
    const limit = req.query.limit !== undefined ? parsePositiveInteger(req.query.limit, 'limit') : 10

    if (limit > MAX_PAGE_SIZE) {
        throw new RequestValidationError(
            `El límite no puede ser mayor a ${MAX_PAGE_SIZE}`
        )
    }

    const titleRaw = normalizedText(req.query.title)
    const contentType = normalizedText(pickAlias(req.query, 'contentType', 'content_type'))
    const status = normalizedText(req.query.status)
    const operationalStatus = normalizedText(
        pickAlias(req.query, 'operationalStatus', 'operational_status')
    )
    const campusIdRaw = pickAlias(req.query, 'campusId', 'campus_id')

    if (titleRaw !== undefined && titleRaw !== '' && typeof titleRaw !== 'string') {
        throw new RequestValidationError(
            'El filtro de título debe ser texto'
        )
    }

    if (
        typeof titleRaw === 'string' &&
        titleRaw.length > MAX_LIST_TITLE_CHARS
    ) {
        throw new RequestValidationError(
            `El filtro de título debe tener máximo ${MAX_LIST_TITLE_CHARS} caracteres`
        )
    }

    const title =
        typeof titleRaw === 'string' && titleRaw.length >= MIN_LIST_TITLE_CHARS
            ? titleRaw
            : undefined

    if (contentType !== undefined && contentType !== '' && !ALLOWED_CONTENT_TYPES.includes(contentType)) {
        throw new RequestValidationError(
            `El filtro de tipo de contenido solo puede ser: ${formatOptions(ALLOWED_CONTENT_TYPES, CONTENT_TYPE_LABELS)}`
        )
    }

    if (status !== undefined && status !== '' && !ALLOWED_LIST_STATUSES.includes(status)) {
        throw new RequestValidationError(
            `El filtro de estado solo puede ser: ${formatOptions(ALLOWED_LIST_STATUSES, STATUS_LABELS)}`
        )
    }

    if (
        operationalStatus !== undefined &&
        operationalStatus !== '' &&
        !ALLOWED_OPERATIONAL_STATUSES.includes(operationalStatus)
    ) {
        throw new RequestValidationError(
            `El filtro de estado operativo solo puede ser: ${formatOptions(ALLOWED_OPERATIONAL_STATUSES, OPERATIONAL_STATUS_LABELS)}`
        )
    }

    if (
        campusIdRaw !== undefined &&
        campusIdRaw !== null &&
        campusIdRaw !== ''
    ) {
        validateCampusId(campusIdRaw)
    }

    req.validated = {
        ...(req.validated ?? {}),
        query: {
            page,
            limit,
            title,
            contentType: contentType || undefined,
            status: status || undefined,
            operationalStatus: operationalStatus || undefined,
            campusId:
                campusIdRaw !== undefined && campusIdRaw !== null && campusIdRaw !== ''
                    ? parsePositiveInteger(campusIdRaw, 'campusId')
                    : undefined,
        },
    }

    next()
}

export function validateUploadPdfQuestionImages(req, res, next) {
    const files = Array.isArray(req.files) ? req.files : []

    if (files.length === 0) {
        throw new RequestValidationError('Debes adjuntar al menos una imagen')
    }

    req.validated = {
        ...(req.validated ?? {}),
        files,
    }

    next()
}

export function validateUpdatePdfQuestionImageMetadata(req, res, next) {
    const payload = req.body ?? {}

    assertAllowedFields(payload, ['sortOrder', 'sort_order', 'status'])

    const data = {}
    const sortOrderRaw = pickAlias(payload, 'sortOrder', 'sort_order')

    if (sortOrderRaw !== undefined) {
        const parsedSortOrder = Number(sortOrderRaw)

        if (!Number.isInteger(parsedSortOrder) || parsedSortOrder < 0) {
            throw new RequestValidationError(
                'El orden debe ser un entero mayor o igual a 0'
            )
        }

        data.sortOrder = parsedSortOrder
    }

    if (payload.status !== undefined) {
        const status = normalizedText(payload.status)

        if (!ALLOWED_PDF_QUESTION_IMAGE_STATUSES.includes(status)) {
            throw new RequestValidationError(
                `El estado solo puede ser: ${formatOptions(ALLOWED_PDF_QUESTION_IMAGE_STATUSES, STATUS_LABELS)}`
            )
        }

        data.status = status
    }

    if (Object.keys(data).length === 0) {
        throw new RequestValidationError(
            'Debes enviar al menos el orden o el estado para actualizar la imagen'
        )
    }

    req.validated = {
        ...(req.validated ?? {}),
        body: data,
    }

    next()
}

export function validateReplacePdfQuestionImageFile(req, res, next) {
    if (!req.file) {
        throw new RequestValidationError('Debes adjuntar una imagen para reemplazar')
    }

    next()
}
