import { useCallback, useState, type ChangeEvent, type FormEvent } from 'react'
import type { NotificationFormErrors, NotificationFormValues } from '../../../types/notification'
import {
  normalizeNotificationFormValues,
  type NotificationValidationOptions,
  validateNotificationForm,
} from '../utils/notification.validators'
import { normalizeTextInputForTyping } from '../../../utils/inputNormalization'

export function useNotificationForm(
  initialValues: NotificationFormValues,
  onSubmit: (values: NotificationFormValues) => Promise<void>,
  validationOptions: NotificationValidationOptions = {}
) {
  const [values, setValues] = useState<NotificationFormValues>(initialValues)
  const [errors, setErrors] = useState<NotificationFormErrors>({})
  const [submitAttempts, setSubmitAttempts] = useState(0)

  function handleChange(
    event: ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) {
    const { name, value } = event.target
    const normalizedValue =
      name === 'title' || name === 'message'
        ? normalizeTextInputForTyping(value)
        : value

    setValues((prev) => {
      if (name === 'targetScope') {
        return {
          ...prev,
          targetScope: normalizedValue as NotificationFormValues['targetScope'],
          targetTotemIds: normalizedValue === 'totems' ? prev.targetTotemIds : [],
        }
      }

      if (name === 'targetCampusId') {
        return {
          ...prev,
          targetCampusId: normalizedValue === '' ? '' : Number(normalizedValue),
        }
      }

      return {
        ...prev,
        [name]: normalizedValue,
      }
    })

    setErrors((prev) => ({
      ...prev,
      [name]: undefined,
      ...(name === 'targetScope' ? { targetTotemIds: undefined } : {}),
    }))
  }

  function handleTotemToggle(totemId: number) {
    setValues((prev) => {
      const exists = prev.targetTotemIds.includes(totemId)

      if (exists) {
        return {
          ...prev,
          targetTotemIds: prev.targetTotemIds.filter((item) => item !== totemId),
        }
      }

      return {
        ...prev,
        targetTotemIds: [...prev.targetTotemIds, totemId],
      }
    })

    setErrors((prev) => ({
      ...prev,
      targetTotemIds: undefined,
    }))
  }

  function setTargetTotemIds(nextTotemIds: number[]) {
    setValues((prev) => ({
      ...prev,
      targetTotemIds: [...new Set(nextTotemIds)],
    }))

    setErrors((prev) => ({
      ...prev,
      targetTotemIds: undefined,
    }))
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSubmitAttempts((previous) => previous + 1)

    const normalizedValues = normalizeNotificationFormValues(values)
    const validationErrors = validateNotificationForm(normalizedValues, validationOptions)

    setErrors(validationErrors)

    if (Object.keys(validationErrors).length > 0) {
      return
    }

    await onSubmit(normalizedValues)
  }

  const setFieldErrors = useCallback((nextErrors: NotificationFormErrors) => {
    setErrors((prev) => ({
      ...prev,
      ...nextErrors,
    }))
  }, [])

  return {
    values,
    errors,
    submitAttempts,
    handleChange,
    handleTotemToggle,
    setTargetTotemIds,
    handleSubmit,
    setFieldErrors,
  }
}
