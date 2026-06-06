import {
    ConflictError,
    NotFoundError,
    RequestValidationError,
} from "../errors/AppError.js";
import { sequelize } from "../config/db.js";
import contentRepository from "../repositories/content.repository.js";
import totemContentRepository from "../repositories/totemContent.repository.js";
import totemRepository from "../repositories/totem.repository.js";
import { isContentExpiredAt, isContentScheduledAt } from "../utils/assignmentAvailability.js";
import { requireCampusScopeId } from "../utils/campusAccess.js";

const CONTENT_TYPE_LIMITS = {
    image: 8,
    video: 3,
    advertisement: 5,
    news: 6,
    pdf: 3,
}

const CONTENT_TYPE_LABELS = {
    image: 'imágenes',
    video: 'videos',
    advertisement: 'publicidades',
    news: 'noticias',
    pdf: 'PDFs',
}

function validateDateRange(startAt, endAt) {
    if (startAt && endAt && new Date(startAt) > new Date(endAt)) {
        throw new RequestValidationError('La fecha de inicio no puede ser mayor a la fecha de fin')
    }
}

function uniquePositiveIntegers(ids) {
    if (!Array.isArray(ids)) return []

    return [...new Set(ids)]
        .map((value) => Number(value))
        .filter((value) => Number.isInteger(value) && value > 0)
}

function getPairKey(totemId, contentId) {
    return `${totemId}:${contentId}`
}

function getTotemTypeKey(totemId, contentType) {
    return `${totemId}:${contentType}`
}

function getContentTypeLimit(contentType) {
    return CONTENT_TYPE_LIMITS[contentType] ?? null
}

function getContentTypeLabel(contentType) {
    return CONTENT_TYPE_LABELS[contentType] ?? String(contentType)
}

function buildLimitExceededMessage(totemId, contentType, limit) {
    return `El tótem #${totemId} excede el límite de ${limit} ${getContentTypeLabel(contentType)}`
}

function buildTemporalStartAtMessage() {
    return 'La fecha de inicio debe ser mayor o igual a la fecha y hora actual'
}

function buildTemporalEndAtWithoutStartMessage() {
    return 'Cuando no envías fecha de inicio, la fecha de fin debe ser mayor a la fecha y hora actual'
}

function buildTypeOverlapLimitMessage({
    totemName,
    contentType,
    concurrentCount,
    limit,
}) {
    const typeLabel = getContentTypeLabel(contentType)
    const assignmentWord = concurrentCount === 1 ? 'asignación' : 'asignaciones'
    const programWord = concurrentCount === 1 ? 'programada' : 'programadas'

    return `El tótem "${totemName}" ya tiene ${concurrentCount} ${assignmentWord} de ${typeLabel} ${programWord} en ese rango horario. El límite permitido para ${typeLabel} es ${limit}.`
}

function buildOpenEndedLimitMessage(contentType, limit) {
    const typeLabel = getContentTypeLabel(contentType)

    return `No se puede guardar esta asignación de ${typeLabel} porque no tiene fecha de finalización y se cruza con una asignación programada existente. El límite permitido para ${typeLabel} es ${limit}. Agrega una fecha de finalización antes del inicio de la asignación programada, o desactiva la asignación existente.`
}

function parseDateOrNull(value) {
    if (!value) {
        return null
    }

    const parsed = value instanceof Date ? value : new Date(value)

    if (Number.isNaN(parsed.getTime())) {
        return null
    }

    return parsed
}

function areSameInstants(leftValue, rightValue, options = {}) {
    const { precision = 'exact' } = options
    const leftDate = parseDateOrNull(leftValue)
    const rightDate = parseDateOrNull(rightValue)

    if (!leftDate || !rightDate) {
        return false
    }

    if (precision === 'minute') {
        return (
            Math.floor(leftDate.getTime() / 60000) ===
            Math.floor(rightDate.getTime() / 60000)
        )
    }

    return leftDate.getTime() === rightDate.getTime()
}

function buildDuplicateAssignmentMessage(totemName, contentName) {
    return `El tótem "${totemName}" ya tiene una asignación vigente o futura para el contenido "${contentName}" con fechas solapadas`
}

function isBulkAssignmentMode(assignmentMode) {
    return assignmentMode === 'multiple' || assignmentMode === 'all'
}

