import {
  AlertTriangle,
  Images,
  Loader2,
  MessageSquareText,
  Mic,
  MicOff,
  Volume2,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type { CSSProperties } from "react";
import loginBg from "../../../../assets/images/Login-bg.webp";
import type { TotemClientQuestionImage } from "../../../types/totemClient";
import { resolveAssetUrl } from "../../../utils/assetUrl";
import { VerticalScrollingText } from "./ScrollingText";

export type TotemQuestionUiState =
  | "idle"
  | "listening"
  | "processing"
  | "answered"
  | "speaking"
  | "showing_images"
  | "error";

interface TotemQuestionModeViewProps {
  transcript: string;
  currentQuestion: string;
  answerText: string;
  answerImages: TotemClientQuestionImage[];
  currentAnswerImageIndex: number;
  state: TotemQuestionUiState;
  isListening: boolean;
  hasActiveSession: boolean;
  inactivityTimeoutSeconds: number;
  errorMessage: string;
  warningMessage?: string;
}

const CLAMP_TRANSCRIPTION_STYLE: CSSProperties = {
  display: "-webkit-box",
  WebkitBoxOrient: "vertical",
  WebkitLineClamp: 4,
  overflow: "hidden",
};

const CLAMP_QUESTION_STYLE: CSSProperties = {
  display: "-webkit-box",
  WebkitBoxOrient: "vertical",
  WebkitLineClamp: 3,
  overflow: "hidden",
};

export default function TotemQuestionModeView({
  transcript,
  currentQuestion,
  answerText,
  answerImages,
  currentAnswerImageIndex,
  state,
  isListening,
  hasActiveSession,
  inactivityTimeoutSeconds,
  errorMessage,
  warningMessage = "",
}: TotemQuestionModeViewProps) {
  const hasError = state === "error" || errorMessage.trim().length > 0;
  const statusLabelByState: Record<TotemQuestionUiState, string> = {
    idle: hasActiveSession ? "Listo para escuchar" : "Iniciando sesión...",
    listening: "Escuchando...",
    processing: "Procesando pregunta...",
    answered: "Respuesta lista",
    speaking: "Reproduciendo respuesta...",
    showing_images: "Mostrando imágenes asociadas...",
    error: "Error de dispositivo",
  };
  const statusHintByState: Record<TotemQuestionUiState, string> = {
    idle: "Puedes hablar cuando quieras.",
    listening: "Habla con claridad y a un ritmo natural.",
    processing: "Estoy analizando tu consulta.",
    answered: "La respuesta ya está lista para el visitante.",
    speaking: "Se está reproduciendo la respuesta por voz.",
    showing_images: "Mostrando contenido visual relacionado.",
    error: "Verifica micrófono, permisos y conectividad.",
  };

  const statusLabel = hasError ? "Error de dispositivo" : statusLabelByState[state];
  const statusHint = hasError
    ? "Revisa los dispositivos y vuelve a activar el modo preguntas."
    : statusHintByState[state];
  const showPulse = state === "listening" && isListening;
  const hasCurrentQuestion = currentQuestion.trim().length > 0;
  const hasAnswer = answerText.trim().length > 0;
  const hasAnswerImages = answerImages.length > 0;
  const normalizedCurrentImageIndex = Math.max(0, currentAnswerImageIndex);
  const currentAnswerImage = useMemo(
    () => answerImages[normalizedCurrentImageIndex] ?? null,
    [answerImages, normalizedCurrentImageIndex],
  );
  const currentAnswerImageUrl = resolveAssetUrl(currentAnswerImage?.fileUrl ?? null);
  const [failedImageIds, setFailedImageIds] = useState<Set<number>>(new Set());

  useEffect(() => {
    setFailedImageIds(new Set());
  }, [answerImages]);

  const hasCurrentImageLoadError =
    currentAnswerImage?.id !== undefined && failedImageIds.has(currentAnswerImage.id);

  return (
    <main
      className="relative h-screen w-screen overflow-hidden bg-cover bg-center p-2 text-(--totem-text-primary) sm:p-3 lg:p-4"
      style={{ backgroundImage: `url(${loginBg})` }}
    >
      <div className="pointer-events-none absolute inset-0 bg-black/68" />
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(145deg,rgba(5,5,6,0.76)_0%,rgba(20,20,28,0.5)_48%,rgba(216,27,78,0.28)_100%)]" />

      <section className="relative z-10 mx-auto flex h-full w-full max-w-5xl flex-col overflow-hidden rounded-3xl border border-(--totem-border-strong) bg-(--totem-surface-2)/96 p-4 text-center shadow-2xl shadow-black/50 sm:p-5 lg:p-6">
        <div className="flex h-full w-full flex-col gap-3 overflow-hidden sm:gap-3.5">
          <header className="mx-auto w-full max-w-3xl shrink-0">
            <div className="mx-auto inline-flex items-center gap-1.5 rounded-full border border-(--totem-accent-soft) bg-(--totem-accent-surface) px-3 py-1 text-[0.62rem] font-semibold uppercase tracking-widest text-(--totem-accent) sm:px-3.5 sm:text-[0.7rem]">
              <MessageSquareText className="h-3.5 w-3.5" />
              Modo preguntas
            </div>

            <h1 className="mt-2 text-[clamp(1.6rem,5vw,2.55rem)] font-bold tracking-tight text-(--totem-text-primary)">
              Pregúntame lo que quieras
            </h1>

            <p className="mt-1 text-sm text-(--totem-text-secondary) sm:text-base">
              Interacción por voz asistida con respuestas en tiempo real.
            </p>

            <div className="mt-2.5 flex items-center justify-center">
              <div
                className={`relative flex h-32 w-32 items-center justify-center rounded-full border-2 sm:h-36 sm:w-36 ${hasError ? "border-(--totem-danger-soft)" : "border-(--totem-accent-soft)"
                  }`}
              >
                <div className="pointer-events-none absolute inset-0 rounded-full border border-white/20" />
                <div
                  className={`pointer-events-none absolute inset-[13%] rounded-full ${hasError
                      ? "bg-(--totem-danger-surface)"
                      : showPulse
                        ? "animate-pulse bg-(--totem-accent)/70"
                        : "bg-(--totem-accent-strong)/80"
                    }`}
                />

                <div className="relative z-10">
                  {hasError ? (
                    <MicOff className="h-11 w-11 text-(--totem-danger-text) sm:h-12 sm:w-12" />
                  ) : state === "processing" ? (
                    <Loader2 className="h-11 w-11 animate-spin text-white sm:h-12 sm:w-12" />
                  ) : state === "showing_images" ? (
                    <Images className="h-11 w-11 text-white sm:h-12 sm:w-12" />
                  ) : state === "speaking" ? (
                    <Volume2 className="h-11 w-11 text-white sm:h-12 sm:w-12" />
                  ) : (
                    <Mic className="h-11 w-11 text-white sm:h-12 sm:w-12" />
                  )}
                </div>
              </div>
            </div>

            <div
              className={`mt-2.5 inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold sm:px-6 sm:text-[0.95rem] ${hasError
                  ? "border-(--totem-danger-soft) bg-(--totem-danger-surface) text-(--totem-danger-text)"
                  : "border-(--totem-accent-soft) bg-(--totem-accent-surface) text-(--totem-text-primary)"
                }`}
            >
              {hasError ? <AlertTriangle className="h-4 w-4" /> : null}
              {statusLabel}
            </div>

            <p className="mt-1.5 text-[11px] leading-relaxed text-(--totem-text-secondary) sm:text-xs">
              {statusHint} Si no hay actividad por {inactivityTimeoutSeconds} segundos, volverá a la vista normal automáticamente.
            </p>

            <div className="mt-2 flex flex-wrap items-center justify-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.08em] sm:text-[11px]">
              <span className="rounded-full border border-(--totem-border-strong) bg-(--totem-surface-3) px-2.5 py-1 text-(--totem-text-secondary)">
                {hasActiveSession ? "Sesión activa" : "Sesión en preparación"}
              </span>
              <span className="rounded-full border border-(--totem-border-strong) bg-(--totem-surface-3) px-2.5 py-1 text-(--totem-text-secondary)">
                {isListening ? "Micrófono abierto" : "Micrófono en espera"}
              </span>
            </div>

            {!hasError && warningMessage.trim().length > 0 ? (
              <div className="mx-auto mt-2 w-full max-w-2xl rounded-xl border border-(--totem-warning-soft) bg-(--totem-warning-surface) px-3 py-1.5 text-xs text-(--totem-warning-text)">
                {warningMessage}
              </div>
            ) : null}
          </header>

          {hasError ? (
            <section className="mx-auto flex w-full max-w-3xl flex-col gap-2 rounded-2xl border border-(--totem-danger-soft) bg-(--totem-danger-surface) px-5 py-4 text-left text-(--totem-danger-text)">
              <p className="text-[0.64rem] font-semibold uppercase tracking-widest">Estado del dispositivo</p>
              <p className="text-sm leading-relaxed sm:text-base">{errorMessage}</p>
              <p className="text-xs text-(--totem-danger-text)/85 sm:text-sm">
                Intenta verificar permisos del navegador o reconectar el micrófono.
              </p>
            </section>
          ) : (
            <div
              className={`w-full min-h-0 flex-1 text-left ${hasAnswerImages
                  ? "grid min-h-0 gap-3 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.95fr)]"
                  : "grid min-h-0 grid-rows-[auto_auto_minmax(0,1fr)] gap-3"
                }`}
            >
              <div className="grid min-h-0 grid-rows-[auto_auto_minmax(0,1fr)] gap-3">
                <section className="overflow-hidden rounded-2xl border border-(--totem-border-strong) bg-(--totem-surface-3)/95 px-4 py-3.5">
                  <h2 className="text-[0.64rem] font-semibold uppercase tracking-widest text-(--totem-text-muted) sm:text-[0.7rem]">
                    Transcripción en vivo
                  </h2>
                  <p
                    className="mt-1.5 text-[0.95rem] leading-relaxed text-(--totem-text-primary) sm:text-[1rem]"
                    style={CLAMP_TRANSCRIPTION_STYLE}
                  >
                    {transcript.trim().length > 0
                      ? transcript
                      : "Esperando tu consulta por voz..."}
                  </p>
                </section>

                <section className="overflow-hidden rounded-2xl border border-(--totem-border-strong) bg-(--totem-surface-3)/95 px-4 py-3.5">
                  <h2 className="inline-flex items-center gap-1.5 text-[0.64rem] font-semibold uppercase tracking-widest text-(--totem-text-muted) sm:text-[0.7rem]">
                    <MessageSquareText className="h-3.5 w-3.5" />
                    Pregunta actual
                  </h2>
                  <p
                    className="mt-1.5 text-sm leading-relaxed text-(--totem-text-secondary) sm:text-[0.95rem]"
                    style={CLAMP_QUESTION_STYLE}
                  >
                    {hasCurrentQuestion ? currentQuestion : "Aún no se envió una pregunta."}
                  </p>
                </section>

                <section className="flex min-h-0 flex-col overflow-hidden rounded-2xl border border-(--totem-accent-soft) bg-(--totem-accent-surface) px-4 py-3.5">
                  <h2 className="inline-flex items-center gap-1.5 text-[0.64rem] font-semibold uppercase tracking-widest text-(--totem-accent) sm:text-[0.7rem]">
                    <Volume2 className="h-3.5 w-3.5" />
                    Respuesta
                  </h2>
                  <VerticalScrollingText
                    key={`question-answer-${hasAnswerImages ? "with-images" : "full"}-${answerText}`}
                    as="p"
                    value={hasAnswer ? answerText : "Esperando respuesta del servidor..."}
                    className={`text-base leading-relaxed text-(--totem-text-primary) ${hasAnswerImages ? "sm:text-lg" : "sm:text-xl"
                      }`}
                    containerClassName="mt-1.5 min-h-0 flex-1"
                    speedPxPerSecond={30}
                    startDelayMs={650}
                    endDelayMs={750}
                  />
                </section>
              </div>

              {hasAnswerImages ? (
                <section className="flex min-h-0 flex-col overflow-hidden rounded-2xl border border-(--totem-border-strong) bg-(--totem-surface-3)/95 px-4 py-3.5">
                  <div className="flex items-center justify-between gap-2">
                    <h2 className="inline-flex items-center gap-1.5 text-[0.64rem] font-semibold uppercase tracking-widest text-(--totem-text-muted) sm:text-[0.7rem]">
                      <Images className="h-3.5 w-3.5" />
                      Imágenes asociadas
                    </h2>
                    <span className="text-[10px] font-semibold uppercase tracking-[0.08em] text-(--totem-text-secondary) sm:text-[11px]">
                      {Math.min(normalizedCurrentImageIndex + 1, answerImages.length)} / {answerImages.length}
                    </span>
                  </div>

                  <p className="mt-1 text-[11px] text-(--totem-text-secondary) sm:text-xs">
                    Se alternan automáticamente según la respuesta.
                  </p>

                  <div className="relative mt-2 min-h-56 flex-1 overflow-hidden rounded-xl border border-(--totem-border-strong) bg-(--totem-surface-1)">
                    {currentAnswerImageUrl && !hasCurrentImageLoadError ? (
                      <>
                        <img
                          src={currentAnswerImageUrl}
                          alt=""
                          aria-hidden
                          className="pointer-events-none absolute inset-0 h-full w-full scale-110 object-cover opacity-45 blur-2xl"
                          loading="lazy"
                        />
                        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(10,10,14,0.12)_0%,rgba(10,10,14,0.62)_100%)]" />

                        <div className="relative z-10 flex h-full w-full items-center justify-center p-2.5">
                          <img
                            src={currentAnswerImageUrl}
                            alt="Imagen asociada a la respuesta"
                            className="h-full w-full object-contain drop-shadow-[0_14px_34px_rgba(0,0,0,0.52)]"
                            loading="lazy"
                            onError={() => {
                              if (!currentAnswerImage) {
                                return;
                              }

                              setFailedImageIds((previous) => {
                                const next = new Set(previous);
                                next.add(currentAnswerImage.id);
                                return next;
                              });
                            }}
                          />
                        </div>
                      </>
                    ) : (
                      <div className="flex h-full w-full items-center justify-center bg-[radial-gradient(circle_at_20%_20%,rgba(255,59,111,0.2),transparent_44%),linear-gradient(150deg,#1a1c28_0%,#12141d_58%,#0d1019_100%)] px-5 text-center text-xs leading-relaxed text-(--totem-text-secondary) sm:text-sm">
                        No se pudo cargar esta imagen. Se mostrará la siguiente automáticamente.
                      </div>
                    )}
                  </div>
                </section>
              ) : null}
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
