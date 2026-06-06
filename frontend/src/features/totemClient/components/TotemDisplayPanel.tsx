import { CalendarClock } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type {
  TotemClientContent,
  TotemDisplayContentType,
} from "../../../types/totemClient";
import { resolveAssetUrl } from "../../../utils/assetUrl";
import { HorizontalScrollingText } from "./ScrollingText";
import type { ScrollingTextTiming } from "./ScrollingText";

interface TotemDisplayPanelProps {
  type: TotemDisplayContentType;
  items: TotemClientContent[];
  apiBaseUrl?: string;
  className?: string;
  compact?: boolean;
  panelLabel?: string;
}

interface NewsCardProps {
  content: TotemClientContent;
  compact?: boolean;
  apiBaseUrl?: string;
  baseDurationMs: number;
  shouldLoopText?: boolean;
  onRecommendedDurationChange?: (durationMs: number) => void;
}

const ROTATION_MS_BY_TYPE: Record<TotemDisplayContentType, number> = {
  image: 12000,
  video: 20000,
  news: 12000,
  advertisement: 12000,
};

const CONTENT_LABEL_BY_TYPE: Record<TotemDisplayContentType, string> = {
  image: "Imágenes",
  video: "Videos",
  news: "Anuncios",
  advertisement: "Publicidades",
};

const IMAGE_ASSET_PATTERN = /\.(jpg|jpeg|png|webp|gif|bmp|svg)([?#].*)?$/i;
const VIDEO_FALLBACK_ADVANCE_MS = 22000;

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

function isVideoAsset(fileUrl: string | null) {
  if (!fileUrl) {
    return false;
  }

  return /\.(mp4|webm|ogg|mov|avi)(\?.*)?$/i.test(fileUrl);
}

function isImageAsset(fileUrl: string | null) {
  if (!fileUrl) {
    return false;
  }

  return IMAGE_ASSET_PATTERN.test(fileUrl);
}

function renderPanelEmptyState(message: string) {
  return (
    <article className="relative flex h-full min-h-0 items-center justify-center overflow-hidden p-6 text-center">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_14%_16%,rgba(255,59,111,0.18),transparent_42%),radial-gradient(circle_at_88%_88%,rgba(94,39,64,0.32),transparent_40%),linear-gradient(150deg,#151620_0%,#12131b_55%,#0f1118_100%)]" />
      <p className="relative z-10 max-w-sm text-sm font-medium text-(--totem-text-muted)">
        {message}
      </p>
    </article>
  );
}

function renderCompactNewsImageFallback() {
  return (
    <div className="relative h-full w-[28%] min-w-20 overflow-hidden rounded-xl border border-(--totem-border-strong) bg-[linear-gradient(155deg,#1b1d2a_0%,#11141e_62%,#0c0f17_100%)]">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(255,59,111,0.2),transparent_46%)]" />
      <div className="relative z-10 flex h-full flex-col items-center justify-center gap-1.5 p-2 text-center">
        <span className="inline-flex h-14 w-14 items-center justify-center rounded-full border border-(--totem-border-strong) bg-(--totem-surface-3) text-(--totem-accent)">
          <CalendarClock className="h-10 w-10" />
        </span>
        <p className="text-[0.58rem] font-semibold uppercase tracking-[0.08em] text-(--totem-text-muted)">
          Noticia
        </p>
      </div>
    </div>
  );
}

function renderMainNewsImageFallback() {
  return (
    <div className="relative z-10 flex h-[54%] min-h-0 w-full items-center justify-center overflow-hidden p-2">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_20%,rgba(255,59,111,0.2),transparent_44%),linear-gradient(150deg,#1a1c29_0%,#12141d_56%,#0d1019_100%)]" />
      <div className="relative z-10 flex flex-col items-center gap-2.5 text-center text-(--totem-text-muted)">
        <span className="inline-flex h-12 w-12 items-center justify-center rounded-full border border-(--totem-border-strong) bg-(--totem-surface-3) text-(--totem-accent)">
          <CalendarClock className="h-6 w-6" />
        </span>
        <p className="text-xs font-semibold uppercase tracking-widest">
          Sin imagen de anuncio
        </p>
      </div>
    </div>
  );
}