function isUniquePairConstraintError(error) {
    if (!error || error.name !== 'SequelizeUniqueConstraintError') {
        return false
    }

    return error.errors?.some((item) =>
        String(item.path).includes('totem_id') ||
        String(item.path).includes('content_id')
    ) ?? true
}

class TotemContentService {
    getScopedCampusId(authUser = null) {
        return requireCampusScopeId(authUser)
    }

    getTypeCounter(counters, totemId, contentType) {
        const totemCounters = counters.get(totemId)

        if (!totemCounters) {
            return 0
        }

        return totemCounters[contentType] ?? 0
    }

    setTypeCounter(counters, totemId, contentType, nextValue) {
        const totemCounters = counters.get(totemId) ?? {}
        const sanitizedValue = Math.max(0, nextValue)

        counters.set(totemId, {
            ...totemCounters,
            [contentType]: sanitizedValue,
        })
    }

    updateTypeCounter(counters, totemId, contentType, delta) {
        const current = this.getTypeCounter(counters, totemId, contentType)
        this.setTypeCounter(counters, totemId, contentType, current + delta)
    }

    getCurrentSortOrder(sortOrdersByTotemType, totemId, contentType) {
        return sortOrdersByTotemType.get(getTotemTypeKey(totemId, contentType)) ?? 0
    }

    setCurrentSortOrder(sortOrdersByTotemType, totemId, contentType, value) {
        sortOrdersByTotemType.set(
            getTotemTypeKey(totemId, contentType),
            Math.max(0, Number(value) || 0)
        )
    }

    ensureTypeLimitAvailable(counters, totemId, contentType) {
        const limit = getContentTypeLimit(contentType)

        if (!limit) {
            throw new RequestValidationError(
                `No existe una regla de límite para el tipo de contenido ${contentType}`
            )
        }

        const current = this.getTypeCounter(counters, totemId, contentType)

        if (current + 1 > limit) {
            throw new RequestValidationError(
                buildLimitExceededMessage(totemId, contentType, limit)
            )
        }
    }

    isTemporalRecordActiveNow({ status, startAt, endAt }, now = new Date()) {
        if (status !== 'active') {
            return false
        }

        if (isContentScheduledAt(startAt, now)) {
            return false
        }

        if (isContentExpiredAt(endAt, now)) {
            return false
        }

        return true
    }

    isContentActiveNow(content) {
        if (!content) {
            return false
        }

        return content.status === 'active'
    }

    shouldCountAssignmentForLimit({
        status,
        startAt,
        endAt,
        content,
        now = new Date(),
    }) {
        if (!this.isTemporalRecordActiveNow({ status, startAt, endAt }, now)) {
            return false
        }

        return this.isContentActiveNow(content)
    }

    assertTemporalBoundaries(startAt, endAt, now = new Date(), options = {}) {
        const { existingStartAt = undefined } = options
        const parsedStartAt = parseDateOrNull(startAt)
        const parsedEndAt = parseDateOrNull(endAt)
        const nowTime = now.getTime()

        const canKeepExistingPastStartAt =
            parsedStartAt &&
            parsedStartAt.getTime() < nowTime &&
            existingStartAt !== undefined &&
            areSameInstants(startAt, existingStartAt, { precision: 'minute' })

        if (parsedStartAt && parsedStartAt.getTime() < nowTime && !canKeepExistingPastStartAt) {
            const message = buildTemporalStartAtMessage()
            throw new RequestValidationError(message, { startAt: message })
        }

        if (!parsedStartAt && parsedEndAt && parsedEndAt.getTime() <= nowTime) {
            const message = buildTemporalEndAtWithoutStartMessage()
            throw new RequestValidationError(message, { endAt: message })
        }
    }

    normalizeTimelineInterval(
        {
            startAt = null,
            endAt = null,
            createdAt = null,
        },
        now = new Date(),
        {
            fallbackStartToNow = false,
        } = {}
    ) {
        const parsedStartAt = parseDateOrNull(startAt)
        const parsedEndAt = parseDateOrNull(endAt)
        const parsedCreatedAt = parseDateOrNull(createdAt)

        const effectiveStartAt =
            parsedStartAt ??
            (fallbackStartToNow
                ? now
                : parsedCreatedAt ?? now)

        return {
            startAt: effectiveStartAt,
            endAt: parsedEndAt,
        }
    }

