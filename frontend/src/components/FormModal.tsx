import { X } from "lucide-react";
import { useId, type ReactNode } from "react";

interface FormModalProps {
  isOpen: boolean;
  title: string;
  description?: string;
  onClose: () => void;
  children: ReactNode;
  maxWidthClassName?: string;
  disableClose?: boolean;
}

export default function FormModal({
  isOpen,
  title,
  description,
  onClose,
  children,
  maxWidthClassName = "max-w-4xl",
  disableClose = false,
}: FormModalProps) {
  const titleId = useId();
  const descriptionId = useId();

  if (!isOpen) return null;

  function handleClose() {
    if (disableClose) return;
    onClose();
  }

  return (
    <section
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      aria-describedby={description ? descriptionId : undefined}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4 backdrop-blur-[2px]"
    >
      <div
        className={`max-h-[calc(100vh-2rem)] w-full overflow-hidden rounded-3xl border border-(--color-border) bg-(--color-card) shadow-xl ${maxWidthClassName}`}
      >
        <header className="flex items-start justify-between gap-4 border-b border-(--color-border) px-6 py-5">
          <div>
            <h2
              id={titleId}
              className="text-base font-bold tracking-tight text-(--color-text-main)"
            >
              {title}
            </h2>
            {description && (
              <p id={descriptionId} className="mt-1 text-xs text-(--color-text-secondary)">
                {description}
              </p>
            )}
          </div>

          <button
            type="button"
            onClick={handleClose}
            disabled={disableClose}
            className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-(--color-border) text-(--color-text-secondary) transition hover:bg-[#f7f7f7] hover:text-(--color-text-main) disabled:cursor-not-allowed disabled:opacity-60"
            aria-label="Cerrar modal"
            title="Cerrar"
          >
            <X className="h-4 w-4" />
          </button>
        </header>

        <div
          data-form-modal-body
          className="max-h-[calc(100vh-13rem)] overflow-y-auto px-6 py-3"
        >
          {children}
        </div>

        <footer className="flex justify-end border-t border-(--color-border) px-6 py-4">
          <button
            type="button"
            onClick={handleClose}
            disabled={disableClose}
            className="inline-flex items-center justify-center rounded-xl border border-(--color-border) bg-white px-5 py-2.5 text-xs font-semibold text-(--color-text-main) transition hover:bg-[#fafafa] disabled:cursor-not-allowed disabled:opacity-60"
          >
            Cancelar
          </button>
        </footer>
      </div>
    </section>
  );
}
