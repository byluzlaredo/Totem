import type {
  NotificationDurationUnit,
  NotificationFormErrors,
  NotificationFormValues,
} from '../../../types/notification'
import {
  NOTIFICATION_MESSAGE_MAX_LENGTH,
  NOTIFICATION_MESSAGE_MIN_LENGTH,
  NOTIFICATION_TITLE_MAX_LENGTH,
  NOTIFICATION_TITLE_MIN_LENGTH,
} from '../../../constants/notification'
import { normalizeTextInputForSubmit } from '../../../utils/inputNormalization'

const VALID_NOTIFICATION_TYPES = new Set<NotificationFormValues['type']>([
  'normal',
  'urgent',
])

const VALID_NOTIFICATION_STATUSES = new Set<NotificationFormValues['status']>([
  'active',
  'inactive',
])

const VALID_NOTIFICATION_SCOPES = new Set<NotificationFormValues['targetScope']>([
  'all',
  'totems',
])

const VALID_DURATION_UNITS = new Set<NotificationDurationUnit>([
  'minutes',
  'hours',
  'days',
])

const MAX_DURATION_MINUTES = 60 * 24 * 30

type NotificationValidationMode = 'create' | 'edit'

export interface NotificationValidationOptions {
  mode?: NotificationValidationMode
  initialStartAt?: string
}

function parseDateOrNull(value: string | null | undefined) {
  if (!value) {
    return null
  }

  const parsed = new Date(value)

  if (Number.isNaN(parsed.getTime())) {
    return null
  }

  return parsed
}

function areSameInstants(leftValue: string | null | undefined, rightValue: string | null | undefined) {
  const leftDate = parseDateOrNull(leftValue)
  const rightDate = parseDateOrNull(rightValue)

  if (!leftDate || !rightDate) {
    return false
  }

  return leftDate.getTime() === rightDate.getTime()
}

export function convertDurationToMinutes(
  durationValue: string,
  durationUnit: NotificationDurationUnit
) {
  const parsedValue = Number(durationValue)

  if (!Number.isInteger(parsedValue) || parsedValue <= 0) {
    return null
  }

  if (durationUnit === 'days') {
    return parsedValue * 24 * 60
  }

  if (durationUnit === 'hours') {
    return parsedValue * 60
  }

  return parsedValue
}

export function normalizeNotificationFormValues(values: NotificationFormValues): NotificationFormValues {
  return {
    ...values,
    title: normalizeTextInputForSubmit(values.title),
    message: normalizeTextInputForSubmit(values.message),
    durationValue: values.durationValue.trim(),
    startAt: values.startAt.trim(),
    targetCampusId:
      values.targetCampusId === ''
        ? ''
        : Number.isInteger(Number(values.targetCampusId))
          ? Number(values.targetCampusId)
          : values.targetCampusId,
    targetTotemIds: [...new Set(values.targetTotemIds)],
  }
}

export function validateNotificationForm(
  values: NotificationFormValues,
  options: NotificationValidationOptions = {}
): NotificationFormErrors {
  const errors: NotificationFormErrors = {}
  const validationMode = options.mode ?? 'create'

  if (!VALID_NOTIFICATION_TYPES.has(values.type)) {
    errors.type = 'El tipo de notificación es inválido'
  }

  if (!VALID_NOTIFICATION_STATUSES.has(values.status)) {
    errors.status = 'El estado de la notificación es inválido'
  }

  if (!values.title) {
    errors.title = 'El título es obligatorio'
  } else if (values.title.length < NOTIFICATION_TITLE_MIN_LENGTH) {
    errors.title = `El título debe tener mínimo ${NOTIFICATION_TITLE_MIN_LENGTH} caracteres`
  } else if (values.title.length > NOTIFICATION_TITLE_MAX_LENGTH) {
    errors.title = `El título debe tener máximo ${NOTIFICATION_TITLE_MAX_LENGTH} caracteres`
  }

  if (!values.message) {
    errors.message = 'El mensaje es obligatorio'
  } else if (values.message.length < NOTIFICATION_MESSAGE_MIN_LENGTH) {
    errors.message = `El mensaje debe tener al menos ${NOTIFICATION_MESSAGE_MIN_LENGTH} caracteres`
  } else if (values.message.length > NOTIFICATION_MESSAGE_MAX_LENGTH) {
    errors.message = `El mensaje debe tener máximo ${NOTIFICATION_MESSAGE_MAX_LENGTH} caracteres`
  }

  if (!VALID_DURATION_UNITS.has(values.durationUnit)) {
    errors.durationUnit = 'La unidad de duración no es válida'
  }

  const durationMinutes = convertDurationToMinutes(values.durationValue, values.durationUnit)
  if (durationMinutes === null) {
    errors.durationValue = 'La duración debe ser un entero positivo'
  } else if (durationMinutes > MAX_DURATION_MINUTES) {
    errors.durationValue = `La duración máxima permitida es ${MAX_DURATION_MINUTES} minutos`
  }

  if (!VALID_NOTIFICATION_SCOPES.has(values.targetScope)) {
    errors.targetScope = 'Debes seleccionar un destino válido'
  }

  if (values.startAt) {
    const startDate = parseDateOrNull(values.startAt)

    if (!startDate) {
      errors.startAt = 'La fecha de inicio no es válida'
    } else if (startDate < new Date()) {
      const canKeepExistingPastStartAt =
        validationMode === 'edit' &&
        areSameInstants(values.startAt, options.initialStartAt)

      if (!canKeepExistingPastStartAt) {
        errors.startAt = 'La fecha de inicio debe ser mayor o igual a la fecha y hora actual'
      }
    }
  }

  if (
    values.targetCampusId !== '' &&
    (!Number.isInteger(values.targetCampusId) || values.targetCampusId <= 0)
  ) {
    errors.targetCampusId = 'Debes seleccionar un campus válido'
  }

  if (values.targetScope === 'totems') {
    if (values.targetTotemIds.length === 0) {
      errors.targetTotemIds = 'Debes seleccionar al menos un tótem'
    } else {
      const hasInvalidTotemId = values.targetTotemIds.some(
        (totemId) => !Number.isInteger(totemId) || totemId <= 0
      )

      if (hasInvalidTotemId) {
        errors.targetTotemIds = 'Debes seleccionar tótems válidos'
      }
    }
  }

  return errors
}
