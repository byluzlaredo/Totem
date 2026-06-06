import { MoreHorizontal } from "lucide-react";
import {
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";

export type RowActionTone = "default" | "accent" | "warning" | "success" | "danger";

export interface RowActionMenuItem {
  key: string;
  label: string;
  onSelect: () => void;
  icon?: ReactNode;
  disabled?: boolean;
  hidden?: boolean;
  title?: string;
  tone?: RowActionTone;
}

interface RowActionsMenuProps {
  actions: RowActionMenuItem[];
  triggerLabel?: string;
  triggerClassName?: string;
  menuWidthPx?: number;
  align?: "left" | "right";
}

const DEFAULT_TRIGGER_CLASSNAME =
  "inline-flex h-9 w-9 items-center justify-center rounded-lg text-(--color-text-secondary) transition hover:bg-[#f3f4f6] hover:text-(--color-text-main) focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--color-red-main)/25";

function mergeClassNames(...classNames: Array<string | false | null | undefined>) {
  return classNames.filter(Boolean).join(" ");
}

let activeScrollLocks = 0;
let previousBodyOverflow = "";
let previousBodyPaddingRight = "";

function lockPageScroll() {
  if (typeof document === "undefined" || typeof window === "undefined") {
    return;
  }

  if (activeScrollLocks === 0) {
    previousBodyOverflow = document.body.style.overflow;
    previousBodyPaddingRight = document.body.style.paddingRight;

    const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;
    if (scrollbarWidth > 0) {
      document.body.style.paddingRight = `${scrollbarWidth}px`;
    }

    document.body.style.overflow = "hidden";
  }

  activeScrollLocks += 1;
}

function unlockPageScroll() {
  if (typeof document === "undefined") {
    return;
  }

  activeScrollLocks = Math.max(0, activeScrollLocks - 1);

  if (activeScrollLocks === 0) {
    document.body.style.overflow = previousBodyOverflow;
    document.body.style.paddingRight = previousBodyPaddingRight;
  }
}

export default function RowActionsMenu({
  actions,
  triggerLabel = "Acciones",
  triggerClassName = DEFAULT_TRIGGER_CLASSNAME,
  menuWidthPx = 208,
  align = "right",
}: RowActionsMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [menuPosition, setMenuPosition] = useState<{ top: number; left: number } | null>(
    null,
  );
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const menuId = useId();

  const visibleActions = useMemo(
    () => actions.filter((action) => !action.hidden),
    [actions],
  );

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    lockPageScroll();
    return () => {
      unlockPageScroll();
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    function handlePointerDown(event: MouseEvent) {
      const target = event.target;

      if (!(target instanceof Node)) {
        return;
      }

      if (triggerRef.current?.contains(target)) {
        return;
      }

      if (menuRef.current?.contains(target)) {
        return;
      }

      setIsOpen(false);
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsOpen(false);
        triggerRef.current?.focus();
      }
    }

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [isOpen]);

  useLayoutEffect(() => {
    if (!isOpen) {
      return;
    }

    function updatePosition() {
      if (!triggerRef.current || !menuRef.current) {
        return;
      }

      const triggerRect = triggerRef.current.getBoundingClientRect();
      const menuHeight = menuRef.current.offsetHeight;
      const viewportHeight = window.innerHeight;
      const viewportWidth = window.innerWidth;
      const viewportMargin = 8;
      const spacing = 6;

      let left =
        align === "right"
          ? triggerRect.right - menuWidthPx
          : triggerRect.left;
      left = Math.min(
        Math.max(left, viewportMargin),
        viewportWidth - menuWidthPx - viewportMargin,
      );

      const availableSpaceBelow = viewportHeight - triggerRect.bottom - viewportMargin;
      const availableSpaceAbove = triggerRect.top - viewportMargin;
      const shouldOpenUpward =
        menuHeight > availableSpaceBelow && availableSpaceAbove > availableSpaceBelow;

      let top = shouldOpenUpward
        ? triggerRect.top - menuHeight - spacing
        : triggerRect.bottom + spacing;

      if (top < viewportMargin) {
        top = viewportMargin;
      }

      if (menuHeight > 0 && top + menuHeight > viewportHeight - viewportMargin) {
        top = Math.max(viewportMargin, viewportHeight - menuHeight - viewportMargin);
      }

      setMenuPosition({ top, left });
    }

    updatePosition();
    const animationFrameId = window.requestAnimationFrame(updatePosition);
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);

    return () => {
      window.cancelAnimationFrame(animationFrameId);
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [align, isOpen, menuWidthPx, visibleActions.length]);

  useEffect(() => {
    if (visibleActions.length === 0) {
      setIsOpen(false);
    }
  }, [visibleActions.length]);

  function handleToggleMenu(event: ReactMouseEvent<HTMLButtonElement>) {
    event.stopPropagation();
    setIsOpen((previous) => {
      const next = !previous;
      if (next) {
        setMenuPosition(null);
      }
      return next;
    });
  }

  return (
    <div className="inline-flex" onClick={(event) => event.stopPropagation()}>
      <button
        ref={triggerRef}
        type="button"
        onClick={handleToggleMenu}
        aria-label={triggerLabel}
        aria-haspopup="menu"
        aria-controls={isOpen ? menuId : undefined}
        aria-expanded={isOpen}
        title={triggerLabel}
        className={triggerClassName}
      >
        <MoreHorizontal className="h-4 w-4" />
      </button>

      {isOpen && typeof document !== "undefined"
        ? createPortal(
          <div
            ref={menuRef}
            id={menuId}
            role="menu"
            aria-label={triggerLabel}
            style={{
              position: "fixed",
              top: menuPosition?.top ?? 0,
              left: menuPosition?.left ?? 0,
              width: `${menuWidthPx}px`,
              visibility: menuPosition ? "visible" : "hidden",
            }}
            className={mergeClassNames(
              "z-80 rounded-2xl border border-(--color-border) bg-white p-1.5 shadow-xl",
              menuPosition ? "" : "pointer-events-none",
            )}
            onClick={(event) => event.stopPropagation()}
          >
            {visibleActions.map((action) => {
              const tone = action.tone ?? "default";

              const toneClassName = action.disabled
                ? "text-(--color-text-secondary)"
                : tone === "danger"
                  ? "text-(--color-red-main) hover:bg-[#fdebef]"
                  : tone === "accent"
                    ? "text-[#1363a3] hover:bg-[#e8f3ff]"
                    : tone === "warning"
                      ? "text-[#b9770e] hover:bg-[#fff8e8]"
                      : tone === "success"
                        ? "text-[#2f855a] hover:bg-[#eaf9ef]"
                        : "text-(--color-text-main) hover:bg-[#f6f6f6]";

              return (
                <button
                  key={action.key}
                  type="button"
                  role="menuitem"
                  disabled={action.disabled}
                  title={action.title ?? action.label}
                  aria-label={action.label}
                  className={mergeClassNames(
                    "inline-flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-xs font-semibold transition",
                    action.disabled
                      ? "cursor-not-allowed opacity-50"
                      : toneClassName,
                  )}
                  onClick={(event) => {
                    event.stopPropagation();

                    if (action.disabled) {
                      return;
                    }

                    setIsOpen(false);
                    action.onSelect();
                  }}
                >
                  {action.icon ? (
                    <span className="inline-flex h-4 w-4 shrink-0 items-center justify-center">
                      {action.icon}
                    </span>
                  ) : null}
                  <span className="truncate">{action.label}</span>
                </button>
              );
            })}
          </div>,
          document.body,
        )
        : null}
    </div>
  );
}
