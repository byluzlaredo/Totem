import { apiRequest } from "../../../services/api";
import { pickFieldErrors } from "../../../utils/apiFieldErrors";
import type {
    ApiItemResponse,
    ApiListResponse,
    ApiMessageResponse,
} from "../../../types/totem";
import type {
    TotemContentBatchCreateResult,
    TotemContent,
    TotemContentFormErrors,
    TotemContentFormValues,
    TotemContentListParams,
    TotemContentStatus,
} from "../../../types/totemContent";

const TOTEM_CONTENT_FORM_ERROR_KEYS = [
    'assignmentMode',
    'totemId',
    'totemIds',
    'contentAssignmentMode',
    'contentId',
    'contentIds',
    'status',
    'startAt',
    'endAt',
    'priority',
    'sortOrder',
] as const

function buildQueryParams(params: TotemContentListParams) {
    const searchParams = new URLSearchParams()

    if (params.totemId) searchParams.set('totemId', String(params.totemId))
    if (params.contentId) searchParams.set('contentId', String(params.contentId))
    if (params.totemSearch) searchParams.set('totemSearch', params.totemSearch)
    if (params.contentSearch) searchParams.set('contentSearch', params.contentSearch)
    if (params.contentType) searchParams.set('contentType', params.contentType)
    if (params.campusId) searchParams.set('campusId', String(params.campusId))
    if (params.status) searchParams.set('status', params.status)
    if (params.page) searchParams.set('page', String(params.page))
    if (params.limit) searchParams.set('limit', String(params.limit))

    return searchParams.toString()
}

function normalizePayload(payload: TotemContentFormValues) {
    const basePayload = {
        status: payload.status,
        startAt: payload.startAt ? new Date(payload.startAt).toISOString() : null,
        endAt: payload.endAt ? new Date(payload.endAt).toISOString() : null,
        priority: Number(payload.priority),
    }
    const contentPayload =
        payload.contentAssignmentMode === 'multiple'
            ? {
                contentIds: payload.contentIds.map((id) => Number(id)),
            }
            : {
                contentId: Number(payload.contentId),
            }

    if (payload.assignmentMode === 'single') {
        return {
            assignmentMode: 'single',
            ...basePayload,
            ...contentPayload,
            totemId: Number(payload.totemId),
        }
    }

    if (payload.assignmentMode === 'multiple') {
        return {
            assignmentMode: 'multiple',
            ...basePayload,
            ...contentPayload,
            totemIds: payload.totemIds.map((id) => Number(id)),
        }
    }

    return {
        assignmentMode: 'all',
        ...basePayload,
        ...contentPayload,
    }
}

function normalizeUpdatePayload(payload: TotemContentFormValues) {
    return {
        totemId: Number(payload.totemId),
        contentId: Number(payload.contentId),
        status: payload.status,
        startAt: payload.startAt ? new Date(payload.startAt).toISOString() : null,
        endAt: payload.endAt ? new Date(payload.endAt).toISOString() : null,
        priority: Number(payload.priority),
        sortOrder: Number(payload.sortOrder),
    }
}

export const totemContentService = {
    async getAssignments(
        params: TotemContentListParams,
        options: { signal?: AbortSignal } = {},
    ) {
        const query = buildQueryParams(params)
        const endpoint = query ? `/api/totem-contents?${query}` : `/api/totem-contents`

        return apiRequest<ApiListResponse<TotemContent>>(endpoint, {
            signal: options.signal,
        })
    },

    async getAssignmentById(id: number) {
        return apiRequest<ApiItemResponse<TotemContent>>(`/api/totem-contents/${id}`)
    },

    async createAssignment(payload: TotemContentFormValues) {
        return apiRequest<ApiItemResponse<TotemContent | TotemContentBatchCreateResult>>('/api/totem-contents', {
            method: 'POST',
            body: JSON.stringify(normalizePayload(payload)),
        })
    },

    async updateAssignment(id: number, payload: TotemContentFormValues) {
        return apiRequest<ApiItemResponse<TotemContent>>(`/api/totem-contents/${id}`, {
            method: 'PATCH',
            body: JSON.stringify(normalizeUpdatePayload(payload)),
        })
    },

    async changeAssignmentStatus(id: number, status: TotemContentStatus) {
        return apiRequest<ApiItemResponse<TotemContent>>(`/api/totem-contents/${id}`, {
            method: 'PATCH',
            body: JSON.stringify({ status }),
        })
    },

    async deleteAssignment(id: number) {
        return apiRequest<ApiMessageResponse>(`/api/totem-contents/${id}`, {
            method: 'DELETE',
        })
    },
}

export function getTotemContentFieldErrors(
    error: unknown
): TotemContentFormErrors {
    return pickFieldErrors(error, TOTEM_CONTENT_FORM_ERROR_KEYS)
}