    doIntervalsOverlap(leftInterval, rightInterval) {
        const leftStart = leftInterval.startAt.getTime()
        const rightStart = rightInterval.startAt.getTime()
        const leftEnd = leftInterval.endAt
            ? leftInterval.endAt.getTime()
            : Number.POSITIVE_INFINITY
        const rightEnd = rightInterval.endAt
            ? rightInterval.endAt.getTime()
            : Number.POSITIVE_INFINITY

        return leftStart <= rightEnd && rightStart <= leftEnd
    }

    getMaxExistingOverlap(existingIntervals, candidateInterval) {
        if (!Array.isArray(existingIntervals) || existingIntervals.length === 0) {
            return 0
        }

        const candidateStartMs = candidateInterval.startAt.getTime()
        const candidateEndMs = candidateInterval.endAt
            ? candidateInterval.endAt.getTime()
            : Number.POSITIVE_INFINITY
        const events = []

        for (const interval of existingIntervals) {
            if (!this.doIntervalsOverlap(interval, candidateInterval)) {
                continue
            }

            const intervalStartMs = interval.startAt.getTime()
            const intervalEndMs = interval.endAt
                ? interval.endAt.getTime()
                : Number.POSITIVE_INFINITY
            const clippedStartMs = Math.max(intervalStartMs, candidateStartMs)
            const clippedEndMs = Math.min(intervalEndMs, candidateEndMs)

            if (clippedStartMs > clippedEndMs) {
                continue
            }

            events.push({ at: clippedStartMs, type: 'start' })

            if (Number.isFinite(clippedEndMs)) {
                events.push({ at: clippedEndMs, type: 'end' })
            }
        }

        if (events.length === 0) {
            return 0
        }

        events.sort((left, right) => {
            if (left.at !== right.at) {
                return left.at - right.at
            }

            if (left.type === right.type) {
                return 0
            }

            return left.type === 'start' ? -1 : 1
        })

        let running = 0
        let maxRunning = 0

        for (const event of events) {
            if (event.type === 'start') {
                running += 1
            } else {
                running -= 1
            }

            if (running > maxRunning) {
                maxRunning = running
            }
        }

        return Math.max(0, maxRunning)
    }

    hasScheduledOverlap(existingIntervals, candidateInterval, now = new Date()) {
        const nowTime = now.getTime()

        return existingIntervals.some((interval) => {
            if (!this.doIntervalsOverlap(interval, candidateInterval)) {
                return false
            }

            return interval.startAt.getTime() > nowTime
        })
    }

    buildTypeTimelineMap(assignments, now = new Date()) {
        const timelineByTotemType = new Map()

        for (const assignment of assignments) {
            const contentType = assignment.content?.contentType

            if (!contentType) {
                continue
            }

            const key = getTotemTypeKey(assignment.totemId, contentType)
            const existing = timelineByTotemType.get(key) ?? []

            existing.push(
                this.normalizeTimelineInterval(
                    {
                        startAt: assignment.startAt,
                        endAt: assignment.endAt,
                        createdAt: assignment.createdAt,
                    },
                    now
                )
            )

            timelineByTotemType.set(key, existing)
        }

        return timelineByTotemType
    }

    evaluateTypeLimitConflict({
        timelineByTotemType,
        totemId,
        totemName,
        contentType,
        startAt,
        endAt,
        now = new Date(),
    }) {
        const limit = getContentTypeLimit(contentType)

        if (!limit) {
            throw new RequestValidationError(
                `No existe una regla de límite para el tipo de contenido ${contentType}`
            )
        }

        const candidateInterval = this.normalizeTimelineInterval(
            {
                startAt,
                endAt,
            },
            now,
            {
                fallbackStartToNow: true,
            }
        )
        const key = getTotemTypeKey(totemId, contentType)
        const currentTimeline = timelineByTotemType.get(key) ?? []
        const maxExistingOverlap = this.getMaxExistingOverlap(
            currentTimeline,
            candidateInterval
        )
        const maxConcurrentAssignments = maxExistingOverlap + 1

        if (maxConcurrentAssignments > limit) {
            const isOpenEndedCandidate = !parseDateOrNull(endAt)
            const hasFutureScheduledOverlap =
                isOpenEndedCandidate &&
                this.hasScheduledOverlap(currentTimeline, candidateInterval, now)
            const message = hasFutureScheduledOverlap
                ? buildOpenEndedLimitMessage(contentType, limit)
                : buildTypeOverlapLimitMessage({
                    totemName,
                    contentType,
                    concurrentCount: maxExistingOverlap,
                    limit,
                })

            return {
                contentType,
                message,
                field: hasFutureScheduledOverlap ? 'endAt' : 'startAt',
            }
        }

        return {
            contentType,
            message: null,
            field: null,
            normalizedInterval: candidateInterval,
        }
    }

