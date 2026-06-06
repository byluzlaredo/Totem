import { RequestValidationError } from '../errors/AppError.js'
import {
  DEVICE_PERMISSION_STATES,
  QUESTION_MODE_ACTIVITY_TYPES,
  QUESTION_MODE_ACTIVATION_TRIGGERS,
  QUESTION_MODE_EXIT_REASONS,
} from '../services/totemQuestionMode.service.js'

const QUESTION_SESSION_END_REASONS = ['manual', 'timeout', 'error']
const MIN_QUESTION_TEXT_LENGTH = 2
const MAX_QUESTION_TEXT_LENGTH = 300
const DEVICE_TOKEN_MIN_LENGTH = 16
const DEVICE_TOKEN_MAX_LENGTH = 256
const LINK_CODE_MIN_LENGTH = 4
const LINK_CODE_MAX_LENGTH = 12
const REFRESH_TOKEN_MIN_LENGTH = 16
const REFRESH_TOKEN_MAX_LENGTH = 512

const FIELD_LABELS = {
  linkCode: 'código temporal',
  deviceToken: 'token de dispositivo',
  refreshToken: 'token de actualización',
  camera: 'cámara',
  microphone: 'micrófono',
  trigger: 'activador',
  activityType: 'tipo de actividad',
  reason: 'motivo',
  questionText: 'pregunta',
  sessionId: 'sesión',
}

const DEVICE_PERMISSION_LABELS = {
  granted: 'concedido',
  denied: 'denegado',
  prompt: 'pendiente',
  unsupported: 'no compatible',
  unknown: 'desconocido',
}

const QUESTION_MODE_TRIGGER_LABELS = {
  open_palm: 'palma abierta',
}

const QUESTION_MODE_ACTIVITY_LABELS = {
  entered_mode: 'entrada al modo pregunta',
  voice_detected: 'voz detectada',
  listening_started: 'escucha iniciada',
  transcription_updated: 'transcripción actualizada',
}

const REASON_LABELS = {
  manual: 'manual',
  timeout: 'tiempo agotado',
  error: 'error',
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

function parsePositiveInteger(value, fieldName) {
  const parsed = Number(value)

  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new RequestValidationError(
      `El campo ${getFieldLabel(fieldName)} debe ser un entero positivo`
    )
  }

  return parsed
}

export function validateTotemDeviceLink(req, res, next) {
  const payload = req.body ?? {}
  assertAllowedFields(payload, ['linkCode', 'link_code', 'deviceToken', 'device_token'])

  const linkCodeRaw = normalizedText(pickAlias(payload, 'linkCode', 'link_code'))
  const deviceTokenRaw = normalizedText(
    pickAlias(payload, 'deviceToken', 'device_token')
  )

  if (linkCodeRaw && deviceTokenRaw) {
    throw new RequestValidationError(
      'No puedes enviar código temporal y token de dispositivo al mismo tiempo'
    )
  }

  if (!linkCodeRaw && !deviceTokenRaw) {
    throw new RequestValidationError(
      'Debes enviar el código temporal de vinculación'
    )
  }

  if (linkCodeRaw) {
    const linkCode = linkCodeRaw
      .toUpperCase()
      .replace(/[\s-]+/g, '')
      .trim()

    if (!linkCode) {
      throw new RequestValidationError(
        'El código temporal es obligatorio'
      )
    }

    if (linkCode.length < LINK_CODE_MIN_LENGTH) {
      throw new RequestValidationError(
        `El código temporal debe tener al menos ${LINK_CODE_MIN_LENGTH} caracteres`
      )
    }

    if (linkCode.length > LINK_CODE_MAX_LENGTH) {
      throw new RequestValidationError(
        `El código temporal no puede superar ${LINK_CODE_MAX_LENGTH} caracteres`
      )
    }

    if (!/^[A-Z0-9]+$/.test(linkCode)) {
      throw new RequestValidationError(
        'El código temporal solo puede contener letras y números'
      )
    }

    req.validated = {
      ...(req.validated ?? {}),
      body: { linkCode },
    }

    next()
    return
  }

  const deviceToken = deviceTokenRaw

  if (!deviceToken) {
    throw new RequestValidationError('El token de dispositivo es obligatorio')
  }

  if (deviceToken.length < DEVICE_TOKEN_MIN_LENGTH) {
    throw new RequestValidationError(
      `El token de dispositivo debe tener al menos ${DEVICE_TOKEN_MIN_LENGTH} caracteres`
    )
  }

  if (deviceToken.length > DEVICE_TOKEN_MAX_LENGTH) {
    throw new RequestValidationError(
      `El token de dispositivo no puede superar ${DEVICE_TOKEN_MAX_LENGTH} caracteres`
    )
  }

  req.validated = {
    ...(req.validated ?? {}),
    body: { deviceToken },
  }

  next()
}

