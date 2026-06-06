import { useEffect, useMemo, useState } from "react";

export type AssetAvailabilityStatus = "checking" | "available" | "unavailable";

const MAX_CACHE_ENTRIES = 500;
const availabilityCache = new Map<string, Exclude<AssetAvailabilityStatus, "checking">>();

function isLocalPreviewUrl(sourceUrl: string) {
  return sourceUrl.startsWith("blob:") || sourceUrl.startsWith("data:");
}

function cacheAvailability(
  sourceUrl: string,
  status: Exclude<AssetAvailabilityStatus, "checking">,
) {
  if (availabilityCache.has(sourceUrl)) {
    availabilityCache.delete(sourceUrl);
  }

  availabilityCache.set(sourceUrl, status);

  if (availabilityCache.size <= MAX_CACHE_ENTRIES) {
    return;
  }

  const oldestCacheKey = availabilityCache.keys().next().value;
  if (!oldestCacheKey) {
    return;
  }

  availabilityCache.delete(oldestCacheKey);
}

export function useAssetAvailability(sourceUrl: string | null | undefined) {
  const normalizedSourceUrl = useMemo(() => {
    if (!sourceUrl) {
      return null;
    }

    const trimmedSourceUrl = sourceUrl.trim();
    return trimmedSourceUrl.length > 0 ? trimmedSourceUrl : null;
  }, [sourceUrl]);
  const [status, setStatus] = useState<AssetAvailabilityStatus>("checking");

  useEffect(() => {
    if (!normalizedSourceUrl) {
      setStatus("unavailable");
      return;
    }

    const sourceUrlToCheck = normalizedSourceUrl;

    if (isLocalPreviewUrl(sourceUrlToCheck)) {
      setStatus("available");
      return;
    }

    const cachedStatus = availabilityCache.get(sourceUrlToCheck);
    if (cachedStatus) {
      setStatus(cachedStatus);
      return;
    }

    let isCancelled = false;
    const abortController = new AbortController();

    setStatus("checking");

    async function validateAssetAvailability() {
      try {
        const response = await fetch(sourceUrlToCheck, {
          method: "HEAD",
          credentials: "include",
          signal: abortController.signal,
        });

        const contentType = (response.headers.get("content-type") || "")
          .toLowerCase()
          .trim();
        const isUnexpectedFallbackContent =
          contentType.includes("text/html") || contentType.includes("application/json");
        const nextStatus: Exclude<AssetAvailabilityStatus, "checking"> =
          response.ok && !isUnexpectedFallbackContent ? "available" : "unavailable";

        cacheAvailability(sourceUrlToCheck, nextStatus);

        if (!isCancelled) {
          setStatus(nextStatus);
        }
      } catch {
        if (!isCancelled) {
          // Mantener el flujo sin bloquear cuando no se puede validar por CORS/red.
          setStatus("available");
        }
      }
    }

    void validateAssetAvailability();

    return () => {
      isCancelled = true;
      abortController.abort();
    };
  }, [normalizedSourceUrl]);

  return {
    status,
    isChecking: status === "checking",
    isAvailable: status === "available",
    isUnavailable: status === "unavailable",
  };
}
