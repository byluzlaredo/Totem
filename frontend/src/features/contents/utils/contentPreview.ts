import type { ContentType } from "../../../types/content";

const IMAGE_FILE_PATTERN = /\.(png|jpe?g|webp|gif|bmp|svg)(\?.*)?$/i;
const VIDEO_FILE_PATTERN = /\.(mp4|webm|ogg|mov|avi)(\?.*)?$/i;
const PDF_FILE_PATTERN = /\.pdf(\?.*)?$/i;

export type PreviewKind = "image" | "video" | "pdf" | "unknown";

interface MissingPreviewCopy {
  title: string;
  message: string;
}

export function inferPreviewKindFromName(name: string): PreviewKind {
  if (IMAGE_FILE_PATTERN.test(name)) return "image";
  if (VIDEO_FILE_PATTERN.test(name)) return "video";
  if (PDF_FILE_PATTERN.test(name)) return "pdf";
  return "unknown";
}

export function inferPreviewKindFromUrl(fileUrl: string): PreviewKind {
  const sanitizedUrl = fileUrl.split("#")[0] ?? fileUrl;
  return inferPreviewKindFromName(sanitizedUrl);
}

export function inferPreviewKindFromContent(
  contentType: ContentType,
  fileUrl: string | null | undefined,
): PreviewKind {
  if (fileUrl) {
    const detectedKind = inferPreviewKindFromUrl(fileUrl);
    if (detectedKind !== "unknown") return detectedKind;
  }

  if (contentType === "image") return "image";
  if (contentType === "video") return "video";
  if (contentType === "pdf") return "pdf";

  return "unknown";
}

export function resolveMissingPreviewCopy(
  contentType: ContentType | undefined,
  fileUrl: string | null | undefined,
): MissingPreviewCopy {
  const hasFileUrl = typeof fileUrl === "string" && fileUrl.trim().length > 0;

  if (!hasFileUrl && contentType === "news") {
    return {
      title: "Contenido no asignado",
      message: "Esta noticia no tiene un archivo adjunto para vista previa.",
    };
  }

  return {
    title: "Contenido no encontrado",
    message: "No se encontró el archivo asociado a este contenido.",
  };
}
