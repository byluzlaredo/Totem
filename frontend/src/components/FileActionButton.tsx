import type { MouseEvent, ReactNode } from "react";
import { resolveAssetUrl } from "../utils/assetUrl";
import { useAssetAvailability } from "../hooks/useAssetAvailability";

interface FileActionButtonProps {
  fileUrl: string | null | undefined;
  label: string;
  className: string;
  disabledClassName: string;
  unavailableLabel?: string;
  checkingLabel?: string;
  icon?: ReactNode;
  title?: string;
  ariaLabel?: string;
  wrapperClassName?: string;
  preventParentClick?: boolean;
}

export default function FileActionButton({
  fileUrl,
  label,
  className,
  disabledClassName,
  unavailableLabel = "Archivo no disponible",
  checkingLabel = "Verificando archivo...",
  icon,
  title,
  ariaLabel,
  wrapperClassName,
  preventParentClick = false,
}: FileActionButtonProps) {
  const fileHref = resolveAssetUrl(fileUrl);
  const {
    isAvailable,
    isUnavailable,
  } = useAssetAvailability(fileHref);

  function handleStopPropagation(event: MouseEvent<HTMLElement>) {
    if (!preventParentClick) {
      return;
    }

    event.stopPropagation();
  }

  const resolvedLabel = isAvailable
    ? label
    : isUnavailable
      ? unavailableLabel
      : checkingLabel;

  const resolvedTitle = isAvailable
    ? title
    : isUnavailable
      ? unavailableLabel
      : checkingLabel;

  return (
    <span
      className={wrapperClassName}
      onMouseDown={handleStopPropagation}
      onClick={handleStopPropagation}
    >
      {isAvailable && fileHref ? (
        <a
          href={fileHref}
          target="_blank"
          rel="noreferrer"
          className={className}
          title={resolvedTitle}
          aria-label={ariaLabel ?? title ?? label}
        >
          {icon}
          <span>{resolvedLabel}</span>
        </a>
      ) : (
        <button
          type="button"
          disabled
          aria-disabled="true"
          className={disabledClassName}
          title={resolvedTitle}
          aria-label={ariaLabel ?? resolvedLabel}
        >
          {icon}
          <span>{resolvedLabel}</span>
        </button>
      )}
    </span>
  );
}
