import type {
  ForgotPasswordFormErrors,
  ForgotPasswordPayload,
} from "../../../types/auth";

export const EMPTY_FORGOT_PASSWORD_FORM: ForgotPasswordPayload = {
  email: "",
};

export function validateForgotPasswordForm(
  values: ForgotPasswordPayload
): ForgotPasswordFormErrors {
  const errors: ForgotPasswordFormErrors = {};
  const normalizedEmail = values.email.trim();

  if (!normalizedEmail) {
    errors.email = "El correo es obligatorio";
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
    errors.email = "Ingresa un correo válido";
  }

  return errors;
}
