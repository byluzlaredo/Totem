import totemContentRepository from "../repositories/totemContent.repository.js";
import totemRepository from "../repositories/totem.repository.js";
import notificationRepository from "../repositories/notification.repository.js";
import { AppError } from "../errors/AppError.js";
import {
    isContentFileUrlCompatibleWithType,
} from "../utils/contentFile.storage.js";
import totemQuestionAnswerService from "./totemQuestionAnswer.service.js";
import totemQuestionModeService from "./totemQuestionMode.service.js";
import totemQuestionSessionService from "./totemQuestionSession.service.js";
import totemWeatherService from "./totemWeather.service.js";
import storageService from "./storage.service.js";

const DISPLAY_CONTENT_TYPES_REQUIRING_FILE = new Set(['image', 'video', 'advertisement'])

function mapClientNotificationType(type) {
    const normalized = typeof type === 'string' ? type.toLowerCase() : 'normal'

    if (normalized === 'urgent' || normalized === 'urgente') return 'alert'
    return 'info'
}

function mapClientNotification(notification) {
    const raw = typeof notification.toJSON === 'function' ? notification.toJSON() : notification
    const startDate = raw.startAt ? new Date(raw.startAt) : (raw.createdAt ? new Date(raw.createdAt) : null)
    const endDate = raw.endAt ? new Date(raw.endAt) : null

    if (
        !startDate ||
        Number.isNaN(startDate.getTime()) ||
        !endDate ||
        Number.isNaN(endDate.getTime())
    ) {
        return null
    }

    const type = mapClientNotificationType(raw.type)
    const totalDurationSeconds = Math.max(
        0,
        Math.floor((endDate.getTime() - startDate.getTime()) / 1000)
    )

    return {
        id: raw.id,
        title: raw.title,
        message: raw.message,
        type,
        isEmergency: typeof raw.type === 'string' && raw.type.toLowerCase() === 'urgent',
        durationSeconds: totalDurationSeconds > 0 ? totalDurationSeconds : null,
        startAt: startDate.toISOString(),
        endAt: endDate.toISOString(),
        createdAt: raw.createdAt ?? null,
    }
}

function sortClientNotifications(left, right) {
    const leftPriority = left.isEmergency ? 0 : 1
    const rightPriority = right.isEmergency ? 0 : 1

    if (leftPriority !== rightPriority) {
        return leftPriority - rightPriority
    }

    const leftStartAt = Date.parse(left.startAt ?? left.createdAt ?? '')
    const rightStartAt = Date.parse(right.startAt ?? right.createdAt ?? '')

    if (!Number.isNaN(leftStartAt) && !Number.isNaN(rightStartAt) && leftStartAt !== rightStartAt) {
        return rightStartAt - leftStartAt
    }

    const leftCreatedAt = Date.parse(left.createdAt ?? '')
    const rightCreatedAt = Date.parse(right.createdAt ?? '')

    if (!Number.isNaN(leftCreatedAt) && !Number.isNaN(rightCreatedAt)) {
        return rightCreatedAt - leftCreatedAt
    }

    return 0
}

function mapTotemClientPayload(totem) {
    return {
        id: totem.id,
        code: totem.code,
        name: totem.name,
        campusId: totem.campusId ?? totem.campus?.id ?? null,
        campusName: totem.campus?.name ?? null,
        headquarters: totem.campus?.name ?? null,
        state: totem.state,
        connectionStatus: totem.connectionStatus,
        lastSeenAt: totem.lastSeenAt,
    }
}

function mapDisplayContent(assignment) {
    const content = assignment.content

    return {
        assignmentId: assignment.id,
        priority: assignment.priority,
        sortOrder: assignment.sortOrder,
        assignmentStartAt: assignment.startAt,
        assignmentEndAt: assignment.endAt,
        id: content.id,
        title: content.title,
        description: content.description,
        contentType: content.contentType,
        fileUrl: content.fileUrl,
    }
}

function normalizeText(value) {
    if (typeof value !== 'string') {
        return ''
    }

    return value.trim()
}

function parseDateToMs(value) {
    if (!value) {
        return null
    }

    const parsedMs = Date.parse(value)
    return Number.isNaN(parsedMs) ? null : parsedMs
}

