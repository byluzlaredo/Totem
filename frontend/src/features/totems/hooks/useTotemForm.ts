import { useCallback, useState, type ChangeEvent, type FormEvent } from "react";
import type { TotemFormErrors, TotemFormValues } from "../../../types/totem";
import { normalizeTotemFormValues, validateTotemForm } from "../utils/totem.validators";
import { normalizeTextInputForTyping } from "../../../utils/inputNormalization";

export function useTotemForm(
    initialValues: TotemFormValues,
    onSubmit: (values: TotemFormValues) => Promise<void>
) {
    const [values, setValues] = useState<TotemFormValues>(initialValues)
    const [errors, setErrors] = useState<TotemFormErrors>({})

    function handleChange(
        event: ChangeEvent<HTMLInputElement | HTMLSelectElement>
    ) {
        const { name, value } = event.target
        const normalizedValue =
            name === 'code' || name === 'name'
                ? normalizeTextInputForTyping(value)
                : value

        setValues((prev) => ({
            ...prev,
            [name]: normalizedValue,
        }))

        setErrors((prev) => ({
            ...prev,
            [name]: undefined,
        }))
    }

    async function handleSubmit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault()

        const normalizedValues = normalizeTotemFormValues(values)
        const validationErrors = validateTotemForm(normalizedValues)

        setErrors(validationErrors)

        if (Object.keys(validationErrors).length > 0) {
            return
        }

        await onSubmit(normalizedValues)
    }

    const setFieldErrors = useCallback((nextErrors: TotemFormErrors) => {
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