    async buildCurrentTypeCounters(totemIds, now = new Date(), options = {}) {
        const normalizedTotemIds = uniquePositiveIntegers(totemIds)

        if (normalizedTotemIds.length === 0) {
            return {
                counters: new Map(),
                activePairs: new Set(),
                sortOrdersByTotemType: new Map(),
            }
        }

        const activeAssignments =
            await totemContentRepository.findActiveAssignmentsByTotemIds(
                normalizedTotemIds,
                now,
                options
            )

        const counters = new Map()
        const activePairs = new Set()
        const sortOrdersByTotemType = new Map()

        for (const assignment of activeAssignments) {
            const contentType = assignment.content?.contentType

            if (!contentType) continue

            this.updateTypeCounter(counters, assignment.totemId, contentType, 1)
            activePairs.add(getPairKey(assignment.totemId, assignment.contentId))

            const currentMaxSortOrder = this.getCurrentSortOrder(
                sortOrdersByTotemType,
                assignment.totemId,
                contentType
            )
            const assignmentSortOrder = Math.max(0, Number(assignment.sortOrder) || 0)

            if (assignmentSortOrder > currentMaxSortOrder) {
                this.setCurrentSortOrder(
                    sortOrdersByTotemType,
                    assignment.totemId,
                    contentType,
                    assignmentSortOrder
                )
            }
        }

        return {
            counters,
            activePairs,
            sortOrdersByTotemType,
        }
    }

    async assertTotemIsActive(totemId, authUser = null, options = {}) {
        const totem = await totemRepository.findById(totemId, options)

        if (!totem) {
            throw new NotFoundError('El tótem especificado no existe')
        }

        const scopedCampusId = this.getScopedCampusId(authUser)
        if (scopedCampusId !== null && Number(totem.campusId) !== scopedCampusId) {
            throw new NotFoundError('El tótem especificado no existe')
        }

        if (totem.state !== 'active') {
            throw new RequestValidationError(
                `El tótem #${totemId} debe estar activo para asignar contenidos`
            )
        }
    }

    async assertTotemsAreActive(totemIds, authUser = null, options = {}) {
        const uniqueTotemIds = uniquePositiveIntegers(totemIds)
        const scopedCampusId = this.getScopedCampusId(authUser)
        const foundTotems = await totemRepository.findSummariesByIds(
            uniqueTotemIds,
            options
        )
        const foundTotemById = new Map(foundTotems.map((totem) => [totem.id, totem]))
        const invalidIds = uniqueTotemIds.filter((id) => {
            const foundTotem = foundTotemById.get(id)

            if (!foundTotem) {
                return true
            }

            if (foundTotem.state !== 'active') {
                return true
            }

            if (scopedCampusId !== null && Number(foundTotem.campusId) !== scopedCampusId) {
                return true
            }

            return false
        })

        if (invalidIds.length > 0) {
            throw new RequestValidationError(
                `Solo puedes asignar tótems activos. Revisa: ${invalidIds.join(', ')}`
            )
        }
    }

    async getActiveContentByIdOrThrow(contentId, authUser = null, options = {}) {
        const content = await contentRepository.findById(contentId, options)

        if (!content) {
            throw new NotFoundError('El contenido especificado no existe')
        }

        const scopedCampusId = this.getScopedCampusId(authUser)
        if (scopedCampusId !== null && Number(content.campusId) !== scopedCampusId) {
            throw new NotFoundError('El contenido especificado no existe')
        }

        if (content.status !== 'active') {
            throw new RequestValidationError(
                `El contenido #${contentId} debe estar activo para asignarse`
            )
        }

        return content
    }

