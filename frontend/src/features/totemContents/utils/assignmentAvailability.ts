export type TemporalStatus = "active" | "inactive" | "scheduled" | "expired";
export type ManualTemporalStatus = "active" | "inactive";
export type RemainingValidityTone = "neutral" | "positive" | "warning" | "expired";

export interface RemainingValiditySummary {
  label: string;
  tone: RemainingValidityTone;
}

function parseValidDate(value: string | Date | null | undefined) {
  if (!value) {
    return null;
  }

  const parsedDate = value instanceof Date ? value : new Date(value);

  if (Number.isNaN(parsedDate.getTime())) {
    return null;
  }

  return parsedDate;
}

function toStartOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function getCalendarDayDifference(target: Date, base: Date) {
  const targetDate = toStartOfDay(target);
  const baseDate = toStartOfDay(base);
  const oneDayMs = 24 * 60 * 60 * 1000;

  return Math.round((targetDate.getTime() - baseDate.getTime()) / oneDayMs);
}

export function isContentScheduledAt(
  startAt: string | null | undefined,
  now: Date = new Date(),
) {
  const parsedStartAt = parseValidDate(startAt);
  const parsedNow = parseValidDate(now) ?? new Date();

  if (!parsedStartAt) {
    return false;
  }

  return parsedNow.getTime() < parsedStartAt.getTime();
}

export function isContentExpiredAt(
  endAt: string | null | undefined,
  now: Date = new Date(),
) {
  const parsedEndAt = parseValidDate(endAt);
  const parsedNow = parseValidDate(now) ?? new Date();

  if (!parsedEndAt) {
    return false;
  }

  return parsedNow.getTime() > parsedEndAt.getTime();
}

export function resolveComputedTemporalStatus(
  status: ManualTemporalStatus,
  startAt: string | null | undefined,
  endAt: string | null | undefined,
  now: Date = new Date(),
): TemporalStatus {
  if (status !== "active") {
    return "inactive";
  }

  if (isContentScheduledAt(startAt, now)) {
    return "scheduled";
  }

  if (isContentExpiredAt(endAt, now)) {
    return "expired";
  }

  return "active";
}

export function formatDateTime(
  value: string | null | undefined,
  fallback = "Sin registro",
) {
  if (!value) {
    return fallback;
  }

  const parsedDate = parseValidDate(value);

  if (!parsedDate) {
    return value;
  }

  return parsedDate.toLocaleString("es-BO", {
    dateStyle: "short",
    timeStyle: "short",
  });
}

export function resolveRemainingValiditySummary(
  endAt: string | null | undefined,
  now: Date = new Date(),
): RemainingValiditySummary {
  const parsedEndAt = parseValidDate(endAt);
  const parsedNow = parseValidDate(now) ?? new Date();

  if (!parsedEndAt) {
    return {
      label: "Sin fecha de expiración",
      tone: "neutral",
    };
  }

  const dayDifference = getCalendarDayDifference(parsedEndAt, parsedNow);

  if (parsedNow.getTime() > parsedEndAt.getTime()) {
    if (dayDifference === 0) {
      return {
        label: "Expiró hoy",
        tone: "expired",
      };
    }

    const expiredDays = Math.abs(dayDifference);

    return {
      label: `Expiró hace ${expiredDays} ${expiredDays === 1 ? "día" : "días"}`,
      tone: "expired",
    };
  }

  if (dayDifference === 0) {
    return {
      label: "Expira hoy",
      tone: "warning",
    };
  }

  if (dayDifference === 1) {
    return {
      label: "Expira en 1 día",
      tone: "positive",
    };
  }

  return {
    label: `Expira en ${dayDifference} días`,
    tone: "positive",
  };
}
