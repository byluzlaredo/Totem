import { TOTEM_ASSIGNMENT_TYPE_LIMITS } from "../../../constants/totemContent";
import type { Content, ContentType } from "../../../types/content";
import type { Totem } from "../../../types/totem";
import type {
  TotemContent,
  TotemContentFormValues,
} from "../../../types/totemContent";
import { resolveComputedTemporalStatus } from "./assignmentAvailability";
import {
  buildDuplicateTotemContentMessage,
  buildOpenEndedTypeLimitMessage,
  buildTypeOverlapLimitMessage,
  resolveSelectedContentIds,
  resolveSelectedTotemIds,
} from "./totemContent.validators";

interface ValidateTypeLimitsParams {
  values: TotemContentFormValues;
  activeTotems: Totem[];
  activeContents: Content[];
  activeAssignments: TotemContent[];
  editingAssignment?: TotemContent | null;
}

interface TimelineInterval {
  startAtMs: number;
  endAtMs: number;
}

function parseDateToMs(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return parsed.getTime();
}

function normalizeCandidateInterval(values: TotemContentFormValues, nowMs: number): TimelineInterval {
  const startAtMs = parseDateToMs(values.startAt) ?? nowMs;
  const endAtMs = parseDateToMs(values.endAt) ?? Number.POSITIVE_INFINITY;

  return {
    startAtMs,
    endAtMs,
  };
}

function normalizeAssignmentInterval(assignment: TotemContent, nowMs: number): TimelineInterval {
  const startAtMs =
    parseDateToMs(assignment.startAt) ??
    parseDateToMs(assignment.createdAt) ??
    nowMs;
  const endAtMs = parseDateToMs(assignment.endAt) ?? Number.POSITIVE_INFINITY;

  return {
    startAtMs,
    endAtMs,
  };
}

function rangesOverlap(left: TimelineInterval, right: TimelineInterval) {
  return left.startAtMs <= right.endAtMs && right.startAtMs <= left.endAtMs;
}

function isTemporalRecordActiveOrScheduled(
  status: "active" | "inactive",
  startAt: string | null | undefined,
  endAt: string | null | undefined,
  now: Date,
) {
  const computed = resolveComputedTemporalStatus(status, startAt, endAt, now);
  return computed === "active" || computed === "scheduled";
}

function getMaxExistingOverlap(
  existingIntervals: TimelineInterval[],
  candidateInterval: TimelineInterval,
) {
  if (existingIntervals.length === 0) {
    return 0;
  }

  const events: Array<{ at: number; type: "start" | "end" }> = [];

  for (const interval of existingIntervals) {
    if (!rangesOverlap(interval, candidateInterval)) {
      continue;
    }

    const clippedStart = Math.max(interval.startAtMs, candidateInterval.startAtMs);
    const clippedEnd = Math.min(interval.endAtMs, candidateInterval.endAtMs);

    if (clippedStart > clippedEnd) {
      continue;
    }

    events.push({ at: clippedStart, type: "start" });

    if (Number.isFinite(clippedEnd)) {
      events.push({ at: clippedEnd, type: "end" });
    }
  }

  if (events.length === 0) {
    return 0;
  }

  events.sort((left, right) => {
    if (left.at !== right.at) {
      return left.at - right.at;
    }

    if (left.type === right.type) {
      return 0;
    }

    return left.type === "start" ? -1 : 1;
  });

  let running = 0;
  let maxRunning = 0;

  for (const event of events) {
    if (event.type === "start") {
      running += 1;
    } else {
      running -= 1;
    }

    if (running > maxRunning) {
      maxRunning = running;
    }
  }

  return Math.max(0, maxRunning);
}

function hasScheduledOverlap(
  existingIntervals: TimelineInterval[],
  candidateInterval: TimelineInterval,
  nowMs: number,
) {
  return existingIntervals.some((interval) => {
    if (!rangesOverlap(interval, candidateInterval)) {
      return false;
    }

    return interval.startAtMs > nowMs;
  });
}

function getTimelineKey(totemId: number, contentType: ContentType) {
  return `${totemId}:${contentType}`;
}

function getPairKey(totemId: number, contentId: number) {
  return `${totemId}:${contentId}`;
}

