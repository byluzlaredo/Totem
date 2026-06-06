import type { ContentType } from "../../../types/content";

interface ContentFileRule {
  accept: string;
  allowedMimeTypes: string[];
  allowedExtensions: string[];
}

const CONTENT_FILE_RULES: Record<ContentType, ContentFileRule> = {
  image: {
    accept: "image/*",
    allowedMimeTypes: [
      "image/jpeg",
      "image/png",
      "image/webp",
      "image/gif",
      "image/bmp",
      "image/svg+xml",
    ],
    allowedExtensions: [".jpg", ".jpeg", ".png", ".webp", ".gif", ".bmp", ".svg"],
  },
  video: {
    accept: "video/*",
    allowedMimeTypes: [
      "video/mp4",
      "video/webm",
      "video/ogg",
      "video/quicktime",
      "video/x-msvideo",
    ],
    allowedExtensions: [".mp4", ".webm", ".ogg", ".mov", ".avi"],
  },
  pdf: {
    accept: ".pdf,application/pdf",
    allowedMimeTypes: ["application/pdf"],
    allowedExtensions: [".pdf"],
  },
  news: {
    accept: "image/*",
    allowedMimeTypes: [
      "image/jpeg",
      "image/png",
      "image/webp",
      "image/gif",
    ],
    allowedExtensions: [".jpg", ".jpeg", ".png", ".webp", ".gif"],
  },
  advertisement: {
    accept: "image/*",
    allowedMimeTypes: [
      "image/jpeg",
      "image/png",
      "image/webp",
      "image/gif",
      "image/bmp",
      "image/svg+xml",
    ],
    allowedExtensions: [".jpg", ".jpeg", ".png", ".webp", ".gif", ".bmp", ".svg"],
  },
};

function getNormalizedExtension(value: string) {
  return value.trim().toLowerCase();
}

function getFileNameExtension(fileName: string) {
  const dotIndex = fileName.lastIndexOf(".");

  if (dotIndex < 0) {
    return "";
  }

  return getNormalizedExtension(fileName.slice(dotIndex));
}

function getFileUrlExtension(fileUrl: string) {
  if (fileUrl.trim().length === 0) {
    return "";
  }

  let pathname = fileUrl.trim();

  try {
    pathname = new URL(pathname, "http://localhost").pathname;
  } catch {
    pathname = fileUrl.trim();
  }

  return getFileNameExtension(pathname);
}

export function getAcceptedMimeTypesForContentType(contentType: ContentType) {
  return CONTENT_FILE_RULES[contentType].accept;
}

export function isFileCompatibleWithContentType(file: File, contentType: ContentType) {
  const rules = CONTENT_FILE_RULES[contentType];
  const rawMimeType = file.type.trim().toLowerCase();
  const mimeType = rawMimeType === "application/octet-stream" ? "" : rawMimeType;
  const extension = getFileNameExtension(file.name);

  if (!mimeType && !extension) {
    return false;
  }

  if (mimeType && !rules.allowedMimeTypes.includes(mimeType)) {
    return false;
  }

  if (extension && !rules.allowedExtensions.includes(extension)) {
    return false;
  }

  return true;
}

export function isStoredFileUrlCompatibleWithContentType(
  fileUrl: string,
  contentType: ContentType,
) {
  const extension = getFileUrlExtension(fileUrl);

  if (!extension) {
    return false;
  }

  return CONTENT_FILE_RULES[contentType].allowedExtensions.includes(extension);
}
