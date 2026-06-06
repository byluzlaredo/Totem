import { AlertTriangle, CheckCircle2, Info, X } from "lucide-react";
import { useEffect, useState } from "react";

interface FeedbackMessageProps {
  type: "success" | "error" | "neutral" | "warning";
  message: string;
  onClose?: () => void;
  layout?: "floating" | "inline";
  containerClassName?: string;
  label?: string;
}

export default function FeedbackMessage({
  type,
  message,
  onClose,
  layout = "floating",
  containerClassName = "",
  label,
}: FeedbackMessageProps) {
  const isSuccess = type === "success";
  const isError = type === "error";
  const isNeutral = type === "neutral";
  const isWarning = type === "warning";
  const isInline = layout === "inline";
  const resolvedLabel = label
    ?? (isSuccess
      ? "Éxito"
      : isWarning
        ? "Advertencia"
        : isNeutral
          ? "Información"
          : "Error");
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    setIsVisible(true);
  }, [containerClassName, label, layout, message, type]);

  if (!message || !isVisible) {
    return null;
  }

  function handleClose() {
    setIsVisible(false);
    onClose?.();
  }

  return (
    <section
      aria-live="polite"
      role={isError || isWarning ? "alert" : "status"}
      className={`${isInline
        ? "w-full"
        : "pointer-events-none fixed right-5 top-6 z-70 w-[min(94vw,460px)]"
        } ${containerClassName}`}
    >
      <div
        className={`pointer-events-auto rounded-2xl border px-3 py-2 shadow-lg ${isSuccess
          ? "border-[#bde3cc] bg-[#f4fbf7]"
          : isWarning
            ? "border-[#f1d7aa] bg-[#fff8ee]"
            : isNeutral
              ? "border-[#c8daf7] bg-[#f3f7ff]"
              : "border-[#f3c2cb] bg-[#fff7f8]"
          }`}
      >
        <div className="flex items-start gap-4">
          <div
            className={`mt-0.5 flex h-8 w-8 items-center justify-center rounded-xl border ${isSuccess
              ? "border-[#bde3cc] bg-[#dff3e7] text-[#0f7a3a]"
              : isWarning
                ? "border-[#f1d7aa] bg-[#fff0da] text-[#8f5b0a]"
                : isNeutral
                  ? "border-[#c8daf7] bg-[#eaf2ff] text-[#1f5dbd]"
                  : "border-[#f3c2cb] bg-[#fdebef] text-[#b42346]"
              }`}
          >
            {isSuccess ? (
              <CheckCircle2 className="h-4 w-4" />
            ) : isNeutral ? (
              <Info className="h-4 w-4" />
            ) : (
              <AlertTriangle className="h-4 w-4" />
            )}
          </div>

          <div className="flex-1">
            <p
              className={`text-xs font-semibold tracking-widest ${isSuccess
                ? "text-[#0f7a3a]"
                : isWarning
                  ? "text-[#8f5b0a]"
                  : isNeutral
                    ? "text-[#1f5dbd]"
                    : "text-[#b42346]"
                }`}
            >
              {resolvedLabel}
            </p>
            <p className="mt-1 whitespace-pre-line text-xs leading-4 text-(--color-text-main)">{message}</p>
          </div>

          <button
            type="button"
            onClick={handleClose}
            className="inline-flex h-8 w-8 items-center justify-center rounded-md text-(--color-text-secondary) transition hover:bg-white/80 hover:text-(--color-text-main)"
            aria-label="Cerrar mensaje"
            title="Cerrar mensaje"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    </section>
  );
}
