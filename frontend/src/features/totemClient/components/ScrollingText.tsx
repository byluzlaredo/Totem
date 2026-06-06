import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ElementType } from "react";

type ScrollingTextTag = "span" | "p" | "div" | "h1" | "h2" | "h3";

export interface ScrollingTextTiming {
  isOverflowing: boolean;
  distancePx: number;
  travelDurationMs: number;
  cycleDurationMs: number;
}

interface SharedScrollingTextProps {
  value: string | null | undefined;
  fallback?: string;
  as?: ScrollingTextTag;
  className?: string;
  containerClassName?: string;
  speedPxPerSecond?: number;
  startDelayMs?: number;
  endDelayMs?: number;
  gapPx?: number;
  loop?: boolean;
  resetToStartOnComplete?: boolean;
  onOverflowChange?: (isOverflowing: boolean) => void;
  onTimingChange?: (timing: ScrollingTextTiming) => void;
  onScrollComplete?: () => void;
}

interface InternalScrollingTextProps extends SharedScrollingTextProps {
  direction: "horizontal" | "vertical";
}

const DEFAULT_HORIZONTAL_SPEED = 46;
const DEFAULT_VERTICAL_SPEED = 34;
const DEFAULT_START_DELAY_MS = 700;
const DEFAULT_END_DELAY_MS = 700;
const DEFAULT_GAP_PX = 40;
const MIN_ANIMATION_DURATION_MS = 1200;

const EMPTY_SCROLLING_TIMING: ScrollingTextTiming = {
  isOverflowing: false,
  distancePx: 0,
  travelDurationMs: 0,
  cycleDurationMs: 0,
};

function mergeClassNames(...classNames: Array<string | false | null | undefined>) {
  return classNames.filter(Boolean).join(" ");
}

function usePrefersReducedMotion() {
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
      return;
    }

    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    const updatePreference = () => {
      setPrefersReducedMotion(mediaQuery.matches);
    };

    updatePreference();

    if (typeof mediaQuery.addEventListener === "function") {
      mediaQuery.addEventListener("change", updatePreference);
      return () => {
        mediaQuery.removeEventListener("change", updatePreference);
      };
    }

    mediaQuery.addListener(updatePreference);
    return () => {
      mediaQuery.removeListener(updatePreference);
    };
  }, []);

  return prefersReducedMotion;
}

function resolveDisplayText(value: string | null | undefined, fallback: string) {
  const normalizedValue = typeof value === "string" ? value.trim() : "";
  if (normalizedValue.length > 0) {
    return normalizedValue;
  }

  return fallback;
}

function calculateTravelDurationMs(distancePx: number, speedPxPerSecond: number) {
  if (distancePx <= 0 || speedPxPerSecond <= 0) {
    return 0;
  }

  return Math.ceil((distancePx / speedPxPerSecond) * 1000);
}

function createHorizontalTransform(offsetPx: number) {
  return `translate3d(${offsetPx}px, 0, 0)`;
}

function createVerticalTransform(offsetPx: number) {
  return `translate3d(0, ${offsetPx}px, 0)`;
}

