import { io } from "socket.io-client";
import type { TotemQuestionModeSocketPayload } from "../../../types/totemClient";

type QuestionModeListener = (payload: TotemQuestionModeSocketPayload) => void;
type EmergencyListener = (payload: { title?: string; message: string; notificationId?: number; durationSeconds?: number | null; emittedAt?: string }) => void;
type NotificationsUpdatedListener = (payload: { action?: string; notificationId?: number; emittedAt?: string }) => void;
type ContentsUpdatedListener = (payload: { action?: string; contentId?: number; totemIds?: number[]; emittedAt?: string }) => void;
type SessionInvalidationListener = () => void;

const REALTIME_BASE_URL =
  typeof import.meta.env.VITE_API_URL === "string" &&
  import.meta.env.VITE_API_URL.trim().length > 0
    ? import.meta.env.VITE_API_URL.trim()
    : undefined;

function shouldInvalidateSession(errorCode: string | undefined) {
  if (!errorCode) {
    return false;
  }

  return [
    "TOTEM_ACCESS_TOKEN_REQUIRED",
    "TOTEM_ACCESS_TOKEN_INVALID",
    "TOTEM_ACCESS_TOKEN_EXPIRED",
    "TOTEM_ACCESS_REVOKED",
    "TOTEM_INACTIVE",
  ].includes(errorCode);
}

export function connectTotemClientRealtime(
  accessToken: string,
  onQuestionModeMessage: QuestionModeListener,
  onEmergencyMessage?: EmergencyListener,
  onNotificationsUpdated?: NotificationsUpdatedListener,
  onContentsUpdated?: ContentsUpdatedListener,
  onSessionInvalidated?: SessionInvalidationListener,
) {
  const socket = io(REALTIME_BASE_URL, {
    withCredentials: true,
    timeout: 5000,
    reconnectionAttempts: 5,
    reconnectionDelay: 2000,
    auth: {
      accessToken,
    },
  });

  socket.on("totem:question-mode", (payload: TotemQuestionModeSocketPayload) => {
    onQuestionModeMessage(payload);
  });

  if (onEmergencyMessage) {
    socket.on("totem:emergency", (payload: { title?: string; message: string; notificationId?: number; durationSeconds?: number | null; emittedAt?: string }) => {
      onEmergencyMessage(payload);
    });
  }

  if (onNotificationsUpdated) {
    socket.on("totem:notifications-updated", (payload: { action?: string; notificationId?: number; emittedAt?: string }) => {
      onNotificationsUpdated(payload);
    });
  }

  if (onContentsUpdated) {
    socket.on("totem:contents-updated", (payload: { action?: string; contentId?: number; totemIds?: number[]; emittedAt?: string }) => {
      onContentsUpdated(payload);
    });
  }

  if (onSessionInvalidated) {
    socket.on("connect_error", (error: Error) => {
      if (shouldInvalidateSession(error.message)) {
        onSessionInvalidated();
      }
    });
  }

  return () => {
    socket.off("totem:question-mode");
    socket.off("totem:emergency");
    socket.off("totem:notifications-updated");
    socket.off("totem:contents-updated");
    socket.off("connect_error");
    socket.disconnect();
  };
}