function isWithinTemporalWindow(startAt, endAt, nowMs) {
    const startAtMs = parseDateToMs(startAt)
    const endAtMs = parseDateToMs(endAt)

    if (startAtMs !== null && nowMs < startAtMs) {
        return false
    }

    if (endAtMs !== null && nowMs > endAtMs) {
        return false
    }

    return true
}

function hasValidNewsText(content) {
    return normalizeText(content?.title).length > 0
        && normalizeText(content?.description).length > 0
}

async function isFileUrlAvailable({ fileUrl, filePath, fileProvider }) {
    if (normalizeText(fileUrl).length === 0 && normalizeText(filePath).length === 0) {
        return false
    }

    return storageService.isFileAvailable({ fileProvider, filePath, fileUrl })
}

async function isDisplayAssignmentAvailable(assignment, nowMs) {
    if (!assignment || assignment.status !== 'active') {
        return false
    }

    if (!isWithinTemporalWindow(assignment.startAt, assignment.endAt, nowMs)) {
        return false
    }

    const content = assignment.content

    if (!content || content.status !== 'active') {
        return false
    }

    const contentType = content.contentType

    if (DISPLAY_CONTENT_TYPES_REQUIRING_FILE.has(contentType)) {
        if (!isContentFileUrlCompatibleWithType(content.fileUrl, contentType)) {
            return false
        }

        return isFileUrlAvailable({
            fileProvider: content.fileProvider,
            filePath: content.filePath,
            fileUrl: content.fileUrl,
        })
    }

    if (contentType === 'news') {
        return hasValidNewsText(content)
    }

    return false
}

async function filterAvailableDisplayAssignments(assignments, now) {
    if (!Array.isArray(assignments) || assignments.length === 0) {
        return []
    }

    const nowMs = now.getTime()
    const checks = await Promise.all(
        assignments.map((assignment) => isDisplayAssignmentAvailable(assignment, nowMs))
    )

    return assignments.filter((_, index) => checks[index])
}

function mapExitReasonToSessionReason(reason) {
    if (reason === 'timeout') {
        return 'timeout'
    }

    if (reason === 'error') {
        return 'error'
    }

    return 'manual'
}

class TotemClientService {
    async markTotemOnline(totem) {
        const now = new Date().toISOString()

        return totemRepository.update(totem, {
            connectionStatus: 'online',
            lastSeenAt: now,
        })
    }

    async getBootstrap(totem) {
        const now = new Date()
        const updatedTotem = await this.markTotemOnline(totem)
        const weather = await totemWeatherService.getCurrentWeatherForTotem(updatedTotem)
        const questionMode = totemQuestionModeService.getState({ totemId: updatedTotem.id })
        const questionSession = await totemQuestionSessionService.getActiveSessionByTotemId(
            updatedTotem.id
        )
        const assignments = await totemContentRepository.findDisplayTimelineAssignmentsByTotemId(
            updatedTotem.id,
            now
        )
        const availableAssignments = await filterAvailableDisplayAssignments(assignments, now)
        const notifications = await notificationRepository.findVisibleOrScheduledForTotem({
            totemId: updatedTotem.id,
            campusId: updatedTotem.campusId ?? updatedTotem.campus?.id ?? null,
            now,
        })
        const timelineNotifications = notifications
            .map((notif) => mapClientNotification(notif))
            .filter(Boolean)
            .sort(sortClientNotifications)

        return {
            totem: mapTotemClientPayload(updatedTotem),
            contents: availableAssignments.map(mapDisplayContent),
            notifications: timelineNotifications,
            weather,
            questionMode,
            questionSession,
            generatedAt: now.toISOString(),
        }
    }

    async heartbeat(totem) {
        const updatedTotem = await this.markTotemOnline(totem)
        const questionMode = totemQuestionModeService.getState({ totemId: updatedTotem.id })
        const questionSession = await totemQuestionSessionService.getActiveSessionByTotemId(
            updatedTotem.id
        )

        return {
            totem: mapTotemClientPayload(updatedTotem),
            questionMode,
            questionSession,
            heartbeatAt: new Date().toISOString(),
        }
    }

