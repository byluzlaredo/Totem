import type { TotemClientSession } from "../../../types/totemClient";

const STORAGE_KEY = "totem-client:session:v1";

let memorySessionCache: TotemClientSession | null = null;

function isBrowser() {
  return typeof window !== "undefined";
}

function isValidDateString(value: string) {
  const parsedTimestamp = Date.parse(value);
  return Number.isFinite(parsedTimestamp);
}

function isValidSessionShape(value: unknown): value is TotemClientSession {
  if (!value || typeof value !== "object") {
    return false;
  }

  const parsed = value as Partial<TotemClientSession>;

  if (
    typeof parsed.accessToken !== "string" ||
    parsed.accessToken.trim().length === 0
  ) {
    return false;
  }

  if (
    typeof parsed.refreshToken !== "string" ||
    parsed.refreshToken.trim().length === 0
  ) {
    return false;
  }

  if (
    typeof parsed.accessTokenExpiresAt !== "string" ||
    !isValidDateString(parsed.accessTokenExpiresAt)
  ) {
    return false;
  }

  if (
    typeof parsed.refreshTokenExpiresAt !== "string" ||
    !isValidDateString(parsed.refreshTokenExpiresAt)
  ) {
    return false;
  }

  if (
    typeof parsed.linkedAt !== "string" ||
    !isValidDateString(parsed.linkedAt)
  ) {
    return false;
  }

  if (!parsed.totem || typeof parsed.totem !== "object") {
    return false;
  }

  return true;
}

function readSessionFromStorage() {
  if (!isBrowser()) {
    return null;
  }

  const rawSession = window.localStorage.getItem(STORAGE_KEY);

  if (!rawSession) {
    return null;
  }

  try {
    const parsed = JSON.parse(rawSession) as unknown;
    return isValidSessionShape(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function writeSessionToStorage(session: TotemClientSession | null) {
  if (!isBrowser()) {
    return;
  }

  if (!session) {
    window.localStorage.removeItem(STORAGE_KEY);
    return;
  }

  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
}

export function getTotemClientSession() {
  if (memorySessionCache) {
    return memorySessionCache;
  }

  const session = readSessionFromStorage();
  memorySessionCache = session;
  return session;
}

export function saveTotemClientSession(session: TotemClientSession) {
  memorySessionCache = session;
  writeSessionToStorage(session);
  return session;
}

export function clearTotemClientSession() {
  memorySessionCache = null;
  writeSessionToStorage(null);
}

export function isTokenExpiringAt(
  expiresAt: string,
  thresholdMs = 0,
) {
  const expirationTimeMs = Date.parse(expiresAt);

  if (!Number.isFinite(expirationTimeMs)) {
    return true;
  }

  return expirationTimeMs - Date.now() <= thresholdMs;
}