    async getActiveContentsByIdsOrThrow(contentIds, authUser = null, options = {}) {
        const uniqueContentIds = uniquePositiveIntegers(contentIds)
        const scopedCampusId = this.getScopedCampusId(authUser)
        const contents = await contentRepository.findActiveSummariesByIds(
            uniqueContentIds,
            options
        )
        const scopedContents = scopedCampusId === null
            ? contents
            : contents.filter(
                (content) => Number(content.campusId) === scopedCampusId
            )
        const contentById = new Map(scopedContents.map((content) => [content.id, content]))
        const invalidIds = uniqueContentIds.filter((id) => !contentById.has(id))

        if (invalidIds.length > 0) {
            throw new RequestValidationError(
                `Solo puedes asignar contenidos activos. Revisa: ${invalidIds.join(', ')}`
            )
        }

        return contentById
    }

    async resolveTargetTotemIds(data, authUser = null, options = {}) {
        const scopedCampusId = this.getScopedCampusId(authUser)

        if (data.assignmentMode === 'single') {
            await this.assertTotemIsActive(data.totemId, authUser, options)
            return [data.totemId]
        }

        if (data.assignmentMode === 'multiple') {
            await this.assertTotemsAreActive(data.totemIds, authUser, options)
            return uniquePositiveIntegers(data.totemIds)
        }

        const activeTotemIds = scopedCampusId === null
            ? await totemRepository.findActiveIds(options)
            : await totemRepository.findActiveIdsByCampusId(scopedCampusId, options)

        if (activeTotemIds.length === 0) {
            throw new NotFoundError('No hay tótems activos disponibles para asignar')
        }

        return activeTotemIds
    }

    async resolveTargetContents(data, authUser = null, options = {}) {
        if (Array.isArray(data.contentIds) && data.contentIds.length > 0) {
            const targetContentIds = uniquePositiveIntegers(data.contentIds)
            const contentById = await this.getActiveContentsByIdsOrThrow(
                targetContentIds,
                authUser,
                options
            )

            return {
                targetContentIds,
                contentById,
            }
        }

        const content = await this.getActiveContentByIdOrThrow(
            data.contentId,
            authUser,
            options
        )

        return {
            targetContentIds: [content.id],
            contentById: new Map([[content.id, content]]),
        }
    }

    buildAssignmentPayload(data, totemId, contentId, sortOrder) {
        return {
            totemId,
            contentId,
            status: data.status ?? 'active',
            startAt: data.startAt ?? null,
            endAt: data.endAt ?? null,
            priority: data.priority ?? 1,
            sortOrder,
        }
    }

