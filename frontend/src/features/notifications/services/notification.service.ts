import { apiRequest } from '../../../services/api'
import { pickFieldErrors } from '../../../utils/apiFieldErrors'
import type { Totem } from '../../../types/totem'
import type {
  NotificationDispatchMode,
  Notification,
  NotificationCampusOption,
  NotificationFormErrors,
  NotificationFormValues,
  NotificationLifecycleStatus,
  NotificationListParams,
  NotificationScope,
  NotificationTarget,
  NotificationTargetTotem,
  NotificationTotemOption,
  NotificationType,
} from '../../../types/notification'
import type { AuthUser } from '../../../types/auth'
import { totemService } from '../../totems/services/totem.service'
import type {
  ApiItemResponse,
  ApiListResponse,
  ApiMessageResponse,
} from '../../../types/totem'
import { convertDurationToMinutes } from '../utils/notification.validators'

const NOTIFICATION_FORM_ERROR_KEYS = [
  'title',
  'message',
  'type',
  'status',
  'durationValue',
  'durationUnit',
  'durationMinutes',
  'duration_minutes',
  'startAt',
  'start_at',
  'targetScope',
  'target_scope',
  'targetCampusId',
  'target_campus_id',
  'targetTotemIds',
  'target_totem_ids',
  'campusId',
  'campus_id',
] as const

type NotificationApiShape = {
  id: number
  title: string
  message: string
  createdBy: number
  targetScope?: string
  durationMinutes: number
  startAt: string
  endAt: string
  deletedAt?: string | null
  createdAt: string
  updatedAt: string
  status: string | number
  type: string
  targets?: Array<{
    id: number
    notificationId: number
    targetType: string
    totemId: number | null
    campusId: number | null
    campus: NotificationCampusOption | null
    totem: NotificationTargetTotem | null
    createdAt: string | null
    updatedAt: string | null
  }>
  remainingSeconds?: number
}

type TotemApiShape = {
  id: number
  code: string
  name: string
  campusId: number | null
  campusName: string | null
  state: 'active' | 'inactive'
}

function buildQueryParams(params: NotificationListParams) {
  const searchParams = new URLSearchParams()

  if (params.search) searchParams.set('search', params.search)
  if (params.type) searchParams.set('type', params.type)
  if (params.scope) searchParams.set('scope', params.scope)
  if (params.campusId) searchParams.set('campusId', String(params.campusId))
  if (params.status) searchParams.set('status', params.status)
  if (params.page) searchParams.set('page', String(params.page))
  if (params.limit) searchParams.set('limit', String(params.limit))

  return searchParams.toString()
}

function normalizeType(type: string): NotificationType {
  const normalized = type.trim().toLowerCase()

  if (normalized === 'urgent' || normalized === 'urgente') return 'urgent'
  return 'normal'
}

function normalizeStatus(status: string | number): NotificationLifecycleStatus {
  const normalized = String(status ?? '').trim().toLowerCase()

  if (normalized === 'active' || normalized === '1') {
    return 'active'
  }

  return 'inactive'
}

function normalizeScope(scope: string | undefined): NotificationScope {
  const normalized = String(scope ?? '').trim().toLowerCase()

  if (normalized === 'campus') return 'campus'
  if (normalized === 'totems') return 'totems'
  return 'all'
}

function normalizeTargetType(targetType: string): NotificationTarget['targetType'] {
  const normalized = targetType.trim().toLowerCase()

  if (normalized === 'campus') return 'campus'
  if (normalized === 'totem') return 'totem'
  return 'all'
}

function normalizeTargets(rawTargets: NotificationApiShape['targets']): NotificationTarget[] {
  if (!Array.isArray(rawTargets)) return []

  return rawTargets.map((target) => ({
    id: target.id,
    notificationId: target.notificationId,
    targetType: normalizeTargetType(target.targetType ?? 'all'),
    totemId: target.totemId,
    campusId: target.campusId,
    campus: target.campus,
    totem: target.totem,
    createdAt: target.createdAt,
    updatedAt: target.updatedAt,
  }))
}

function mapScope(targets: NotificationTarget[]): NotificationScope {
  if (targets.some((target) => target.targetType === 'totem' || target.totemId !== null)) {
    return 'totems'
  }

  if (targets.some((target) => target.targetType === 'campus' || target.campusId !== null)) {
    return 'campus'
  }

  return 'all'
}

