import { AlertTriangle, Bell } from "lucide-react";
import { useEffect, useState } from "react";
import type { TotemClientNotification } from "../../../types/totemClient";
import { HorizontalScrollingText } from "./ScrollingText";
import type { ScrollingTextTiming } from "./ScrollingText";

interface NotificationBannerProps {
  notification: TotemClientNotification | null;
  activeIndex?: number;
  className?: string;
  baseDurationMs?: number;
  onDisplayDurationChange?: (durationMs: number) => void;
}

function getIcon(isEmergency: boolean, type: TotemClientNotification["type"]) {
  if (isEmergency || type === "warning" || type === "alert") {
    return <AlertTriangle className="h-4 w-4 text-white" />;
  }

  return <Bell className="h-4 w-4 text-white" />;
}

const EMPTY_SCROLLING_TIMING: ScrollingTextTiming = {
  isOverflowing: false,
  distancePx: 0,
  travelDurationMs: 0,
  cycleDurationMs: 0,
};

function areTimingsEqual(left: ScrollingTextTiming, right: ScrollingTextTiming) {
  return (
    left.isOverflowing === right.isOverflowing &&
    left.distancePx === right.distancePx &&
    left.travelDurationMs === right.travelDurationMs &&
    left.cycleDurationMs === right.cycleDurationMs
  );
}

export default function NotificationBanner({
  notification,
  activeIndex = 0,
  className = "",
  baseDurationMs = 5000,
  onDisplayDurationChange,
}: NotificationBannerProps) {
  const [titleTiming, setTitleTiming] = useState<ScrollingTextTiming>(EMPTY_SCROLLING_TIMING);
  const [messageTiming, setMessageTiming] = useState<ScrollingTextTiming>(EMPTY_SCROLLING_TIMING);
  const hasNotification = Boolean(notification);
  const topLabel = notification?.title?.trim() || "Evento destacado";
  const messageText = notification?.message?.trim() || "Sin detalle disponible.";
  const cycleSignature = notification
    ? `${notification.id}:${activeIndex}:${topLabel}:${messageText}`
    : `no-notification:${activeIndex}`;

  useEffect(() => {
    setTitleTiming(EMPTY_SCROLLING_TIMING);
    setMessageTiming(EMPTY_SCROLLING_TIMING);
  }, [cycleSignature]);

  useEffect(() => {
    if (!onDisplayDurationChange) {
      return;
    }

    if (!hasNotification) {
      onDisplayDurationChange(baseDurationMs);
      return;
    }

    const needsExtendedDuration = titleTiming.isOverflowing || messageTiming.isOverflowing;
    const longestScrollDurationMs = Math.max(
      titleTiming.cycleDurationMs,
      messageTiming.cycleDurationMs,
    );
    const resolvedDurationMs = needsExtendedDuration
      ? Math.max(baseDurationMs, longestScrollDurationMs)
      : baseDurationMs;

    onDisplayDurationChange(resolvedDurationMs);
  }, [baseDurationMs, hasNotification, messageTiming, onDisplayDurationChange, titleTiming]);

  if (!notification) {
    return null;
  }

  const icon = getIcon(notification.isEmergency, notification.type);

  return (
    <article
      key={`totem-notification-${notification.id}-${activeIndex}`}
      className={`min-w-0 overflow-hidden rounded-xl border border-white/35 bg-[linear-gradient(95deg,#d51b56_0%,#b41447_50%,#9a0f3b_100%)] px-3 py-2 text-white shadow-md shadow-black/30 ${className}`}
    >
      <div className="flex items-center gap-2.5">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/16">
          {icon}
        </div>
        <div className="min-w-0 flex-1">
          <HorizontalScrollingText
            key={`notification-title-${cycleSignature}`}
            as="p"
            value={topLabel}
            fallback="Evento destacado"
            className="text-[10px] font-bold uppercase tracking-[0.08em] text-white/75"
            containerClassName="w-full"
            speedPxPerSecond={40}
            startDelayMs={450}
            endDelayMs={650}
            loop
            onTimingChange={(nextTiming) => {
              setTitleTiming((currentTiming) =>
                areTimingsEqual(currentTiming, nextTiming) ? currentTiming : nextTiming,
              );
            }}
          />
          <HorizontalScrollingText
            key={`notification-message-${cycleSignature}`}
            as="p"
            value={messageText}
            fallback="Sin detalle disponible."
            className="text-base font-extrabold leading-tight text-white sm:text-lg"
            containerClassName="w-full"
            speedPxPerSecond={36}
            startDelayMs={520}
            endDelayMs={700}
            loop
            onTimingChange={(nextTiming) => {
              setMessageTiming((currentTiming) =>
                areTimingsEqual(currentTiming, nextTiming) ? currentTiming : nextTiming,
              );
            }}
          />
        </div>
      </div>
    </article>
  );
}
