import { AppError } from '../errors/AppError.js'
import { emitTotemQuestionModeState } from './totemClientRealtime.service.js'

const DEFAULT_INACTIVITY_TIMEOUT_SECONDS = 20
const DEFAULT_REACTIVATION_COOLDOWN_SECONDS = 2

export const QUESTION_MODE_ACTIVITY_TYPES = [
  'entered_mode',
  'voice_detected',
  'listening_started',
  'transcription_updated',
]

export const QUESTION_MODE_EXIT_REASONS = ['manual', 'timeout', 'error']

export const QUESTION_MODE_ACTIVATION_TRIGGERS = ['open_palm']

export const DEVICE_PERMISSION_STATES = [
  'granted',
  'denied',
  'prompt',
  'unsupported',
  'unknown',
]

function parsePositiveInteger(rawValue, fallbackValue) {
  const parsedValue = Number(rawValue)

  if (!Number.isInteger(parsedValue) || parsedValue <= 0) {
    return fallbackValue
  }

  return parsedValue
}

function addSecondsToIsoDate(seconds) {
  return new Date(Date.now() + seconds * 1000).toISOString()
}

function nowIso() {
  return new Date().toISOString()
}

class TotemQuestionModeService {
  constructor() {
    this.inactivityTimeoutSeconds = parsePositiveInteger(
      process.env.TOTEM_QUESTION_MODE_IDLE_TIMEOUT_SECONDS,
      DEFAULT_INACTIVITY_TIMEOUT_SECONDS
    )

    this.reactivationCooldownSeconds = parsePositiveInteger(
      process.env.TOTEM_QUESTION_MODE_REACTIVATION_COOLDOWN_SECONDS,
      DEFAULT_REACTIVATION_COOLDOWN_SECONDS
    )

    this.stateByTotemId = new Map()
  }

  createInitialState(deviceToken = null) {
    return {
      mode: 'normal',
      enteredQuestionModeAt: null,
      lastActivityAt: null,
      lastActivityType: null,
      inactivityDeadlineAt: null,
      reactivationBlockedUntil: null,
      lastActivationByGestureAt: null,
      lastExitedAt: null,
      lastExitReason: null,
      deviceToken,
      deviceStatus: {
        camera: {
          available: null,
          permission: 'unknown',
          error: null,
        },
        microphone: {
          available: null,
          permission: 'unknown',
          error: null,
        },
        reportedAt: null,
      },
      inactivityTimer: null,
    }
  }

  ensureState(totemId, deviceToken = null) {
    if (!this.stateByTotemId.has(totemId)) {
      this.stateByTotemId.set(totemId, this.createInitialState(deviceToken))
    }

    const state = this.stateByTotemId.get(totemId)

    if (deviceToken) {
      state.deviceToken = deviceToken
    }

    return state
  }

  clearInactivityTimer(state) {
    if (!state.inactivityTimer) {
      return
    }

    clearTimeout(state.inactivityTimer)
    state.inactivityTimer = null
  }

  scheduleInactivityTimer(totemId, state) {
    this.clearInactivityTimer(state)

    if (state.mode !== 'question') {
      return
    }

    state.inactivityTimer = setTimeout(() => {
      this.exitQuestionMode({
        totemId,
        reason: 'timeout',
        skipCooldown: false,
      })
    }, this.inactivityTimeoutSeconds * 1000)

    state.inactivityTimer.unref?.()
  }

  snapshot(state) {
    const now = Date.now()
    const blockedUntilEpoch = state.reactivationBlockedUntil
      ? Date.parse(state.reactivationBlockedUntil)
      : null
    const isReactivationBlocked =
      blockedUntilEpoch !== null && Number.isFinite(blockedUntilEpoch)
        ? blockedUntilEpoch > now
        : false

    return {
      mode: state.mode,
      inactivityTimeoutSeconds: this.inactivityTimeoutSeconds,
      reactivationCooldownSeconds: this.reactivationCooldownSeconds,
      enteredQuestionModeAt: state.enteredQuestionModeAt,
      lastActivityAt: state.lastActivityAt,
      lastActivityType: state.lastActivityType,
      inactivityDeadlineAt: state.inactivityDeadlineAt,
      reactivationBlockedUntil: state.reactivationBlockedUntil,
      isReactivationBlocked,
      lastActivationByGestureAt: state.lastActivationByGestureAt,
      lastExitedAt: state.lastExitedAt,
      lastExitReason: state.lastExitReason,
      deviceStatus: {
        camera: { ...state.deviceStatus.camera },
        microphone: { ...state.deviceStatus.microphone },
        reportedAt: state.deviceStatus.reportedAt,
      },
    }
  }

