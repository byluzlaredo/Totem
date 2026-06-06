import type {
  ResetPasswordFormErrors,
  ResetPasswordPayload,
} from "../../../types/auth";
import {
  PASSWORD_RULE,
  PASSWORD_RULE_MESSAGE,
} from "./password.validators";

export const EMPTY_RESET_PASSWORD_FORM: Omit<
  ResetPasswordPayload,
  "token"
> = {
  newPassword: "",
  confirmNewPassword: "",
};

export function validateResetPasswordForm(
  values: Omit<ResetPasswordPayload, "token">
): ResetPasswordFormErrors {
  const errors: ResetPasswordFormErrors = {};

  if (!values.newPassword) {
    errors.newPassword = "La nueva contraseña es obligatoria";
  } else if (!PASSWORD_RULE.test(values.newPassword)) {
    errors.newPassword = PASSWORD_RULE_MESSAGE;
  }

  if (!values.confirmNewPassword) {
    errors.confirmNewPassword =
      "La confirmación de la nueva contraseña es obligatoria";
  } else if (values.confirmNewPassword !== values.newPassword) {
    errors.confirmNewPassword =
      "La confirmación no coincide con la nueva contraseña";
  }

  return errors;
}
