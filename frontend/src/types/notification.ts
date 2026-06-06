export type NotificationType = 'normal' | 'urgent'
export type NotificationScope = 'all' | 'campus' | 'totems'
export type NotificationDispatchMode = 'all' | 'totems'
export type NotificationLifecycleStatus = 'active' | 'inactive'
export type NotificationStatus = NotificationLifecycleStatus | 'all'
export type NotificationTargetType = 'all' | 'campus' | 'totem'
export type NotificationDurationUnit = 'minutes' | 'hours' | 'days'

export interface NotificationCampusOption {
  id: number
  name: string
}

export interface NotificationTargetTotem {
  id: number
  code: string
  name: string
  campusId: number | null
  campusName: string | null
  state: 'active' | 'inactive'
}

export interface NotificationTarget {
  id: number
  notificationId: number
  targetType: NotificationTargetType
  totemId: number | null
  campusId: number | null
  campus: NotificationCampusOption | null
  totem: NotificationTargetTotem | null
  createdAt: string | null
  updatedAt: string | null
}

export interface NotificationTotemOption {
  id: number
  code: string
  name: string
  campusId: number | null
  campusName: string | null
  state: 'active' | 'inactive'
}

export interface Notification {
  id: number
  title: string
  message: string
  createdBy: number
  targetScope: NotificationScope
  durationMinutes: number
  startAt: string
  endAt: string
  deletedAt: string | null
  createdAt: string
  updatedAt: string
  status: NotificationLifecycleStatus
  type: NotificationType
  targets: NotificationTarget[]
  campuses: NotificationCampusOption[]
  targetCampusId: number | null
  targetCampus: NotificationCampusOption | null
  targetTotemIds: number[]
  targetTotems: NotificationTargetTotem[]
  remainingSeconds: number
}

export interface NotificationFormValues {
  title: string
  message: string
  type: NotificationType
  status: NotificationLifecycleStatus
  durationValue: string
  durationUnit: NotificationDurationUnit
  startAt: string
  targetScope: NotificationDispatchMode
  targetCampusId: number | ''
  targetTotemIds: number[]
}

export interface NotificationFormErrors {
  title?: string
  message?: string
  type?: string
  status?: string
  durationValue?: string
  durationUnit?: string
  startAt?: string
  targetScope?: string
  targetCampusId?: string
  targetTotemIds?: string
}

export interface NotificationListParams {
  search?: string
  type?: NotificationType | ''
  scope?: NotificationScope | ''
  campusId?: number | ''
  status?: NotificationStatus
  page?: number
  limit?: number
}
