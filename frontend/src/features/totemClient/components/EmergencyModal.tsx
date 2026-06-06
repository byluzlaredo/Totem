import { AlertTriangle, Clock3 } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { HorizontalScrollingText, VerticalScrollingText } from "./ScrollingText";

interface EmergencyModalProps {
  active: boolean;
  title?: string;
  message: string;
  durationSeconds?: number | null;
  emergencyKey?: string;
  onClose?: () => void;
}

const FALLBACK_DURATION_SECONDS = 60;

export default function EmergencyModal({
  active,
  title = "",
  message,
  durationSeconds,
  emergencyKey,
  onClose,
}: EmergencyModalProps) {
  const [countdown, setCountdown] = useState(FALLBACK_DURATION_SECONDS);
  const [totalDurationSeconds, setTotalDurationSeconds] = useState(FALLBACK_DURATION_SECONDS);
  const currentEmergencyKeyRef = useRef<string | null>(null);
  const intervalRef = useRef<number | null>(null);
  const onCloseRef = useRef(onClose);

  const normalizedDurationSeconds = useMemo(
    () =>
      typeof durationSeconds === "number" && durationSeconds > 0
        ? Math.ceil(durationSeconds)
        : FALLBACK_DURATION_SECONDS,
    [durationSeconds],
  );

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!active) {
      if (intervalRef.current !== null) {
        window.clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      currentEmergencyKeyRef.current = null;
      return;
    }

    const nextKey = emergencyKey ?? "__default_emergency__";
    const isNewEmergency = currentEmergencyKeyRef.current !== nextKey;

    if (isNewEmergency) {
      currentEmergencyKeyRef.current = nextKey;
      setCountdown(normalizedDurationSeconds);
      setTotalDurationSeconds(normalizedDurationSeconds);
    } else {
      // Si es la misma emergencia, evita reiniciar progreso en cada refresh.
      setCountdown((previous) => Math.min(previous, normalizedDurationSeconds));
    }
  }, [active, emergencyKey, normalizedDurationSeconds]);

  useEffect(() => {
    if (!active) {
      return;
    }

    if (intervalRef.current !== null) {
      window.clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    intervalRef.current = window.setInterval(() => {
      setCountdown((previous) => {
        if (previous <= 1) {
          if (intervalRef.current !== null) {
            window.clearInterval(intervalRef.current);
            intervalRef.current = null;
          }
          onCloseRef.current?.();
          return 0;
        }

        return previous - 1;
      });
    }, 1000);

    return () => {
      if (intervalRef.current !== null) {
        window.clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [active, emergencyKey]);

  if (!active) {
    return null;
  }

  const minutes = Math.floor(countdown / 60);
  const seconds = countdown % 60;
  const formattedTime = `${minutes}:${seconds.toString().padStart(2, "0")}`;
  const progress =
    totalDurationSeconds > 0
      ? Math.max(0, Math.min(1, countdown / totalDurationSeconds))
      : 0;
  const titleText = title.trim() || "Alerta de emergencia";
  const messageText =
    message?.trim() || "Se ha detectado una situación de emergencia en el campus.";

  return (
    <div className="fixed inset-0 z-999999 overflow-hidden bg-[#c0134d] text-white">
      <div className="absolute inset-0 bg-[linear-gradient(180deg,#d8245f_0%,#cc1b56_44%,#b50f46_100%)]" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_25%_18%,rgba(255,255,255,0.14),transparent_46%),radial-gradient(circle_at_82%_84%,rgba(255,255,255,0.09),transparent_42%)]" />

      <main className="relative flex h-screen w-screen items-stretch justify-stretch overflow-hidden p-2 sm:p-3 lg:p-4">
        <section className="mx-auto flex h-full w-full max-w-4xl flex-col overflow-hidden rounded-3xl border border-white/35 bg-white/6 p-4 text-center shadow-2xl shadow-black/35 sm:p-5 lg:p-6">
          <div className="shrink-0">
            <p className="mx-auto inline-flex items-center rounded-full border border-white/40 bg-white/12 px-3 py-1 text-[0.62rem] font-semibold uppercase tracking-[0.12em] text-white/95 sm:text-[0.7rem]">
              Alerta prioritaria
            </p>

            <div className="mx-auto mt-2 flex items-center justify-center">
              <div className="relative flex h-32 w-32 items-center justify-center rounded-full border-2 border-white/35 bg-white/8 sm:h-36 sm:w-36">
                <div className="pointer-events-none absolute inset-0 rounded-full border border-white/45 animate-pulse" />
                <div className="pointer-events-none absolute inset-[11%] rounded-full bg-white/14 animate-pulse" />
                <div className="relative z-10 flex h-20 w-20 items-center justify-center rounded-full bg-white sm:h-24 sm:w-24">
                  <AlertTriangle className="h-10 w-10 text-[#cf1f56] sm:h-11 sm:w-11" />
                </div>
              </div>
            </div>

            <h1 className="mt-3 text-[clamp(2.4rem,8vw,5.2rem)] font-extrabold tracking-[0.09em] text-white">
              EMERGENCIA
            </h1>

            <p className="mt-1 text-sm font-semibold text-white/90 sm:text-base">
              Mantenga la calma y siga las indicaciones del personal de seguridad.
            </p>
          </div>

          <div className="mt-3 grid min-h-0 flex-1 grid-rows-[auto_auto_minmax(0,1fr)] gap-3 text-white sm:mt-4 sm:gap-3.5">
            <section className="min-w-0 rounded-2xl border border-white/38 bg-white/18 px-5 py-4 sm:px-6 sm:py-8">
              <p className="text-[0.68rem] font-semibold uppercase tracking-widest text-white/90 sm:text-xs">
                Detalle de la alerta
              </p>
              <HorizontalScrollingText
                key={`emergency-title-${emergencyKey ?? "default"}-${titleText}`}
                as="p"
                value={titleText}
                className="w-full text-center text-[clamp(1.5rem,3.4vw,2.2rem)] font-bold leading-snug sm:text-3xl"
                containerClassName="mt-1.5 w-full min-w-0"
                speedPxPerSecond={44}
                startDelayMs={700}
                endDelayMs={700}
              />
              <VerticalScrollingText
                key={`emergency-message-${emergencyKey ?? "default"}-${messageText}`}
                as="p"
                value={messageText}
                className="text-center text-base font-semibold leading-relaxed text-white/95 sm:text-xl"
                containerClassName="mt-2 h-[clamp(4.8rem,15vh,9.2rem)] w-full min-w-0"
                speedPxPerSecond={32}
                startDelayMs={700}
                endDelayMs={750}
              />
            </section>

            <section className="mx-auto w-full rounded-2xl border border-white/26 bg-white/16 px-5 py-4 sm:px-6 sm:py-8">
              <p className="text-[0.68rem] font-semibold uppercase tracking-widest text-white/90 sm:text-xs">
                Recomendaciones inmediatas
              </p>
              <ul className="mt-2.5 space-y-1.5 text-base font-semibold leading-relaxed text-white sm:text-xl">
                <li>- Mantén la calma</li>
                <li>- Dirígete a la salida de emergencia más cercana</li>
                <li>- No uses los ascensores</li>
              </ul>
            </section>

            <section className="grid min-h-0 grid-rows-[auto_auto_minmax(0,1fr)_auto] rounded-2xl bg-white/10 px-4 py-3 sm:px-5 sm:py-4">
              <div className="flex items-center justify-center gap-2 text-xl font-semibold text-white sm:text-3xl">
                <Clock3 className="h-6 w-6 sm:h-7 sm:w-7" />
                <span>Mensaje activo:</span>
              </div>

              <p className="mt-1 text-xs font-semibold tracking-[0.08em] text-white/90 sm:text-sm">
                Protocolo de emergencia en curso.
              </p>

              <div className="flex min-h-0 flex-col items-center justify-center">
                <div className="mx-auto mt-1.5 h-3 w-full max-w-88 overflow-hidden rounded-full bg-white/26 sm:h-3.5">
                  <div
                    className="h-full rounded-full bg-white transition-[width] duration-500 ease-out"
                    style={{ width: `${progress * 100}%` }}
                  />
                </div>

                <p className="mt-2 text-[clamp(3rem,9vw,5.4rem)] font-bold tabular-nums text-white">
                  {formattedTime}
                </p>

                <p className="mt-1 text-xs font-semibold text-white/85 sm:text-sm">
                  Tiempo estimado restante del mensaje.
                </p>
              </div>

              <footer className="mt-3 w-full max-w-2xl justify-self-center rounded-xl bg-white/14 px-4 py-2 text-sm text-white sm:text-base">
                Emergencias: 911 | Seguridad Campus: ext. 5555
              </footer>
            </section>
          </div>
        </section>
      </main>
    </div>
  );
}
