import { useCallback, useState, type ChangeEvent, type FormEvent } from "react";
import type { ContentFormErrors, ContentFormValues } from "../../../types/content";
import { isFileRequiredForContentType } from "../../../constants/content";
import { isStoredFileUrlCompatibleWithContentType } from "../utils/contentFileRules";
import {
    normalizeContentFormValues,
    validateContentForm,
} from "../utils/content.validators";
import { normalizeTextInputForTyping } from "../../../utils/inputNormalization";

interface UseContentFormOptions {
    requireFile?: boolean
    initialContentType?: ContentFormValues['contentType']
    existingFileUrl?: string | null
}

export function useContentForm(
    initialValues: ContentFormValues,
    onSubmit: (values: ContentFormValues) => Promise<void>,
    options: UseContentFormOptions = {}
) {
    const [values, setValues] = useState<ContentFormValues>(initialValues)
    const [errors, setErrors] = useState<ContentFormErrors>({})
    const [submitAttempts, setSubmitAttempts] = useState(0)

    function handleChange(
        event: ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
    ) {
        const { name } = event.target

        if (event.target instanceof HTMLInputElement && event.target.type === 'file') {
            const file = event.target.files?.[0] ?? null

            setValues((prev) => ({
                ...prev,
                file,
            }))
        } else {
            const { value } = event.target
            const normalizedValue =
                name === 'title' || name === 'description'
                    ? normalizeTextInputForTyping(value)
                    : value

            setValues((prev) => ({
                ...prev,
                [name]: normalizedValue,
            }))
        }

        setErrors((prev) => ({
            ...prev,
            [name]: undefined,
        }))
    }

    async function handleSubmit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault()
        setSubmitAttempts((previous) => previous + 1)

        const normalizedValues = normalizeContentFormValues(values)
        const contentTypeChanged =
            options.initialContentType !== undefined &&
            normalizedValues.contentType !== options.initialContentType
        const hasSelectedFile = Boolean(normalizedValues.file)
        const existingFileUrl = options.existingFileUrl?.trim() ?? ''
        const hasExistingFile = existingFileUrl.length > 0
        const hasCompatibleExistingFile =
            hasExistingFile &&
            isStoredFileUrlCompatibleWithContentType(
                existingFileUrl,
                normalizedValues.contentType
            )
        const requireFile =
            Boolean(options.requireFile) ||
            (contentTypeChanged &&
                isFileRequiredForContentType(normalizedValues.contentType) &&
                !hasSelectedFile &&
                !hasCompatibleExistingFile)
        const validationErrors = validateContentForm(normalizedValues, {
            requireFile,
            existingFileUrl: existingFileUrl || undefined,
            validateExistingFileCompatibility:
                contentTypeChanged && !hasSelectedFile && hasExistingFile,
        })

        setErrors(validationErrors)

        if (Object.keys(validationErrors).length > 0) {
            return
        }

        await onSubmit(normalizedValues)
    }

    const setFieldErrors = useCallback((nextErrors: ContentFormErrors) => {
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
        handleSubmit,
        setFieldErrors,
    }
}