    async createAssignment(data, authUser = null) {
        const assignmentMode = data.assignmentMode ?? 'single'
        const nextStatus = data.status ?? 'active'
        const willBeActive = nextStatus === 'active'
        const shouldSkipExistingPairs = isBulkAssignmentMode(assignmentMode)
        const shouldSkipLimitExceeded = shouldSkipExistingPairs && willBeActive
        const now = new Date()

        validateDateRange(data.startAt, data.endAt)
        this.assertTemporalBoundaries(data.startAt ?? null, data.endAt ?? null, now)

        return sequelize.transaction(async (transaction) => {
            const targetTotemIds = await this.resolveTargetTotemIds(
                {
                    ...data,
                    assignmentMode,
                },
                authUser,
                { transaction }
            )
            const { targetContentIds, contentById } = await this.resolveTargetContents(
                data,
                authUser,
                { transaction }
            )
            const { sortOrdersByTotemType } = await this.buildCurrentTypeCounters(
                targetTotemIds,
                now,
                { transaction }
            )
            const overlappingAssignments = willBeActive
                ? await totemContentRepository.findOverlappingActiveOrFutureAssignments(
                    targetTotemIds,
                    targetContentIds,
                    {
                        startAt: data.startAt ?? now.toISOString(),
                        endAt: data.endAt ?? null,
                        now,
                    },
                    { transaction }
                )
                : []
            const overlappingPairs = new Set(
                overlappingAssignments.map((row) => getPairKey(row.totemId, row.contentId))
            )
            const targetTotems = await totemRepository.findSummariesByIds(
                targetTotemIds,
                { transaction }
            )
            const totemNameById = new Map(
                targetTotems.map((totem) => [
                    totem.id,
                    totem.name || `#${totem.id}`,
                ])
            )
            const selectedContentTypes = [...new Set(
                [...contentById.values()]
                    .map((content) => content?.contentType)
                    .filter(Boolean)
            )]
            const activeOrScheduledAssignmentsByType = willBeActive
                ? await totemContentRepository
                    .findActiveOrScheduledAssignmentsByTotemIdsAndContentTypes(
                        targetTotemIds,
                        selectedContentTypes,
                        {
                            now,
                        },
                        { transaction }
                    )
                : []
            const timelineByTotemType = this.buildTypeTimelineMap(
                activeOrScheduledAssignmentsByType,
                now
            )

            const summary = {
                requested: targetTotemIds.length * targetContentIds.length,
                created: 0,
                skippedExisting: 0,
                skippedLimit: 0,
                limitReachedByContentType: {},
                updated: 0,
                reactivated: 0,
            }
            const limitReachedTotemsByType = new Map()

            const assignments = []

            for (const totemId of targetTotemIds) {
                for (const contentId of targetContentIds) {
                    const content = contentById.get(contentId)
                    const contentType = content?.contentType
                    const contentName = content?.title || String(contentId)
                    const totemName = totemNameById.get(totemId) || `#${totemId}`

                    if (!contentType) {
                        throw new RequestValidationError(
                            `No se pudo identificar el tipo del contenido ${contentId}`
                        )
                    }

                    const pairKey = getPairKey(totemId, contentId)

                    if (willBeActive && overlappingPairs.has(pairKey)) {
                        if (shouldSkipExistingPairs) {
                            summary.skippedExisting += 1
                            continue
                        }

                        throw new ConflictError(
                            buildDuplicateAssignmentMessage(totemName, contentName)
                        )
                    }

                    let typeLimitEvaluation = null

                    if (willBeActive) {
                        typeLimitEvaluation = this.evaluateTypeLimitConflict({
                            timelineByTotemType,
                            totemId,
                            totemName,
                            contentType,
                            startAt: data.startAt ?? null,
                            endAt: data.endAt ?? null,
                            now,
                        })

                        if (typeLimitEvaluation.message) {
                            if (shouldSkipLimitExceeded) {
                                summary.skippedLimit += 1

                                const totemsByType =
                                    limitReachedTotemsByType.get(contentType) ?? new Set()

                                totemsByType.add(totemName)
                                limitReachedTotemsByType.set(contentType, totemsByType)
                                continue
                            }

                            throw new RequestValidationError(
                                typeLimitEvaluation.message,
                                {
                                    [typeLimitEvaluation.field]: typeLimitEvaluation.message,
                                }
                            )
                        }
                    }

                    const nextSortOrderForType =
                        this.getCurrentSortOrder(
                            sortOrdersByTotemType,
                            totemId,
                            contentType
                        ) + 1
                    const assignmentPayload = this.buildAssignmentPayload(
                        data,
                        totemId,
                        contentId,
                        nextSortOrderForType
                    )

                    try {
                        const assignment = await totemContentRepository.create(
                            assignmentPayload,
                            { transaction }
                        )

                        this.setCurrentSortOrder(
                            sortOrdersByTotemType,
                            totemId,
                            contentType,
                            nextSortOrderForType
                        )

                        if (willBeActive && typeLimitEvaluation?.normalizedInterval) {
                            const timelineKey = getTotemTypeKey(totemId, contentType)
                            const timeline = timelineByTotemType.get(timelineKey) ?? []

                            timeline.push(typeLimitEvaluation.normalizedInterval)
                            timelineByTotemType.set(timelineKey, timeline)
                        }

                        assignments.push(assignment)
                        summary.created += 1
                    } catch (error) {
                        if (isUniquePairConstraintError(error)) {
                            if (shouldSkipExistingPairs) {
                                summary.skippedExisting += 1
                                continue
                            }

                            throw new ConflictError(
                                buildDuplicateAssignmentMessage(totemName, contentName)
                            )
                        }

                        throw error
                    }
                }
            }

            summary.limitReachedByContentType = Object.fromEntries(
                [...limitReachedTotemsByType.entries()].map(([contentType, totemNames]) => [
                    contentType,
                    [...totemNames].sort((left, right) => left.localeCompare(right)),
                ])
            )

            return {
                assignmentMode,
                assignments,
                summary,
            }
        })
    }