    async enterQuestionModeByGesture(totem, deviceToken, trigger) {
        const updatedTotem = await this.markTotemOnline(totem)
        const questionMode = totemQuestionModeService.enterQuestionMode({
            totemId: updatedTotem.id,
            deviceToken,
            trigger,
        })

        return {
            totem: mapTotemClientPayload(updatedTotem),
            questionMode,
            changedAt: new Date().toISOString(),
        }
    }

    async registerQuestionModeActivity(totem, deviceToken, activityType) {
        const updatedTotem = await this.markTotemOnline(totem)
        const questionMode = totemQuestionModeService.registerActivity({
            totemId: updatedTotem.id,
            deviceToken,
            activityType,
        })
        const questionSession = await totemQuestionSessionService.touchActiveSessionByTotemId(
            updatedTotem.id
        )

        return {
            totem: mapTotemClientPayload(updatedTotem),
            questionMode,
            questionSession,
            updatedAt: new Date().toISOString(),
        }
    }

    async exitQuestionMode(totem, deviceToken, reason) {
        const updatedTotem = await this.markTotemOnline(totem)
        const questionMode = totemQuestionModeService.exitQuestionMode({
            totemId: updatedTotem.id,
            deviceToken,
            reason,
        })
        const questionSession = await totemQuestionSessionService.endActiveSessionByTotemId(
            updatedTotem.id,
            mapExitReasonToSessionReason(reason)
        )

        return {
            totem: mapTotemClientPayload(updatedTotem),
            questionMode,
            questionSession,
            changedAt: new Date().toISOString(),
        }
    }

    async reportDeviceStatus(totem, deviceToken, payload) {
        const updatedTotem = await this.markTotemOnline(totem)
        const questionMode = totemQuestionModeService.reportDeviceStatus({
            totemId: updatedTotem.id,
            deviceToken,
            ...payload,
        })

        return {
            totem: mapTotemClientPayload(updatedTotem),
            questionMode,
            reportedAt: new Date().toISOString(),
        }
    }

    async startQuestionSession(totem) {
        const updatedTotem = await this.markTotemOnline(totem)
        const questionModeState = totemQuestionModeService.getState({
            totemId: updatedTotem.id,
        })

        if (questionModeState.mode !== 'question') {
            throw new AppError(
                409,
                'No se puede iniciar la sesión porque el tótem no está en modo preguntas',
                'QUESTION_MODE_NOT_ACTIVE'
            )
        }

        const session = await totemQuestionSessionService.startSession(updatedTotem.id)
        const questionMode = totemQuestionModeService.registerActivity({
            totemId: updatedTotem.id,
            activityType: 'entered_mode',
        })

        return {
            totem: mapTotemClientPayload(updatedTotem),
            questionMode,
            session,
            startedAt: new Date().toISOString(),
        }
    }

    async answerQuestion(totem, sessionId, questionText) {
        const updatedTotem = await this.markTotemOnline(totem)
        const questionModeState = totemQuestionModeService.getState({
            totemId: updatedTotem.id,
        })

        if (questionModeState.mode !== 'question') {
            throw new AppError(
                409,
                'No se puede procesar la pregunta porque el modo preguntas no está activo',
                'QUESTION_MODE_NOT_ACTIVE'
            )
        }

        const answer = await totemQuestionAnswerService.answerQuestion({
            totemId: updatedTotem.id,
            sessionId,
            questionText,
        })
        const questionMode = totemQuestionModeService.registerActivity({
            totemId: updatedTotem.id,
            activityType: 'transcription_updated',
        })

        return {
            totem: mapTotemClientPayload(updatedTotem),
            questionMode,
            session: answer.session,
            questionText: answer.questionText,
            answerText: answer.answerText,
            questionImages: answer.questionImages ?? [],
            hasMatch: answer.hasMatch,
            source: answer.source,
            coverage: answer.coverage,
            answeredAt: new Date().toISOString(),
        }
    }

    async endQuestionSession(totem, sessionId, reason) {
        const updatedTotem = await this.markTotemOnline(totem)
        const session = await totemQuestionSessionService.endSession(
            sessionId,
            updatedTotem.id,
            reason
        )
        const questionMode = totemQuestionModeService.registerActivity({
            totemId: updatedTotem.id,
            activityType: 'transcription_updated',
        })

        return {
            totem: mapTotemClientPayload(updatedTotem),
            questionMode,
            session,
            endedAt: new Date().toISOString(),
        }
    }
}

export default new TotemClientService()
