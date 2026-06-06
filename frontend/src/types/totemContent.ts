import type { ContentStatus, ContentType } from "./content";
import type { CampusOption } from "./campus";

export type TotemContentStatus = 'active' | 'inactive'
export type TotemContentComputedStatus =
    | TotemContentStatus
    | 'scheduled'
    | 'expired'
export type TotemContentListStatusFilter =
    | TotemContentComputedStatus
    | 'expiringSoon'
export type AssignmentMode = 'single' | 'multiple' | 'all'
export type ContentAssignmentMode = 'single' | 'multiple'

export interface TotemAssignmentTotem {
    id: number
    code: string
    name: string
    campusId: number
    campus: CampusOption | null
}

export interface TotemAssignmentContent {
    id: number
    title: string
    contentType: ContentType
    status: ContentStatus
}

export interface TotemContent {
    id: number
    totemId: number
    contentId: number
    status: TotemContentStatus
    startAt: string | null
    endAt: string | null
    priority: number
    sortOrder: number
    createdAt: string
    updatedAt: string
    deletedAt?: string | null
    totem?: TotemAssignmentTotem
    content?: TotemAssignmentContent
}

export interface TotemContentFormValues {
    assignmentMode: AssignmentMode
    totemId: string
    totemIds: string[]
    contentAssignmentMode: ContentAssignmentMode
    contentId: string
    contentIds: string[]
    status: TotemContentStatus
    startAt: string
    endAt: string
    priority: string
    sortOrder: string
}

export interface TotemContentFormErrors {
    assignmentMode?: string
    totemId?: string
    totemIds?: string
    contentAssignmentMode?: string
    contentId?: string
    contentIds?: string
    status?: string
    startAt?: string
    endAt?: string
    priority?: string
    sortOrder?: string
}

export interface TotemContentListParams {
    totemId?: number
    contentId?: number
    totemSearch?: string
    contentSearch?: string
    contentType?: ContentType | ''
    campusId?: number | ''
    status?: TotemContentListStatusFilter | ''
    page?: number
    limit?: number
}

export interface TotemContentBatchSummary {
    requested: number
    created: number
    skippedExisting: number
    skippedLimit: number
    limitReachedByContentType?: Partial<Record<ContentType, string[]>>
    updated: number
    reactivated: number
}

export interface TotemContentBatchCreateResult {
    assignmentMode: AssignmentMode
    assignments: TotemContent[]
    summary: TotemContentBatchSummary
}