  getState({ totemId, deviceToken = null }) {
    const state = this.ensureState(totemId, deviceToken)
    return this.snapshot(state)
  }

  touchActivity(state, activityType) {
    state.lastActivityType = activityType
    state.lastActivityAt = nowIso()
    state.inactivityDeadlineAt = addSecondsToIsoDate(this.inactivityTimeoutSeconds)
  }

  enterQuestionMode({ totemId, deviceToken, trigger = 'open_palm' }) {
    const state = this.ensureState(totemId, deviceToken)
    const currentTime = Date.now()
    const blockedUntil = state.reactivationBlockedUntil
      ? Date.parse(state.reactivationBlockedUntil)
      : null

    if (
      blockedUntil !== null &&
      Number.isFinite(blockedUntil) &&
      blockedUntil > currentTime
    ) {
      throw new AppError(
        429,
        'El modo preguntas está temporalmente bloqueado para evitar reactivación accidental',
        'QUESTION_MODE_REACTIVATION_BLOCKED',
        {
          retryAfterSeconds: Math.max(1, Math.ceil((blockedUntil - currentTime) / 1000)),
          reactivationBlockedUntil: state.reactivationBlockedUntil,
        }
      )
    }

    const entryTimestamp = nowIso()

    state.mode = 'question'
    state.enteredQuestionModeAt = entryTimestamp
    state.lastActivationByGestureAt =
      trigger === 'open_palm' ? entryTimestamp : state.lastActivationByGestureAt
    state.reactivationBlockedUntil = null
    this.touchActivity(state, 'entered_mode')
    this.scheduleInactivityTimer(totemId, state)

    const snapshot = this.snapshot(state)

    emitTotemQuestionModeState(state.deviceToken, {
      event: 'question_mode_entered',
      questionMode: snapshot,
      trigger,
      emittedAt: nowIso(),
    })

    return snapshot
  }

  registerActivity({ totemId, deviceToken, activityType }) {
    const state = this.ensureState(totemId, deviceToken)

    if (state.mode !== 'question') {
      return this.snapshot(state)
    }

    this.touchActivity(state, activityType)
    this.scheduleInactivityTimer(totemId, state)
    return this.snapshot(state)
  }

  exitQuestionMode({
    totemId,
    deviceToken = null,
    reason = 'manual',
    skipCooldown = false,
  }) {
    const state = this.ensureState(totemId, deviceToken)

    if (state.mode !== 'question') {
      return this.snapshot(state)
    }

    this.clearInactivityTimer(state)

    state.mode = 'normal'
    state.lastExitReason = reason
    state.lastExitedAt = nowIso()
    state.lastActivityType = null
    state.inactivityDeadlineAt = null

    if (!skipCooldown && this.reactivationCooldownSeconds > 0) {
      state.reactivationBlockedUntil = addSecondsToIsoDate(
        this.reactivationCooldownSeconds
      )
    } else {
      state.reactivationBlockedUntil = null
    }

    const snapshot = this.snapshot(state)

    emitTotemQuestionModeState(state.deviceToken, {
      event: 'question_mode_exited',
      questionMode: snapshot,
      reason,
      emittedAt: nowIso(),
    })

    return snapshot
  }

  reportDeviceStatus({ totemId, deviceToken, camera, microphone }) {
    const state = this.ensureState(totemId, deviceToken)

    state.deviceStatus.camera = {
      available: camera.available,
      permission: camera.permission,
      error: camera.error,
    }

    state.deviceStatus.microphone = {
      available: microphone.available,
      permission: microphone.permission,
      error: microphone.error,
    }

    state.deviceStatus.reportedAt = nowIso()

    return this.snapshot(state)
  }
}

export default new TotemQuestionModeService()

