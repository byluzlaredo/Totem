import type {
  NotificationDispatchMode,
  NotificationDurationUnit,
  NotificationFormValues,
  NotificationScope,
  NotificationStatus,
  NotificationType,
} from '../types/notification'

export const NOTIFICATION_TYPE_OPTIONS: Array<{ value: NotificationType; label: string }> = [
  { value: 'normal', label: 'Normal' },
  { value: 'urgent', label: 'Urgente' },
]

export const NOTIFICATION_SCOPE_FILTER_OPTIONS: Array<{ value: NotificationScope; label: string }> = [
  { value: 'all', label: 'Todos los tótems' },
  { value: 'campus', label: 'Por campus' },
  { value: 'totems', label: 'Tótems específicos' },
]

export const NOTIFICATION_DELIVERY_MODE_OPTIONS: Array<{
  value: NotificationDispatchMode
  label: string
}> = [
    { value: 'all', label: 'Todos los tótems' },
    { value: 'totems', label: 'Tótems específicos' },
  ]

export const NOTIFICATION_STATUS_OPTIONS: Array<{ value: NotificationStatus; label: string }> = [
  { value: 'all', label: 'Todos' },
  { value: 'active', label: 'Activas' },
  { value: 'inactive', label: 'Inactivas' },
]

export const NOTIFICATION_RECORD_STATUS_OPTIONS: Array<{
  value: Exclude<NotificationStatus, 'all'>
  label: string
}> = [
    { value: 'active', label: 'Activa' },
    { value: 'inactive', label: 'Inactiva' },
  ]

export const NOTIFICATION_DURATION_UNIT_OPTIONS: Array<{
  value: NotificationDurationUnit
  label: string
}> = [
    { value: 'minutes', label: 'Minutos' },
    { value: 'hours', label: 'Horas' },
    { value: 'days', label: 'Días' },
  ]

export const DEFAULT_NOTIFICATION_PAGE_SIZE = 10
export const NOTIFICATION_FORM_TOTEM_PAGE_SIZE = 50
export const NOTIFICATION_FORM_TOTEM_SEARCH_DEBOUNCE_MS = 300
export const NOTIFICATION_TITLE_MIN_LENGTH = 3
export const NOTIFICATION_TITLE_MAX_LENGTH = 200
export const NOTIFICATION_MESSAGE_MIN_LENGTH = 5
export const NOTIFICATION_MESSAGE_MAX_LENGTH = 500

export const EMPTY_NOTIFICATION_FORM: NotificationFormValues = {
  title: '',
  message: '',
  type: 'normal',
  status: 'active',
  durationValue: '30',
  durationUnit: 'minutes',
  startAt: '',
  targetScope: 'all',
  targetCampusId: '',
  targetTotemIds: [],
}
