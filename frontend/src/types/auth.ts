import type { CampusOption } from "./campus";
import type { UserRole, UserStatus } from "./user";

export interface AuthUser {
  id: number
  name: string
  email: string
  role: UserRole
  status: UserStatus
  campusId: number | null
  campus: CampusOption | null
  lastLoginAt: string | null
}

export interface LoginCredentials {
  email: string
  password: string
}

export interface ForgotPasswordPayload {
  email: string
}

export interface ForgotPasswordFormErrors {
  email?: string
}

export interface ResetPasswordValidatePayload {
  token: string
}

export interface SetPasswordValidatePayload {
  token: string
}

export interface ResetPasswordPayload {
  token: string
  newPassword: string
  confirmNewPassword: string
}

export interface SetPasswordPayload {
  token: string
  newPassword: string
  confirmNewPassword: string
}

export interface ResetPasswordFormErrors {
  token?: string
  newPassword?: string
  confirmNewPassword?: string
}

export interface SetPasswordFormErrors {
  token?: string
  newPassword?: string
  confirmNewPassword?: string
}

export interface ChangePasswordPayload {
  currentPassword: string
  newPassword: string
  confirmNewPassword: string
}

export interface ChangePasswordFormErrors {
  currentPassword?: string
  newPassword?: string
  confirmNewPassword?: string
}

export interface AuthApiResponse {
  ok: boolean
  message?: string
  data: {
    user: AuthUser
  }
}

export interface AuthMessageResponse {
  ok: boolean
  message: string
}

export interface ForgotPasswordApiResponse extends AuthMessageResponse {}

export interface ValidateResetTokenApiResponse {
  ok: boolean
  data: {
    valid: boolean
  }
}

export interface ValidateSetPasswordTokenApiResponse {
  ok: boolean
  data: {
    valid: boolean
  }
}

export interface ChangePasswordApiResponse {
  ok: boolean
  message: string
  data: {
    invalidatedSessions: number
  }
}

export interface ResetPasswordApiResponse extends ChangePasswordApiResponse {}

export interface SetPasswordApiResponse extends ChangePasswordApiResponse {}