function NewsCard({
  content,
  compact = false,
  apiBaseUrl,
  baseDurationMs,
  shouldLoopText = false,
  onRecommendedDurationChange,
}: NewsCardProps) {
  const assetUrl = resolveAssetUrl(content.fileUrl, apiBaseUrl);
  const titleText = content.title?.trim() || "Sin título";
  const descriptionText = content.description?.trim() || "Sin descripción disponible.";
  const itemSignature = `${content.assignmentId}:${titleText}:${descriptionText}`;
  const [imageLoadFailed, setImageLoadFailed] = useState(false);
  const [titleTiming, setTitleTiming] = useState<ScrollingTextTiming>(EMPTY_SCROLLING_TIMING);
  const [descriptionTiming, setDescriptionTiming] = useState<ScrollingTextTiming>(
    EMPTY_SCROLLING_TIMING,
  );
  const hasDisplayImage = Boolean(assetUrl) && !imageLoadFailed;
  const imageSrc = assetUrl ?? undefined;

  useEffect(() => {
    setTitleTiming(EMPTY_SCROLLING_TIMING);
    setDescriptionTiming(EMPTY_SCROLLING_TIMING);
    setImageLoadFailed(false);
  }, [itemSignature]);

  useEffect(() => {
    if (!onRecommendedDurationChange) {
      return;
    }

    const hasOverflow = titleTiming.isOverflowing || descriptionTiming.isOverflowing;
    const longestScrollDurationMs = Math.max(
      titleTiming.cycleDurationMs,
      descriptionTiming.cycleDurationMs,
    );
    const nextDurationMs = hasOverflow
      ? Math.max(baseDurationMs, longestScrollDurationMs)
      : baseDurationMs;

    onRecommendedDurationChange(nextDurationMs);
  }, [
    baseDurationMs,
    descriptionTiming,
    onRecommendedDurationChange,
    titleTiming,
  ]);

  if (compact) {
    return (
      <article className="relative flex h-full min-h-0 overflow-hidden text-(--totem-text-primary)">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_0%_0%,rgba(255,59,111,0.14),transparent_44%),linear-gradient(170deg,#1a1b26_0%,#13141d_56%,#0f1119_100%)]" />
        <div className="relative z-10 flex h-full w-full min-h-0 gap-3 p-3 lg:p-4">
          {hasDisplayImage ? (
            <div className="relative h-full w-[28%] min-w-20 overflow-hidden rounded-xl border border-(--totem-border-strong) bg-(--totem-surface-1)">
              <img
                src={imageSrc}
                alt=""
                aria-hidden
                className="pointer-events-none absolute inset-0 h-full w-full scale-110 object-cover opacity-45 blur-xl"
                loading="lazy"
                onError={() => {
                  setImageLoadFailed(true);
                }}
              />
              <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(10,10,14,0.1)_0%,rgba(10,10,14,0.5)_100%)]" />
              <img
                src={imageSrc}
                alt={content.title}
                className="relative z-10 h-full w-full object-contain p-1"
                loading="lazy"
                onError={() => {
                  setImageLoadFailed(true);
                }}
              />
            </div>
          ) : renderCompactNewsImageFallback()}

          <div className="min-w-0 flex-1 py-6 overflow-hidden">
            <HorizontalScrollingText
              key={`news-compact-title-${itemSignature}`}
              as="h3"
              value={titleText}
              fallback="Sin título"
              className="text-base font-semibold leading-snug text-(--totem-text-primary) lg:text-log py-3"
              containerClassName="w-full"
              speedPxPerSecond={34}
              startDelayMs={500}
              endDelayMs={700}
              loop={shouldLoopText}
              resetToStartOnComplete
              onTimingChange={(nextTiming) => {
                setTitleTiming((currentTiming) =>
                  areTimingsEqual(currentTiming, nextTiming) ? currentTiming : nextTiming,
                );
              }}
            />
            <HorizontalScrollingText
              key={`news-compact-description-${itemSignature}`}
              as="p"
              value={descriptionText}
              fallback="Sin descripción disponible."
              className="text-base leading-relaxed text-(--totem-text-secondary) lg:text-base"
              containerClassName="mt-1 w-full"
              speedPxPerSecond={32}
              startDelayMs={550}
              endDelayMs={750}
              loop={shouldLoopText}
              resetToStartOnComplete
              onTimingChange={(nextTiming) => {
                setDescriptionTiming((currentTiming) =>
                  areTimingsEqual(currentTiming, nextTiming) ? currentTiming : nextTiming,
                );
              }}
            />
          </div>
        </div>
      </article>
    );
  }

  return (
    <article className="relative flex h-full min-h-0 flex-col overflow-hidden text-(--totem-text-primary)">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_0%_0%,rgba(255,59,111,0.14),transparent_44%),linear-gradient(170deg,#1a1b26_0%,#13141d_56%,#0f1119_100%)]" />
      {hasDisplayImage ? (
        <div className="relative z-10 flex h-[54%] min-h-0 w-full items-center justify-center overflow-hidden p-2">
          <img
            src={imageSrc}
            alt=""
            aria-hidden
            className="pointer-events-none absolute inset-0 h-full w-full scale-110 object-cover opacity-45 blur-2xl"
            loading="lazy"
            onError={() => {
              setImageLoadFailed(true);
            }}
          />
          <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(10,10,14,0.08)_0%,rgba(10,10,14,0.48)_100%)]" />
          <img
            src={imageSrc}
            alt={content.title}
            className="relative z-10 h-full w-full object-contain"
            loading="lazy"
            onError={() => {
              setImageLoadFailed(true);
            }}
          />
        </div>
      ) : renderMainNewsImageFallback()}

      <div className="relative z-10 min-h-0 flex-1 overflow-hidden p-4 lg:p-5">
        <HorizontalScrollingText
          key={`news-main-title-${itemSignature}`}
          as="h3"
          value={titleText}
          fallback="Sin título"
          className="text-xl font-semibold leading-tight lg:text-2xl"
          containerClassName="w-full"
          speedPxPerSecond={35}
          startDelayMs={550}
          endDelayMs={750}
          loop={shouldLoopText}
          resetToStartOnComplete
          onTimingChange={(nextTiming) => {
            setTitleTiming((currentTiming) =>
              areTimingsEqual(currentTiming, nextTiming) ? currentTiming : nextTiming,
            );
          }}
        />
        <HorizontalScrollingText
          key={`news-main-description-${itemSignature}`}
          as="p"
          value={descriptionText}
          fallback="Sin descripción disponible."
          className="text-base leading-relaxed text-(--totem-text-secondary) lg:text-lg"
          containerClassName="mt-2 w-full"
          speedPxPerSecond={33}
          startDelayMs={600}
          endDelayMs={800}
          loop={shouldLoopText}
          resetToStartOnComplete
          onTimingChange={(nextTiming) => {
            setDescriptionTiming((currentTiming) =>
              areTimingsEqual(currentTiming, nextTiming) ? currentTiming : nextTiming,
            );
          }}
        />
      </div>
    </article>
  );
}

