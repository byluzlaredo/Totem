import {
    isSessionReauthMessage,
    resolveAdminSessionInvalidationReason,
    type AdminSessionInvalidationReason,
} from '../utils/sessionReauth'

const API_BASE_URL = import.meta.env.VITE_API_URL ?? ''
const ADMIN_SESSION_INVALIDATED_EVENT = 'admin-session:invalidated'
const adminSessionEvents = new EventTarget()

interface AdminSessionInvalidationPayload {
    reason: AdminSessionInvalidationReason
    message: string
}
const DEFAULT_REQUEST_ERROR = 'Ocurrió un error en la petición'
const DEFAULT_CONNECTION_ERROR = 'No se pudo conectar con el servidor'
const DEFAULT_TIMEOUT_ERROR = 'El servidor tardó demasiado en responder'

interface ApiRequestOptions extends RequestInit {
    baseUrl?: string
    timeoutMs?: number
}

function isAbsoluteUrl(endpoint: string) {
    return endpoint.startsWith('http://') || endpoint.startsWith('https://')
}

function normalizeRelativeEndpoint(endpoint: string) {
    return endpoint.startsWith('/') ? endpoint : `/${endpoint}`
}

function buildRequestUrl(endpoint: string, baseUrl: string) {
    if (isAbsoluteUrl(endpoint)) {
        return endpoint
    }

    const normalizedBaseUrl = baseUrl.trim().replace(/\/+$/, '')
    const normalizedEndpoint = normalizeRelativeEndpoint(endpoint)

    if (!normalizedBaseUrl) {
        return normalizedEndpoint
    }

    return `${normalizedBaseUrl}${normalizedEndpoint}`
}

function extractEndpointPath(endpoint: string) {
    if (isAbsoluteUrl(endpoint)) {
        try {
            return new URL(endpoint).pathname
        } catch {
            return endpoint
        }
    }

    return normalizeRelativeEndpoint(endpoint)
}

function isAdminSessionInvalidationCandidateEndpoint(endpoint: string) {
    const normalizedEndpoint = extractEndpointPath(endpoint).toLowerCase()

    if (normalizedEndpoint.startsWith('/client')) {
        return false
    }

    if (normalizedEndpoint === '/api/auth/login' || normalizedEndpoint === '/api/auth') {
        return false
    }

    return true
}

function shouldSetJsonContentType(body: BodyInit | null | undefined, headers: Headers) {
    return typeof body === 'string' && body.length > 0 && !headers.has('Content-Type')
}

function resolveTimeoutMs(timeoutMs: number | undefined) {
    if (typeof timeoutMs !== 'number' || !Number.isFinite(timeoutMs)) {
        return null
    }

    const normalized = Math.trunc(timeoutMs)
    return normalized > 0 ? normalized : null
}

async function parseResponseData(response: Response): Promise<unknown> {
    if (response.status === 204 || response.status === 205) {
        return null
    }

    const contentType = response.headers.get('content-type')?.toLowerCase() ?? ''

    if (contentType.includes('application/json')) {
        return response.json().catch(() => null)
    }

    const text = await response.text().catch(() => '')
    return text.length > 0 ? text : null
}

function extractErrorMessage(data: unknown) {
    if (typeof data === 'string' && data.trim().length > 0) {
        return data
    }

    if (data && typeof data === 'object' && 'message' in data) {
        const { message } = data as { message?: unknown }

        if (typeof message === 'string' && message.trim().length > 0) {
            return message
        }
    }

    return DEFAULT_REQUEST_ERROR
}

