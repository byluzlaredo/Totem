import type { ContentType } from "./content";
import type { TotemConnectionStatus, TotemState } from "./totem";

export type TotemDisplayContentType = Exclude<ContentType, 'pdf'>

export type TotemQuestionMode = 'normal' | 'question'

export type TotemQuestionModeActivityType =
    | 'entered_mode'
    | 'voice_detected'
    | 'listening_started'
    | 'transcription_updated'

export type TotemQuestionModeExitReason = 'manual' | 'timeout' | 'error'

export type TotemQuestionActivationTrigger = 'open_palm'

export type TotemDevicePermissionState =
    | 'granted'
    | 'denied'
    | 'prompt'
    | 'unsupported'
    | 'unknown'

export interface TotemClientDeviceInfo {
    available: boolean | null
    permission: TotemDevicePermissionState
    error: string | null
}

export interface TotemClientDeviceStatus {
    camera: TotemClientDeviceInfo
    microphone: TotemClientDeviceInfo
    reportedAt: string | null
}

export interface TotemQuestionModeState {
    mode: TotemQuestionMode
    inactivityTimeoutSeconds: number
    reactivationCooldownSeconds: number
    enteredQuestionModeAt: string | null
    lastActivityAt: string | null
    lastActivityType: TotemQuestionModeActivityType | null
    inactivityDeadlineAt: string | null
    reactivationBlockedUntil: string | null
    isReactivationBlocked: boolean
    lastActivationByGestureAt: string | null
    lastExitedAt: string | null
    lastExitReason: TotemQuestionModeExitReason | null
    deviceStatus: TotemClientDeviceStatus
}

export type TotemQuestionSessionStatus = 'active' | 'ended' | 'expired'

export interface TotemQuestionSession {
    id: number
    totemId: number
    status: TotemQuestionSessionStatus
    startedAt: string
    lastActivityAt: string
    inactivityTimeoutSeconds: number
    inactivityDeadlineAt: string
    endedAt: string | null
    endReason: TotemQuestionModeExitReason | null
    isExpired: boolean
}

export interface TotemClientInfo {
    id: number
    code: string
    name: string
    campusId: number | null
    campusName: string | null
    headquarters?: string | null
    state: TotemState
    connectionStatus: TotemConnectionStatus
    lastSeenAt: string | null
}

export interface TotemClientAuthTokens {
    tokenType: 'Bearer'
    accessToken: string
    refreshToken: string
    accessTokenExpiresAt: string
    refreshTokenExpiresAt: string
}

export interface TotemClientAuthData {
    totem: TotemClientInfo
    session: TotemClientAuthTokens
    linkedAt: string
}

export interface TotemClientSession {
    totem: TotemClientInfo
    accessToken: string
    refreshToken: string
    accessTokenExpiresAt: string
    refreshTokenExpiresAt: string
    linkedAt: string
}

export type TotemClientSessionInvalidationReason =
    | 'unauthorized'
    | 'forbidden'
    | 'refresh_failed'
    | 'manual_unlink'
    | 'storage_cleared'

export interface TotemClientContent {
    assignmentId: number
    priority: number
    sortOrder: number
    assignmentStartAt: string | null
    assignmentEndAt: string | null
    id: number
    title: string
    description: string | null
    contentType: TotemDisplayContentType
    fileUrl: string | null
}

export interface TotemClientNotification {
    id: number
    title: string
    message: string
    type: 'info' | 'warning' | 'alert'
    isEmergency: boolean
    durationSeconds: number | null
    startAt?: string | null
    endAt?: string | null
    createdAt?: string | null
}

export type TotemClientWeatherConditionKey =
    | 'clear'
    | 'partly_cloudy'
    | 'cloudy'
    | 'fog'
    | 'drizzle'
    | 'rain'
    | 'snow'
    | 'thunderstorm'
    | 'unknown'

export interface TotemClientWeather {
    provider: 'open-meteo'
    source: 'live' | 'cache'
    locationName: string
    temperatureC: number | null
    apparentTemperatureC: number | null
    weatherCode: number | null
    conditionKey: TotemClientWeatherConditionKey
    conditionLabel: string
    isDay: boolean | null
    windSpeedKmh: number | null
    observedAt: string | null
    fetchedAt: string
}

export interface TotemClientBootstrapData {
    totem: TotemClientInfo
    contents: TotemClientContent[]
    notifications: TotemClientNotification[]
    weather: TotemClientWeather | null
    questionMode: TotemQuestionModeState
    questionSession: TotemQuestionSession | null
    generatedAt: string
}

export interface TotemClientHeartbeatData {
    totem: TotemClientInfo
    questionMode: TotemQuestionModeState
    questionSession: TotemQuestionSession | null
    heartbeatAt: string
}

export interface TotemClientQuestionModeMutationData {
    totem: TotemClientInfo
    questionMode: TotemQuestionModeState
    questionSession?: TotemQuestionSession | null
    changedAt?: string
    updatedAt?: string
    reportedAt?: string
}

export interface TotemClientQuestionSessionStartData {
    totem: TotemClientInfo
    questionMode: TotemQuestionModeState
    session: TotemQuestionSession
    startedAt: string
}

export interface TotemClientQuestionAnswerSource {
    chunkId: number
    pdfDocumentId: number
    contentId: number
    contentTitle: string
    matchedQuestionText: string
    combinedScore: number
}

export interface TotemClientQuestionCoverage {
    assignedPdfCount: number
    indexedPdfCount: number
    processedPdfCount: number
}

export interface TotemClientQuestionImage {
    id: number
    fileUrl: string
    sortOrder: number
}

export interface TotemClientQuestionAnswerData {
    totem: TotemClientInfo
    questionMode: TotemQuestionModeState
    session: TotemQuestionSession
    questionText: string
    answerText: string
    questionImages: TotemClientQuestionImage[]
    hasMatch: boolean
    source: TotemClientQuestionAnswerSource | null
    coverage: TotemClientQuestionCoverage
    answeredAt: string
}

export interface TotemClientQuestionSessionEndData {
    totem: TotemClientInfo
    questionMode: TotemQuestionModeState
    session: TotemQuestionSession
    endedAt: string
}

export interface TotemQuestionModeSocketPayload {
    event: 'question_mode_entered' | 'question_mode_exited'
    questionMode: TotemQuestionModeState
    reason?: TotemQuestionModeExitReason
    trigger?: TotemQuestionActivationTrigger
    emittedAt: string
}