function renderVisualContent(
  content: TotemClientContent,
  fallbackType: TotemDisplayContentType,
  apiBaseUrl?: string,
) {
  const assetUrl = resolveAssetUrl(content.fileUrl, apiBaseUrl);

  if (!assetUrl) {
    return renderPanelEmptyState("No hay archivo disponible para este contenido.");
  }

  const shouldRenderVideo = fallbackType === "video";

  if (shouldRenderVideo) {
    return (
      <article className="relative flex h-full min-h-0 items-center justify-center overflow-hidden">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_18%_22%,rgba(255,59,111,0.26),transparent_42%),radial-gradient(circle_at_82%_78%,rgba(20,20,28,0.22),transparent_36%),linear-gradient(140deg,#191a23_0%,#141622_55%,#10131e_100%)]" />
        <div className="relative z-10 flex h-full w-full items-center justify-center p-2.5 lg:p-3.5">
          <video
            key={assetUrl}
            src={assetUrl}
            className="h-full w-full object-contain drop-shadow-[0_14px_32px_rgba(0,0,0,0.42)]"
            autoPlay
            loop
            playsInline
            preload="metadata"
          />
        </div>
      </article>
    );
  }

  return (
    <article className="relative flex h-full min-h-0 items-center justify-center overflow-hidden">
      <img
        src={assetUrl}
        alt=""
        aria-hidden
        className="pointer-events-none absolute inset-0 h-full w-full scale-110 object-cover opacity-42 blur-2xl"
        loading="lazy"
      />
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(10,10,14,0.12)_0%,rgba(10,10,14,0.66)_100%)]" />
      <div className="relative z-10 flex h-full w-full items-center justify-center p-2.5 lg:p-3.5">
        <img
          src={assetUrl}
          alt={content.title}
          className="h-full w-full object-contain drop-shadow-[0_16px_38px_rgba(0,0,0,0.5)]"
          loading="lazy"
        />
      </div>
    </article>
  );
}

