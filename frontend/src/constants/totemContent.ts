import type {
    AssignmentMode,
    ContentAssignmentMode,
    TotemContentListStatusFilter,
    TotemContentFormValues,
    TotemContentStatus,
} from "../types/totemContent";
import type { ContentType } from "../types/content";

export const TOTEM_CONTENT_STATUS_OPTIONS: Array<{ value: TotemContentStatus; label: string }> = [
    { value: 'active', label: 'Activo' },
    { value: 'inactive', label: 'Inactivo' },
]

export const TOTEM_CONTENT_FILTER_STATUS_OPTIONS: Array<{
    value: TotemContentListStatusFilter
    label: string
}> = [
        { value: 'active', label: 'Activo' },
        { value: 'inactive', label: 'Inactivo' },
        { value: 'scheduled', label: 'Programado' },
        { value: 'expired', label: 'Expirado' },
        { value: 'expiringSoon', label: 'Próximo a expirar' },
    ]

export const ASSIGNMENT_MODE_OPTIONS: Array<{ value: AssignmentMode; label: string }> = [
    { value: 'single', label: 'Un tótem' },
    { value: 'multiple', label: 'Varios tótems' },
    { value: 'all', label: 'Todos los tótems activos' },
]

export const CONTENT_ASSIGNMENT_MODE_OPTIONS: Array<{
    value: ContentAssignmentMode
    label: string
}> = [
        { value: 'single', label: 'Un contenido' },
        { value: 'multiple', label: 'Varios contenidos' },
    ]

export const DEFAULT_TOTEM_CONTENT_PAGE_SIZE = 10

export const TOTEM_ASSIGNMENT_TYPE_LIMITS: Record<ContentType, number> = {
    image: 8,
    video: 3,
    advertisement: 5,
    news: 6,
    pdf: 3,
}

export const CONTENT_TYPE_LIMIT_LABELS: Record<ContentType, string> = {
    image: 'imágenes',
    video: 'videos',
    advertisement: 'publicidades',
    news: 'noticias',
    pdf: 'PDFs',
}

export const EMPTY_TOTEM_CONTENT_FORM: TotemContentFormValues = {
    assignmentMode: 'single',
    totemId: '',
    totemIds: [],
    contentAssignmentMode: 'single',
    contentId: '',
    contentIds: [],
    status: 'active',
    startAt: '',
    endAt: '',
    priority: '1',
    sortOrder: '1',
}
