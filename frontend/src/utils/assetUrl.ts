const API_BASE_URL = import.meta.env.VITE_API_URL ?? "";

function normalizeBaseUrl(baseUrl: string | null | undefined) {
  if (!baseUrl) return "";
  return baseUrl.trim().replace(/\/+$/, "");
}

function resolveAssetBaseUrl(
  normalizedBaseUrl: string,
  normalizedPath: string,
) {
  if (!normalizedPath.startsWith("/uploads/")) {
    return normalizedBaseUrl;
  }

  try {
    return new URL(normalizedBaseUrl).origin;
  } catch {
    return normalizedBaseUrl;
  }
}

export function resolveAssetUrl(
  fileUrl: string | null | undefined,
  baseUrl: string | null | undefined = API_BASE_URL,
) {
  if (!fileUrl) return null;

  const trimmedFileUrl = fileUrl.trim();
  if (!trimmedFileUrl) return null;

  if (
    trimmedFileUrl.startsWith("http://") ||
    trimmedFileUrl.startsWith("https://") ||
    trimmedFileUrl.startsWith("blob:") ||
    trimmedFileUrl.startsWith("data:")
  ) {
    return trimmedFileUrl;
  }

  const normalizedBaseUrl = normalizeBaseUrl(baseUrl);
  const normalizedPath = trimmedFileUrl.startsWith("/")
    ? trimmedFileUrl
    : `/${trimmedFileUrl}`;

  if (!normalizedBaseUrl) {
    return normalizedPath;
  }

  const assetBaseUrl = resolveAssetBaseUrl(normalizedBaseUrl, normalizedPath);
  return `${assetBaseUrl}${normalizedPath}`;
}