function normalizeNotification(raw: NotificationApiShape): Notification {
  const targets = normalizeTargets(raw.targets)
  const campusesMap = new Map<number, NotificationCampusOption>()

  for (const target of targets) {
    if (target.campus?.id && !campusesMap.has(target.campus.id)) {
      campusesMap.set(target.campus.id, target.campus)
    }
  }

  const targetTotemIds = [...new Set(
    targets
      .map((target) => target.totemId)
      .filter((id): id is number => id !== null)
  )]

  const totemMap = new Map<number, NotificationTargetTotem>()
  for (const target of targets) {
    if (target.totem?.id && !totemMap.has(target.totem.id)) {
      totemMap.set(target.totem.id, target.totem)
    }
  }

  const targetTotems = [...totemMap.values()]
  const campuses = [...campusesMap.values()]
  const targetCampus = campuses[0] ?? null
  const targetCampusId = targetCampus?.id ?? null
  const endAtMs = Date.parse(raw.endAt)
  const remainingSeconds =
    Number.isFinite(endAtMs)
      ? Math.max(0, Math.floor((endAtMs - Date.now()) / 1000))
      : 0

  return {
    id: raw.id,
    title: raw.title,
    message: raw.message,
    createdBy: raw.createdBy,
    targetScope: raw.targetScope ? normalizeScope(raw.targetScope) : mapScope(targets),
    durationMinutes: Number(raw.durationMinutes ?? 0),
    startAt: raw.startAt,
    endAt: raw.endAt,
    deletedAt: raw.deletedAt ?? null,
    createdAt: raw.createdAt,
    updatedAt: raw.updatedAt,
    status: normalizeStatus(raw.status),
    type: normalizeType(raw.type ?? 'normal'),
    targets,
    campuses,
    targetCampusId,
    targetCampus,
    targetTotemIds,
    targetTotems,
    remainingSeconds: typeof raw.remainingSeconds === 'number' ? raw.remainingSeconds : remainingSeconds,
  }
}

function resolveDispatchPayload({
  mode,
  selectedCampusId,
  targetTotemIds,
  isSuperAdmin,
  scopedCampusId,
}: {
  mode: NotificationDispatchMode
  selectedCampusId: number | ''
  targetTotemIds: number[]
  isSuperAdmin: boolean
  scopedCampusId: number | null
}) {
  if (mode === 'totems') {
    return {
      targetScope: 'totems' as const,
      targetCampusId: undefined,
      targetTotemIds,
    }
  }

  const campusIdForCampusScope = isSuperAdmin
    ? (selectedCampusId === '' ? null : Number(selectedCampusId))
    : scopedCampusId

  if (campusIdForCampusScope && Number.isInteger(campusIdForCampusScope) && campusIdForCampusScope > 0) {
    return {
      targetScope: 'campus' as const,
      targetCampusId: campusIdForCampusScope,
      targetTotemIds: undefined,
    }
  }

  return {
    targetScope: 'all' as const,
    targetCampusId: undefined,
    targetTotemIds: undefined,
  }
}

function normalizePayloadWithAccessContext(
  payload: NotificationFormValues,
  accessContext: Pick<AuthUser, 'role' | 'campusId'>
) {
  const durationMinutes = convertDurationToMinutes(payload.durationValue, payload.durationUnit) ?? 0
  const isSuperAdmin = accessContext.role === 'SuperAdmin'
  const scopedCampusId = isSuperAdmin
    ? null
    : (typeof accessContext.campusId === 'number' && accessContext.campusId > 0
      ? accessContext.campusId
      : null)
  const resolvedDispatch = resolveDispatchPayload({
    mode: payload.targetScope,
    selectedCampusId: payload.targetCampusId,
    targetTotemIds: payload.targetTotemIds,
    isSuperAdmin,
    scopedCampusId,
  })

  return {
    title: payload.title.trim(),
    message: payload.message.trim(),
    type: payload.type,
    status: payload.status,
    durationMinutes,
    startAt: payload.startAt ? new Date(payload.startAt).toISOString() : null,
    ...resolvedDispatch,
  }
}

function normalizeCreatePayload(
  payload: NotificationFormValues,
  createdBy: number,
  accessContext: Pick<AuthUser, 'role' | 'campusId'>
) {
  return {
    ...normalizePayloadWithAccessContext(payload, accessContext),
    createdBy,
  }
}

function normalizeUpdatePayload(
  payload: NotificationFormValues,
  accessContext: Pick<AuthUser, 'role' | 'campusId'>
) {
  return normalizePayloadWithAccessContext(payload, accessContext)
}

function normalizeTotemOption(raw: TotemApiShape): NotificationTotemOption {
  return {
    id: raw.id,
    code: raw.code,
    name: raw.name,
    campusId: raw.campusId,
    campusName: raw.campusName,
    state: raw.state,
  }
}

