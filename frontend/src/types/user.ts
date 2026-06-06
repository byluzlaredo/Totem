export type UserRole = 'Admin' | 'SuperAdmin'
export type UserStatus = 'active' | 'inactive' | 'invited'
import type { CampusOption } from './campus'

export interface User {
  id: number
  name: string
  email: string
  role: UserRole
  status: UserStatus
  campusId: number
  campus: CampusOption | null
  lastLoginAt: string | null
  createdAt: string
  updatedAt: string
}

export interface UserFormValues {
  name: string
  email: string
  role: UserRole
  status: UserStatus
  campusId: string
}

export interface UserFormErrors {
  name?: string
  email?: string
  role?: string
  status?: string
  campusId?: string
}

export interface UserListParams {
  search?: string
  role?: UserRole | ''
  status?: UserStatus | ''
  campusId?: number | ''
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
