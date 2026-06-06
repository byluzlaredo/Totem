import { Filter, RotateCcw, X } from "lucide-react";
import {
  useEffect,
  useId,
  useRef,
  useState,
  type ReactNode,
} from "react";

export interface CompactFilterChip {
  key: string;
  label: string;
  valueLabel: string;
  onRemove?: () => void;
}

interface CompactFilterBarProps {
  searchControls: ReactNode;
  secondaryControls: ReactNode;
  activeChips?: CompactFilterChip[];
  onClearAll: () => void;
  panelTitle?: string;
  panelWidthClassName?: string;
  autoApplyMessage?: string;
  triggerAriaLabel?: string;
}

function mergeClassNames(...classNames: Array<string | false | null | undefined>) {
  return classNames.filter(Boolean).join(" ");
}

export default function CompactFilterBar({
  searchControls,
  secondaryControls,
  activeChips = [],
  onClearAll,
  panelTitle = "Filtros",
  panelWidthClassName = "sm:w-[23rem]",
  autoApplyMessage = "Los filtros se aplican automáticamente.",
  triggerAriaLabel = "Abrir filtros",
}: CompactFilterBarProps) {
  const activeFiltersCount = activeChips.length;
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const panelId = useId();

  useEffect(() => {
    function handlePointerDown(event: MouseEvent) {
      const target = event.target as Node;

      if (!containerRef.current?.contains(target)) {
        setIsPanelOpen(false);
      }
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsPanelOpen(false);
      }
    }

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleEscape);
    };
  }, []);

  return (
    <form
      onSubmit={(event) => event.preventDefault()}
      className="w-full overflow-visible"
    >
      <div ref={containerRef} className="relative overflow-visible">
        <div className="flex flex-nowrap items-center gap-3">
          <div className="min-w-0 flex-1">{searchControls}</div>

          <div className="flex shrink-0 items-center justify-end">
            <button
              type="button"
              onClick={() => setIsPanelOpen((previous) => !previous)}
              aria-controls={panelId}
              aria-expanded={isPanelOpen}
              aria-label={
                activeFiltersCount > 0
                  ? `${triggerAriaLabel}. ${activeFiltersCount} filtros activos`
                  : triggerAriaLabel
              }
              className={mergeClassNames(
                "relative inline-flex h-11 w-11 items-center justify-center rounded-xl border transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--color-red-main)/30",
                isPanelOpen
                  ? "border-(--color-red-main)/40 bg-[#fdebef] text-(--color-red-main)"
                  : "border-(--color-border) bg-white text-(--color-text-main) hover:bg-[#fafafa]"
              )}
            >
              <Filter className="h-4 w-4" />
              {activeFiltersCount > 0 ? (
                <span className="absolute -right-1 -top-1 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-(--color-red-main) px-1 text-[10px] font-bold leading-none text-white">
                  {activeFiltersCount > 99 ? "99+" : activeFiltersCount}
                </span>
              ) : null}
            </button>
          </div>
        </div>

        {isPanelOpen ? (
          <div
            id={panelId}
            role="dialog"
            aria-label={panelTitle}
            className={mergeClassNames(
              "absolute left-0 right-0 top-full z-50 mt-2 flex max-h-[75vh] flex-col overflow-hidden rounded-2xl border border-(--color-border) bg-white shadow-xl sm:left-auto sm:right-0 sm:max-w-full",
              panelWidthClassName
            )}
          >
            <div className="flex items-center justify-between border-b border-(--color-border) px-4 py-3">
              <p className="text-xs font-semibold text-(--color-text-main)">{panelTitle}</p>
              <button
                type="button"
                onClick={() => setIsPanelOpen(false)}
                className="inline-flex h-7 w-7 items-center justify-center rounded-full text-(--color-text-secondary) transition hover:bg-[#f3f4f6] hover:text-(--color-text-main)"
                aria-label="Cerrar filtros"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-4 overflow-y-auto p-4 py-0.5">{secondaryControls}</div>

            <div className="flex flex-col gap-2 border-t border-(--color-border) p-4 sm:flex-row sm:items-center sm:justify-between">
              <button
                type="button"
                onClick={onClearAll}
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-(--color-border) bg-white px-3.5 py-2 text-xs font-semibold text-(--color-text-main) transition hover:bg-[#fafafa] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--color-red-main)/30"
              >
                <RotateCcw className="h-4 w-4" />
                Limpiar
              </button>
              <p className="text-xs text-(--color-text-secondary)">{autoApplyMessage}</p>
            </div>
          </div>
        ) : null}
      </div>
    </form>
  );
}