export function validateTotemSessionRefresh(req, res, next) {
  const payload = req.body ?? {}
  assertAllowedFields(payload, ['refreshToken', 'refresh_token'])

  const refreshToken = normalizedText(
    pickAlias(payload, 'refreshToken', 'refresh_token')
  )

  if (!refreshToken) {
    throw new RequestValidationError('El token de actualización es obligatorio')
  }

  if (refreshToken.length < REFRESH_TOKEN_MIN_LENGTH) {
    throw new RequestValidationError(
      `El token de actualización debe tener al menos ${REFRESH_TOKEN_MIN_LENGTH} caracteres`
    )
  }

  if (refreshToken.length > REFRESH_TOKEN_MAX_LENGTH) {
    throw new RequestValidationError(
      `El token de actualización no puede superar ${REFRESH_TOKEN_MAX_LENGTH} caracteres`
    )
  }

  req.validated = {
    ...(req.validated ?? {}),
    body: { refreshToken },
  }

  next()
}

function normalizeDeviceInfo(rawValue, fieldName) {
  if (!rawValue || typeof rawValue !== 'object' || Array.isArray(rawValue)) {
    throw new RequestValidationError(
      `La información de ${getFieldLabel(fieldName)} es obligatoria y debe ser un objeto`
    )
  }

  assertAllowedFields(rawValue, ['available', 'permission', 'error'])

  const isBooleanOrNull =
    typeof rawValue.available === 'boolean' || rawValue.available === null

  if (!isBooleanOrNull) {
    throw new RequestValidationError(
      `La disponibilidad de ${getFieldLabel(fieldName)} debe ser booleana o null`
    )
  }

  const permission = normalizedText(rawValue.permission)

  if (!permission || !DEVICE_PERMISSION_STATES.includes(permission)) {
    throw new RequestValidationError(
      `El permiso de ${getFieldLabel(fieldName)} solo puede ser: ${formatOptions(DEVICE_PERMISSION_STATES, DEVICE_PERMISSION_LABELS)}`
    )
  }

  let error = null

  if (rawValue.error !== undefined && rawValue.error !== null) {
    if (typeof rawValue.error !== 'string') {
      throw new RequestValidationError(
        `El error de ${getFieldLabel(fieldName)} debe ser texto o null`
      )
    }

    const normalizedError = rawValue.error.trim()

    if (normalizedError.length > 0) {
      error = normalizedError.slice(0, 240)
    }
  }

  return {
    available: rawValue.available,
    permission,
    error,
  }
}

export function validateQuestionModeEnter(req, res, next) {
  const payload = req.body ?? {}
  assertAllowedFields(payload, ['trigger'])

  const trigger = normalizedText(payload.trigger ?? 'open_palm')

  if (!QUESTION_MODE_ACTIVATION_TRIGGERS.includes(trigger)) {
    throw new RequestValidationError(
      `El activador solo puede ser: ${formatOptions(QUESTION_MODE_ACTIVATION_TRIGGERS, QUESTION_MODE_TRIGGER_LABELS)}`
    )
  }

  req.validated = {
    ...(req.validated ?? {}),
    body: { trigger },
  }

  next()
}