function normalizeCatalogTotemOption(raw: Totem): NotificationTotemOption {
  return {
    id: raw.id,
    code: raw.code,
    name: raw.name,
    campusId: Number.isInteger(raw.campusId) ? raw.campusId : raw.campus?.id ?? null,
    campusName: raw.campus?.name ?? null,
    state: raw.state,
  }
}

export const notificationService = {
  async getNotifications(
    params: NotificationListParams,
    options: { signal?: AbortSignal } = {}
  ) {
    const query = buildQueryParams(params)
    const endpoint = query ? `/api/notifications?${query}` : '/api/notifications'

    const response = await apiRequest<ApiListResponse<NotificationApiShape>>(endpoint, {
      signal: options.signal,
    })

    return {
      ...response,
      data: response.data.map(normalizeNotification),
    } satisfies ApiListResponse<Notification>
  },

  async getNotificationById(id: number) {
    const response = await apiRequest<ApiItemResponse<NotificationApiShape>>(`/api/notifications/${id}`)

    return {
      ...response,
      data: normalizeNotification(response.data),
    } satisfies ApiItemResponse<Notification>
  },

  async getCampusOptions() {
    const response = await apiRequest<{ ok: boolean; data: NotificationCampusOption[] }>('/api/notifications/campuses')

    return response.data
  },

  async getActiveTotemOptions() {
    const response = await apiRequest<{ ok: boolean; data: TotemApiShape[] }>('/api/notifications/totem-options')

    return response.data.map(normalizeTotemOption)
  },

  async getActiveTotemOptionsPage(
    {
      page,
      limit,
      search,
      campusId,
    }: {
      page: number
      limit: number
      search?: string
      campusId?: number | null
    },
    options: { signal?: AbortSignal } = {}
  ) {
    const response = await totemService.getTotems(
      {
        state: 'active',
        search: search?.trim() || undefined,
        campusId:
          typeof campusId === 'number' && Number.isInteger(campusId) && campusId > 0
            ? campusId
            : undefined,
        page,
        limit,
      },
      {
        signal: options.signal,
      }
    )

    return {
      ...response,
      data: response.data.map(normalizeCatalogTotemOption),
    } satisfies ApiListResponse<NotificationTotemOption>
  },

  async createNotification(
    payload: NotificationFormValues,
    createdBy: number,
    accessContext: Pick<AuthUser, 'role' | 'campusId'>
  ) {
    const response = await apiRequest<ApiItemResponse<NotificationApiShape>>('/api/notifications', {
      method: 'POST',
      body: JSON.stringify(normalizeCreatePayload(payload, createdBy, accessContext)),
    })

    return {
      ...response,
      data: normalizeNotification(response.data),
    } satisfies ApiItemResponse<Notification>
  },

  async updateNotification(
    id: number,
    payload: NotificationFormValues,
    accessContext: Pick<AuthUser, 'role' | 'campusId'>
  ) {
    const response = await apiRequest<ApiItemResponse<NotificationApiShape>>(`/api/notifications/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(normalizeUpdatePayload(payload, accessContext)),
    })

    return {
      ...response,
      data: normalizeNotification(response.data),
    } satisfies ApiItemResponse<Notification>
  },

  async deleteNotification(id: number) {
    return apiRequest<ApiMessageResponse>(`/api/notifications/${id}`, {
      method: 'DELETE',
    })
  },

  async changeNotificationStatus(id: number, status: NotificationLifecycleStatus) {
    const response = await apiRequest<ApiItemResponse<NotificationApiShape>>(
      `/api/notifications/${id}/status`,
      {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      }
    )

    return {
      ...response,
      data: normalizeNotification(response.data),
    } satisfies ApiItemResponse<Notification>
  },
}

export function getNotificationFieldErrors(
  error: unknown
): NotificationFormErrors {
  const rawErrors = pickFieldErrors(error, NOTIFICATION_FORM_ERROR_KEYS)

  const mappedErrors: NotificationFormErrors = {
    title: rawErrors.title,
    message: rawErrors.message,
    type: rawErrors.type,
    status: rawErrors.status,
    durationValue:
      rawErrors.durationValue ??
      rawErrors.durationMinutes ??
      rawErrors.duration_minutes,
    durationUnit: rawErrors.durationUnit,
    startAt: rawErrors.startAt ?? rawErrors.start_at,
    targetScope: rawErrors.targetScope ?? rawErrors.target_scope,
    targetCampusId:
      rawErrors.targetCampusId ??
      rawErrors.target_campus_id ??
      rawErrors.campusId ??
      rawErrors.campus_id,
    targetTotemIds: rawErrors.targetTotemIds ?? rawErrors.target_totem_ids,
  }

  return mappedErrors
}
