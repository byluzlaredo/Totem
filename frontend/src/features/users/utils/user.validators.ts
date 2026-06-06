import type { UserFormErrors, UserFormValues, UserRole, UserStatus } from "../../../types/user";
import {
  normalizeEmailInputForSubmit,
  normalizeTextInputForSubmit,
} from "../../../utils/inputNormalization";

const VALID_ROLES: UserRole[] = ['Admin', 'SuperAdmin']
const VALID_STATUSES: UserStatus[] = ['active', 'inactive', 'invited']

export function normalizeUserFormValues(values: UserFormValues): UserFormValues {
  return {
    ...values,
    name: normalizeTextInputForSubmit(values.name),
    email: normalizeEmailInputForSubmit(values.email),
  }
}

export function validateUserForm(
  values: UserFormValues,
  isEditing: boolean
): UserFormErrors {
  const errors: UserFormErrors = {}

  if (!values.name) {
    errors.name = 'El nombre es obligatorio'
  } else if (values.name.length < 3) {
    errors.name = 'El nombre debe tener mínimo 3 caracteres'
  } else if (values.name.length > 100) {
    errors.name = 'El nombre debe tener máximo 100 caracteres'
  }

  if (!values.email) {
    errors.email = 'El correo es obligatorio'
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email)) {
    errors.email = 'Ingresa un correo válido'
  }

  if (!VALID_ROLES.includes(values.role)) {
    errors.role = 'Selecciona un rol válido'
  }

  if (isEditing && !VALID_STATUSES.includes(values.status)) {
    errors.status = 'Selecciona un estado válido'
  }

  if (!values.campusId) {
    errors.campusId = 'Selecciona un campus'
  } else {
    const parsedCampusId = Number(values.campusId)

    if (!Number.isInteger(parsedCampusId) || parsedCampusId <= 0) {
      errors.campusId = 'Selecciona un campus válido'
    }
  }

  return errors
}