export function validateQuestionModeActivity(req, res, next) {
  const payload = req.body ?? {}
  assertAllowedFields(payload, ['activityType', 'activity_type'])

  const rawActivityType = pickAlias(payload, 'activityType', 'activity_type')
  const activityType = normalizedText(rawActivityType)

  if (!activityType || !QUESTION_MODE_ACTIVITY_TYPES.includes(activityType)) {
    throw new RequestValidationError(
      `El tipo de actividad solo puede ser: ${formatOptions(QUESTION_MODE_ACTIVITY_TYPES, QUESTION_MODE_ACTIVITY_LABELS)}`
    )
  }

  req.validated = {
    ...(req.validated ?? {}),
    body: { activityType },
  }

  next()
}

export function validateQuestionModeExit(req, res, next) {
  const payload = req.body ?? {}
  assertAllowedFields(payload, ['reason'])

  const reason = normalizedText(payload.reason ?? 'manual')

  if (!QUESTION_MODE_EXIT_REASONS.includes(reason)) {
    throw new RequestValidationError(
      `El motivo solo puede ser: ${formatOptions(QUESTION_MODE_EXIT_REASONS, REASON_LABELS)}`
    )
  }

  req.validated = {
    ...(req.validated ?? {}),
    body: { reason },
  }

  next()
}

export function validateTotemDeviceStatusReport(req, res, next) {
  const payload = req.body ?? {}
  assertAllowedFields(payload, ['camera', 'microphone'])

  const camera = normalizeDeviceInfo(payload.camera, 'camera')
  const microphone = normalizeDeviceInfo(payload.microphone, 'microphone')

  req.validated = {
    ...(req.validated ?? {}),
    body: {
      camera,
      microphone,
    },
  }

  next()
}

export function validateStartQuestionSession(req, res, next) {
  const payload = req.body ?? {}
  assertAllowedFields(payload, [])

  req.validated = {
    ...(req.validated ?? {}),
    body: {},
  }

  next()
}

export function validateQuestionSessionIdParam(req, res, next) {
  const sessionId = parsePositiveInteger(req.params.sessionId, 'sessionId')

  req.validated = {
    ...(req.validated ?? {}),
    params: {
      ...(req.validated?.params ?? {}),
      sessionId,
    },
  }

  next()
}

export function validateQuestionSubmission(req, res, next) {
  const payload = req.body ?? {}
  assertAllowedFields(payload, ['questionText', 'question_text'])

  const questionText = normalizedText(
    pickAlias(payload, 'questionText', 'question_text')
  )

  if (!questionText) {
    throw new RequestValidationError('La pregunta es obligatoria')
  }

  if (questionText.length < MIN_QUESTION_TEXT_LENGTH) {
    throw new RequestValidationError(
      `La pregunta debe tener al menos ${MIN_QUESTION_TEXT_LENGTH} caracteres`
    )
  }

  if (questionText.length > MAX_QUESTION_TEXT_LENGTH) {
    throw new RequestValidationError(
      `La pregunta no puede superar ${MAX_QUESTION_TEXT_LENGTH} caracteres`
    )
  }

  req.validated = {
    ...(req.validated ?? {}),
    body: { questionText },
  }

  next()
}

export function validateEndQuestionSession(req, res, next) {
  const payload = req.body ?? {}
  assertAllowedFields(payload, ['reason'])

  const reason = normalizedText(payload.reason ?? 'manual')

  if (!QUESTION_SESSION_END_REASONS.includes(reason)) {
    throw new RequestValidationError(
      `El motivo solo puede ser: ${formatOptions(QUESTION_SESSION_END_REASONS, REASON_LABELS)}`
    )
  }

  req.validated = {
    ...(req.validated ?? {}),
    body: { reason },
  }

  next()
}
