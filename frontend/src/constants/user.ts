import type { UserFormValues, UserRole, UserStatus } from "../types/user";

export const USER_ROLE_OPTIONS: Array<{ value: UserRole; label: string }> = [
  { value: 'Admin', label: 'Admin' },
  { value: 'SuperAdmin', label: 'Super Admin' },
]

export const USER_STATUS_OPTIONS: Array<{ value: UserStatus; label: string }> = [
  { value: 'invited', label: 'Invitado' },
  { value: 'active', label: 'Activo' },
  { value: 'inactive', label: 'Inactivo' },
]

export const DEFAULT_USER_PAGE_SIZE = 10

export const EMPTY_USER_FORM: UserFormValues = {
  name: '',
  email: '',
  role: 'Admin',
  status: 'invited',
  campusId: '',
}