    async listAssignments(query, authUser = null) {
        const scopedCampusId = this.getScopedCampusId(authUser)
        const scopedQuery = scopedCampusId === null
            ? query
            : {
                ...query,
                campusId: scopedCampusId,
            }
        const { count, rows } = await totemContentRepository.findAllWithPagination(scopedQuery)

        return {
            items: rows,
            meta: {
                totalItems: count,
                totalPages: count === 0 ? 0 : Math.ceil(count / scopedQuery.limit),
                currentPage: scopedQuery.page,
                pageSize: scopedQuery.limit,
            },
        }
    }

    async getAssignmentById(id, authUser = null) {
        const assignment = await totemContentRepository.findById(id)

        if (!assignment) {
            throw new NotFoundError('La asignación no existe')
        }

        const scopedCampusId = this.getScopedCampusId(authUser)
        if (
            scopedCampusId !== null &&
            Number(assignment?.totem?.campusId) !== scopedCampusId
        ) {
            throw new NotFoundError('La asignación no existe')
        }

        return assignment
    }

    async updateAssignment(id, data, authUser = null) {
        const assignment = await this.getAssignmentById(id, authUser)

        const totemId = data.totemId ?? assignment.totemId
        const contentId = data.contentId ?? assignment.contentId
        const nextStatus = data.status ?? assignment.status
        const startAt = data.startAt !== undefined ? data.startAt : assignment.startAt
        const endAt = data.endAt !== undefined ? data.endAt : assignment.endAt
        const isPairChanging =
            totemId !== assignment.totemId || contentId !== assignment.contentId
        const shouldValidateActiveEntities = isPairChanging || nextStatus === 'active'
        const now = new Date()
        let content = null

        if (shouldValidateActiveEntities) {
            await this.assertTotemIsActive(totemId, authUser)
            content = await this.getActiveContentByIdOrThrow(contentId, authUser)
        }

        validateDateRange(startAt, endAt)
        this.assertTemporalBoundaries(
            startAt ?? null,
            endAt ?? null,
            now,
            { existingStartAt: assignment.startAt }
        )

        if (nextStatus === 'active') {
            if (!content) {
                content = await this.getActiveContentByIdOrThrow(contentId, authUser)
            }

            const hasOverlappingAssignments =
                await totemContentRepository.findOverlappingActiveOrFutureAssignments(
                    [totemId],
                    [contentId],
                    {
                        startAt: startAt ?? now.toISOString(),
                        endAt: endAt ?? null,
                        excludeAssignmentId: id,
                        now,
                    }
                )

            if (hasOverlappingAssignments.length > 0) {
                const totemName =
                    assignment.totemId === totemId
                        ? assignment.totem?.name ?? `#${totemId}`
                        : `#${totemId}`
                const contentName = content?.title ?? assignment.content?.title ?? String(contentId)

                throw new ConflictError(
                    buildDuplicateAssignmentMessage(totemName, contentName)
                )
            }

            const contentType = content.contentType
            const activeOrScheduledAssignmentsByType =
                await totemContentRepository.findActiveOrScheduledAssignmentsByTotemIdsAndContentTypes(
                    [totemId],
                    [contentType],
                    {
                        excludeAssignmentId: id,
                        now,
                    }
                )
            const timelineByTotemType = this.buildTypeTimelineMap(
                activeOrScheduledAssignmentsByType,
                now
            )
            const totemName =
                totemId === assignment.totemId
                    ? assignment.totem?.name ?? `#${totemId}`
                    : `#${totemId}`
            const typeLimitEvaluation = this.evaluateTypeLimitConflict({
                timelineByTotemType,
                totemId,
                totemName,
                contentType,
                startAt: startAt ?? null,
                endAt: endAt ?? null,
                now,
            })

            if (typeLimitEvaluation.message) {
                throw new RequestValidationError(
                    typeLimitEvaluation.message,
                    {
                        [typeLimitEvaluation.field]: typeLimitEvaluation.message,
                    }
                )
            }
        }

        return totemContentRepository.update(assignment, data)
    }

    async deleteAssignment(id, authUser = null) {
        const assignment = await this.getAssignmentById(id, authUser)
        await totemContentRepository.softDelete(assignment)
    }
}

export default new TotemContentService()
