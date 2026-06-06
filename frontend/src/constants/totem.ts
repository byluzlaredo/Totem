import type {
    TotemConnectionStatus,
    TotemFormValues,
    TotemState,
} from "../types/totem";

export const TOTEM_STATE_OPTIONS: Array<{ value: TotemState; label: string }> = [
    { value: 'active', label: 'Activo' },
    { value: 'inactive', label: 'Inactivo' },
]

export const TOTEM_CONNECTION_STATUS_OPTIONS: Array<{ value: TotemConnectionStatus; label: string }> = [
    { value: 'online', label: 'En línea' },
    { value: 'offline', label: 'Fuera de línea' },
]

export const DEFAULT_PAGE_SIZE = 10

export const EMPTY_TOTEM_FORM: TotemFormValues = {
    code: '',
    name: '',
    campusId: '',
    state: 'active',
}
