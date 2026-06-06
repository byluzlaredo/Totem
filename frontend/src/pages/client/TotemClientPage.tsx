import { Link2Off, MonitorOff, RefreshCcw } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import SpeechRecognition, { useSpeechRecognition } from "react-speech-recognition";
import loginBg from "../../../assets/images/Login-bg.webp";
import logoIcon from "../../../assets/images/Logo.webp";
import PalmDetector from "../../components/PalmDetector";
import ConfirmDialog from "../../components/ConfirmDialog";
import FeedbackMessage from "../../components/FeedbackMessage";
import { DEFAULT_QUESTION_MODE_IDLE_TIMEOUT_SECONDS } from "../../constants/totemClient";
import {
  EmergencyModal,
  NotificationBanner,
  TotemClientLinkScreen,
  TotemClientSystemScreen,
  TotemDisplayPanel,
  TotemWeatherBadge,
  TotemQuestionModeView,
} from "../../features/totemClient/components";
import type { TotemQuestionUiState } from "../../features/totemClient/components";
import { useTotemClient } from "../../features/totemClient/hooks/useTotemClient";
import {
  ensureTotemClientSessionFresh,
  getTotemClientSessionSnapshot,
  invalidateTotemClientSession,
  linkTotemClientDevice,
  onTotemClientSessionChanged,
  onTotemClientSessionInvalidated,
  unlinkTotemClientDevice,
} from "../../features/totemClient/services/totemClientAuth.service";
import { connectTotemClientRealtime } from "../../features/totemClient/services/totemClientRealtime.service";
import { totemClientService } from "../../features/totemClient/services/totemClient.service";
import { isStoredFileUrlCompatibleWithContentType } from "../../features/contents/utils/contentFileRules";
import type {
  TotemClientContent,
  TotemClientDeviceInfo,
  TotemClientDeviceStatus,
  TotemClientQuestionImage,
  TotemClientSession,
  TotemDisplayContentType,
  TotemClientNotification,
  TotemQuestionModeActivityType,
  TotemQuestionModeExitReason,
  TotemQuestionModeState,
  TotemQuestionSession,
} from "../../types/totemClient";
import { ApiError } from "../../services/api";
import { getErrorMessage } from "../../utils/getErrorMessage";

const EMPTY_DEVICE_INFO: TotemClientDeviceInfo = {
  available: null,
  permission: "unknown",
  error: null,
};

const INITIAL_BOOTSTRAP_RETRY_SECONDS = 20;
const QUESTION_SUBMIT_DEBOUNCE_MS = 1400;
const QUESTION_REPEAT_GUARD_WINDOW_MS = 2200;
const SPEAKING_ACTIVITY_SYNC_INTERVAL_MS = 2200;
const QUESTION_ANSWER_IMAGE_DISPLAY_MS = 4200;
const MIN_QUESTION_CHARACTER_COUNT = 6;
const MIN_QUESTION_WORD_COUNT = 3;
const MAX_QUESTION_LENGTH = 300;
const QUESTION_TOO_LONG_ANSWER_TEXT = `Tu pregunta es demasiado larga. Intenta resumirla en un máximo de ${MAX_QUESTION_LENGTH} caracteres.`;
const SHORT_QUESTION_ANSWER_TEXT = "Hazme una pregunta un poco más completa.";
const NO_PDF_AVAILABLE_ANSWER_TEXT =
  "Lo siento, no tengo respuestas para ofrecer en este momento.";
const CLIENT_MESSAGE_AUTO_HIDE_MS = 9000;
const NOTIFICATION_CAROUSEL_INTERVAL_MS = 5000;
const VISUAL_SECTION_ORDER = ["video", "image", "advertisement"] as const;
const DISPLAY_CONTENT_TYPES_REQUIRING_FILE = new Set<TotemDisplayContentType>([
  "image",
  "video",
  "advertisement",
]);
type TotemVisualContentType = (typeof VISUAL_SECTION_ORDER)[number];

function buildPanelKey(type: TotemDisplayContentType, items: TotemClientContent[]) {
  const signature = items.map((item) => item.assignmentId).join(",");
  return `${type}:${signature}`;
}
function createDefaultQuestionModeState(): TotemQuestionModeState {
  return {
    mode: "normal",
    inactivityTimeoutSeconds: DEFAULT_QUESTION_MODE_IDLE_TIMEOUT_SECONDS,
    reactivationCooldownSeconds: 2,
    enteredQuestionModeAt: null,
    lastActivityAt: null,
    lastActivityType: null,
    inactivityDeadlineAt: null,
    reactivationBlockedUntil: null,
    isReactivationBlocked: false,
    lastActivationByGestureAt: null,
    lastExitedAt: null,
    lastExitReason: null,
    deviceStatus: {
      camera: { ...EMPTY_DEVICE_INFO },
      microphone: { ...EMPTY_DEVICE_INFO },
      reportedAt: null,
    },
  };
}

function normalizeDisplayText(value: string | null | undefined) {
  if (typeof value !== "string") {
    return "";
  }

  return value.trim();
}

function hasValidNewsText(content: TotemClientContent) {
  return (
    normalizeDisplayText(content.title).length > 0 &&
    normalizeDisplayText(content.description).length > 0
  );
}

function hasCompatibleDisplayFile(content: TotemClientContent) {
  if (!content.fileUrl) {
    return false;
  }

  return isStoredFileUrlCompatibleWithContentType(content.fileUrl, content.contentType);
}

function isRenderableDisplayContent(content: TotemClientContent) {
  if (DISPLAY_CONTENT_TYPES_REQUIRING_FILE.has(content.contentType)) {
    return hasCompatibleDisplayFile(content);
  }

  if (content.contentType === "news") {
    return hasValidNewsText(content);
  }

  return false;
}

function isRenderableQuestionImage(image: TotemClientQuestionImage) {
  const fileUrl = normalizeDisplayText(image.fileUrl);

  if (!fileUrl) {
    return false;
  }

  return isStoredFileUrlCompatibleWithContentType(fileUrl, "image");
}

function sortQuestionImagesForDisplay(images: TotemClientQuestionImage[]) {
  return [...images].sort((left, right) =>
    left.sortOrder === right.sortOrder
      ? left.id - right.id
      : left.sortOrder - right.sortOrder,
  );
}

function groupDisplayContents(contents: TotemClientContent[]) {
  return {
    image: contents.filter((item) => item.contentType === "image"),
    video: contents.filter((item) => item.contentType === "video"),
    news: contents.filter((item) => item.contentType === "news"),
    advertisement: contents.filter((item) => item.contentType === "advertisement"),
  };
}

function useAutoDismissMessage(message: string, delayMs: number) {
  const [visibleMessage, setVisibleMessage] = useState("");

  useEffect(() => {
    if (!message) {
      setVisibleMessage("");
      return;
    }

    setVisibleMessage(message);
    const timer = window.setTimeout(() => {
      setVisibleMessage((current) => (current === message ? "" : current));
    }, delayMs);

    return () => {
      window.clearTimeout(timer);
    };
  }, [delayMs, message]);

  return visibleMessage;
}

type TotemFloatingFeedbackMessage = {
  id: string;
  type: "success" | "error" | "neutral" | "warning";
  label: string;
  message: string;
};

function mapMicrophoneError(error: unknown): TotemClientDeviceInfo {
  if (!(error instanceof DOMException)) {
    return {
      available: false,
      permission: "unknown",
      error: "No se pudo acceder al micrófono.",
    };
  }

  if (error.name === "NotAllowedError" || error.name === "SecurityError") {
    return {
      available: false,
      permission: "denied",
      error: "Permiso de micrófono denegado.",
    };
  }

  if (error.name === "NotFoundError") {
    return {
      available: false,
      permission: "granted",
      error: "No se encontró un micrófono disponible.",
    };
  }

  return {
    available: false,
    permission: "unknown",
    error: "No se pudo inicializar el micrófono.",
  };
}

async function resolveMicrophoneStatus(
  supportsSpeechRecognition: boolean,
): Promise<TotemClientDeviceInfo> {
  if (!supportsSpeechRecognition) {
    return {
      available: false,
      permission: "unsupported",
      error: "Este navegador no soporta reconocimiento de voz.",
    };
  }

  if (!navigator?.mediaDevices?.getUserMedia) {
    return {
      available: false,
      permission: "unsupported",
      error: "El navegador no soporta acceso a micrófono.",
    };
  }

  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
    stream.getTracks().forEach((track) => track.stop());

    return {
      available: true,
      permission: "granted",
      error: null,
    };
  } catch (error) {
    return mapMicrophoneError(error);
  }
}

function pickSpanishVoice(voices: SpeechSynthesisVoice[]) {
  if (!Array.isArray(voices) || voices.length === 0) {
    return null;
  }

  const spanishByLocale = voices.find((voice) =>
    voice.lang.toLowerCase().startsWith("es"),
  );

  if (spanishByLocale) {
    return spanishByLocale;
  }

  return voices[0] ?? null;
}

