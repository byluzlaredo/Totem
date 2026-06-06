import type {
    TotemContentFormErrors,
    TotemContentFormValues,
} from "../../../types/totemContent";
import type { ContentType } from "../../../types/content";
import {
    CONTENT_TYPE_LIMIT_LABELS,
    TOTEM_ASSIGNMENT_TYPE_LIMITS,
} from "../../../constants/totemContent";

type TotemContentValidationMode = 'create' | 'edit'

export interface TotemContentValidationOptions {
    mode?: TotemContentValidationMode
    initialStartAt?: string
}

function parsePositiveInteger(value: string): number | null {
    if (!value) return null

    const parsed = Number(value)

    if (!Number.isInteger(parsed) || parsed <= 0) {
        return null
    }

    return parsed
}

function parseDateOrNull(value: string) {
    if (!value) {
        return null
    }

    const parsed = new Date(value)

    if (Number.isNaN(parsed.getTime())) {
        return null
    }

    return parsed
}

function areSameInstants(leftValue: string, rightValue: string) {
    const leftDate = parseDateOrNull(leftValue)
    const rightDate = parseDateOrNull(rightValue)

    if (!leftDate || !rightDate) {
        return false
    }

    return leftDate.getTime() === rightDate.getTime()
}

function uniquePositiveIntegers(values: Array<string | number>) {
    return [...new Set(values.map((value) => Number(value)).filter((value) => Number.isInteger(value) && value > 0))]
}

export function resolveSelectedTotemIds(
    values: TotemContentFormValues,
    allActiveTotemIds: number[]
) {
    if (values.assignmentMode === 'all') {
        return uniquePositiveIntegers(allActiveTotemIds)
    }

    if (values.assignmentMode === 'multiple') {
        return uniquePositiveIntegers(values.totemIds)
    }

    const parsed = parsePositiveInteger(values.totemId)
    return parsed ? [parsed] : []
}

export function resolveSelectedContentIds(values: TotemContentFormValues) {
    if (values.contentAssignmentMode === 'multiple') {
        return uniquePositiveIntegers(values.contentIds)
    }

    const parsed = parsePositiveInteger(values.contentId)
    return parsed ? [parsed] : []
}

export function getTotemAssignmentTypeLimit(contentType: ContentType) {
    return TOTEM_ASSIGNMENT_TYPE_LIMITS[contentType]
}

export function buildTotemAssignmentLimitMessage(
    totemLabel: string,
    contentType: ContentType
) {
    const limit = getTotemAssignmentTypeLimit(contentType)
    const typeLabel = CONTENT_TYPE_LIMIT_LABELS[contentType]

    return `${totemLabel} supera el límite de ${limit} ${typeLabel}`
}

export function buildTypeOverlapLimitMessage(
    totemName: string,
    contentType: ContentType,
    concurrentCount: number
) {
    const limit = getTotemAssignmentTypeLimit(contentType)
    const typeLabel = CONTENT_TYPE_LIMIT_LABELS[contentType]
    const assignmentWord = concurrentCount === 1 ? 'asignación' : 'asignaciones'
    const programWord = concurrentCount === 1 ? 'programada' : 'programadas'

    return `El tótem "${totemName}" ya tiene ${concurrentCount} ${assignmentWord} de ${typeLabel} ${programWord} en ese rango horario. El límite permitido para ${typeLabel} es ${limit}.`
}

export function buildOpenEndedTypeLimitMessage(contentType: ContentType) {
    const limit = getTotemAssignmentTypeLimit(contentType)
    const typeLabel = CONTENT_TYPE_LIMIT_LABELS[contentType]

    return `No se puede guardar esta asignación de ${typeLabel} porque no tiene fecha de finalización y se cruza con una asignación programada existente. El límite permitido para ${typeLabel} es ${limit}. Agrega una fecha de finalización antes del inicio de la asignación programada, o desactiva la asignación existente.`
}

export function buildDuplicateTotemContentMessage(
    totemName: string,
    contentName: string
) {
    return `El tótem "${totemName}" ya tiene una asignación vigente o futura para el contenido "${contentName}" con fechas solapadas`
}