function InternalScrollingText({
  value,
  fallback = "",
  as = "p",
  className = "",
  containerClassName = "",
  speedPxPerSecond,
  startDelayMs = DEFAULT_START_DELAY_MS,
  endDelayMs = DEFAULT_END_DELAY_MS,
  gapPx = DEFAULT_GAP_PX,
  loop = true,
  resetToStartOnComplete = false,
  onOverflowChange,
  onTimingChange,
  onScrollComplete,
  direction,
}: InternalScrollingTextProps) {
  const prefersReducedMotion = usePrefersReducedMotion();
  const animationRef = useRef<Animation | null>(null);
  const measurementFrameRef = useRef<number | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const trackRef = useRef<HTMLDivElement | null>(null);
  const primaryTextRef = useRef<HTMLElement | null>(null);
  const onOverflowChangeRef = useRef(onOverflowChange);
  const onTimingChangeRef = useRef(onTimingChange);
  const onScrollCompleteRef = useRef(onScrollComplete);
  const [isOverflowing, setIsOverflowing] = useState(false);

  const displayText = useMemo(
    () => resolveDisplayText(value, fallback),
    [fallback, value],
  );
  const resolvedSpeedPxPerSecond = Math.max(
    12,
    speedPxPerSecond ?? (direction === "horizontal" ? DEFAULT_HORIZONTAL_SPEED : DEFAULT_VERTICAL_SPEED),
  );
  const resolvedGapPx = Math.max(12, gapPx);
  const Tag = as as ElementType;

  useEffect(() => {
    onOverflowChangeRef.current = onOverflowChange;
  }, [onOverflowChange]);

  useEffect(() => {
    onTimingChangeRef.current = onTimingChange;
  }, [onTimingChange]);

  useEffect(() => {
    onScrollCompleteRef.current = onScrollComplete;
  }, [onScrollComplete]);

  const clearAnimation = useCallback(() => {
    if (animationRef.current) {
      animationRef.current.cancel();
      animationRef.current = null;
    }

    if (trackRef.current) {
      const resetTransform =
        direction === "horizontal"
          ? createHorizontalTransform(0)
          : createVerticalTransform(0);
      trackRef.current.style.transform = resetTransform;
    }
  }, [direction]);

  const publishTiming = useCallback((timing: ScrollingTextTiming) => {
    onTimingChangeRef.current?.(timing);
  }, []);

  const publishOverflowState = useCallback((nextOverflowing: boolean) => {
    setIsOverflowing((previous) => {
      if (previous === nextOverflowing) {
        return previous;
      }

      return nextOverflowing;
    });
    onOverflowChangeRef.current?.(nextOverflowing);
  }, []);

  const measureAndAnimate = useCallback(() => {
    const container = containerRef.current;
    const primaryText = primaryTextRef.current;
    const track = trackRef.current;

    if (!container || !primaryText || !track) {
      publishOverflowState(false);
      publishTiming(EMPTY_SCROLLING_TIMING);
      clearAnimation();
      return;
    }

    const containerSize =
      direction === "horizontal" ? container.clientWidth : container.clientHeight;
    const textSize =
      direction === "horizontal" ? primaryText.scrollWidth : primaryText.scrollHeight;

    if (containerSize <= 0 || textSize <= 0) {
      publishOverflowState(false);
      publishTiming(EMPTY_SCROLLING_TIMING);
      clearAnimation();
      return;
    }

    const overflowDistancePx = Math.max(0, textSize - containerSize);
    const shouldAnimate = overflowDistancePx > 1 && !prefersReducedMotion;
    const travelDistancePx = shouldAnimate
      ? loop
        ? textSize + resolvedGapPx
        : overflowDistancePx
      : 0;
    const travelDurationMs = shouldAnimate
      ? calculateTravelDurationMs(travelDistancePx, resolvedSpeedPxPerSecond)
      : 0;
    const cycleDurationMs = shouldAnimate
      ? startDelayMs + travelDurationMs + (loop ? 0 : endDelayMs)
      : 0;

    publishOverflowState(shouldAnimate);
    publishTiming({
      isOverflowing: shouldAnimate,
      distancePx: travelDistancePx,
      travelDurationMs,
      cycleDurationMs,
    });
    clearAnimation();

    if (!shouldAnimate || travelDurationMs === 0) {
      return;
    }

    if (typeof track.animate !== "function") {
      return;
    }

    const totalDurationMs = Math.max(
      MIN_ANIMATION_DURATION_MS,
      startDelayMs + travelDurationMs + (loop ? 0 : endDelayMs),
    );
    const startHoldOffset = Math.min(0.85, startDelayMs / totalDurationMs);
    const endTravelOffset = Math.max(
      startHoldOffset,
      Math.min(0.985, (startDelayMs + travelDurationMs) / totalDurationMs),
    );
    const destinationTransform =
      direction === "horizontal"
        ? createHorizontalTransform(-travelDistancePx)
        : createVerticalTransform(-travelDistancePx);
    const initialTransform =
      direction === "horizontal"
        ? createHorizontalTransform(0)
        : createVerticalTransform(0);

    const keyframes = loop
      ? [
        { transform: initialTransform, offset: 0 },
        { transform: initialTransform, offset: startHoldOffset },
        { transform: destinationTransform, offset: 1 },
      ]
      : [
        { transform: initialTransform, offset: 0 },
        { transform: initialTransform, offset: startHoldOffset },
        { transform: destinationTransform, offset: endTravelOffset },
        { transform: destinationTransform, offset: 1 },
      ];

    const animation = track.animate(keyframes, {
      duration: totalDurationMs,
      easing: "linear",
      iterations: loop ? Number.POSITIVE_INFINITY : 1,
      fill: loop ? "none" : "forwards",
    });

    if (!loop) {
      animation.onfinish = () => {
        if (resetToStartOnComplete && trackRef.current) {
          trackRef.current.style.transform = initialTransform;
        }
        onScrollCompleteRef.current?.();
      };
    }

    animationRef.current = animation;
  }, [
    clearAnimation,
    direction,
    endDelayMs,
    loop,
    prefersReducedMotion,
    publishOverflowState,
    publishTiming,
    resolvedGapPx,
    resolvedSpeedPxPerSecond,
    startDelayMs,
    resetToStartOnComplete,
  ]);

  useEffect(() => {
    const scheduleMeasurement = () => {
      if (measurementFrameRef.current !== null) {
        window.cancelAnimationFrame(measurementFrameRef.current);
      }

      measurementFrameRef.current = window.requestAnimationFrame(() => {
        measurementFrameRef.current = null;
        measureAndAnimate();
      });
    };

    scheduleMeasurement();

    const resizeObserver =
      typeof ResizeObserver !== "undefined"
        ? new ResizeObserver(() => {
          scheduleMeasurement();
        })
        : null;

    if (resizeObserver) {
      if (containerRef.current) {
        resizeObserver.observe(containerRef.current);
      }
      if (primaryTextRef.current) {
        resizeObserver.observe(primaryTextRef.current);
      }
    }

    window.addEventListener("resize", scheduleMeasurement);

    return () => {
      if (measurementFrameRef.current !== null) {
        window.cancelAnimationFrame(measurementFrameRef.current);
        measurementFrameRef.current = null;
      }

      window.removeEventListener("resize", scheduleMeasurement);
      resizeObserver?.disconnect();
      clearAnimation();
    };
  }, [clearAnimation, displayText, measureAndAnimate]);

  const showDuplicate = loop && isOverflowing;

  return (
    <div
      ref={containerRef}
      className={mergeClassNames("relative min-w-0 overflow-hidden", containerClassName)}
    >
      <div
        ref={trackRef}
        className={mergeClassNames(
          "relative min-w-full will-change-transform",
          direction === "horizontal"
            ? "inline-flex items-center"
            : "flex min-h-full w-full flex-col items-stretch",
        )}
      >
        <Tag
          ref={(node: HTMLElement | null) => {
            primaryTextRef.current = node;
          }}
          className={mergeClassNames(
            direction === "horizontal"
              ? "shrink-0 whitespace-nowrap"
              : "w-full whitespace-pre-wrap wrap-anywhere",
            className,
          )}
        >
          {displayText}
        </Tag>

        {showDuplicate ? (
          direction === "horizontal" ? (
            <>
              <span
                aria-hidden
                className="shrink-0"
                style={{ width: `${resolvedGapPx}px` }}
              />
              <Tag
                aria-hidden
                className={mergeClassNames("shrink-0 whitespace-nowrap", className)}
              >
                {displayText}
              </Tag>
            </>
          ) : (
            <>
              <div
                aria-hidden
                className="shrink-0"
                style={{ height: `${resolvedGapPx}px` }}
              />
              <Tag
                aria-hidden
                className={mergeClassNames(
                  "w-full whitespace-pre-wrap wrap-anywhere",
                  className,
                )}
              >
                {displayText}
              </Tag>
            </>
          )
        ) : null}
      </div>
    </div>
  );
}

export function HorizontalScrollingText(props: SharedScrollingTextProps) {
  return <InternalScrollingText {...props} direction="horizontal" />;
}

export function VerticalScrollingText(props: SharedScrollingTextProps) {
  return <InternalScrollingText {...props} direction="vertical" />;
}
