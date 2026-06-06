import type { Notification } from "../../../types/notification";

export type NotificationRemainingState =
  | "inactive"
  | "pending"
  | "running"
  | "finished"
  | "invalid";

export interface NotificationRemainingInfo {
  state: NotificationRemainingState;
  remainingSeconds: number;
  label: string;
}

function parseDateToMs(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  const parsedMs = Date.parse(value);
  return Number.isNaN(parsedMs) ? null : parsedMs;
}

type NotificationRemainingDisplayMode = "list" | "detail";

function pad2(value: number) {
  return String(Math.max(0, Math.floor(value))).padStart(2, "0");
}

function formatRemainingDuration(
  seconds: number,
  displayMode: NotificationRemainingDisplayMode,
) {
  if (seconds <= 0) {
    return "Finalizada";
  }

  if (displayMode === "detail") {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const remaining = seconds % 60;

    if (hours > 0) {
      return `${hours}:${pad2(minutes)}:${pad2(remaining)}`;
    }

    return `${minutes}:${pad2(remaining)}`;
  }

  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remaining = seconds % 60;

  if (days > 0) {
    return `${days}d ${pad2(hours)}h ${pad2(minutes)}m ${pad2(remaining)}s`;
  }

  if (hours > 0) {
    return `${hours}h ${pad2(minutes)}m ${pad2(remaining)}s`;
  }

  if (minutes > 0) {
    return `${minutes}m ${pad2(remaining)}s`;
  }

  return `${remaining}s`;
}

export function resolveNotificationRemainingInfo(
  notification: Notification,
  nowMs = Date.now(),
  displayMode: NotificationRemainingDisplayMode = "list",
): NotificationRemainingInfo {
  if (notification.status !== "active") {
    return {
      state: "inactive",
      remainingSeconds: 0,
      label: "Inactiva",
    };
  }

  const startAtMs = parseDateToMs(notification.startAt ?? notification.createdAt);
  const endAtMs = parseDateToMs(notification.endAt);

  if (endAtMs === null) {
    return {
      state: "invalid",
      remainingSeconds: 0,
      label: "Sin fecha de fin",
    };
  }

  if (startAtMs !== null && nowMs < startAtMs) {
    return {
      state: "pending",
      remainingSeconds: 0,
      label: "Todavía no inicia",
    };
  }

  const remainingSeconds = Math.max(0, Math.floor((endAtMs - nowMs) / 1000));

  if (remainingSeconds <= 0) {
    return {
      state: "finished",
      remainingSeconds: 0,
      label: "Finalizada",
    };
  }

  return {
    state: "running",
    remainingSeconds,
    label: formatRemainingDuration(remainingSeconds, displayMode),
  };
}
