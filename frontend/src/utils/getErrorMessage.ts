import { ApiError } from "../services/api";
import {
    getAdminSessionNoticeMessage,
    isSessionReauthMessage,
    resolveAdminSessionInvalidationReason,
} from "./sessionReauth";

export function getErrorMessage(
    error: unknown,
    fallback = "Ocurrió un error inesperado"
): string {
    if (error instanceof ApiError && error.status === 401) {
        const normalizedMessage = error.message.trim();

        if (isSessionReauthMessage(normalizedMessage)) {
            return getAdminSessionNoticeMessage(
                resolveAdminSessionInvalidationReason(normalizedMessage)
            );
        }
    }

    if (error instanceof Error) {
        return error.message;
    }

    return fallback;
}