export function normalizeTotemContentFormValues(
    values: TotemContentFormValues
): TotemContentFormValues {
    return {
        ...values,
        assignmentMode: values.assignmentMode,
        totemId: values.totemId.trim(),
        totemIds: [...new Set(values.totemIds.map((id) => id.trim()).filter(Boolean))],
        contentAssignmentMode: values.contentAssignmentMode,
        contentId: values.contentId.trim(),
        contentIds: [...new Set(values.contentIds.map((id) => id.trim()).filter(Boolean))],
        startAt: values.startAt.trim(),
        endAt: values.endAt.trim(),
        priority: values.priority.trim(),
        sortOrder: values.sortOrder.trim(),
    }
}

export function validateTotemContentForm(
    values: TotemContentFormValues,
    options: TotemContentValidationOptions = {}
): TotemContentFormErrors {
    const errors: TotemContentFormErrors = {}
    const validationMode = options.mode ?? 'create'

    if (!['single', 'multiple', 'all'].includes(values.assignmentMode)) {
        errors.assignmentMode = 'Debes seleccionar un modo de asignación válido'
    }

    if (values.assignmentMode === 'single' && !parsePositiveInteger(values.totemId)) {
        errors.totemId = 'Debes seleccionar un tótem válido'
    }

    if (values.assignmentMode === 'multiple') {
        if (values.totemIds.length === 0) {
            errors.totemIds = 'Debes seleccionar al menos un tótem'
        } else {
            const hasInvalidId = values.totemIds.some((totemId) => !parsePositiveInteger(totemId))

            if (hasInvalidId) {
                errors.totemIds = 'Todos los tótems seleccionados deben ser válidos'
            }
        }
    }

    if (!['single', 'multiple'].includes(values.contentAssignmentMode)) {
        errors.contentAssignmentMode = 'Debes seleccionar un modo de contenido válido'
    }

    if (values.contentAssignmentMode === 'single') {
        if (!parsePositiveInteger(values.contentId)) {
            errors.contentId = 'Debes seleccionar un contenido válido'
        }
    }

    if (values.contentAssignmentMode === 'multiple') {
        if (values.contentIds.length === 0) {
            errors.contentIds = 'Debes seleccionar al menos un contenido'
        } else {
            const hasInvalidId = values.contentIds.some((contentId) => !parsePositiveInteger(contentId))

            if (hasInvalidId) {
                errors.contentIds = 'Todos los contenidos seleccionados deben ser válidos'
            }
        }
    }

    if (!['active', 'inactive'].includes(values.status)) {
        errors.status = 'El estado debe ser activo o inactivo'
    }

    if (!parsePositiveInteger(values.priority)) {
        errors.priority = 'La prioridad debe ser un entero positivo'
    }

    if (!parsePositiveInteger(values.sortOrder)) {
        errors.sortOrder = 'El orden debe ser un entero positivo'
    }

    if (values.startAt) {
        const start = parseDateOrNull(values.startAt)

        if (!start) {
            errors.startAt = 'La fecha de inicio no es válida'
        } else if (start < new Date()) {
            const canKeepExistingPastStartAt =
                validationMode === 'edit' &&
                areSameInstants(values.startAt, options.initialStartAt ?? '')

            if (!canKeepExistingPastStartAt) {
                errors.startAt = 'La fecha de inicio debe ser mayor o igual a la fecha y hora actual'
            }
        }
    }

    if (values.endAt) {
        const end = parseDateOrNull(values.endAt)

        if (!end) {
            errors.endAt = 'La fecha de fin no es válida'
        }
    }

    const parsedStartAt = parseDateOrNull(values.startAt)
    const parsedEndAt = parseDateOrNull(values.endAt)
    const now = new Date()

    if (parsedStartAt && parsedEndAt && parsedStartAt > parsedEndAt) {
        errors.endAt = 'La fecha de fin no puede ser menor a la fecha de inicio'
    }

    if (!parsedStartAt && parsedEndAt && parsedEndAt <= now) {
        errors.endAt = 'Cuando no defines fecha de inicio, la fecha de fin debe ser mayor a la fecha y hora actual'
    }

    return errors
}