export default function TotemDisplayPanel({
  type,
  items,
  apiBaseUrl,
  className = "",
  compact = false,
  panelLabel,
}: TotemDisplayPanelProps) {
  const [index, setIndex] = useState(0);
  const [itemDisplayDurationMs, setItemDisplayDurationMs] = useState(
    ROTATION_MS_BY_TYPE[type],
  );
  const videoItemSignatureRef = useRef<string | null>(null);
  const intervalMs = ROTATION_MS_BY_TYPE[type];
  const displayItems = useMemo(() => {
    if (type !== "advertisement") {
      return items;
    }

    return items.filter((item) => isImageAsset(item.fileUrl));
  }, [items, type]);
  const itemsSignature = useMemo(
    () => displayItems.map((item) => item.assignmentId).join(","),
    [displayItems],
  );

  useEffect(() => {
    if (displayItems.length === 0) {
      setIndex(0);
      return;
    }

    setIndex((previous) => previous % displayItems.length);
  }, [displayItems.length, itemsSignature]);

  const currentItem = useMemo(() => {
    if (displayItems.length === 0) {
      return null;
    }

    return displayItems[index % displayItems.length];
  }, [displayItems, index]);

  const currentItemSignature = currentItem
    ? `${currentItem.assignmentId}:${currentItem.title ?? ""}:${currentItem.description ?? ""}`
    : "no-item";

  useEffect(() => {
    setItemDisplayDurationMs(intervalMs);
  }, [currentItemSignature, intervalMs, type]);

  useEffect(() => {
    if (displayItems.length <= 1) {
      return;
    }

    if (type === "video") {
      return;
    }

    const nextRotationMs =
      type === "news" ? Math.max(1200, itemDisplayDurationMs) : intervalMs;
    const timer = window.setTimeout(() => {
      setIndex((previous) => {
        if (displayItems.length <= 1) {
          return 0;
        }

        return (previous + 1) % displayItems.length;
      });
    }, nextRotationMs);

    return () => {
      window.clearTimeout(timer);
    };
  }, [displayItems.length, index, intervalMs, itemDisplayDurationMs, type]);

  const moveToNextItem = useCallback(() => {
    setIndex((previous) => {
      if (displayItems.length <= 1) {
        return 0;
      }

      return (previous + 1) % displayItems.length;
    });
  }, [displayItems.length]);

  const handleCurrentVideoCompleted = useCallback(
    (itemSignature: string) => {
      if (videoItemSignatureRef.current !== itemSignature) {
        return;
      }

      moveToNextItem();
    },
    [moveToNextItem],
  );

  const handleNewsDurationChange = useCallback(
    (durationMs: number) => {
      const normalizedDurationMs =
        Number.isFinite(durationMs) && durationMs > 0
          ? Math.max(intervalMs, Math.ceil(durationMs))
          : intervalMs;

      setItemDisplayDurationMs((currentDurationMs) =>
        currentDurationMs === normalizedDurationMs
          ? currentDurationMs
          : normalizedDurationMs,
      );
    },
    [intervalMs],
  );

  const currentVideoItemSignature =
    type === "video" && currentItem
      ? `${currentItem.assignmentId}:${currentItem.fileUrl ?? ""}:${index}`
      : null;

  useEffect(() => {
    if (type !== "video") {
      videoItemSignatureRef.current = null;
      return;
    }

    videoItemSignatureRef.current = currentVideoItemSignature;
  }, [currentVideoItemSignature, type]);

  if (!currentItem && type !== "advertisement") {
    return null;
  }

  const resolvedPanelLabel = panelLabel?.trim() || CONTENT_LABEL_BY_TYPE[type];
  const currentPositionLabel =
    displayItems.length > 0
      ? `${(index % displayItems.length) + 1}/${displayItems.length}`
      : "0/0";

  return (
    <section
      className={`flex h-full min-h-0 flex-col overflow-hidden border border-(--totem-border) bg-(--totem-surface-2)/94 shadow-xl shadow-black/35 ${compact ? "rounded-xl" : "rounded-2xl"} ${className}`}
    >
      <header className={`flex items-center justify-between border-b border-(--totem-border) bg-(--totem-surface-2)/92 ${compact ? "px-3 py-1.5" : "px-4 py-2 lg:px-5"}`}>
        <p className={`font-semibold uppercase tracking-[0.08em] text-(--totem-text-secondary) ${compact ? "text-[0.6rem]" : "text-[0.68rem] lg:text-[0.72rem]"}`}>
          {resolvedPanelLabel}
        </p>
        {displayItems.length > 1 ? (
          <span className={`rounded-full border border-(--totem-border-strong) bg-(--totem-surface-3) px-2 py-0.5 font-semibold text-(--totem-text-muted) ${compact ? "text-[0.58rem]" : "text-[0.64rem]"}`}>
            {currentPositionLabel}
          </span>
        ) : null}
      </header>

      <div className="min-h-0 flex-1">
        {!currentItem ? (
          renderPanelEmptyState("No hay publicidades con imagen válida para mostrar.")
        ) : type === "news" ? (
          <NewsCard
            key={`news-card-${currentItemSignature}-${compact ? "compact" : "full"}`}
            content={currentItem}
            compact={compact}
            apiBaseUrl={apiBaseUrl}
            baseDurationMs={intervalMs}
            shouldLoopText
            onRecommendedDurationChange={handleNewsDurationChange}
          />
        ) : (
          <VisualContentCard
            content={currentItem}
            type={type}
            apiBaseUrl={apiBaseUrl}
            itemSignature={currentVideoItemSignature}
            shouldLoopVideo={displayItems.length <= 1}
            videoFallbackMs={Math.max(intervalMs, VIDEO_FALLBACK_ADVANCE_MS)}
            onVideoCompleted={handleCurrentVideoCompleted}
          />
        )}
      </div>
    </section>
  );
}

