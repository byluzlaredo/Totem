import { apiRequest } from "../../../services/api";
import { pickFieldErrors } from "../../../utils/apiFieldErrors";
import type {
  ApiItemResponse,
  ApiListResponse,
  ApiMessageResponse,
  User,
  UserFormErrors,
  UserFormValues,
  UserListParams,
  UserStatus,
} from "../../../types/user";

type CreateUserPayload = Omit<UserFormValues, 'campusId' | 'status'> & {
  campusId: number
}

type UpdateUserPayload = Omit<UserFormValues, 'campusId'> & {
  campusId: number
}

const USER_FORM_ERROR_KEYS = [
  'name',
  'email',
  'role',
  'status',
  'campusId',
  'campus_id',
] as const

function buildQueryParams(params: UserListParams) {
  const searchParams = new URLSearchParams()

  if (params.search) searchParams.set('search', params.search)
  if (params.role) searchParams.set('role', params.role)
  if (params.status) searchParams.set('status', params.status)
  if (params.campusId) searchParams.set('campusId', String(params.campusId))
  if (params.page) searchParams.set('page', String(params.page))
  if (params.limit) searchParams.set('limit', String(params.limit))

  return searchParams.toString()
}

function normalizeCreatePayload(payload: UserFormValues): CreateUserPayload {
  return {
    name: payload.name,
    email: payload.email,
    role: payload.role,
    campusId: Number(payload.campusId),
  }
}

function normalizeUpdatePayload(payload: UserFormValues): UpdateUserPayload {
  return {
    name: payload.name,
    email: payload.email,
    role: payload.role,
    status: payload.status,
    campusId: Number(payload.campusId),
  }
}

export const usersService = {
  async getUsers(
    params: UserListParams,
    options: { signal?: AbortSignal } = {},
  ) {
    const query = buildQueryParams(params)
    const endpoint = query ? `/api/users?${query}` : '/api/users'

    return apiRequest<ApiListResponse<User>>(endpoint, {
      signal: options.signal,
    })
  },

  async getUserById(id: number) {
    return apiRequest<ApiItemResponse<User>>(`/api/users/${id}`)
  },

  async createUser(payload: UserFormValues) {
    return apiRequest<ApiItemResponse<User>>('/api/users', {
      method: 'POST',
      body: JSON.stringify(normalizeCreatePayload(payload)),
    })
  },

  async updateUser(id: number, payload: UserFormValues) {
    return apiRequest<ApiItemResponse<User>>(`/api/users/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(normalizeUpdatePayload(payload)),
    })
  },

  async changeUserStatus(id: number, status: UserStatus) {
    return apiRequest<ApiItemResponse<User>>(`/api/users/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    })
  },

  async deleteUser(id: number) {
    return apiRequest<ApiMessageResponse>(`/api/users/${id}`, {
      method: 'DELETE',
    })
  },

  async resendInvitation(id: number) {
    return apiRequest<ApiItemResponse<User>>(`/api/users/${id}/resend-invitation`, {
      method: 'POST',
    })
  },
}

export function getUserFieldErrors(error: unknown): UserFormErrors {
  return pickFieldErrors(error, USER_FORM_ERROR_KEYS)
}