export function validateTotemContentTypeLimits({
  values,
  activeTotems,
  activeContents,
  activeAssignments,
  editingAssignment = null,
}: ValidateTypeLimitsParams) {
  const now = new Date();
  const nowMs = now.getTime();
  const activeTotemIds = activeTotems.map((totem) => totem.id);
  const selectedTotemIds = resolveSelectedTotemIds(values, activeTotemIds);
  const selectedContentIds = resolveSelectedContentIds(values);
  const selectedTotemIdsSet = new Set(selectedTotemIds);
  const shouldSkipExistingPairs =
    values.assignmentMode === "multiple" || values.assignmentMode === "all";
  const shouldSkipLimitValidation = shouldSkipExistingPairs;

  if (selectedTotemIds.length === 0 || selectedContentIds.length === 0) {
    return null;
  }

  if (values.status !== "active") {
    return null;
  }

  const contentTypeById = new Map(
    activeContents.map((content) => [content.id, content.contentType]),
  );
  const contentNameById = new Map(
    activeContents.map((content) => [content.id, content.title]),
  );

  const invalidContentIds = selectedContentIds.filter(
    (contentId) => !contentTypeById.has(contentId),
  );

  if (invalidContentIds.length > 0) {
    return "Solo puedes asignar contenidos activos y disponibles.";
  }

  const invalidTotemIds = selectedTotemIds.filter(
    (totemId) => !activeTotemIds.includes(totemId),
  );

  if (invalidTotemIds.length > 0) {
    return "Solo puedes asignar tótems activos y disponibles.";
  }

  const candidateInterval = normalizeCandidateInterval(values, nowMs);
  const isOpenEndedCandidate = !values.endAt;
  const intervalsByPair = new Map<string, TimelineInterval[]>();
  const intervalsByTotemType = new Map<string, TimelineInterval[]>();

  for (const assignment of activeAssignments) {
    if (!selectedTotemIdsSet.has(assignment.totemId)) {
      continue;
    }

    if (editingAssignment && assignment.id === editingAssignment.id) {
      continue;
    }

    const contentType = contentTypeById.get(assignment.contentId);

    if (!contentType) {
      continue;
    }

    if (
      !isTemporalRecordActiveOrScheduled(
        assignment.status,
        assignment.startAt,
        assignment.endAt,
        now,
      )
    ) {
      continue;
    }

    const timelineInterval = normalizeAssignmentInterval(assignment, nowMs);
    const pairKey = getPairKey(assignment.totemId, assignment.contentId);
    const pairIntervals = intervalsByPair.get(pairKey) ?? [];
    pairIntervals.push(timelineInterval);
    intervalsByPair.set(pairKey, pairIntervals);

    const timelineKey = getTimelineKey(assignment.totemId, contentType);
    const typeIntervals = intervalsByTotemType.get(timelineKey) ?? [];
    typeIntervals.push(timelineInterval);
    intervalsByTotemType.set(timelineKey, typeIntervals);
  }

  for (const totemId of selectedTotemIds) {
    const totemName = activeTotems.find((totem) => totem.id === totemId)?.name ?? `#${totemId}`;

    for (const contentId of selectedContentIds) {
      const contentType = contentTypeById.get(contentId);

      if (!contentType) {
        return "No se pudo validar el tipo de contenido seleccionado.";
      }

      const pairKey = getPairKey(totemId, contentId);
      const existingPairIntervals = intervalsByPair.get(pairKey) ?? [];

      if (existingPairIntervals.some((interval) => rangesOverlap(candidateInterval, interval))) {
        if (shouldSkipExistingPairs) {
          continue;
        }

        const contentName = contentNameById.get(contentId) ?? String(contentId);
        return buildDuplicateTotemContentMessage(totemName, contentName);
      }

      const limit = TOTEM_ASSIGNMENT_TYPE_LIMITS[contentType];
      const timelineKey = getTimelineKey(totemId, contentType);
      const typeTimeline = intervalsByTotemType.get(timelineKey) ?? [];
      const maxExistingOverlap = getMaxExistingOverlap(typeTimeline, candidateInterval);

      if (maxExistingOverlap + 1 > limit) {
        if (shouldSkipLimitValidation) {
          continue;
        }

        if (
          isOpenEndedCandidate &&
          hasScheduledOverlap(typeTimeline, candidateInterval, nowMs)
        ) {
          return buildOpenEndedTypeLimitMessage(contentType);
        }

        return buildTypeOverlapLimitMessage(
          totemName,
          contentType,
          maxExistingOverlap,
        );
      }

      const nextTypeTimeline = intervalsByTotemType.get(timelineKey) ?? [];
      nextTypeTimeline.push(candidateInterval);
      intervalsByTotemType.set(timelineKey, nextTypeTimeline);
    }
  }

  return null;
}
