import { apiRequest } from "../../../services/api";
import { pickFieldErrors } from "../../../utils/apiFieldErrors";
import type {
  AuthApiResponse,
  AuthMessageResponse,
  ChangePasswordApiResponse,
  ChangePasswordFormErrors,
  ChangePasswordPayload,
  ForgotPasswordApiResponse,
  ForgotPasswordFormErrors,
  ForgotPasswordPayload,
  LoginCredentials,
  ResetPasswordApiResponse,
  ResetPasswordFormErrors,
  ResetPasswordPayload,
  ResetPasswordValidatePayload,
  SetPasswordApiResponse,
  SetPasswordFormErrors,
  SetPasswordPayload,
  SetPasswordValidatePayload,
  ValidateResetTokenApiResponse,
  ValidateSetPasswordTokenApiResponse,
} from "../../../types/auth";

const AUTH_ME_TIMEOUT_MS = (() => {
  const parsed = Number(import.meta.env.VITE_AUTH_ME_TIMEOUT_MS ?? 12000)

  if (!Number.isFinite(parsed)) {
    return 12000
  }

  const normalized = Math.trunc(parsed)

  if (normalized < 3000) {
    return 3000
  }

  if (normalized > 30000) {
    return 30000
  }

  return normalized
})()

const CHANGE_PASSWORD_FORM_ERROR_KEYS = [
  'currentPassword',
  'newPassword',
  'confirmNewPassword',
] as const
const FORGOT_PASSWORD_FORM_ERROR_KEYS = ['email'] as const
const RESET_PASSWORD_FORM_ERROR_KEYS = [
  'token',
  'newPassword',
  'confirmNewPassword',
] as const
const SET_PASSWORD_FORM_ERROR_KEYS = [
  'token',
  'newPassword',
  'confirmNewPassword',
] as const

export const authService = {
  async login(payload: LoginCredentials) {
    return apiRequest<AuthApiResponse>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify(payload),
    })
  },

  async logout() {
    return apiRequest<AuthMessageResponse>('/api/auth/logout', {
      method: 'POST',
    })
  },

  async me() {
    return apiRequest<AuthApiResponse>('/api/auth/me', {
      timeoutMs: AUTH_ME_TIMEOUT_MS,
    })
  },

  async changePassword(payload: ChangePasswordPayload) {
    return apiRequest<ChangePasswordApiResponse>('/api/auth/change-password', {
      method: 'POST',
      body: JSON.stringify(payload),
    })
  },

  async requestPasswordReset(payload: ForgotPasswordPayload) {
    return apiRequest<ForgotPasswordApiResponse>('/api/auth/forgot-password', {
      method: 'POST',
      body: JSON.stringify(payload),
    })
  },

  async validateResetPasswordToken(payload: ResetPasswordValidatePayload) {
    return apiRequest<ValidateResetTokenApiResponse>(
      '/api/auth/reset-password/validate',
      {
        method: 'POST',
        body: JSON.stringify(payload),
      }
    )
  },

  async resetPassword(payload: ResetPasswordPayload) {
    return apiRequest<ResetPasswordApiResponse>('/api/auth/reset-password', {
      method: 'POST',
      body: JSON.stringify(payload),
    })
  },

  async validateSetPasswordToken(payload: SetPasswordValidatePayload) {
    return apiRequest<ValidateSetPasswordTokenApiResponse>(
      '/api/auth/set-password/validate',
      {
        method: 'POST',
        body: JSON.stringify(payload),
      }
    )
  },

  async setPasswordFromInvitation(payload: SetPasswordPayload) {
    return apiRequest<SetPasswordApiResponse>('/api/auth/set-password', {
      method: 'POST',
      body: JSON.stringify(payload),
    })
  },
}

export function getChangePasswordFieldErrors(error: unknown): ChangePasswordFormErrors {
  return pickFieldErrors(error, CHANGE_PASSWORD_FORM_ERROR_KEYS)
}

export function getForgotPasswordFieldErrors(error: unknown): ForgotPasswordFormErrors {
  return pickFieldErrors(error, FORGOT_PASSWORD_FORM_ERROR_KEYS)
}

export function getResetPasswordFieldErrors(error: unknown): ResetPasswordFormErrors {
  return pickFieldErrors(error, RESET_PASSWORD_FORM_ERROR_KEYS)
}

export function getSetPasswordFieldErrors(error: unknown): SetPasswordFormErrors {
  return pickFieldErrors(error, SET_PASSWORD_FORM_ERROR_KEYS)
}
