import { useCallback, useState, type ChangeEvent, type FormEvent } from "react";
import type { UserFormErrors, UserFormValues } from "../../../types/user";
import { normalizeUserFormValues, validateUserForm } from "../utils/user.validators";
import {
  normalizeEmailInputForTyping,
  normalizeTextInputForTyping,
} from "../../../utils/inputNormalization";

export function useUserForm(
  initialValues: UserFormValues,
  onSubmit: (values: UserFormValues) => Promise<void>,
  isEditing: boolean
) {
  const [values, setValues] = useState<UserFormValues>(initialValues)
  const [errors, setErrors] = useState<UserFormErrors>({})

  const handleChange = useCallback((
    event: ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    const { name, value } = event.target
    const normalizedValue =
      name === 'name'
        ? normalizeTextInputForTyping(value)
        : name === 'email'
          ? normalizeEmailInputForTyping(value)
          : value

    setValues((prev) => ({
      ...prev,
      [name]: normalizedValue,
    }))

    setErrors((prev) => ({
      ...prev,
      [name]: undefined,
    }))
  }, [])

  const handleSubmit = useCallback(async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    const normalizedValues = normalizeUserFormValues(values)
    const validationErrors = validateUserForm(normalizedValues, isEditing)

    setErrors(validationErrors)

    if (Object.keys(validationErrors).length > 0) {
      return
    }

    await onSubmit(normalizedValues)
  }, [isEditing, onSubmit, values])

  const setFieldErrors = useCallback((nextErrors: UserFormErrors) => {
    setErrors((prev) => ({
      ...prev,
      ...nextErrors,
    }))
  }, [])

  return {
    values,
    errors,
    handleChange,
    handleSubmit,
    setFieldErrors,
  }
}
