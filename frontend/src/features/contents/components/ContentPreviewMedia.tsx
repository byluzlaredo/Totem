import { useEffect, useMemo, useState } from "react";
import type { PreviewKind } from "../utils/contentPreview";
import ContentPreviewPlaceholder from "./ContentPreviewPlaceholder";

interface ContentPreviewMediaProps {
  kind: PreviewKind;
  sourceUrl: string | null;
  title: string;
  imageClassName: string;
  videoClassName: string;
  pdfClassName: string;
  fallbackClassName: string;
  placeholderTone?: "light" | "dark";
  unknownTitle?: string;
  unknownMessage?: string;
  missingTitle?: string;
  missingMessage?: string;
}

function isLocalObjectUrl(sourceUrl: string) {
  return sourceUrl.startsWith("blob:") || sourceUrl.startsWith("data:");
}

function resolveRequestCredentials(sourceUrl: string): RequestCredentials {
  try {
    const parsedUrl = new URL(sourceUrl, window.location.href);

    if (parsedUrl.origin === window.location.origin) {
      return "include";
    }

    return "omit";
  } catch {
    return "include";
  }
}

function shouldValidatePdfSource(kind: PreviewKind, sourceUrl: string | null) {
  if (kind !== "pdf" || !sourceUrl) return false;
  return !isLocalObjectUrl(sourceUrl);
}

export default function ContentPreviewMedia({
  kind,
  sourceUrl,
  title,
  imageClassName,
  videoClassName,
  pdfClassName,
  fallbackClassName,
  placeholderTone = "light",
  unknownTitle = "Vista previa no disponible",
  unknownMessage = "No se puede mostrar una vista previa para este tipo de archivo.",
  missingTitle = "Contenido no encontrado",
  missingMessage = "No se pudo encontrar o cargar el archivo asociado a este contenido.",
}: ContentPreviewMediaProps) {
  const previewSignature = `${kind}::${sourceUrl ?? ""}`;
  const [loadErrorSignature, setLoadErrorSignature] = useState<string | null>(
    null,
  );
  const [invalidPdfSignature, setInvalidPdfSignature] = useState<
    string | null
  >(null);
  const [validPdfSignature, setValidPdfSignature] = useState<string | null>(
    null,
  );
  const shouldValidatePdf = shouldValidatePdfSource(kind, sourceUrl);
  const hasLoadError = loadErrorSignature === previewSignature;
  const isInvalidPdfSource = invalidPdfSignature === previewSignature;
  const isValidPdfSource = validPdfSignature === previewSignature;
  const isPdfValidationPending =
    shouldValidatePdf && !isInvalidPdfSource && !isValidPdfSource;

  useEffect(() => {
    if (!shouldValidatePdf || !sourceUrl) return;
    const pdfSourceUrl = sourceUrl;

    const abortController = new AbortController();
    const requestCredentials = resolveRequestCredentials(pdfSourceUrl);

    setValidPdfSignature((previous) =>
      previous === previewSignature ? previous : null,
    );
    setInvalidPdfSignature((previous) =>
      previous === previewSignature ? previous : null,
    );

    function isUnexpectedPdfResponse(response: Response) {
      const contentType = (response.headers.get("content-type") || "")
        .toLowerCase()
        .trim();

      return (
        !response.ok
        || contentType.includes("text/html")
        || contentType.includes("application/json")
        || contentType.includes("text/plain")
      );
    }

    async function validatePdfSource() {
      try {
        const headResponse = await fetch(pdfSourceUrl, {
          method: "HEAD",
          credentials: requestCredentials,
          signal: abortController.signal,
        });

        if (isUnexpectedPdfResponse(headResponse)) {
          setInvalidPdfSignature(previewSignature);
          setValidPdfSignature((previous) =>
            previous === previewSignature ? null : previous,
          );
          return;
        }

        setValidPdfSignature(previewSignature);
        setInvalidPdfSignature((previous) =>
          previous === previewSignature ? null : previous,
        );
      } catch {
        try {
          const getResponse = await fetch(pdfSourceUrl, {
            method: "GET",
            credentials: requestCredentials,
            signal: abortController.signal,
          });

          if (isUnexpectedPdfResponse(getResponse)) {
            setInvalidPdfSignature(previewSignature);
            setValidPdfSignature((previous) =>
              previous === previewSignature ? null : previous,
            );
            return;
          }

          setValidPdfSignature(previewSignature);
          setInvalidPdfSignature((previous) =>
            previous === previewSignature ? null : previous,
          );

          void getResponse.body?.cancel();
        } catch {
          // Ignorar errores de red/CORS: en ese caso dejamos el render normal.
          return;
        }
      }
    }

    void validatePdfSource();

    return () => {
      abortController.abort();
    };
  }, [previewSignature, shouldValidatePdf, sourceUrl]);

  const missingPlaceholder = useMemo(
    () => (
      <ContentPreviewPlaceholder
        tone={placeholderTone}
        className={fallbackClassName}
        title={missingTitle}
        message={missingMessage}
      />
    ),
    [fallbackClassName, missingMessage, missingTitle, placeholderTone],
  );

  if (!sourceUrl) {
    return missingPlaceholder;
  }

  if (kind === "unknown") {
    return (
      <ContentPreviewPlaceholder
        tone={placeholderTone}
        className={fallbackClassName}
        title={unknownTitle}
        message={unknownMessage}
      />
    );
  }

  if (hasLoadError || isInvalidPdfSource) {
    return missingPlaceholder;
  }

  if (isPdfValidationPending) {
    return (
      <ContentPreviewPlaceholder
        tone={placeholderTone}
        className={fallbackClassName}
        title="Cargando vista previa"
        message="Validando disponibilidad del archivo..."
      />
    );
  }

  if (kind === "image") {
    return (
      <img
        src={sourceUrl}
        alt={title}
        className={imageClassName}
        loading="lazy"
        onError={() => setLoadErrorSignature(previewSignature)}
      />
    );
  }

  if (kind === "video") {
    return (
      <video
        key={sourceUrl}
        src={sourceUrl}
        className={videoClassName}
        controls
        autoPlay
        loop
        muted
        preload="metadata"
        onError={() => setLoadErrorSignature(previewSignature)}
      />
    );
  }

  return (
    <iframe
      title={title}
      src={sourceUrl}
      className={pdfClassName}
      onError={() => setLoadErrorSignature(previewSignature)}
    />
  );
}