interface VisualContentCardProps {
  content: TotemClientContent;
  type: TotemDisplayContentType;
  apiBaseUrl?: string;
  itemSignature: string | null;
  shouldLoopVideo: boolean;
  videoFallbackMs: number;
  onVideoCompleted: (itemSignature: string) => void;
}

function VisualContentCard({
  content,
  type,
  apiBaseUrl,
  itemSignature,
  shouldLoopVideo,
  videoFallbackMs,
  onVideoCompleted,
}: VisualContentCardProps) {
  if (type !== "video" || !itemSignature) {
    return renderVisualContent(content, type, apiBaseUrl);
  }

  return (
    <VideoContentCard
      content={content}
      apiBaseUrl={apiBaseUrl}
      itemSignature={itemSignature}
      shouldLoop={shouldLoopVideo}
      fallbackAdvanceMs={videoFallbackMs}
      onPlaybackCompleted={onVideoCompleted}
    />
  );
}

interface VideoContentCardProps {
  content: TotemClientContent;
  apiBaseUrl?: string;
  itemSignature: string;
  shouldLoop: boolean;
  fallbackAdvanceMs: number;
  onPlaybackCompleted: (itemSignature: string) => void;
}

function VideoContentCard({
  content,
  apiBaseUrl,
  itemSignature,
  shouldLoop,
  fallbackAdvanceMs,
  onPlaybackCompleted,
}: VideoContentCardProps) {
  const assetUrl = resolveAssetUrl(content.fileUrl, apiBaseUrl);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const fallbackTimerRef = useRef<number | null>(null);
  const hasCompletedRef = useRef(false);
  const [playbackProgressPercent, setPlaybackProgressPercent] = useState(0);
  const playbackProgressRef = useRef(0);

  const updatePlaybackProgress = useCallback((nextPercent: number) => {
    const normalizedPercent = Math.max(0, Math.min(100, nextPercent));

    if (Math.abs(playbackProgressRef.current - normalizedPercent) < 0.25) {
      return;
    }

    playbackProgressRef.current = normalizedPercent;
    setPlaybackProgressPercent(normalizedPercent);
  }, []);

  const clearFallbackTimer = useCallback(() => {
    if (fallbackTimerRef.current !== null) {
      window.clearTimeout(fallbackTimerRef.current);
      fallbackTimerRef.current = null;
    }
  }, []);

  const scheduleFallbackAdvance = useCallback(
    (delayMs: number) => {
      if (shouldLoop) {
        return;
      }

      clearFallbackTimer();
      const safeDelayMs = Math.max(1800, Math.ceil(delayMs));
      fallbackTimerRef.current = window.setTimeout(() => {
        if (hasCompletedRef.current) {
          return;
        }

        hasCompletedRef.current = true;
        onPlaybackCompleted(itemSignature);
      }, safeDelayMs);
    },
    [clearFallbackTimer, itemSignature, onPlaybackCompleted, shouldLoop],
  );

  const completePlayback = useCallback(() => {
    if (hasCompletedRef.current) {
      return;
    }

    hasCompletedRef.current = true;
    updatePlaybackProgress(100);
    clearFallbackTimer();
    onPlaybackCompleted(itemSignature);
  }, [clearFallbackTimer, itemSignature, onPlaybackCompleted, updatePlaybackProgress]);

  useEffect(() => {
    hasCompletedRef.current = false;
    playbackProgressRef.current = 0;
    setPlaybackProgressPercent(0);

    if (!shouldLoop) {
      scheduleFallbackAdvance(fallbackAdvanceMs);
    }

    return () => {
      clearFallbackTimer();
      hasCompletedRef.current = false;
    };
  }, [clearFallbackTimer, fallbackAdvanceMs, itemSignature, scheduleFallbackAdvance, shouldLoop]);

  useEffect(() => {
    const video = videoRef.current;

    if (!video) {
      return;
    }

    video.defaultMuted = false;
    video.muted = false;
    if (video.volume <= 0) {
      video.volume = 1;
    }

    const syncProgressFromVideo = () => {
      const durationSeconds = Number(video.duration);
      if (!Number.isFinite(durationSeconds) || durationSeconds <= 0) {
        updatePlaybackProgress(0);
        return;
      }

      const nextPercent = (video.currentTime / durationSeconds) * 100;
      updatePlaybackProgress(nextPercent);
    };

    const handleEnded = () => {
      completePlayback();
    };
    const handleError = () => {
      scheduleFallbackAdvance(2200);
    };
    const handleAbort = () => {
      scheduleFallbackAdvance(2200);
    };
    const handleStalled = () => {
      scheduleFallbackAdvance(5000);
    };
    const handleLoadedMetadata = () => {
      syncProgressFromVideo();

      if (shouldLoop) {
        return;
      }

      const durationSeconds = Number(video.duration);
      if (!Number.isFinite(durationSeconds) || durationSeconds <= 0) {
        return;
      }

      scheduleFallbackAdvance(durationSeconds * 1000 + 2500);
    };
    const handleTimeUpdate = () => {
      syncProgressFromVideo();
    };
    const handlePlay = () => {
      video.muted = false;
      if (video.volume <= 0) {
        video.volume = 1;
      }
    };

    video.addEventListener("ended", handleEnded);
    video.addEventListener("error", handleError);
    video.addEventListener("abort", handleAbort);
    video.addEventListener("stalled", handleStalled);
    video.addEventListener("loadedmetadata", handleLoadedMetadata);
    video.addEventListener("timeupdate", handleTimeUpdate);
    video.addEventListener("play", handlePlay);

    const playVideo = async () => {
      try {
        await video.play();
      } catch {
        // Algunas políticas de autoplay pueden bloquear audio; se intenta iniciar
        // el video de todos modos y luego desmutear para preservar el flujo.
        try {
          video.muted = true;
          await video.play();
          video.muted = false;
        } catch {
          // Si no se puede reproducir automáticamente, el fallback mantiene el carrusel activo.
        }
      }
    };

    void playVideo();

    return () => {
      video.removeEventListener("ended", handleEnded);
      video.removeEventListener("error", handleError);
      video.removeEventListener("abort", handleAbort);
      video.removeEventListener("stalled", handleStalled);
      video.removeEventListener("loadedmetadata", handleLoadedMetadata);
      video.removeEventListener("timeupdate", handleTimeUpdate);
      video.removeEventListener("play", handlePlay);
    };
  }, [completePlayback, scheduleFallbackAdvance, shouldLoop, updatePlaybackProgress]);

  if (!assetUrl || !isVideoAsset(content.fileUrl)) {
    return renderPanelEmptyState("No hay video válido disponible para este contenido.");
  }

  return (
    <article className="relative flex h-full min-h-0 items-center justify-center overflow-hidden">
      <div className="pointer-events-none absolute left-0 right-0 top-0 z-30 h-1 bg-black/45">
        <div
          className="h-full bg-(--totem-accent) transition-[width] duration-150 ease-linear"
          style={{ width: `${playbackProgressPercent}%` }}
        />
      </div>
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_18%_22%,rgba(255,59,111,0.26),transparent_42%),radial-gradient(circle_at_82%_78%,rgba(20,20,28,0.22),transparent_36%),linear-gradient(140deg,#191a23_0%,#141622_55%,#10131e_100%)]" />
      <div className="relative z-10 flex h-full w-full items-center justify-center p-2.5 lg:p-3.5">
        <video
          ref={videoRef}
          key={`${assetUrl}:${itemSignature}`}
          src={assetUrl}
          className="h-full w-full object-contain drop-shadow-[0_14px_32px_rgba(0,0,0,0.42)]"
          autoPlay
          loop={shouldLoop}
          playsInline
          preload="metadata"
        />
      </div>
    </article>
  );
}