function extractErrorDetails(data: unknown) {
    if (!data || typeof data !== 'object') {
        return undefined
    }

    const parsed = data as { details?: unknown; errors?: unknown }

    if (parsed.details !== undefined) {
        return parsed.details
    }

    return parsed.errors
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
    return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function normalizeFieldErrors(raw: unknown) {
    const fieldErrors: Record<string, string> = {}

    if (Array.isArray(raw)) {
        for (const item of raw) {
            if (!isPlainObject(item)) {
                continue
            }

            const field =
                typeof item.field === 'string'
                    ? item.field
                    : typeof item.path === 'string'
                        ? item.path
                        : null
            const message = typeof item.message === 'string' ? item.message : null

            if (!field || !message) {
                continue
            }

            const normalizedField = field.trim().replace(/[_-\s]+([a-zA-Z0-9])/g, (_, char: string) =>
                char.toUpperCase()
            )
            const normalizedMessage = message.trim()

            if (!normalizedField || !normalizedMessage || fieldErrors[normalizedField]) {
                continue
            }

            fieldErrors[normalizedField] = normalizedMessage
        }
    }

    if (isPlainObject(raw)) {
        for (const [rawField, rawMessage] of Object.entries(raw)) {
            if (
                rawField === 'message' ||
                rawField === 'ok' ||
                rawField === 'status'
            ) {
                continue
            }

            if (typeof rawMessage !== 'string') {
                continue
            }

            const normalizedField = rawField
                .trim()
                .replace(/[_-\s]+([a-zA-Z0-9])/g, (_, char: string) => char.toUpperCase())
            const normalizedMessage = rawMessage.trim()

            if (!normalizedField || !normalizedMessage || fieldErrors[normalizedField]) {
                continue
            }

            fieldErrors[normalizedField] = normalizedMessage
        }
    }

    return Object.keys(fieldErrors).length > 0 ? fieldErrors : undefined
}

function extractErrorFieldErrors(data: unknown) {
    if (!data || typeof data !== 'object') {
        return undefined
    }

    const parsed = data as { fieldErrors?: unknown; details?: unknown; errors?: unknown }

    if (parsed.fieldErrors !== undefined) {
        const normalized = normalizeFieldErrors(parsed.fieldErrors)

        if (normalized) {
            return normalized
        }
    }

    if (parsed.details !== undefined) {
        const normalized = normalizeFieldErrors(parsed.details)

        if (normalized) {
            return normalized
        }
    }

    return normalizeFieldErrors(parsed.errors)
}

export class ApiError extends Error {
    status: number
    details?: unknown
    fieldErrors?: Record<string, string>

    constructor(
        message: string,
        status = 500,
        details?: unknown,
        fieldErrors?: Record<string, string>
    ) {
        super(message)
        this.name = 'ApiError'
        this.status = status
        this.details = details
        this.fieldErrors = fieldErrors
    }
}

export function onAdminSessionInvalidated(
    listener: (payload: AdminSessionInvalidationPayload) => void
) {
    const handler = (event: Event) => {
        const customEvent = event as CustomEvent<AdminSessionInvalidationPayload>
        listener(customEvent.detail)
    }

    adminSessionEvents.addEventListener(ADMIN_SESSION_INVALIDATED_EVENT, handler)

    return () => {
        adminSessionEvents.removeEventListener(ADMIN_SESSION_INVALIDATED_EVENT, handler)
    }
}

function emitAdminSessionInvalidated(message: string) {
    adminSessionEvents.dispatchEvent(
        new CustomEvent<AdminSessionInvalidationPayload>(ADMIN_SESSION_INVALIDATED_EVENT, {
            detail: {
                reason: resolveAdminSessionInvalidationReason(message),
                message,
            },
        })
    )
}

export async function apiRequest<T>(
    endpoint: string,
    options: ApiRequestOptions = {}
): Promise<T> {
    if (typeof endpoint !== 'string' || endpoint.trim().length === 0) {
        throw new ApiError('La ruta de la petición es obligatoria', 500)
    }

    const { baseUrl, timeoutMs: requestTimeoutMs, ...requestOptions } = options
    const headers = new Headers(requestOptions.headers ?? {})

    if (shouldSetJsonContentType(requestOptions.body, headers)) {
        headers.set('Content-Type', 'application/json')
    }

    const requestUrl = buildRequestUrl(endpoint.trim(), baseUrl ?? API_BASE_URL)
    const timeoutMs = resolveTimeoutMs(requestTimeoutMs)
    const sourceSignal = requestOptions.signal ?? null
    const timeoutController = timeoutMs ? new AbortController() : null

    let timeoutId: ReturnType<typeof setTimeout> | null = null
    let timeoutTriggered = false
    let relayAbortFromSourceSignal: (() => void) | null = null

    if (timeoutController && timeoutMs !== null) {
        if (sourceSignal?.aborted) {
            timeoutController.abort()
        } else if (sourceSignal) {
            relayAbortFromSourceSignal = () => {
                timeoutController.abort()
            }

            sourceSignal.addEventListener('abort', relayAbortFromSourceSignal, { once: true })
        }

        timeoutId = setTimeout(() => {
            timeoutTriggered = true
            timeoutController.abort()
        }, timeoutMs)
    }

    let response: Response

    try {
        response = await fetch(requestUrl, {
            ...requestOptions,
            credentials: requestOptions.credentials ?? 'include',
            headers,
            signal: timeoutController ? timeoutController.signal : sourceSignal,
        })
    } catch (error) {
        if (timeoutTriggered) {
            throw new ApiError(DEFAULT_TIMEOUT_ERROR, 0, error)
        }

        throw new ApiError(DEFAULT_CONNECTION_ERROR, 0, error)
    } finally {
        if (timeoutId !== null) {
            clearTimeout(timeoutId)
        }

        if (sourceSignal && relayAbortFromSourceSignal) {
            sourceSignal.removeEventListener('abort', relayAbortFromSourceSignal)
        }
    }

    const data = await parseResponseData(response)

    if (!response.ok) {
        const errorMessage = extractErrorMessage(data)

        if (
            response.status === 401 &&
            isAdminSessionInvalidationCandidateEndpoint(endpoint) &&
            isSessionReauthMessage(errorMessage)
        ) {
            emitAdminSessionInvalidated(errorMessage)
        }

        throw new ApiError(
            errorMessage,
            response.status,
            extractErrorDetails(data),
            extractErrorFieldErrors(data)
        )
    }

    return data as T
}
