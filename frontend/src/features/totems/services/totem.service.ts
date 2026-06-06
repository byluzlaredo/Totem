import { apiRequest } from "../../../services/api";
import { pickFieldErrors } from "../../../utils/apiFieldErrors";
import type {
    ApiListResponse,
    ApiItemResponse,
    ApiMessageResponse,
    Totem,
    TotemFormErrors,
    TotemFormValues,
    TotemLinkingCodeResponse,
    TotemListParams,
    TotemState,
} from '../../../types/totem'

const TOTEM_FORM_ERROR_KEYS = ['code', 'name', 'campusId', 'campus_id', 'state'] as const

function buildQueryParams(params: TotemListParams) {
    const searchParams = new URLSearchParams()

    if (params.search) searchParams.set('search', params.search)
    if (params.campusId) searchParams.set('campusId', String(params.campusId))
    if (params.state) searchParams.set('state', params.state)
    if (params.connectionStatus) searchParams.set('connectionStatus', params.connectionStatus)
    if (params.page) searchParams.set('page', String(params.page))
    if (params.limit) searchParams.set('limit', String(params.limit))

    return searchParams.toString()
}

function normalizePayload(payload: TotemFormValues) {
    return {
        code: payload.code,
        name: payload.name,
        campusId: Number(payload.campusId),
    }
}

export const totemService = {
    async getTotems(
        params: TotemListParams,
        options: { signal?: AbortSignal } = {},
    ) {
        const query = buildQueryParams(params)
        const endpoint = query ? `/api/totems?${query}` : `/api/totems`

        return apiRequest<ApiListResponse<Totem>>(endpoint, {
            signal: options.signal,
        })
    },

    async getTotemById(id: number) {
        return apiRequest<ApiItemResponse<Totem>>(`/api/totems/${id}`)
    },

    async getTotemLinkingCode(id: number) {
        return apiRequest<ApiItemResponse<TotemLinkingCodeResponse>>(
            `/api/totems/${id}/linking-code`
        )
    },

    async generateTotemLinkingCode(id: number, ttlMinutes?: number) {
        const payload =
            typeof ttlMinutes === 'number' && Number.isInteger(ttlMinutes) && ttlMinutes > 0
                ? { ttlMinutes }
                : {}

        return apiRequest<ApiItemResponse<TotemLinkingCodeResponse>>(
            `/api/totems/${id}/linking-code`,
            {
                method: 'POST',
                body: JSON.stringify(payload),
            }
        )
    },

    async createTotem(payload: TotemFormValues) {
        return apiRequest<ApiItemResponse<Totem>>('/api/totems', {
            method: 'POST',
            body: JSON.stringify(normalizePayload(payload)),
        })
    },

    async updateTotem(id: number, payload: TotemFormValues) {
        return apiRequest<ApiItemResponse<Totem>>(`/api/totems/${id}`, {
            method: 'PATCH',
            body: JSON.stringify(normalizePayload(payload)),
        })
    },

    async changeTotemState(id: number, state: TotemState) {
        return apiRequest<ApiItemResponse<Totem>>(`/api/totems/${id}/state`, {
            method: 'PATCH',
            body: JSON.stringify({ state }),
        })
    },

    async deleteTotem(id: number) {
        return apiRequest<ApiMessageResponse>(`/api/totems/${id}`, {
            method: 'DELETE',
        })
    },
}

export function getTotemFieldErrors(error: unknown): TotemFormErrors {
    return pickFieldErrors(error, TOTEM_FORM_ERROR_KEYS)
}
