import { AlertTriangle, LoaderCircle } from "lucide-react";
import { useEffect, useId } from "react";

type ConfirmDialogVariant = "default" | "totem";

interface ConfirmDialogProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmLabel: string;
  cancelLabel?: string;
  loading?: boolean;
  variant?: ConfirmDialogVariant;
  closeOnBackdrop?: boolean;
  closeOnEscape?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function ConfirmDialog({
  isOpen,
  title,
  message,
  confirmLabel,
  cancelLabel = "Cancelar",
  loading = false,
  variant = "default",
  closeOnBackdrop = false,
  closeOnEscape = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const titleId = useId();
  const messageId = useId();

  useEffect(() => {
    if (!isOpen || !closeOnEscape) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || loading) {
        return;
      }

      onCancel();
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [closeOnEscape, isOpen, loading, onCancel]);

  if (!isOpen) return null;

  const isTotem = variant === "totem";
  const overlayClassName = isTotem
    ? "fixed inset-0 z-[1200] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
    : "fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4 backdrop-blur-[2px]";
  const containerClassName = isTotem
    ? "w-full max-w-md rounded-2xl border border-(--totem-border-strong) bg-(--totem-surface-2) p-4 text-(--totem-text-primary) shadow-xl shadow-black/45"
    : "w-full max-w-md rounded-2xl border border-(--color-border) bg-(--color-card) p-4 shadow-xl";
  const iconWrapperClassName = isTotem
    ? "mt-0.5 rounded-full bg-(--totem-warning-surface) p-2 text-(--totem-warning-text)"
    : "mt-0.5 rounded-full bg-[#ffe4ea] p-2 text-(--color-red-main)";
  const titleClassName = isTotem
    ? "text-sm font-semibold text-(--totem-text-primary)"
    : "text-sm font-semibold text-(--color-text-main)";
  const messageClassName = isTotem
    ? "mt-1 text-xs text-(--totem-text-secondary) break-words [overflow-wrap:anywhere]"
    : "mt-1 text-xs text-(--color-text-secondary) break-words [overflow-wrap:anywhere]";
  const cancelButtonClassName = isTotem
    ? "inline-flex items-center justify-center rounded-lg border border-(--totem-border-strong) bg-(--totem-surface-3) px-4 py-2.5 text-xs font-semibold text-(--totem-text-primary) transition hover:text-(--totem-accent) disabled:cursor-not-allowed disabled:opacity-60"
    : "inline-flex items-center justify-center rounded-lg border border-(--color-border) bg-white px-4 py-2.5 text-xs font-semibold text-(--color-text-main) transition hover:bg-[#f6f6f6] disabled:cursor-not-allowed disabled:opacity-60";
  const confirmButtonClassName = isTotem
    ? "inline-flex items-center justify-center gap-2 rounded-lg bg-(--totem-accent) px-4 py-2.5 text-xs font-semibold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
    : "inline-flex items-center justify-center gap-2 rounded-lg bg-(--color-red-button) px-4 py-2.5 text-xs font-semibold text-white transition hover:bg-(--color-red-dark) disabled:cursor-not-allowed disabled:opacity-60";

  return (
    <section
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      aria-describedby={messageId}
      className={overlayClassName}
      onClick={() => {
        if (closeOnBackdrop && !loading) {
          onCancel();
        }
      }}
    >
      <div className={containerClassName} onClick={(event) => event.stopPropagation()}>
        <div className="mb-4 flex items-start gap-3">
          <div className={iconWrapperClassName}>
            <AlertTriangle className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <h2 id={titleId} className={titleClassName}>
              {title}
            </h2>
            <p id={messageId} className={messageClassName}>
              {message}
            </p>
          </div>
        </div>

        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onCancel}
            disabled={loading}
            className={cancelButtonClassName}
          >
            {cancelLabel}
          </button>

          <button
            type="button"
            onClick={onConfirm}
            disabled={loading}
            className={confirmButtonClassName}
          >
            {loading && <LoaderCircle className="h-4 w-4 animate-spin" />}
            {loading ? "Procesando..." : confirmLabel}
          </button>
        </div>
      </div>
    </section>
  );
}
