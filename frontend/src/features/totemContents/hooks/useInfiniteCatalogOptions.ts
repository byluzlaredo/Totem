import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type UIEvent,
} from "react";
import type { ApiListResponse } from "../../../types/totem";

const SCROLL_LOAD_THRESHOLD_PX = 48;

function mergeUniqueById<T extends { id: number }>(existing: T[], incoming: T[]) {
  if (incoming.length === 0) {
    return existing;
  }

  const merged: T[] = [...existing];
  const knownIds = new Set(existing.map((item) => item.id));

  for (const item of incoming) {
    if (knownIds.has(item.id)) {
      continue;
    }

    knownIds.add(item.id);
    merged.push(item);
  }

  return merged;
}

interface UseInfiniteCatalogOptionsParams<T extends { id: number }> {
  initialItems: T[];
  pageSize: number;
  queryKey: string;
  enabled?: boolean;
  fetchPage: (
    page: number,
    limit: number,
    options?: { signal?: AbortSignal },
  ) => Promise<ApiListResponse<T>>;
}

export function useInfiniteCatalogOptions<T extends { id: number }>({
  initialItems,
  pageSize,
  queryKey,
  enabled = true,
  fetchPage,
}: UseInfiniteCatalogOptionsParams<T>) {
  const [knownItems, setKnownItems] = useState<T[]>(initialItems);
  const [resultItems, setResultItems] = useState<T[]>([]);
  const [totalItems, setTotalItems] = useState(0);
  const [currentPage, setCurrentPage] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const requestSequenceRef = useRef(0);
  const requestAbortControllerRef = useRef<AbortController | null>(null);

  const abortOngoingRequest = useCallback(() => {
    if (!requestAbortControllerRef.current) {
      return;
    }

    requestAbortControllerRef.current.abort();
    requestAbortControllerRef.current = null;
  }, []);

  useEffect(() => {
    setKnownItems((previous) => mergeUniqueById(previous, initialItems));
  }, [initialItems]);

  const loadPage = useCallback(
    async (page: number, mode: "replace" | "append") => {
      const requestId = requestSequenceRef.current + 1;
      requestSequenceRef.current = requestId;
      abortOngoingRequest();

      const requestAbortController = new AbortController();
      requestAbortControllerRef.current = requestAbortController;

      if (mode === "replace") {
        setIsLoading(true);
        setIsLoadingMore(false);
      } else {
        setIsLoadingMore(true);
      }

      setErrorMessage("");

      try {
        const response = await fetchPage(page, pageSize, {
          signal: requestAbortController.signal,
        });

        if (requestSequenceRef.current !== requestId) {
          return;
        }

        setResultItems((previous) =>
          mode === "replace"
            ? response.data
            : mergeUniqueById(previous, response.data),
        );
        setKnownItems((previous) => mergeUniqueById(previous, response.data));
        setTotalItems(response.meta.totalItems);
        setCurrentPage(response.meta.currentPage);
        setTotalPages(response.meta.totalPages);
      } catch {
        if (
          requestSequenceRef.current !== requestId
          || requestAbortController.signal.aborted
        ) {
          return;
        }

        setErrorMessage("No se pudieron cargar los resultados.");

        if (mode === "replace") {
          setResultItems([]);
          setTotalItems(0);
          setCurrentPage(0);
          setTotalPages(1);
        }
      } finally {
        if (requestSequenceRef.current !== requestId) {
          return;
        }

        if (requestAbortControllerRef.current === requestAbortController) {
          requestAbortControllerRef.current = null;
        }

        if (mode === "replace") {
          setIsLoading(false);
        } else {
          setIsLoadingMore(false);
        }
      }
    },
    [abortOngoingRequest, fetchPage, pageSize],
  );

  useEffect(() => {
    if (!enabled) {
      abortOngoingRequest();
      setResultItems([]);
      setTotalItems(0);
      setCurrentPage(0);
      setTotalPages(1);
      setIsLoading(false);
      setIsLoadingMore(false);
      setErrorMessage("");
      return;
    }

    void loadPage(1, "replace");
  }, [abortOngoingRequest, enabled, loadPage, queryKey]);

  useEffect(() => () => {
    requestSequenceRef.current += 1;
    abortOngoingRequest();
  }, [abortOngoingRequest]);

  const hasMore = currentPage > 0 && currentPage < totalPages;

  const loadMore = useCallback(() => {
    if (!enabled || isLoading || isLoadingMore || !hasMore) {
      return;
    }

    void loadPage(currentPage + 1, "append");
  }, [currentPage, enabled, hasMore, isLoading, isLoadingMore, loadPage]);

  const handleResultsScroll = useCallback(
    (event: UIEvent<HTMLDivElement>) => {
      const element = event.currentTarget;
      const remainingDistance =
        element.scrollHeight - element.scrollTop - element.clientHeight;

      if (remainingDistance <= SCROLL_LOAD_THRESHOLD_PX) {
        loadMore();
      }
    },
    [loadMore],
  );

  const knownItemById = useMemo(
    () => new Map(knownItems.map((item) => [item.id, item])),
    [knownItems],
  );

  return {
    resultItems,
    knownItemById,
    totalItems,
    hasMore,
    isLoading,
    isLoadingMore,
    errorMessage,
    handleResultsScroll,
  };
}
