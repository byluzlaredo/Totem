import type {
  ChangePasswordFormErrors,
  ChangePasswordPayload,
} from "../../../types/auth";
import {
  PASSWORD_RULE,
  PASSWORD_RULE_MESSAGE,
} from "./password.validators";

export const EMPTY_CHANGE_PASSWORD_FORM: ChangePasswordPayload = {
  currentPassword: "",
  newPassword: "",
  confirmNewPassword: "",
};

export function validateChangePasswordForm(
  values: ChangePasswordPayload
): ChangePasswordFormErrors {
  const errors: ChangePasswordFormErrors = {};

  if (!values.currentPassword) {
    errors.currentPassword = "La contraseña actual es obligatoria";
  }

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
