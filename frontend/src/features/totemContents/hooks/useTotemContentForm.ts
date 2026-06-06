import { useCallback, useState, type ChangeEvent, type FormEvent } from "react";
import type {
    TotemContentFormErrors,
    TotemContentFormValues,
} from "../../../types/totemContent";
import {
    normalizeTotemContentFormValues,
    type TotemContentValidationOptions,
    validateTotemContentForm,
} from "../utils/totemContent.validators";

export function useTotemContentForm(
    initialValues: TotemContentFormValues,
    onSubmit: (values: TotemContentFormValues) => Promise<void>,
    validationOptions: TotemContentValidationOptions = {}
) {
    const [values, setValues] = useState<TotemContentFormValues>(initialValues)
    const [errors, setErrors] = useState<TotemContentFormErrors>({})
    const [submitAttempts, setSubmitAttempts] = useState(0)

    function handleChange(
        event: ChangeEvent<HTMLInputElement | HTMLSelectElement>
    ) {
        const { name, value } = event.target

        if (
            event.target instanceof HTMLSelectElement &&
            event.target.multiple &&
            (name === 'totemIds' || name === 'contentIds')
        ) {
            const selectedValues = Array.from(event.target.selectedOptions).map(
                (option) => option.value
            )

            setValues((prev) => ({
                ...prev,
                [name]: selectedValues,
            }))

            setErrors((prev) => ({
                ...prev,
                [name]: undefined,
            }))

            return
        }

        if (name === 'assignmentMode') {
            setValues((prev) => {
                if (value === 'single') {
                    return {
                        ...prev,
                        assignmentMode: 'single',
                        totemIds: [],
                    }
                }

                if (value === 'multiple') {
                    return {
                        ...prev,
                        assignmentMode: 'multiple',
                        totemId: '',
                    }
                }

                return {
                    ...prev,
                    assignmentMode: 'all',
                    totemId: '',
                    totemIds: [],
                }
            })

            setErrors((prev) => ({
                ...prev,
                assignmentMode: undefined,
                totemId: undefined,
                totemIds: undefined,
            }))

            return
        }

        if (name === 'contentAssignmentMode') {
            setValues((prev) => {
                if (value === 'multiple') {
                    return {
                        ...prev,
                        contentAssignmentMode: 'multiple',
                        contentId: '',
                    }
                }

                return {
                    ...prev,
                    contentAssignmentMode: 'single',
                    contentIds: [],
                }
            })

            setErrors((prev) => ({
                ...prev,
                contentAssignmentMode: undefined,
                contentId: undefined,
                contentIds: undefined,
            }))

            return
        }

        setValues((prev) => ({
            ...prev,
            [name]: value,
        }))

        setErrors((prev) => ({
            ...prev,
            [name]: undefined,
        }))
    }

    async function handleSubmit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault()
        setSubmitAttempts((previous) => previous + 1)

        const normalizedValues = normalizeTotemContentFormValues(values)
        const validationErrors = validateTotemContentForm(normalizedValues, validationOptions)

        setErrors(validationErrors)

        if (Object.keys(validationErrors).length > 0) {
            return
        }

        await onSubmit(normalizedValues)
    }

    const setFieldErrors = useCallback((nextErrors: TotemContentFormErrors) => {
        setErrors((prev) => ({
            ...prev,
            ...nextErrors,
        }))
    }, [])

    function setSingleTotemId(totemId: number | null) {
        setValues((prev) => ({
            ...prev,
            totemId: totemId ? String(totemId) : '',
        }))

        setErrors((prev) => ({
            ...prev,
            totemId: undefined,
        }))
    }

    function setSingleContentId(contentId: number | null) {
        setValues((prev) => ({
            ...prev,
            contentId: contentId ? String(contentId) : '',
        }))

        setErrors((prev) => ({
            ...prev,
            contentId: undefined,
        }))
    }

    function toggleMultipleTotemId(totemId: number) {
        setValues((prev) => {
            const nextId = String(totemId)
            const exists = prev.totemIds.includes(nextId)

            return {
                ...prev,
                totemIds: exists
                    ? prev.totemIds.filter((currentId) => currentId !== nextId)
                    : [...prev.totemIds, nextId],
            }
        })

        setErrors((prev) => ({
            ...prev,
            totemIds: undefined,
        }))
    }

    function toggleMultipleContentId(contentId: number) {
        setValues((prev) => {
            const nextId = String(contentId)
            const exists = prev.contentIds.includes(nextId)

            return {
                ...prev,
                contentIds: exists
                    ? prev.contentIds.filter((currentId) => currentId !== nextId)
                    : [...prev.contentIds, nextId],
            }
        })

        setErrors((prev) => ({
            ...prev,
            contentIds: undefined,
        }))
    }

    function removeSelectedContent(contentId: number) {
        setValues((prev) => {
            if (prev.contentAssignmentMode === 'multiple') {
                return {
                    ...prev,
                    contentIds: prev.contentIds.filter(
                        (selectedId) => Number(selectedId) !== contentId
                    ),
                }
            }

            if (Number(prev.contentId) !== contentId) {
                return prev
            }

            return {
                ...prev,
                contentId: '',
            }
        })

        setErrors((prev) => ({
            ...prev,
            contentId: undefined,
            contentIds: undefined,
        }))
    }

    return {
        values,
        errors,
        submitAttempts,
        removeSelectedContent,
        setSingleTotemId,
        setSingleContentId,
        toggleMultipleTotemId,
        toggleMultipleContentId,
        handleChange,
        handleSubmit,
        setFieldErrors,
    }
}
