import { UniqueConstraintError, ValidationError as SequelizeValidationError } from "sequelize"
import { AppError } from "../errors/AppError.js"
import { removeFileIfExists } from "../utils/contentFile.storage.js"

const KNOWN_FIELD_KEYS = [
    'name',
    'email',
    'token',
    'currentPassword',
    'newPassword',
    'confirmNewPassword',
    'password',
    'role',
    'status',
    'campus',
    'code',
    'linkCode',
    'link_code',
    'ttlMinutes',
    'ttl_minutes',
    'headquarters',
    'title',
    'message',
    'description',
    'contentType',
    'content_type',
    'file',
    'startAt',
    'start_at',
    'endAt',
    'end_at',
    'type',
    'durationHours',
    'duration_hours',
    'durationMinutes',
    'duration_minutes',
    'targetScope',
    'target_scope',
    'targetCampus',
    'target_campus',
    'targetCampusId',
    'target_campus_id',
    'campusId',
    'campus_id',
    'targetTotemIds',
    'target_totem_ids',
    'assignmentMode',
    'assignment_mode',
    'totemId',
    'totem_id',
    'totemIds',
    'totem_ids',
    'contentId',
    'content_id',
    'contentIds',
    'content_ids',
    'contentAssignmentMode',
    'content_assignment_mode',
    'chunkId',
    'chunk_id',
    'imageId',
    'image_id',
    'questionText',
    'question_text',
    'answerText',
    'answer_text',
    'questionKey',
    'question_key',
    'priority',
    'sortOrder',
    'sort_order',
]

