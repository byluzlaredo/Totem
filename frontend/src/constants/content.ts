import type {
    ContentFormValues,
    ContentOperationalStatus,
    ContentStatus,
    ContentType,
} from "../types/content";

export const CONTENT_TYPE_OPTIONS: Array<{ value: ContentType; label: string }> = [
    { value: 'image', label: 'Imagen' },
    { value: 'video', label: 'Video' },
    { value: 'news', label: 'Noticia' },
    { value: 'advertisement', label: 'Publicidad' },
    { value: 'pdf', label: 'PDF' },
]

export const CONTENT_STATUS_OPTIONS: Array<{ value: ContentStatus; label: string }> = [
    { value: 'active', label: 'Activo' },
    { value: 'inactive', label: 'Inactivo' },
]

export const CONTENT_FILTER_STATUS_OPTIONS: Array<{
    value: ContentStatus
    label: string
}> = [
        { value: 'active', label: 'Activo' },
        { value: 'inactive', label: 'Inactivo' },
    ]

export const CONTENT_OPERATIONAL_STATUS_OPTIONS: Array<{
    value: ContentOperationalStatus
    label: string
}> = [
        { value: 'activeWithoutAssignment', label: 'Activos sin asignación vigente' },
        { value: 'activeWithUnavailableFile', label: 'Activos con archivo no disponible' },
    ]

export const CONTENT_PAGE_SIZE_OPTIONS = [6, 12, 18, 24, 30]
export const DEFAULT_CONTENT_PAGE_SIZE = 12
export const CONTENT_TITLE_MIN_LENGTH = 3
export const CONTENT_TITLE_MAX_LENGTH = 180
export const CONTENT_DESCRIPTION_MAX_LENGTH = 500
export const NEWS_DESCRIPTION_MIN_LENGTH = 5

export const MAX_FILE_SIZE_BYTES_BY_CONTENT_TYPE: Record<ContentType, number> = {
    image: 15 * 1024 * 1024,
    video: 150 * 1024 * 1024,
    pdf: 25 * 1024 * 1024,
    news: 25 * 1024 * 1024,
    advertisement: 15 * 1024 * 1024,
}

export const MAX_PDF_QUESTION_IMAGE_SIZE_BYTES =
    MAX_FILE_SIZE_BYTES_BY_CONTENT_TYPE.image
export const MAX_PDF_QUESTION_IMAGES_PER_CHUNK = 4
export const MAX_PDF_QUESTION_IMAGE_FILES_PER_REQUEST =
    MAX_PDF_QUESTION_IMAGES_PER_CHUNK

export const EMPTY_CONTENT_FORM: ContentFormValues = {
    title: '',
    description: '',
    contentType: 'image',
    file: null,
    status: 'active',
    campusId: '',
}

export function getMaxFileSizeBytesForContentType(contentType: ContentType) {
    return MAX_FILE_SIZE_BYTES_BY_CONTENT_TYPE[contentType]
}

export function isFileRequiredForContentType(contentType: ContentType) {
    return contentType !== 'news'
}
