import { X } from "lucide-react";
import { useEffect, useId, type ReactNode } from "react";

interface SideDrawerProps {
  isOpen: boolean;
  title: string;
  description?: string;
  onClose: () => void;
  children: ReactNode;
  widthClassName?: string;
}

export default function SideDrawer({
  isOpen,
  title,
  description,
  onClose,
  children,
  widthClassName = "max-w-2xl",
}: SideDrawerProps) {
  const titleId = useId();
  const descriptionId = useId();

  useEffect(() => {
    if (!isOpen) return;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <section
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      aria-describedby={description ? descriptionId : undefined}
      className="fixed inset-0 z-40"
    >
      <button
        type="button"
        onClick={onClose}
        className="absolute inset-0 bg-black/40 backdrop-blur-[1px]"
        aria-label="Cerrar panel lateral"
      />

      <aside
        className={`absolute inset-y-0 right-0 h-full w-full overflow-hidden border-l border-(--color-border) bg-(--color-card) shadow-2xl ${widthClassName}`}
      >
        <header className="flex items-start justify-between gap-3 border-b border-(--color-border) px-5 py-4">
          <div className="min-w-0 space-y-1">
            <h2
              id={titleId}
              className="truncate text-base font-bold tracking-tight text-(--color-text-main)"
              title={title}
            >
              {title}
            </h2>
            {description && (
              <p
                id={descriptionId}
                className="truncate text-xs text-(--color-text-secondary)"
                title={description}
              >
                {description}
              </p>
            )}
          </div>

          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-(--color-border) text-(--color-text-secondary) transition hover:bg-[#f7f7f7] hover:text-(--color-text-main)"
            title="Cerrar"
            aria-label="Cerrar drawer"
          >
            <X className="h-4 w-4" />
          </button>
        </header>

        <div className="h-[calc(100%-5.25rem)] overflow-x-hidden overflow-y-auto px-5 py-5">
          {children}
        </div>
      </aside>
    </section>
  );
}