function isPlainObject(value) {
    return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function normalizeFieldKey(field) {
    return String(field ?? '')
        .trim()
        .replace(/[_-\s]+([a-zA-Z0-9])/g, (_, char) => char.toUpperCase())
}

function setFieldError(target, field, message) {
    const normalizedField = normalizeFieldKey(field)
    const normalizedMessage = String(message ?? '').trim()

    if (!normalizedField || !normalizedMessage) {
        return
    }

    if (!target[normalizedField]) {
        target[normalizedField] = normalizedMessage
    }
}

function normalizeMessageForMatching(message) {
    return String(message ?? '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
}

function extractFieldErrorsFromDetails(details) {
    const fieldErrors = {}

    if (Array.isArray(details)) {
        for (const item of details) {
            if (!isPlainObject(item)) {
                continue
            }

            const field =
                typeof item.field === 'string'
                    ? item.field
                    : typeof item.path === 'string'
                        ? item.path
                        : null
            const message = typeof item.message === 'string' ? item.message : null

            if (field && message) {
                setFieldError(fieldErrors, field, message)
            }
        }
    }

    if (isPlainObject(details)) {
        for (const [rawField, rawMessage] of Object.entries(details)) {
            if (
                rawField === 'message' ||
                rawField === 'ok' ||
                rawField === 'status'
            ) {
                continue
            }

            if (typeof rawMessage !== 'string') {
                continue
            }

            setFieldError(fieldErrors, rawField, rawMessage)
        }
    }

    return fieldErrors
}

function escapeRegExp(value) {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function inferFieldErrorsFromMessage(message) {
    const normalizedMessage = String(message ?? '').trim()
    const searchableMessage = normalizeMessageForMatching(normalizedMessage)
    const fieldErrors = {}

    if (!normalizedMessage) {
        return fieldErrors
    }

    if (
        searchableMessage.match(/la fecha startAt no puede ser mayor a endAt/i) ||
        searchableMessage.match(/la fecha de inicio no puede ser mayor a la fecha de fin/i)
    ) {
        setFieldError(fieldErrors, 'endAt', normalizedMessage)
        return fieldErrors
    }

    const sortedFieldKeys = [...KNOWN_FIELD_KEYS].sort(
        (left, right) => right.length - left.length
    )

    for (const fieldKey of sortedFieldKeys) {
        const expression = new RegExp(`\\b${escapeRegExp(fieldKey)}\\b`, 'i')

        if (expression.test(searchableMessage)) {
            setFieldError(fieldErrors, fieldKey, normalizedMessage)
        }
    }

    if (searchableMessage.match(/duracion del codigo temporal/i)) {
        setFieldError(fieldErrors, 'ttlMinutes', normalizedMessage)
    }

    if (
        searchableMessage.match(/codigo temporal/i) &&
        !searchableMessage.match(/duracion del codigo temporal/i)
    ) {
        setFieldError(fieldErrors, 'linkCode', normalizedMessage)
    }

    if (searchableMessage.match(/token de dispositivo/i)) {
        setFieldError(fieldErrors, 'deviceToken', normalizedMessage)
    }

    if (searchableMessage.match(/token de actualizacion/i)) {
        setFieldError(fieldErrors, 'refreshToken', normalizedMessage)
    }

    if (searchableMessage.match(/estado del totem/i)) {
        setFieldError(fieldErrors, 'state', normalizedMessage)
    }

    if (
        searchableMessage.match(/\bcodigo\b/i) &&
        !searchableMessage.match(/codigo temporal/i)
    ) {
        setFieldError(fieldErrors, 'code', normalizedMessage)
    }

    if (searchableMessage.match(/\bnombre\b/i)) {
        setFieldError(fieldErrors, 'name', normalizedMessage)
    }

    if (searchableMessage.match(/\bcorreo\b/i)) {
        setFieldError(fieldErrors, 'email', normalizedMessage)
    }

    if (searchableMessage.match(/\brol\b/i)) {
        setFieldError(fieldErrors, 'role', normalizedMessage)
    }

    if (
        searchableMessage.match(/\bestado\b/i) &&
        !searchableMessage.match(/estado del totem/i)
    ) {
        setFieldError(fieldErrors, 'status', normalizedMessage)
    }

    if (searchableMessage.match(/\btitulo\b/i)) {
        setFieldError(fieldErrors, 'title', normalizedMessage)
    }

    if (searchableMessage.match(/\bdescripcion\b/i)) {
        setFieldError(fieldErrors, 'description', normalizedMessage)
    }

    if (searchableMessage.match(/tipo de contenido/i)) {
        setFieldError(fieldErrors, 'contentType', normalizedMessage)
    }

    if (searchableMessage.match(/\barchivo\b/i)) {
        setFieldError(fieldErrors, 'file', normalizedMessage)
    }

    if (searchableMessage.match(/fecha de inicio/i)) {
        setFieldError(fieldErrors, 'startAt', normalizedMessage)
    }

    if (searchableMessage.match(/fecha de fin/i)) {
        setFieldError(fieldErrors, 'endAt', normalizedMessage)
    }

    if (searchableMessage.match(/tipo de notificacion|filtro de tipo/i)) {
        setFieldError(fieldErrors, 'type', normalizedMessage)
    }

    if (searchableMessage.match(/totems de destino|totems especificos/i)) {
        setFieldError(fieldErrors, 'targetTotemIds', normalizedMessage)
    }

    if (searchableMessage.match(/campus de destino/i)) {
        setFieldError(fieldErrors, 'targetCampusId', normalizedMessage)
    }

    if (
        searchableMessage.match(/\bdestino\b/i) &&
        !searchableMessage.match(/cuando el destino|campus de destino|totems de destino|totems especificos/i)
    ) {
        setFieldError(fieldErrors, 'targetScope', normalizedMessage)
    }

    if (
        searchableMessage.match(/\bcampus\b/i) &&
        !searchableMessage.match(/campus de destino/i)
    ) {
        setFieldError(fieldErrors, 'campusId', normalizedMessage)
    }

    if (searchableMessage.match(/modo de asignacion/i)) {
        setFieldError(fieldErrors, 'assignmentMode', normalizedMessage)
    }

    if (searchableMessage.match(/varios totems|al menos un totem/i)) {
        setFieldError(fieldErrors, 'totemIds', normalizedMessage)
    }

    if (searchableMessage.match(/un totem unico|un totem para/i)) {
        setFieldError(fieldErrors, 'totemId', normalizedMessage)
    }

    if (searchableMessage.match(/varios contenidos|al menos un contenido|uno o varios contenidos/i)) {
        setFieldError(fieldErrors, 'contentIds', normalizedMessage)
    }

    if (searchableMessage.match(/un contenido/i)) {
        setFieldError(fieldErrors, 'contentId', normalizedMessage)
    }

    if (searchableMessage.match(/\borden\b/i)) {
        setFieldError(fieldErrors, 'sortOrder', normalizedMessage)
    }

    if (searchableMessage.match(/\bprioridad\b/i)) {
        setFieldError(fieldErrors, 'priority', normalizedMessage)
    }

    if (searchableMessage.match(/\bpregunta\b/i)) {
        setFieldError(fieldErrors, 'questionText', normalizedMessage)
    }

    if (searchableMessage.match(/\bmensaje\b/i)) {
        setFieldError(fieldErrors, 'message', normalizedMessage)
    }

    if (searchableMessage.match(/ya existe un totem con (ese|este) nombre/i)) {
        setFieldError(fieldErrors, 'name', normalizedMessage)
    }

    if (searchableMessage.match(/ya existe un totem con (ese|este) codigo/i)) {
        setFieldError(fieldErrors, 'code', normalizedMessage)
    }

    if (searchableMessage.match(/ya existe un usuario con ese correo/i)) {
        setFieldError(fieldErrors, 'email', normalizedMessage)
    }

    if (searchableMessage.match(/debes seleccionar un totem/i)) {
        setFieldError(fieldErrors, 'totemId', normalizedMessage)
    }

    if (searchableMessage.match(/debes seleccionar un contenido/i)) {
        setFieldError(fieldErrors, 'contentId', normalizedMessage)
    }

    if (searchableMessage.match(/debes adjuntar un archivo/i)) {
        setFieldError(fieldErrors, 'file', normalizedMessage)
    }

    if (searchableMessage.match(/uno o mas totems seleccionados no existen/i)) {
        setFieldError(fieldErrors, 'targetTotemIds', normalizedMessage)
    }

    if (searchableMessage.match(/la referencia de totem no existe/i)) {
        setFieldError(fieldErrors, 'targetTotemIds', normalizedMessage)
    }

    if (searchableMessage.match(/uno o mas campus seleccionados no existen/i)) {
        setFieldError(fieldErrors, 'targetCampusId', normalizedMessage)
    }

    if (searchableMessage.match(/la referencia de.*campus/i)) {
        setFieldError(fieldErrors, 'targetCampusId', normalizedMessage)
    }

    if (searchableMessage.match(/solo puedes asignar totems activos/i)) {
        setFieldError(fieldErrors, 'totemIds', normalizedMessage)
    }

    if (searchableMessage.match(/solo puedes asignar contenidos activos/i)) {
        setFieldError(fieldErrors, 'contentIds', normalizedMessage)
    }

    if (searchableMessage.match(/el contenido ya esta asignado al totem indicado/i)) {
        setFieldError(fieldErrors, 'contentId', normalizedMessage)
    }

    if (searchableMessage.match(/asignacion vigente o futura.*fechas solapadas/i)) {
        setFieldError(fieldErrors, 'contentId', normalizedMessage)
    }

    return fieldErrors
}

function buildErrorPayload({
    code,
    message,
    details = null,
}) {
    const explicitFieldErrors = extractFieldErrorsFromDetails(details)
    const fieldErrors =
        Object.keys(explicitFieldErrors).length > 0
            ? explicitFieldErrors
            : inferFieldErrorsFromMessage(message)
    const hasFieldErrors = Object.keys(fieldErrors).length > 0

    return {
        ok: false,
        code,
        message,
        details: details ?? (hasFieldErrors ? fieldErrors : null),
        fieldErrors: hasFieldErrors ? fieldErrors : null,
    }
}

export function notFoundHandler(req, res, next) {
    res.status(404).json(
        buildErrorPayload({
            code: 'ROUTE_NOT_FOUND',
            message: 'Ruta no encontrada',
        })
    )
}

export function errorHandler(err, req, res, next) {
    console.error(err)

    if (req?.file?.path) {
        void removeFileIfExists(req.file.path)
    }

    if (Array.isArray(req?.files)) {
        for (const uploadedFile of req.files) {
            if (uploadedFile?.path) {
                void removeFileIfExists(uploadedFile.path)
            }
        }
    }

    if (err instanceof AppError) {
        return res.status(err.statusCode).json(
            buildErrorPayload({
                code: err.code,
                message: err.message,
                details: err.details ?? null,
            })
        )
    }

    if (err?.name === 'MulterError') {
        if (err.code === 'LIMIT_FILE_SIZE') {
            return res.status(413).json(
                buildErrorPayload({
                    code: 'FILE_TOO_LARGE',
                    message: 'El archivo excede el tamaño máximo permitido',
                })
            )
        }

        if (err.code === 'LIMIT_FILE_COUNT') {
            return res.status(422).json(
                buildErrorPayload({
                    code: 'FILE_COUNT_EXCEEDED',
                    message: 'Se excedió la cantidad máxima de archivos permitidos',
                })
            )
        }

        return res.status(422).json(
            buildErrorPayload({
                code: 'FILE_UPLOAD_ERROR',
                message: 'No se pudo procesar el archivo enviado',
            })
        )
    }

    if (err instanceof UniqueConstraintError) {
        return res.status(409).json(
            buildErrorPayload({
                code: 'UNIQUE_CONSTRAINT_ERROR',
                message: 'Ya existe un registro con un valor Único duplicado',
                details:
                    err.errors?.map((item) => ({
                        field: item.path,
                        message: item.message,
                    })) ?? null,
            })
        )
    }

    if (err instanceof SequelizeValidationError) {
        return res.status(422).json(
            buildErrorPayload({
                code: 'MODEL_VALIDATION_ERROR',
                message: 'Los datos enviados no son válidos',
                details:
                    err.errors?.map((item) => ({
                        field: item.path,
                        message: item.message,
                    })) ?? null,
            })
        )
    }

    return res.status(500).json(
        buildErrorPayload({
            code: 'INTERNAL_SERVER_ERROR',
            message: 'Error interno del servidor',
        })
    )
}