function normalizeWordsForQuestionValidation(text: string) {
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function countMeaningfulWords(text: string) {
  const normalizedText = normalizeWordsForQuestionValidation(text);

  if (normalizedText.length === 0) {
    return 0;
  }

  return Array.from(
    new Set(normalizedText.split(" ").filter((word) => word.length > 1)),
  ).length;
}

function resolveQuestionModeFallbackAnswer(error: unknown) {
  const rawMessage =
    error instanceof ApiError || error instanceof Error
      ? error.message
      : typeof error === "string"
        ? error
        : "";

  if (!rawMessage.trim()) {
    return null;
  }

  const normalizedMessage = normalizeWordsForQuestionValidation(rawMessage);
  const normalizedNoPdfMessage =
    "el totem no tiene contenidos pdf activos asignados para responder preguntas";
  const isQuestionTooLongMessage =
    normalizedMessage.includes("pregunta") &&
    (
      normalizedMessage.includes("caracter") ||
      normalizedMessage.includes("character")
    ) &&
    (
      normalizedMessage.includes("maximo") ||
      normalizedMessage.includes("excede") ||
      normalizedMessage.includes("longitud") ||
      normalizedMessage.includes("too long")
    );

  if (isQuestionTooLongMessage) {
    return QUESTION_TOO_LONG_ANSWER_TEXT;
  }

  if (normalizedMessage.includes(normalizedNoPdfMessage)) {
    return NO_PDF_AVAILABLE_ANSWER_TEXT;
  }

  if (
    normalizedMessage.includes("totem") &&
    normalizedMessage.includes("contenidos") &&
    normalizedMessage.includes("pdf") &&
    normalizedMessage.includes("activos") &&
    normalizedMessage.includes("asignados") &&
    (
      normalizedMessage.includes("responder preguntas") ||
      normalizedMessage.includes("responder")
    )
  ) {
    return NO_PDF_AVAILABLE_ANSWER_TEXT;
  }

  return null;
}

function isActiveSession(
  session: TotemQuestionSession | null,
): session is TotemQuestionSession {
  return session?.status === "active" && !session.isExpired;
}

type TotemEmergencyOverlay = {
  source: "bootstrap" | "realtime";
  key: string;
  title: string;
  message: string;
  durationSeconds: number | null;
  notificationId: number | null;
};

type RealtimeEmergencyState = TotemEmergencyOverlay & {
  expiresAtMs: number | null;
};

function resolveNotificationRemainingSeconds(
  notification: TotemClientNotification,
  nowMs: number,
) {
  const parsedEndAt = Date.parse(notification.endAt ?? "");
  if (!Number.isNaN(parsedEndAt)) {
    const remainingSeconds = Math.ceil((parsedEndAt - nowMs) / 1000);
    return remainingSeconds > 0 ? remainingSeconds : 0;
  }

  if (typeof notification.durationSeconds === "number" && notification.durationSeconds > 0) {
    return Math.ceil(notification.durationSeconds);
  }

  return 0;
}

function parseDateToMs(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  const parsedMs = Date.parse(value);
  return Number.isNaN(parsedMs) ? null : parsedMs;
}

function isWithinTemporalWindow(
  startAt: string | null | undefined,
  endAt: string | null | undefined,
  nowMs: number,
) {
  const startAtMs = parseDateToMs(startAt);
  const endAtMs = parseDateToMs(endAt);

  if (startAtMs !== null && nowMs < startAtMs) {
    return false;
  }

  if (endAtMs !== null && nowMs > endAtMs) {
    return false;
  }

  return true;
}

function isDisplayContentVisibleAt(content: TotemClientContent, nowMs: number) {
  return isWithinTemporalWindow(
    content.assignmentStartAt,
    content.assignmentEndAt,
    nowMs,
  );
}

function isNotificationVisibleAt(notification: TotemClientNotification, nowMs: number) {
  const effectiveStartAt = notification.startAt ?? notification.createdAt ?? null;
  return isWithinTemporalWindow(effectiveStartAt, notification.endAt, nowMs);
}

function resolveNextTemporalCheckpointMs(
  contents: TotemClientContent[],
  notifications: TotemClientNotification[],
  nowMs: number,
) {
  let nextCheckpointMs: number | null = null;

  const registerBoundary = (boundaryMs: number | null) => {
    if (boundaryMs === null || boundaryMs <= nowMs) {
      return;
    }

    if (nextCheckpointMs === null || boundaryMs < nextCheckpointMs) {
      nextCheckpointMs = boundaryMs;
    }
  };

  for (const item of contents) {
    registerBoundary(parseDateToMs(item.assignmentStartAt));
    registerBoundary(parseDateToMs(item.assignmentEndAt));
  }

  for (const notification of notifications) {
    registerBoundary(parseDateToMs(notification.startAt ?? notification.createdAt ?? null));
    registerBoundary(parseDateToMs(notification.endAt));
  }

  return nextCheckpointMs;
}

export default function TotemClientPage() {
  const [session, setSession] = useState<TotemClientSession | null>(() =>
    getTotemClientSessionSnapshot(),
  );
  const [linkCode, setLinkCode] = useState("");
  const [linkError, setLinkError] = useState("");
  const [isLinkingDevice, setIsLinkingDevice] = useState(false);
  const [isUnlinkingDevice, setIsUnlinkingDevice] = useState(false);
  const [isUnlinkConfirmOpen, setIsUnlinkConfirmOpen] = useState(false);
  const [questionMode, setQuestionMode] = useState<TotemQuestionModeState>(
    createDefaultQuestionModeState,
  );
  const [questionSession, setQuestionSession] = useState<TotemQuestionSession | null>(null);
  const [deviceStatus, setDeviceStatus] = useState<
    Pick<TotemClientDeviceStatus, "camera" | "microphone">
  >({
    camera: { ...EMPTY_DEVICE_INFO },
    microphone: { ...EMPTY_DEVICE_INFO },
  });
  const [questionModeError, setQuestionModeError] = useState("");
  const [speechWarning, setSpeechWarning] = useState("");
  const [questionUiState, setQuestionUiState] = useState<TotemQuestionUiState>("idle");
  const [currentQuestion, setCurrentQuestion] = useState("");
  const [answerText, setAnswerText] = useState("");
  const [answerImages, setAnswerImages] = useState<TotemClientQuestionImage[]>([]);
  const [currentAnswerImageIndex, setCurrentAnswerImageIndex] = useState(0);
  const [isSubmittingQuestion, setIsSubmittingQuestion] = useState(false);
  const [deviceReportWarning, setDeviceReportWarning] = useState("");
  const [isActivatingQuestionMode, setIsActivatingQuestionMode] = useState(false);
  const [isExitingQuestionMode, setIsExitingQuestionMode] = useState(false);
  const [questionModeActivityVersion, setQuestionModeActivityVersion] = useState(0);
  const [isCooldownActive, setIsCooldownActive] = useState(false);
  const [realtimeEmergency, setRealtimeEmergency] = useState<RealtimeEmergencyState | null>(null);
  const [dismissedBootstrapEmergencyKey, setDismissedBootstrapEmergencyKey] = useState<string | null>(null);
  const [notificationIndex, setNotificationIndex] = useState(0);
  const [notificationDisplayDurationMs, setNotificationDisplayDurationMs] = useState(
    NOTIFICATION_CAROUSEL_INTERVAL_MS,
  );
  const [bootstrapRetryCountdown, setBootstrapRetryCountdown] = useState<number | null>(null);
  const [temporalNowMs, setTemporalNowMs] = useState(() => Date.now());

  const { transcript, listening, browserSupportsSpeechRecognition, resetTranscript } =
    useSpeechRecognition();

  const hasVoiceDetectedRef = useRef(false);
  const previousTranscriptRef = useRef("");
  const questionSubmitTimerRef = useRef<number | null>(null);
  const lastSubmittedQuestionRef = useRef("");
  const lastSubmittedQuestionAtRef = useRef(0);
  const activeUtteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const lastReportedDeviceStatusRef = useRef("");
  const lastTranscriptionActivitySyncRef = useRef(0);
  const isQuestionModeActiveRef = useRef(false);
  const isEmergencyBlockingRef = useRef(false);
  const speakAnswerRef = useRef<
    ((textToSpeak: string, options?: { onCompleted?: () => void }) => void) | null
  >(null);
  const handleExitQuestionModeRef = useRef<
    ((reason: TotemQuestionModeExitReason) => Promise<void>) | null
  >(null);
  const totemIdRef = useRef<number | null>(null);
  const temporalCheckpointTimerRef = useRef<number | null>(null);
  const questionImageCarouselTimerRef = useRef<number | null>(null);
  const isQuestionModeActive = questionMode.mode === "question";
  const inactivityTimeoutSeconds =
    Math.min(
      questionMode.inactivityTimeoutSeconds || DEFAULT_QUESTION_MODE_IDLE_TIMEOUT_SECONDS,
      DEFAULT_QUESTION_MODE_IDLE_TIMEOUT_SECONDS,
    );

  useEffect(() => {
    const html = document.documentElement;
    const body = document.body;
    const previousHtmlOverflow = html.style.overflow;
    const previousBodyOverflow = body.style.overflow;
    const previousBodyOverscrollBehavior = body.style.overscrollBehavior;

    html.style.overflow = "hidden";
    body.style.overflow = "hidden";
    body.style.overscrollBehavior = "none";

    return () => {
      html.style.overflow = previousHtmlOverflow;
      body.style.overflow = previousBodyOverflow;
      body.style.overscrollBehavior = previousBodyOverscrollBehavior;
    };
  }, []);

  useEffect(() => {
    isQuestionModeActiveRef.current = isQuestionModeActive;
  }, [isQuestionModeActive]);

  const clearQuestionSubmitTimer = useCallback(() => {
    if (questionSubmitTimerRef.current !== null) {
      window.clearTimeout(questionSubmitTimerRef.current);
      questionSubmitTimerRef.current = null;
    }
  }, []);

  const clearQuestionImageCarousel = useCallback(() => {
    if (questionImageCarouselTimerRef.current !== null) {
      window.clearTimeout(questionImageCarouselTimerRef.current);
      questionImageCarouselTimerRef.current = null;
    }

    setAnswerImages([]);
    setCurrentAnswerImageIndex(0);
  }, []);

  const stopListeningSafely = useCallback(async () => {
    try {
      await SpeechRecognition.stopListening();
    } catch {
      // No se interrumpe el flujo por fallos puntuales al detener escucha.
    }
  }, []);

  const cancelSpeechPlayback = useCallback(() => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) {
      activeUtteranceRef.current = null;
      return;
    }

    const activeUtterance = activeUtteranceRef.current;

    if (activeUtterance) {
      activeUtterance.onstart = null;
      activeUtterance.onend = null;
      activeUtterance.onerror = null;
    }

    window.speechSynthesis.cancel();
    activeUtteranceRef.current = null;
  }, []);

  useEffect(() => {
    return () => {
      clearQuestionSubmitTimer();
      clearQuestionImageCarousel();
      cancelSpeechPlayback();
      if (temporalCheckpointTimerRef.current !== null) {
        window.clearTimeout(temporalCheckpointTimerRef.current);
        temporalCheckpointTimerRef.current = null;
      }
    };
  }, [cancelSpeechPlayback, clearQuestionImageCarousel, clearQuestionSubmitTimer]);

  useEffect(() => {
    const unsubscribeSession = onTotemClientSessionChanged((nextSession) => {
      setSession(nextSession);
      setLinkError("");
      if (!nextSession) {
        setRealtimeEmergency(null);
        setDismissedBootstrapEmergencyKey(null);
        setIsUnlinkConfirmOpen(false);
      }
    });

    const unsubscribeInvalidation = onTotemClientSessionInvalidated((reason) => {
      setSession(null);
      setBootstrapRetryCountdown(null);
      setQuestionMode(createDefaultQuestionModeState());
      setQuestionSession(null);
      setIsUnlinkConfirmOpen(false);
      setQuestionModeError("");
      setDeviceReportWarning("");
      setSpeechWarning("");
      setQuestionUiState("idle");
      setCurrentQuestion("");
      setAnswerText("");
      setAnswerImages([]);
      setCurrentAnswerImageIndex(0);
      setIsSubmittingQuestion(false);
      setRealtimeEmergency(null);
      setDismissedBootstrapEmergencyKey(null);
      hasVoiceDetectedRef.current = false;
      previousTranscriptRef.current = "";
      clearQuestionSubmitTimer();
      clearQuestionImageCarousel();
      cancelSpeechPlayback();
      void SpeechRecognition.stopListening();
      resetTranscript();

      if (reason === "forbidden") {
        setLinkError("La sesión fue revocada o el tótem fue desactivado.");
        return;
      }

      if (reason === "refresh_failed") {
        setLinkError("La sesión expiró y debes vincular el dispositivo nuevamente.");
        return;
      }

      if (reason === "unauthorized") {
        setLinkError("La sesión del dispositivo ya no es válida.");
      }
    });

    return () => {
      unsubscribeSession();
      unsubscribeInvalidation();
    };
  }, [
    cancelSpeechPlayback,
    clearQuestionImageCarousel,
    clearQuestionSubmitTimer,
    resetTranscript,
  ]);

  useEffect(() => {
    if (!session) {
      return;
    }

    void ensureTotemClientSessionFresh();

    const refreshTimer = window.setInterval(() => {
      void ensureTotemClientSessionFresh();
    }, 60_000);

    return () => {
      window.clearInterval(refreshTimer);
    };
  }, [session]);

  const { data, loading, error, networkWarning, retry, refresh } = useTotemClient(session);

  useEffect(() => {
    if (!error) {
      setBootstrapRetryCountdown(null);
      return;
    }

    setBootstrapRetryCountdown(INITIAL_BOOTSTRAP_RETRY_SECONDS);

    const timer = window.setInterval(() => {
      setBootstrapRetryCountdown((previous) => {
        if (previous === null) {
          return INITIAL_BOOTSTRAP_RETRY_SECONDS;
        }

        if (previous <= 1) {
          retry();
          return INITIAL_BOOTSTRAP_RETRY_SECONDS;
        }

        return previous - 1;
      });
    }, 1000);

    return () => {
      window.clearInterval(timer);
    };
  }, [error, retry]);

  const applyQuestionMode = useCallback((nextQuestionMode: TotemQuestionModeState) => {
    setQuestionMode(nextQuestionMode);
  }, []);

  useEffect(() => {
    if (!data?.questionMode) {
      return;
    }

    applyQuestionMode(data.questionMode);
    setQuestionSession(data.questionSession ?? null);
    setDeviceStatus({
      camera: data.questionMode.deviceStatus.camera,
      microphone: data.questionMode.deviceStatus.microphone,
    });
  }, [applyQuestionMode, data?.questionMode, data?.questionSession]);

  useEffect(() => {
    totemIdRef.current = data?.totem?.id ?? null;
  }, [data?.totem?.id]);

  const timelineContents = useMemo(
    () => (data?.contents ?? []).filter((item) => isRenderableDisplayContent(item)),
    [data?.contents],
  );
  const timelineNotifications = useMemo(() => data?.notifications ?? [], [data?.notifications]);

  useEffect(() => {
    setTemporalNowMs(Date.now());
  }, [timelineContents, timelineNotifications]);

  useEffect(() => {
    const syncTemporalClock = () => {
      setTemporalNowMs(Date.now());
    };

    window.addEventListener("focus", syncTemporalClock);
    document.addEventListener("visibilitychange", syncTemporalClock);

    return () => {
      window.removeEventListener("focus", syncTemporalClock);
      document.removeEventListener("visibilitychange", syncTemporalClock);
    };
  }, []);

  useEffect(() => {
    if (temporalCheckpointTimerRef.current !== null) {
      window.clearTimeout(temporalCheckpointTimerRef.current);
      temporalCheckpointTimerRef.current = null;
    }

    const nextCheckpointMs = resolveNextTemporalCheckpointMs(
      timelineContents,
      timelineNotifications,
      temporalNowMs,
    );

    if (nextCheckpointMs === null) {
      return;
    }

    const delayMs = Math.max(40, nextCheckpointMs - Date.now() + 40);

    temporalCheckpointTimerRef.current = window.setTimeout(() => {
      setTemporalNowMs(Date.now());
      temporalCheckpointTimerRef.current = null;
    }, delayMs);

    return () => {
      if (temporalCheckpointTimerRef.current !== null) {
        window.clearTimeout(temporalCheckpointTimerRef.current);
        temporalCheckpointTimerRef.current = null;
      }
    };
  }, [temporalNowMs, timelineContents, timelineNotifications]);

  const visibleContents = useMemo(
    () =>
      timelineContents.filter((item) =>
        isDisplayContentVisibleAt(item, temporalNowMs),
      ),
    [timelineContents, temporalNowMs],
  );

  const visibleNotifications = useMemo(
    () =>
      timelineNotifications.filter((item) =>
        isNotificationVisibleAt(item, temporalNowMs),
      ),
    [timelineNotifications, temporalNowMs],
  );

  const nonUrgentNotifications = useMemo(() => {
    return visibleNotifications.filter((item) => !item.isEmergency);
  }, [visibleNotifications]);

  const bootstrapEmergency = useMemo<TotemEmergencyOverlay | null>(() => {
    const urgentNotification = visibleNotifications.find((item) => item.isEmergency);

    if (!urgentNotification) {
      return null;
    }

    const remainingSeconds = resolveNotificationRemainingSeconds(
      urgentNotification,
      temporalNowMs,
    );

    if (remainingSeconds <= 0) {
      return null;
    }

    return {
      source: "bootstrap",
      key: `bootstrap-${urgentNotification.id}-${urgentNotification.endAt ?? "no-end"}`,
      title: urgentNotification.title?.trim() || "Emergencia en curso",
      message: urgentNotification.message,
      durationSeconds: remainingSeconds,
      notificationId: urgentNotification.id,
    };
  }, [temporalNowMs, visibleNotifications]);

  useEffect(() => {
    if (!bootstrapEmergency) {
      setDismissedBootstrapEmergencyKey(null);
      return;
    }

    if (
      dismissedBootstrapEmergencyKey &&
      dismissedBootstrapEmergencyKey !== bootstrapEmergency.key
    ) {
      setDismissedBootstrapEmergencyKey(null);
    }
  }, [bootstrapEmergency, dismissedBootstrapEmergencyKey]);

  useEffect(() => {
    if (!realtimeEmergency || realtimeEmergency.expiresAtMs === null) {
      return;
    }

    const remainingMs = realtimeEmergency.expiresAtMs - Date.now();

    if (remainingMs <= 0) {
      setRealtimeEmergency((current) =>
        current?.key === realtimeEmergency.key ? null : current,
      );
      return;
    }

    const timer = window.setTimeout(() => {
      setRealtimeEmergency((current) =>
        current?.key === realtimeEmergency.key ? null : current,
      );
    }, remainingMs + 100);

    return () => {
      window.clearTimeout(timer);
    };
  }, [realtimeEmergency]);

  useEffect(() => {
    if (
      !realtimeEmergency ||
      realtimeEmergency.notificationId === null ||
      timelineNotifications.length === 0
    ) {
      return;
    }

    const stillVisibleAsUrgent = timelineNotifications.some(
      (notification) =>
        notification.id === realtimeEmergency.notificationId &&
        notification.isEmergency &&
        isNotificationVisibleAt(notification, temporalNowMs) &&
        resolveNotificationRemainingSeconds(notification, temporalNowMs) > 0,
    );

    if (!stillVisibleAsUrgent) {
      setRealtimeEmergency((current) =>
        current?.key === realtimeEmergency.key ? null : current,
      );
    }
  }, [realtimeEmergency, temporalNowMs, timelineNotifications]);

  useEffect(() => {
    if (nonUrgentNotifications.length === 0) {
      setNotificationIndex(0);
      return;
    }

    if (notificationIndex >= nonUrgentNotifications.length) {
      setNotificationIndex(0);
    }
  }, [nonUrgentNotifications.length, notificationIndex]);

  useEffect(() => {
    if (nonUrgentNotifications.length <= 1) {
      return;
    }

    const timer = window.setTimeout(() => {
      setNotificationIndex((currentIndex) => {
        if (nonUrgentNotifications.length <= 1) {
          return 0;
        }

        return (currentIndex + 1) % nonUrgentNotifications.length;
      });
    }, Math.max(1200, notificationDisplayDurationMs));

    return () => {
      window.clearTimeout(timer);
    };
  }, [nonUrgentNotifications.length, notificationDisplayDurationMs, notificationIndex]);

  const activeEmergency = useMemo<TotemEmergencyOverlay | null>(() => {
    if (
      realtimeEmergency &&
      typeof realtimeEmergency.expiresAtMs === "number" &&
      realtimeEmergency.expiresAtMs > Date.now()
    ) {
      return realtimeEmergency;
    }

    if (
      bootstrapEmergency &&
      bootstrapEmergency.key !== dismissedBootstrapEmergencyKey
    ) {
      return bootstrapEmergency;
    }

    return null;
  }, [bootstrapEmergency, dismissedBootstrapEmergencyKey, realtimeEmergency]);

  const isEmergencyBlocking = Boolean(activeEmergency);

  useEffect(() => {
    isEmergencyBlockingRef.current = isEmergencyBlocking;
  }, [isEmergencyBlocking]);


  useEffect(() => {
    if (!session) {
      return;
    }

    return connectTotemClientRealtime(
      session.accessToken,
      (payload) => {
        setQuestionMode(payload.questionMode);
      },
      (payload) => {
        const durationSeconds =
          typeof payload.durationSeconds === "number" && payload.durationSeconds > 0
            ? Math.ceil(payload.durationSeconds)
            : null;
        const fallbackDurationSeconds = durationSeconds ?? 60;
        const expiresAtMs = Date.now() + fallbackDurationSeconds * 1000;

        setRealtimeEmergency({
          source: "realtime",
          key: `realtime-${payload.notificationId ?? "broadcast"}-${payload.emittedAt ?? Date.now()}`,
          title: payload.title?.trim() || "Emergencia en curso",
          message: payload.message,
          durationSeconds: fallbackDurationSeconds,
          notificationId:
            typeof payload.notificationId === "number" ? payload.notificationId : null,
          expiresAtMs,
        });
        setDismissedBootstrapEmergencyKey(null);
      },
      (payload) => {
        const action =
          typeof payload?.action === "string" ? payload.action.toLowerCase() : "";
        const updatedNotificationId =
          typeof payload?.notificationId === "number" ? payload.notificationId : null;

        if (action === "deleted" || action === "updated") {
          setRealtimeEmergency((current) => {
            if (!current) {
              return current;
            }

            if (updatedNotificationId === null) {
              return action === "deleted" ? null : current;
            }

            if (current.notificationId === updatedNotificationId) {
              return null;
            }

            return current;
          });
        }

        refresh();
      },
      (payload) => {
        if (Array.isArray(payload?.totemIds) && payload.totemIds.length > 0) {
          const currentTotemId = totemIdRef.current;
          if (currentTotemId && !payload.totemIds.includes(currentTotemId)) {
            return;
          }
        }

        refresh();
      },
      () => {
        invalidateTotemClientSession("forbidden");
      },
    );
  }, [refresh, session]);

  const reportDeviceStatus = useCallback(
    async (nextStatus: Pick<TotemClientDeviceStatus, "camera" | "microphone">) => {
      if (!session) {
        return;
      }

      const serializedStatus = JSON.stringify(nextStatus);
      const previousReportedStatus = lastReportedDeviceStatusRef.current;

      if (serializedStatus === lastReportedDeviceStatusRef.current) {
        return;
      }

      try {
        const response = await totemClientService.reportDeviceStatus(nextStatus);
        lastReportedDeviceStatusRef.current = serializedStatus;
        applyQuestionMode(response.data.questionMode);
        setDeviceReportWarning("");
      } catch (err) {
        lastReportedDeviceStatusRef.current = previousReportedStatus;
        setDeviceReportWarning(
          getErrorMessage(err, "No se pudo sincronizar el estado de cámara y micrófono."),
        );
      }
    },
    [applyQuestionMode, session],
  );

  const updateCameraStatus = useCallback(
    (camera: TotemClientDeviceInfo) => {
      setDeviceStatus((previous) => {
        const nextStatus = {
          ...previous,
          camera,
        };

        void reportDeviceStatus(nextStatus);
        return nextStatus;
      });
    },
    [reportDeviceStatus],
  );

  const updateMicrophoneStatus = useCallback(
    (microphone: TotemClientDeviceInfo) => {
      setDeviceStatus((previous) => {
        const nextStatus = {
          ...previous,
          microphone,
        };

        void reportDeviceStatus(nextStatus);
        return nextStatus;
      });
    },
    [reportDeviceStatus],
  );

  const registerQuestionModeActivity = useCallback(
    async (
      activityType: TotemQuestionModeActivityType,
      options: { notifyBackend?: boolean } = {},
    ) => {
      const { notifyBackend = true } = options;
      setQuestionModeActivityVersion((value) => value + 1);

      if (!notifyBackend || !session) {
        return;
      }

      if (activityType === "transcription_updated") {
        const now = Date.now();

        if (now - lastTranscriptionActivitySyncRef.current < 1200) {
          return;
        }

        lastTranscriptionActivitySyncRef.current = now;
      }

      try {
        const response = await totemClientService.reportQuestionModeActivity(activityType);
        applyQuestionMode(response.data.questionMode);

        if (Object.prototype.hasOwnProperty.call(response.data, "questionSession")) {
          setQuestionSession(response.data.questionSession ?? null);
        }
      } catch {
        // La experiencia local no se detiene por errores puntuales de sincronización.
      }
    },
    [applyQuestionMode, session],
  );

  const resumeListeningAfterResponse = useCallback(async () => {
    if (!isQuestionModeActiveRef.current || isEmergencyBlockingRef.current) {
      return;
    }

    clearQuestionImageCarousel();
    resetTranscript();
    previousTranscriptRef.current = "";

    try {
      await SpeechRecognition.startListening({
        continuous: true,
        language: "es-ES",
      });
      setQuestionUiState("listening");
      void registerQuestionModeActivity("listening_started");
    } catch {
      // No se interrumpe el flujo por fallos puntuales al reanudar escucha.
    }
  }, [clearQuestionImageCarousel, registerQuestionModeActivity, resetTranscript]);

  const completeAnswerFlowAfterResponse = useCallback(() => {
    if (!isQuestionModeActiveRef.current || isEmergencyBlockingRef.current) {
      return;
    }

    setQuestionUiState((previous) => (previous === "error" ? previous : "listening"));
    void registerQuestionModeActivity("transcription_updated");
    void resumeListeningAfterResponse();
  }, [registerQuestionModeActivity, resumeListeningAfterResponse]);

  const startQuestionImageCarousel = useCallback(
    (rawImages: TotemClientQuestionImage[]) => {
      if (!isQuestionModeActiveRef.current || isEmergencyBlockingRef.current) {
        clearQuestionImageCarousel();
        return;
      }

      const orderedImages = sortQuestionImagesForDisplay(
        rawImages.filter((image) => isRenderableQuestionImage(image)),
      );

      if (orderedImages.length === 0) {
        completeAnswerFlowAfterResponse();
        return;
      }

      if (questionImageCarouselTimerRef.current !== null) {
        window.clearTimeout(questionImageCarouselTimerRef.current);
        questionImageCarouselTimerRef.current = null;
      }

      setAnswerImages(orderedImages);
      setCurrentAnswerImageIndex(0);
      setQuestionUiState("showing_images");
      void registerQuestionModeActivity("transcription_updated");

      const scheduleNextImage = (imageIndex: number) => {
        questionImageCarouselTimerRef.current = window.setTimeout(() => {
          if (!isQuestionModeActiveRef.current || isEmergencyBlockingRef.current) {
            clearQuestionImageCarousel();
            return;
          }

          const nextImageIndex = imageIndex + 1;

          if (nextImageIndex >= orderedImages.length) {
            questionImageCarouselTimerRef.current = null;
            completeAnswerFlowAfterResponse();
            return;
          }

          setCurrentAnswerImageIndex(nextImageIndex);
          void registerQuestionModeActivity("transcription_updated");
          scheduleNextImage(nextImageIndex);
        }, QUESTION_ANSWER_IMAGE_DISPLAY_MS);
      };

      scheduleNextImage(0);
    },
    [
      clearQuestionImageCarousel,
      completeAnswerFlowAfterResponse,
      registerQuestionModeActivity,
    ],
  );

  const speakAnswer = useCallback(
    (
      textToSpeak: string,
      options: {
        onCompleted?: () => void;
      } = {},
    ) => {
      const normalizedText = textToSpeak.trim();
      const onPlaybackCompleted =
        options.onCompleted ?? (() => completeAnswerFlowAfterResponse());

      if (normalizedText.length === 0) {
        onPlaybackCompleted();
        return;
      }

      if (typeof window === "undefined" || !("speechSynthesis" in window)) {
        setSpeechWarning(
          "El navegador no soporta síntesis de voz. La respuesta seguirá mostrándose en pantalla.",
        );
        onPlaybackCompleted();
        return;
      }

      cancelSpeechPlayback();
      clearQuestionSubmitTimer();
      void SpeechRecognition.stopListening();
      setSpeechWarning("");

      const utterance = new SpeechSynthesisUtterance(normalizedText);
      utterance.lang = "es-ES";
      utterance.rate = 1;
      utterance.pitch = 1;

      const voice = pickSpanishVoice(window.speechSynthesis.getVoices());

      if (voice) {
        utterance.voice = voice;
      }

      utterance.onstart = () => {
        if (activeUtteranceRef.current !== utterance) {
          return;
        }

        setQuestionUiState("speaking");
        void registerQuestionModeActivity("transcription_updated");
      };

      utterance.onend = () => {
        if (activeUtteranceRef.current !== utterance) {
          return;
        }

        activeUtteranceRef.current = null;
        void registerQuestionModeActivity("transcription_updated");
        onPlaybackCompleted();
      };

      utterance.onerror = () => {
        if (activeUtteranceRef.current !== utterance) {
          return;
        }

        activeUtteranceRef.current = null;
        setSpeechWarning(
          "No se pudo reproducir la respuesta por voz. Puedes continuar preguntando.",
        );
        onPlaybackCompleted();
      };

      activeUtteranceRef.current = utterance;
      window.speechSynthesis.speak(utterance);
    },
    [
      cancelSpeechPlayback,
      clearQuestionSubmitTimer,
      completeAnswerFlowAfterResponse,
      registerQuestionModeActivity,
    ],
  );

  const submitQuestion = useCallback(
    async (rawQuestionText: string) => {
      if (!session || !isQuestionModeActive || isSubmittingQuestion || isEmergencyBlockingRef.current) {
        return;
      }

      const normalizedQuestion = rawQuestionText.trim();

      if (normalizedQuestion.length === 0) {
        return;
      }

      if (normalizedQuestion.length > MAX_QUESTION_LENGTH) {
        setIsSubmittingQuestion(true);
        clearQuestionImageCarousel();
        cancelSpeechPlayback();
        clearQuestionSubmitTimer();
        await stopListeningSafely();
        resetTranscript();
        previousTranscriptRef.current = "";
        void registerQuestionModeActivity("transcription_updated");
        setCurrentQuestion(normalizedQuestion);
        setQuestionModeError("");
        setSpeechWarning("");
        setAnswerText(QUESTION_TOO_LONG_ANSWER_TEXT);
        setAnswerImages([]);
        setCurrentAnswerImageIndex(0);
        setQuestionUiState("answered");
        if (!isEmergencyBlockingRef.current) {
          speakAnswer(QUESTION_TOO_LONG_ANSWER_TEXT, {
            onCompleted: () => {
              completeAnswerFlowAfterResponse();
            },
          });
        }
        setIsSubmittingQuestion(false);
        return;
      }

      if (!isActiveSession(questionSession)) {
        setQuestionUiState("error");
        setQuestionModeError(
          "No hay una sesión activa de preguntas. Intenta volver a entrar al modo preguntas.",
        );
        return;
      }

      const now = Date.now();
      const isDuplicateRecentQuestion =
        lastSubmittedQuestionRef.current === normalizedQuestion &&
        now - lastSubmittedQuestionAtRef.current < QUESTION_REPEAT_GUARD_WINDOW_MS;

      if (isDuplicateRecentQuestion) {
        return;
      }

      lastSubmittedQuestionRef.current = normalizedQuestion;
      lastSubmittedQuestionAtRef.current = now;

      const questionWordCount = countMeaningfulWords(normalizedQuestion);
      const shouldRequestMoreCompleteQuestion =
        normalizedQuestion.length < MIN_QUESTION_CHARACTER_COUNT ||
        questionWordCount < MIN_QUESTION_WORD_COUNT;

      setCurrentQuestion(normalizedQuestion);
      setQuestionModeError("");

      if (shouldRequestMoreCompleteQuestion) {
        setIsSubmittingQuestion(true);
        clearQuestionImageCarousel();
        cancelSpeechPlayback();
        clearQuestionSubmitTimer();
        await stopListeningSafely();
        resetTranscript();
        previousTranscriptRef.current = "";
        void registerQuestionModeActivity("transcription_updated");
        setAnswerText(SHORT_QUESTION_ANSWER_TEXT);
        setAnswerImages([]);
        setCurrentAnswerImageIndex(0);
        setQuestionUiState("answered");
        if (!isEmergencyBlockingRef.current) {
          speakAnswer(SHORT_QUESTION_ANSWER_TEXT, {
            onCompleted: () => {
              completeAnswerFlowAfterResponse();
            },
          });
        }
        setIsSubmittingQuestion(false);
        return;
      }

      setQuestionUiState("processing");
      setIsSubmittingQuestion(true);
      clearQuestionImageCarousel();
      cancelSpeechPlayback();
      clearQuestionSubmitTimer();
      await stopListeningSafely();
      resetTranscript();
      previousTranscriptRef.current = "";
      void registerQuestionModeActivity("transcription_updated");

      try {
        const response = await totemClientService.submitQuestion(
          questionSession.id,
          normalizedQuestion,
        );

        applyQuestionMode(response.data.questionMode);
        setQuestionSession(response.data.session);
        setCurrentQuestion(response.data.questionText);
        setAnswerText(response.data.answerText);
        const responseImages = sortQuestionImagesForDisplay(
          (response.data.questionImages ?? []).filter((image) =>
            isRenderableQuestionImage(image),
          ),
        );
        setAnswerImages(responseImages);
        setCurrentAnswerImageIndex(0);
        setQuestionUiState("answered");
        setQuestionModeError("");
        void registerQuestionModeActivity("transcription_updated");
        if (!isEmergencyBlockingRef.current) {
          speakAnswer(response.data.answerText, {
            onCompleted: () => {
              if (responseImages.length > 0) {
                startQuestionImageCarousel(responseImages);
                return;
              }

              completeAnswerFlowAfterResponse();
            },
          });
        }
      } catch (err) {
        const fallbackAnswerText = resolveQuestionModeFallbackAnswer(err);

        if (fallbackAnswerText) {
          setQuestionUiState("answered");
          setQuestionModeError("");
          setAnswerText(fallbackAnswerText);
          setAnswerImages([]);
          setCurrentAnswerImageIndex(0);
          void registerQuestionModeActivity("transcription_updated");
          if (!isEmergencyBlockingRef.current) {
            speakAnswer(fallbackAnswerText, {
              onCompleted: () => {
                completeAnswerFlowAfterResponse();
              },
            });
          }
        } else {
          setQuestionUiState("error");
          setAnswerImages([]);
          setCurrentAnswerImageIndex(0);
          setQuestionModeError(
            getErrorMessage(err, "No se pudo procesar la pregunta del visitante."),
          );
        }
      } finally {
        setIsSubmittingQuestion(false);
        resetTranscript();
        previousTranscriptRef.current = "";
      }
    },
    [
      applyQuestionMode,
      cancelSpeechPlayback,
      clearQuestionImageCarousel,
      clearQuestionSubmitTimer,
      completeAnswerFlowAfterResponse,
      isQuestionModeActive,
      isSubmittingQuestion,
      questionSession,
      registerQuestionModeActivity,
      resetTranscript,
      session,
      speakAnswer,
      startQuestionImageCarousel,
      stopListeningSafely,
    ],
  );

  const handleExitQuestionMode = useCallback(
    async (reason: TotemQuestionModeExitReason) => {
      if (!session || questionMode.mode !== "question" || isExitingQuestionMode) {
        return;
      }

      setIsExitingQuestionMode(true);
      clearQuestionSubmitTimer();
      cancelSpeechPlayback();

      try {
        if (isActiveSession(questionSession)) {
          const endResponse = await totemClientService.endQuestionSession(
            questionSession.id,
            reason,
          );
          setQuestionSession(endResponse.data.session);
        }

        const response = await totemClientService.exitQuestionMode(reason);
        applyQuestionMode(response.data.questionMode);
        setQuestionSession(response.data.questionSession ?? null);
        setQuestionModeError("");
      } catch (err) {
        setQuestionModeError(getErrorMessage(err, "No se pudo salir del modo preguntas."));
      } finally {
        setIsExitingQuestionMode(false);
        setQuestionUiState("idle");
        setCurrentQuestion("");
        setAnswerText("");
        setAnswerImages([]);
        setCurrentAnswerImageIndex(0);
        setSpeechWarning("");
        setIsSubmittingQuestion(false);
        hasVoiceDetectedRef.current = false;
        previousTranscriptRef.current = "";
        clearQuestionSubmitTimer();
        clearQuestionImageCarousel();
        cancelSpeechPlayback();
        void SpeechRecognition.stopListening();
        resetTranscript();
      }
    },
    [
      applyQuestionMode,
      cancelSpeechPlayback,
      clearQuestionImageCarousel,
      clearQuestionSubmitTimer,
      isExitingQuestionMode,
      questionMode.mode,
      questionSession,
      resetTranscript,
      session,
    ],
  );

  useEffect(() => {
    speakAnswerRef.current = speakAnswer;
  }, [speakAnswer]);

  useEffect(() => {
    handleExitQuestionModeRef.current = handleExitQuestionMode;
  }, [handleExitQuestionMode]);

  const handlePalmDetected = useCallback(async () => {
    if (
      !session ||
      questionMode.mode === "question" ||
      isActivatingQuestionMode ||
      isEmergencyBlockingRef.current
    ) {
      return;
    }

    setIsActivatingQuestionMode(true);

    try {
      const response = await totemClientService.enterQuestionMode("open_palm");
      applyQuestionMode(response.data.questionMode);
      setQuestionModeError("");
    } catch (err) {
      setQuestionModeError(
        getErrorMessage(err, "No se pudo activar el modo preguntas por gesto."),
      );
    } finally {
      setIsActivatingQuestionMode(false);
    }
  }, [applyQuestionMode, isActivatingQuestionMode, questionMode.mode, session]);

  useEffect(() => {
    if (!questionMode.reactivationBlockedUntil) {
      setIsCooldownActive(false);
      return;
    }

    const remainingMs = Date.parse(questionMode.reactivationBlockedUntil) - Date.now();

    if (remainingMs <= 0) {
      setIsCooldownActive(false);
      return;
    }

    setIsCooldownActive(true);

    const timer = window.setTimeout(() => {
      setIsCooldownActive(false);
    }, remainingMs + 50);

    return () => {
      window.clearTimeout(timer);
    };
  }, [questionMode.reactivationBlockedUntil]);

  useEffect(() => {
    if (!isQuestionModeActive || isEmergencyBlocking) {
      hasVoiceDetectedRef.current = false;
      previousTranscriptRef.current = "";
      setQuestionModeActivityVersion(0);
      setQuestionUiState("idle");
      setCurrentQuestion("");
      setAnswerText("");
      setAnswerImages([]);
      setCurrentAnswerImageIndex(0);
      setSpeechWarning("");
      setIsSubmittingQuestion(false);
      setQuestionSession(null);
      clearQuestionSubmitTimer();
      clearQuestionImageCarousel();
      cancelSpeechPlayback();
      void SpeechRecognition.stopListening();
      resetTranscript();
      return;
    }

    if (!session) {
      setQuestionUiState("error");
      setQuestionModeError("La sesión del cliente tótem no está disponible.");
      return;
    }

    hasVoiceDetectedRef.current = false;
    previousTranscriptRef.current = "";
    setQuestionModeError("");
    setSpeechWarning("");
    setQuestionUiState("idle");
    setCurrentQuestion("");
    setAnswerText("");
    setAnswerImages([]);
    setCurrentAnswerImageIndex(0);
    setIsSubmittingQuestion(false);
    resetTranscript();
    void registerQuestionModeActivity("entered_mode", { notifyBackend: false });

    let cancelled = false;

    const startVoiceCapture = async () => {
      const microphoneInfo = await resolveMicrophoneStatus(browserSupportsSpeechRecognition);

      if (cancelled) {
        return;
      }

      updateMicrophoneStatus(microphoneInfo);

      if (!microphoneInfo.available || microphoneInfo.permission !== "granted") {
        setQuestionUiState("error");
        setQuestionModeError(microphoneInfo.error ?? "No se pudo acceder al micrófono.");
        return;
      }

      try {
        await SpeechRecognition.startListening({
          continuous: true,
          language: "es-ES",
        });

        await registerQuestionModeActivity("listening_started");

        const response = await totemClientService.startQuestionSession();

        if (cancelled) {
          return;
        }

        applyQuestionMode(response.data.questionMode);
        setQuestionSession(response.data.session);
        setQuestionUiState("listening");
        setQuestionModeError("");
      } catch (err) {
        const fallbackAnswerText = resolveQuestionModeFallbackAnswer(err);

        if (fallbackAnswerText) {
          setQuestionUiState("answered");
          setQuestionModeError("");
          setAnswerText(fallbackAnswerText);
          setAnswerImages([]);
          setCurrentAnswerImageIndex(0);
          setSpeechWarning("");

          if (!isEmergencyBlockingRef.current) {
            speakAnswerRef.current?.(fallbackAnswerText, {
              onCompleted: () => {
                void handleExitQuestionModeRef.current?.("error");
              },
            });
          } else {
            void handleExitQuestionModeRef.current?.("error");
          }

          return;
        }

        const message = getErrorMessage(err, "No se pudo iniciar la captura de voz del tótem.");
        setQuestionUiState("error");
        setQuestionModeError(message);
        updateMicrophoneStatus({
          available: false,
          permission: "unknown",
          error: message,
        });
      }
    };

    void startVoiceCapture();

    return () => {
      cancelled = true;
      clearQuestionSubmitTimer();
      clearQuestionImageCarousel();
      cancelSpeechPlayback();
      void SpeechRecognition.stopListening();
    };
  }, [
    applyQuestionMode,
    browserSupportsSpeechRecognition,
    cancelSpeechPlayback,
    clearQuestionImageCarousel,
    clearQuestionSubmitTimer,
    isEmergencyBlocking,
    isQuestionModeActive,
    registerQuestionModeActivity,
    resetTranscript,
    session,
    updateMicrophoneStatus,
  ]);

  useEffect(() => {
    if (!isQuestionModeActive || isEmergencyBlocking) {
      return;
    }

    const normalizedTranscript = transcript.trim();
    const previousTranscript = previousTranscriptRef.current.trim();

    if (normalizedTranscript.length === 0 || normalizedTranscript === previousTranscript) {
      return;
    }

    if (
      questionUiState === "processing"
      || questionUiState === "speaking"
      || questionUiState === "showing_images"
    ) {
      previousTranscriptRef.current = transcript;
      return;
    }

    previousTranscriptRef.current = transcript;

    if (!hasVoiceDetectedRef.current) {
      hasVoiceDetectedRef.current = true;
      void registerQuestionModeActivity("voice_detected");
    }

    setQuestionUiState("listening");
    void registerQuestionModeActivity("transcription_updated");
    clearQuestionSubmitTimer();

    questionSubmitTimerRef.current = window.setTimeout(() => {
      if (!isQuestionModeActive || isSubmittingQuestion || !isActiveSession(questionSession)) {
        return;
      }

      void submitQuestion(normalizedTranscript);
    }, QUESTION_SUBMIT_DEBOUNCE_MS);
  }, [
    clearQuestionSubmitTimer,
    isEmergencyBlocking,
    isQuestionModeActive,
    isSubmittingQuestion,
    questionSession,
    questionUiState,
    registerQuestionModeActivity,
    submitQuestion,
    transcript,
  ]);

  useEffect(() => {
    if (
      !isQuestionModeActive
      || (questionUiState !== "speaking" && questionUiState !== "showing_images")
    ) {
      return;
    }

    const timer = window.setInterval(() => {
      void registerQuestionModeActivity("transcription_updated");
    }, SPEAKING_ACTIVITY_SYNC_INTERVAL_MS);

    return () => {
      window.clearInterval(timer);
    };
  }, [isQuestionModeActive, questionUiState, registerQuestionModeActivity]);

  useEffect(() => {
    if (!isQuestionModeActive) {
      return;
    }

    const timer = window.setTimeout(() => {
      void handleExitQuestionMode("timeout");
    }, inactivityTimeoutSeconds * 1000);

    return () => {
      window.clearTimeout(timer);
    };
  }, [
    handleExitQuestionMode,
    inactivityTimeoutSeconds,
    isQuestionModeActive,
    questionModeActivityVersion,
  ]);

  const gestureDetectionEnabled =
    !isEmergencyBlocking &&
    !isQuestionModeActive &&
    !isCooldownActive &&
    !isActivatingQuestionMode;

  const groupedContents = useMemo(() => {
    if (visibleContents.length === 0) {
      return {
        image: [],
        video: [],
        news: [],
        advertisement: [],
      };
    }

    return groupDisplayContents(visibleContents);
  }, [visibleContents]);

  const visualSectionOrder = useMemo<TotemVisualContentType[]>(
    () => VISUAL_SECTION_ORDER.filter((type) => groupedContents[type].length > 0),
    [groupedContents],
  );
  const primaryVisualType = visualSectionOrder[0] ?? null;
  const secondaryVisualTypes = visualSectionOrder.slice(1);
  const hasNewsSection = groupedContents.news.length > 0;
  const hasVisibleSections = visualSectionOrder.length > 0 || hasNewsSection;
  const shouldRenderNewsInFooter = hasNewsSection && primaryVisualType !== null;

  const activeHeaderNotification = useMemo(() => {
    if (nonUrgentNotifications.length === 0) {
      return null;
    }

    return nonUrgentNotifications[notificationIndex % nonUrgentNotifications.length];
  }, [nonUrgentNotifications, notificationIndex]);
  const activeNotificationSignature = activeHeaderNotification
    ? `${activeHeaderNotification.id}:${activeHeaderNotification.title ?? ""}:${activeHeaderNotification.message ?? ""}:${notificationIndex}`
    : "no-notification";
  const handleNotificationDisplayDurationChange = useCallback((durationMs: number) => {
    const normalizedDurationMs =
      Number.isFinite(durationMs) && durationMs > 0
        ? Math.max(1200, Math.ceil(durationMs))
        : NOTIFICATION_CAROUSEL_INTERVAL_MS;

    setNotificationDisplayDurationMs((currentDurationMs) =>
      currentDurationMs === normalizedDurationMs ? currentDurationMs : normalizedDurationMs,
    );
  }, []);

  useEffect(() => {
    setNotificationDisplayDurationMs(NOTIFICATION_CAROUSEL_INTERVAL_MS);
  }, [activeNotificationSignature]);

  const totemDisplayName =
    data?.totem?.name?.trim() ||
    session?.totem?.name?.trim() ||
    "Cliente Tótem";
  const campusDisplayName =
    data?.totem?.campusName?.trim() ||
    session?.totem?.campusName?.trim() ||
    "";

  const handleEmergencyClose = useCallback(() => {
    if (!activeEmergency) {
      return;
    }

    if (activeEmergency.source === "realtime") {
      setRealtimeEmergency((current) =>
        current?.key === activeEmergency.key ? null : current,
      );
      return;
    }

    setDismissedBootstrapEmergencyKey(activeEmergency.key);
  }, [activeEmergency]);

  const visibleNetworkWarning = useAutoDismissMessage(
    networkWarning,
    CLIENT_MESSAGE_AUTO_HIDE_MS,
  );
  const visibleCameraError = useAutoDismissMessage(
    deviceStatus.camera.error ?? "",
    CLIENT_MESSAGE_AUTO_HIDE_MS,
  );
  const visibleDeviceReportWarning = useAutoDismissMessage(
    deviceReportWarning,
    CLIENT_MESSAGE_AUTO_HIDE_MS,
  );
  const visibleQuestionModeError = useAutoDismissMessage(
    questionModeError,
    CLIENT_MESSAGE_AUTO_HIDE_MS,
  );
  const floatingFeedbackMessages = useMemo<TotemFloatingFeedbackMessage[]>(() => {
    const messages: TotemFloatingFeedbackMessage[] = [];

    if (visibleQuestionModeError) {
      messages.push({
        id: "question-mode-error",
        type: "error",
        label: "Error",
        message: visibleQuestionModeError,
      });
    }

    if (visibleCameraError) {
      messages.push({
        id: "camera-warning",
        type: "warning",
        label: "Cámara",
        message: `Cámara: ${visibleCameraError}`,
      });
    }

    if (visibleNetworkWarning) {
      messages.push({
        id: "network-warning",
        type: "warning",
        label: "Conexión",
        message: visibleNetworkWarning,
      });
    }

    if (visibleDeviceReportWarning) {
      messages.push({
        id: "device-sync-warning",
        type: "neutral",
        label: "Sincronización",
        message: visibleDeviceReportWarning,
      });
    }

    const seen = new Set<string>();
    return messages.filter((item) => {
      const key = item.message.trim().toLowerCase();
      if (!key || seen.has(key)) {
        return false;
      }

      seen.add(key);
      return true;
    });
  }, [
    visibleCameraError,
    visibleDeviceReportWarning,
    visibleNetworkWarning,
    visibleQuestionModeError,
  ]);

  const handleLinkSubmit = useCallback(async () => {
    const normalizedLinkCode = linkCode.toUpperCase().replace(/[\s-]+/g, "").trim();

    if (!normalizedLinkCode) {
      setLinkError("Debes ingresar el código temporal de vinculación.");
      return;
    }

    setIsLinkingDevice(true);
    setLinkError("");

    try {
      await linkTotemClientDevice(normalizedLinkCode);
      setLinkCode("");
      setBootstrapRetryCountdown(null);
    } catch (err) {
      setLinkError(getErrorMessage(err, "No se pudo vincular el dispositivo."));
    } finally {
      setIsLinkingDevice(false);
    }
  }, [linkCode]);

  const handleUnlinkDevice = useCallback(() => {
    if (isUnlinkingDevice) {
      return;
    }

    setIsUnlinkConfirmOpen(true);
  }, [isUnlinkingDevice]);

  const handleCancelUnlinkDevice = useCallback(() => {
    if (isUnlinkingDevice) {
      return;
    }

    setIsUnlinkConfirmOpen(false);
  }, [isUnlinkingDevice]);

  const handleConfirmUnlinkDevice = useCallback(async () => {
    if (isUnlinkingDevice) {
      return;
    }

    setIsUnlinkConfirmOpen(false);
    setIsUnlinkingDevice(true);

    try {
      await unlinkTotemClientDevice();
    } finally {
      setIsUnlinkingDevice(false);
    }
  }, [isUnlinkingDevice]);

  if (!session) {
    return (
      <TotemClientLinkScreen
        linkCode={linkCode}
        error={linkError}
        isSubmitting={isLinkingDevice}
        onLinkCodeChange={(value) => {
          setLinkCode(value);
          if (linkError) {
            setLinkError("");
          }
        }}
        onSubmit={handleLinkSubmit}
      />
    );
  }

  if (loading) {
    return (
      <main
        className="relative flex h-screen w-screen items-center justify-center overflow-hidden bg-cover bg-center text-(--totem-text-primary)"
        style={{ backgroundImage: `url(${loginBg})` }}
      >
        <div className="pointer-events-none absolute inset-0 bg-black/68" />
        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(145deg,rgba(5,5,6,0.76)_0%,rgba(20,20,28,0.5)_48%,rgba(216,27,78,0.28)_100%)]" />
        <div className="relative inline-flex items-center gap-3 rounded-2xl border border-(--totem-border-strong) bg-(--totem-surface-2) px-6 py-4 text-sm font-semibold shadow-lg shadow-black/45">
          <RefreshCcw className="h-4 w-4 animate-spin" />
          Inicializando cliente tótem...
        </div>
      </main>
    );
  }

  if (error) {
    return (
      <TotemClientSystemScreen
        icon={MonitorOff}
        title="No se pudo iniciar el cliente"
        message={error}
        details={
          bootstrapRetryCountdown === null
            ? "Reintentando automáticamente."
            : `Reintentando automáticamente en ${bootstrapRetryCountdown} segundos.`
        }
      />
    );
  }

  if (activeEmergency) {
    return (
      <EmergencyModal
        active={Boolean(activeEmergency)}
        title={activeEmergency.title}
        message={activeEmergency.message}
        durationSeconds={activeEmergency.durationSeconds}
        emergencyKey={activeEmergency.key}
        onClose={handleEmergencyClose}
      />
    );
  }

  if (isQuestionModeActive) {
    const questionViewState: TotemQuestionUiState =
      questionModeError || deviceStatus.microphone.error ? "error" : questionUiState;

    return (
      <TotemQuestionModeView
        transcript={transcript}
        currentQuestion={currentQuestion}
        answerText={answerText}
        answerImages={answerImages}
        currentAnswerImageIndex={currentAnswerImageIndex}
        state={questionViewState}
        isListening={listening}
        hasActiveSession={isActiveSession(questionSession)}
        inactivityTimeoutSeconds={inactivityTimeoutSeconds}
        errorMessage={questionModeError || deviceStatus.microphone.error || ""}
        warningMessage={speechWarning}
      />
    );
  }

  return (
    <main
      className="relative h-screen w-screen overflow-hidden bg-cover bg-center text-(--totem-text-primary)"
      style={{ backgroundImage: `url(${loginBg})` }}
    >
      <div className="pointer-events-none absolute inset-0 bg-black/68" />
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(145deg,rgba(5,5,6,0.76)_0%,rgba(20,20,28,0.5)_48%,rgba(216,27,78,0.28)_100%)]" />
      <PalmDetector
        enabled={gestureDetectionEnabled}
        onPalmDetected={handlePalmDetected}
        onStatusChange={updateCameraStatus}
      />
      <div className="relative z-10 flex h-full w-full flex-col overflow-hidden">
        <header className="flex shrink-0 items-center gap-3 border-b border-(--totem-border) bg-(--totem-surface-2)/94 px-3 py-2.5 backdrop-blur-sm lg:px-4 lg:py-3">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-(--totem-border-strong) bg-black/35 shadow-md shadow-black/35">
            <img src={logoIcon} alt="Logo Totem" className="h-9 w-9 object-contain" />
          </div>

          <div className="min-w-0 max-w-[clamp(8.5rem,18vw,15rem)] shrink">
            <div
              className="flex h-12 items-center rounded-xl border border-(--totem-border-strong) bg-(--totem-surface-3)/88 px-3 shadow-sm shadow-black/20"
              title={totemDisplayName}
              aria-label={`Tótem ${totemDisplayName}`}
            >
              <p className="w-full truncate text-sm font-semibold leading-tight text-(--totem-text-primary) lg:text-sm">
                {totemDisplayName}
              </p>
            </div>
          </div>

          <div className="flex min-w-0 flex-1 items-center gap-2 text-xs font-semibold text-(--totem-text-secondary) lg:text-sm">
            <TotemWeatherBadge
              weather={data?.weather ?? null}
              className="shrink-0"
            />
            <NotificationBanner
              notification={activeHeaderNotification}
              activeIndex={notificationIndex}
              className="min-w-0 flex-1"
              baseDurationMs={NOTIFICATION_CAROUSEL_INTERVAL_MS}
              onDisplayDurationChange={handleNotificationDisplayDurationChange}
            />
            <button
              type="button"
              onClick={handleUnlinkDevice}
              disabled={isUnlinkingDevice}
              className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-(--totem-border-strong) bg-(--totem-surface-3) px-2.5 py-1.5 text-[11px] font-semibold text-(--totem-text-primary) transition hover:border-(--totem-accent-soft) hover:text-(--totem-accent) disabled:cursor-not-allowed disabled:opacity-70"
            >
              <Link2Off className="h-3.5 w-3.5" />
              {isUnlinkingDevice && "Desvinculando..."}
            </button>
          </div>
        </header>

        {floatingFeedbackMessages.length > 0 && (
          <aside className="pointer-events-none fixed right-3 top-18 z-70 flex w-[min(92vw,26rem)] flex-col gap-2 lg:right-4 lg:top-20">
            {floatingFeedbackMessages.map((item) => (
              <FeedbackMessage
                key={item.id}
                type={item.type}
                label={item.label}
                message={item.message}
                layout="inline"
              />
            ))}
          </aside>
        )}

        <section className="relative min-h-0 flex-1 overflow-hidden">
          <div
            className="pointer-events-none absolute inset-0 bg-cover bg-center"
            style={{ backgroundImage: `url(${loginBg})` }}
          />
          <div className="pointer-events-none absolute inset-0 bg-black/68" />
          <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(145deg,rgba(5,5,6,0.76)_0%,rgba(20,20,28,0.5)_48%,rgba(216,27,78,0.28)_100%)]" />

          {hasVisibleSections ? (
            <div className="relative z-10 flex h-full min-h-0 flex-col gap-2 px-2 py-2 lg:gap-3 lg:px-3 lg:py-3">
              <div className={`min-h-0 ${shouldRenderNewsInFooter ? "flex-1" : "h-full"}`}>
                {primaryVisualType ? (
                  secondaryVisualTypes.length > 0 ? (
                    <div className="grid h-full min-h-0 grid-cols-12 gap-2 lg:gap-3">
                      <TotemDisplayPanel
                        key={buildPanelKey(primaryVisualType, groupedContents[primaryVisualType])}
                        type={primaryVisualType}
                        items={groupedContents[primaryVisualType]}
                        className="col-span-12 h-full min-h-0 md:col-span-8"
                        panelLabel="Pantalla principal"
                      />

                      <div className={`col-span-12 grid min-h-0 gap-2 md:col-span-4 lg:gap-3 ${secondaryVisualTypes.length > 1 ? "grid-rows-2" : "grid-rows-1"}`}>
                        {secondaryVisualTypes.slice(0, 2).map((type) => (
                          <TotemDisplayPanel
                            key={buildPanelKey(type, groupedContents[type])}
                            type={type}
                            items={groupedContents[type]}
                            compact
                            className="h-full min-h-0"
                            panelLabel={type === "advertisement" ? "Publicidad" : undefined}
                          />
                        ))}
                      </div>
                    </div>
                  ) : (
                    <TotemDisplayPanel
                      key={buildPanelKey(primaryVisualType, groupedContents[primaryVisualType])}
                      type={primaryVisualType}
                      items={groupedContents[primaryVisualType]}
                      className="h-full min-h-0"
                      panelLabel="Contenido multimedia"
                    />
                  )
                ) : (
                  <TotemDisplayPanel
                    key={buildPanelKey("news", groupedContents.news)}
                    type="news"
                    items={groupedContents.news}
                    className="h-full min-h-0"
                  />
                )}
              </div>

              {shouldRenderNewsInFooter ? (
                <div className="h-[clamp(8rem,22vh,12.5rem)] min-h-32 max-h-50 shrink-0">
                  <TotemDisplayPanel
                    key={buildPanelKey("news", groupedContents.news)}
                    type="news"
                    items={groupedContents.news}
                    compact
                    className="h-full min-h-0"
                    panelLabel="Noticias"
                  />
                </div>
              ) : null}
            </div>
          ) : (
            <div className="relative z-10 flex h-full min-h-0 items-center justify-center overflow-hidden p-4 lg:p-8">
              <article className="relative flex min-h-[min(34rem,78vh)] w-full max-w-4xl items-center justify-center overflow-hidden rounded-2xl border border-white/15 bg-(--totem-surface-2)/88 px-6 py-8 text-center shadow-2xl shadow-black/50 backdrop-blur-md sm:px-10 lg:px-14">
                <div className="relative z-10 mx-auto flex max-w-2xl flex-col items-center">
                  <div className="flex h-24 w-24 items-center justify-center rounded-full border border-white/15 bg-white/94 shadow-xl shadow-black/35">
                    <img src={logoIcon} alt="Logo Totem" className="h-16 w-16 object-contain" />
                  </div>

                  {campusDisplayName ? (
                    <p className="mt-6 text-sm font-semibold text-(--totem-accent) lg:text-base">
                      {campusDisplayName}
                    </p>
                  ) : null}

                  <h2 className="mt-3 text-4xl font-bold leading-tight text-(--totem-text-primary) sm:text-5xl lg:text-6xl">
                    Bienvenido
                  </h2>

                  <p className="mt-5 max-w-xl text-lg font-semibold leading-relaxed text-(--totem-text-secondary) sm:text-xl lg:text-2xl">
                    La información estará disponible próximamente.
                  </p>

                  <p className="mt-4 max-w-xl text-sm leading-relaxed text-(--totem-text-muted) sm:text-base">
                    Este tótem está listo para mostrar contenidos cuando sean asignados.
                  </p>

                  <div className="mt-8 flex max-w-full flex-wrap items-center justify-center gap-2 text-xs font-semibold text-(--totem-text-secondary) sm:text-sm">
                    <span className="max-w-full truncate rounded-full border border-white/12 bg-white/8 px-3 py-1.5">
                      {totemDisplayName}
                    </span>
                    <span className="rounded-full border border-(--totem-border-strong) bg-(--totem-surface-3)/80 px-3 py-1.5 text-(--totem-text-muted)">
                      Sin contenidos asignados actualmente
                    </span>
                  </div>
                </div>
              </article>
            </div>
          )}
        </section>
      </div>

      <ConfirmDialog
        isOpen={isUnlinkConfirmOpen}
        title="Desvincular Dispositivo"
        message="Se cerrará la sesión del dispositivo en este tótem. ¿Deseas continuar?"
        confirmLabel="Sí, desvincular"
        cancelLabel="Cancelar"
        loading={isUnlinkingDevice}
        variant="totem"
        closeOnBackdrop
        closeOnEscape
        onConfirm={handleConfirmUnlinkDevice}
        onCancel={handleCancelUnlinkDevice}
      />
    </main>
  );
}
