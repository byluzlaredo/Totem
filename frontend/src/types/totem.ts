import type { CampusOption } from "./campus"

export type TotemState = 'active' | 'inactive'
export type TotemConnectionStatus = 'online' | 'offline'
export type TotemLinkingCodeStatus = 'none' | 'active' | 'expired' | 'used'

export interface Totem {
    id: number
    code: string
    name: string
    campusId: number
    campus: CampusOption | null
    deviceToken?: string | null
    linkingCode?: string | null
    linkingCodeGeneratedAt?: string | null
    linkingCodeExpiresAt?: string | null
    linkingCodeUsedAt?: string | null
    linkingCodeTtlMinutes?: number | null
    connectionStatus: TotemConnectionStatus
    lastSeenAt: string | null
    state: TotemState
    createdAt: string
    updatedAt: string
    deleted_at?: string | null
}

export interface TotemLinkingCodeInfo {
    status: TotemLinkingCodeStatus
    code: string | null
    generatedAt: string | null
    expiresAt: string | null
    usedAt: string | null
    ttlMinutes: number | null
    remainingSeconds: number
    isUsable: boolean
}

export interface TotemLinkingCodeResponse extends TotemLinkingCodeInfo {
    totemId: number
    totemName: string
    totemState: TotemState
    defaultTtlMinutes: number
    allowedTtlMinutes: number[]
}

export interface TotemFormValues {
    code: string
    name: string
    campusId: string
    state: TotemState
}

export interface TotemFormErrors {
    code?: string
    name?: string
    campusId?: string
    state?: string
}

export interface TotemListParams {
    search?: string
    campusId?: number | ''
    state?: TotemState | ''
    connectionStatus?: TotemConnectionStatus | ''
    page?: number
    limit?: number
}

export interface PaginationMeta {
    totalItems: number
    totalPages: number
    currentPage: number
    pageSize: number
}

export interface ApiListResponse<T> {
    ok: boolean
    data: T[]
    meta: PaginationMeta
}

export interface ApiItemResponse<T> {
    ok: boolean
    message?: string
    data: T
}

export interface ApiMessageResponse {
    ok: boolean
    message: string
}
