import { ApiError, apiRequest } from "../../../services/api";
import type { ApiItemResponse } from "../../../types/totem";
import type {
  TotemClientAuthData,
  TotemClientSession,
  TotemClientSessionInvalidationReason,
} from "../../../types/totemClient";
import {
  clearTotemClientSession,
  getTotemClientSession,
  isTokenExpiringAt,
  saveTotemClientSession,
} from "./totemClientSession.service";

const SESSION_CHANGED_EVENT = "totem-client:session-changed";
const SESSION_INVALIDATED_EVENT = "totem-client:session-invalidated";
const ACCESS_TOKEN_REFRESH_THRESHOLD_MS = 30_000;

const sessionEvents = new EventTarget();
let refreshInFlightPromise: Promise<TotemClientSession | null> | null = null;

type TotemClientSessionRequestOptions = RequestInit & {
  retryOnUnauthorized?: boolean;
};

function emitSessionChanged(session: TotemClientSession | null) {
  sessionEvents.dispatchEvent(
    new CustomEvent<TotemClientSession | null>(SESSION_CHANGED_EVENT, {
      detail: session,
    }),
  );
}

function emitSessionInvalidated(reason: TotemClientSessionInvalidationReason) {
  sessionEvents.dispatchEvent(
    new CustomEvent<TotemClientSessionInvalidationReason>(
      SESSION_INVALIDATED_EVENT,
      {
        detail: reason,
      },
    ),
  );
}

function mapAuthDataToSession(data: TotemClientAuthData): TotemClientSession {
  return {
    totem: data.totem,
    accessToken: data.session.accessToken,
    refreshToken: data.session.refreshToken,
    accessTokenExpiresAt: data.session.accessTokenExpiresAt,
    refreshTokenExpiresAt: data.session.refreshTokenExpiresAt,
    linkedAt: data.linkedAt,
  };
}

function withAccessTokenHeader(
  session: TotemClientSession,
  headersInput: HeadersInit | undefined,
) {
  const headers = new Headers(headersInput ?? {});
  headers.set("Authorization", `Bearer ${session.accessToken}`);
  return headers;
}

export function getTotemClientSessionSnapshot() {
  return getTotemClientSession();
}

export function onTotemClientSessionChanged(
  listener: (session: TotemClientSession | null) => void,
) {
  const handler = (event: Event) => {
    const customEvent = event as CustomEvent<TotemClientSession | null>;
    listener(customEvent.detail);
  };

  sessionEvents.addEventListener(SESSION_CHANGED_EVENT, handler);

  return () => {
    sessionEvents.removeEventListener(SESSION_CHANGED_EVENT, handler);
  };
}

export function onTotemClientSessionInvalidated(
  listener: (reason: TotemClientSessionInvalidationReason) => void,
) {
  const handler = (event: Event) => {
    const customEvent =
      event as CustomEvent<TotemClientSessionInvalidationReason>;
    listener(customEvent.detail);
  };

  sessionEvents.addEventListener(SESSION_INVALIDATED_EVENT, handler);

  return () => {
    sessionEvents.removeEventListener(SESSION_INVALIDATED_EVENT, handler);
  };
}

export function invalidateTotemClientSession(
  reason: TotemClientSessionInvalidationReason,
) {
  clearTotemClientSession();
  emitSessionChanged(null);
  emitSessionInvalidated(reason);
}

export async function linkTotemClientDevice(linkCode: string) {
  const normalizedLinkCode =
    typeof linkCode === "string"
      ? linkCode.toUpperCase().replace(/[\s-]+/g, "").trim()
      : "";

  if (!normalizedLinkCode) {
    throw new ApiError("El código temporal es obligatorio", 422);
  }

  const response = await apiRequest<ApiItemResponse<TotemClientAuthData>>(
    "/client/totem/link",
    {
      method: "POST",
      body: JSON.stringify({ linkCode: normalizedLinkCode }),
    },
  );

  const session = mapAuthDataToSession(response.data);
  saveTotemClientSession(session);
  emitSessionChanged(session);

  return session;
}

async function refreshTotemClientSessionInternal() {
  const currentSession = getTotemClientSession();

  if (!currentSession) {
    invalidateTotemClientSession("storage_cleared");
    return null;
  }

  if (isTokenExpiringAt(currentSession.refreshTokenExpiresAt, 0)) {
    invalidateTotemClientSession("refresh_failed");
    return null;
  }

  try {
    const response = await apiRequest<ApiItemResponse<TotemClientAuthData>>(
      "/client/totem/session/refresh",
      {
        method: "POST",
        body: JSON.stringify({ refreshToken: currentSession.refreshToken }),
      },
    );

    const refreshedSession = mapAuthDataToSession(response.data);
    saveTotemClientSession(refreshedSession);
    emitSessionChanged(refreshedSession);
    return refreshedSession;
  } catch (error) {
    if (error instanceof ApiError && error.status === 403) {
      invalidateTotemClientSession("forbidden");
      return null;
    }

    invalidateTotemClientSession("refresh_failed");
    return null;
  }
}

export async function refreshTotemClientSession() {
  if (refreshInFlightPromise) {
    return refreshInFlightPromise;
  }

  refreshInFlightPromise = refreshTotemClientSessionInternal().finally(() => {
    refreshInFlightPromise = null;
  });

  return refreshInFlightPromise;
}

export async function ensureTotemClientSessionFresh() {
  const session = getTotemClientSession();

  if (!session) {
    return null;
  }

  if (!isTokenExpiringAt(session.accessTokenExpiresAt, ACCESS_TOKEN_REFRESH_THRESHOLD_MS)) {
    return session;
  }

  return refreshTotemClientSession();
}

export async function unlinkTotemClientDevice() {
  const session = getTotemClientSession();

  if (session) {
    try {
      await apiRequest<ApiItemResponse<{ revokedAt: string }>>(
        "/client/totem/session/unlink",
        {
          method: "POST",
          headers: withAccessTokenHeader(session, undefined),
        },
      );
    } catch {
      // La desvinculacion local debe continuar aunque falle la peticion remota.
    }
  }

  invalidateTotemClientSession("manual_unlink");
}

export async function totemClientApiRequestWithSession<T>(
  endpoint: string,
  options: TotemClientSessionRequestOptions = {},
): Promise<T> {
  const { retryOnUnauthorized = true, ...requestOptions } = options;
  const currentSession = await ensureTotemClientSessionFresh();

  if (!currentSession) {
    invalidateTotemClientSession("storage_cleared");
    throw new ApiError("El dispositivo no está vinculado", 401);
  }

  try {
    return await apiRequest<T>(endpoint, {
      ...requestOptions,
      headers: withAccessTokenHeader(currentSession, requestOptions.headers),
    });
  } catch (error) {
    if (error instanceof ApiError && error.status === 403) {
      invalidateTotemClientSession("forbidden");
      throw error;
    }

    if (
      error instanceof ApiError &&
      error.status === 401 &&
      retryOnUnauthorized
    ) {
      const refreshedSession = await refreshTotemClientSession();

      if (!refreshedSession) {
        throw error;
      }

      return totemClientApiRequestWithSession<T>(endpoint, {
        ...requestOptions,
        retryOnUnauthorized: false,
      });
    }

    if (error instanceof ApiError && error.status === 401) {
      invalidateTotemClientSession("unauthorized");
    }

    throw error;
  }
}
