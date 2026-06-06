import { Plus } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import ConfirmDialog from "../../components/ConfirmDialog";
import EmptyState from "../../components/EmptyState";
import FeedbackMessage from "../../components/FeedbackMessage";
import LoadingState from "../../components/LoadingState";
import Pagination from "../../components/Pagination";
import {
  LIST_FILTER_DEBOUNCE_MS,
  LIST_SEARCH_MIN_CHARS,
} from "../../constants/search";
import { CONTENT_TYPE_OPTIONS } from "../../constants/content";
import { DEFAULT_TOTEM_CONTENT_PAGE_SIZE } from "../../constants/totemContent";
import TotemContentDetailPanel from "../../features/totemContents/components/TotemContentDetailPanel";
import TotemContentFilters from "../../features/totemContents/components/TotemContentFilters";
import TotemContentTable from "../../features/totemContents/components/TotemContentTable";
import { totemContentService } from "../../features/totemContents/services/totemContent.service";
import { contentService } from "../../features/contents/services/content.service";
import { campusService } from "../../features/campuses/services/campus.service";
import type { Content, ContentType } from "../../types/content";
import type { PaginationMeta } from "../../types/totem";
import type { CampusOption } from "../../types/campus";
import type {
  TotemContent,
  TotemContentListStatusFilter,
  TotemContentListParams,
  TotemContentStatus,
} from "../../types/totemContent";
import { getErrorMessage } from "../../utils/getErrorMessage";
import { useAuth } from "../../context/AuthContext";
import {
  normalizeSearchInputForQuery,
  normalizeTextForSearch,
} from "../../utils/textSearch";

const DEFAULT_META: PaginationMeta = {
  totalItems: 0,
  totalPages: 0,
  currentPage: 1,
  pageSize: DEFAULT_TOTEM_CONTENT_PAGE_SIZE,
};

const DEFAULT_FILTERS = {
  totemSearch: "",
  contentSearch: "",
  contentType: "",
  campusId: "",
  status: "",
};
const ALLOWED_ASSIGNMENT_STATUS_FILTERS = new Set<TotemContentListStatusFilter>([
  "active",
  "inactive",
  "scheduled",
  "expired",
  "expiringSoon",
]);

type FlashMessageState = {
  message?: string;
  messageType?: "success" | "neutral";
  dashboardFilters?: Partial<typeof DEFAULT_FILTERS>;
} | null;

type ConfirmState =
  | null
  | {
    type: "delete";
    assignment: TotemContent;
  }
  | {
    type: "status";
    assignment: TotemContent;
    nextStatus: TotemContentStatus;
  };

function getContentTypeLabel(contentType: ContentType) {
  return (
    CONTENT_TYPE_OPTIONS.find((option) => option.value === contentType)?.label
    ?? contentType
  );
}

function buildTotemContentQueryFromFilters(
  filters: typeof DEFAULT_FILTERS,
  limit: number,
): TotemContentListParams {
  return {
    totemSearch: normalizeSearchInputForQuery(
      filters.totemSearch,
      LIST_SEARCH_MIN_CHARS,
    ),
    contentSearch: normalizeSearchInputForQuery(
      filters.contentSearch,
      LIST_SEARCH_MIN_CHARS,
    ),
    contentType: (filters.contentType as ContentType | "") || undefined,
    campusId: filters.campusId === "" ? undefined : Number(filters.campusId),
    status: (filters.status as TotemContentListStatusFilter | "") || undefined,
    page: 1,
    limit,
  };
}

function areAssignmentQueriesEqual(
  left: TotemContentListParams,
  right: TotemContentListParams,
) {
  return (
    left.totemId === right.totemId
    && left.contentId === right.contentId
    && left.totemSearch === right.totemSearch
    && left.contentSearch === right.contentSearch
    && left.contentType === right.contentType
    && left.campusId === right.campusId
    && left.status === right.status
    && left.page === right.page
    && left.limit === right.limit
  );
}

function parseAssignmentFiltersFromSearchParams(search: string) {
  const params = new URLSearchParams(search);
  const parsedFilters: Partial<typeof DEFAULT_FILTERS> = {};

  const totemSearch = params.get("totemSearch");
  if (totemSearch && totemSearch.trim().length > 0) {
    parsedFilters.totemSearch = totemSearch.trim();
  }

  const contentSearch = params.get("contentSearch");
  if (contentSearch && contentSearch.trim().length > 0) {
    parsedFilters.contentSearch = contentSearch.trim();
  }

  const contentType = params.get("contentType");
  if (contentType && CONTENT_TYPE_OPTIONS.some((option) => option.value === contentType)) {
    parsedFilters.contentType = contentType;
  }

  const campusId = Number(params.get("campusId"));
  if (Number.isInteger(campusId) && campusId > 0) {
    parsedFilters.campusId = String(campusId);
  }

  const status = params.get("status");
  if (
    status
    && ALLOWED_ASSIGNMENT_STATUS_FILTERS.has(status as TotemContentListStatusFilter)
  ) {
    parsedFilters.status = status;
  }

  return Object.keys(parsedFilters).length > 0 ? parsedFilters : null;
}

export default function TotemContentListPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const isSuperAdmin = user?.role === "SuperAdmin";

  const [items, setItems] = useState<TotemContent[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [successType, setSuccessType] = useState<"success" | "neutral">("success");
  const [meta, setMeta] = useState<PaginationMeta>(DEFAULT_META);
  const [campusOptions, setCampusOptions] = useState<CampusOption[]>([]);
  const [filtersForm, setFiltersForm] = useState(DEFAULT_FILTERS);
  const [query, setQuery] = useState<TotemContentListParams>({
    page: 1,
    limit: DEFAULT_TOTEM_CONTENT_PAGE_SIZE,
  });
  const [confirmState, setConfirmState] = useState<ConfirmState>(null);
  const [previewAssignment, setPreviewAssignment] = useState<TotemContent | null>(
    null,
  );
  const [previewContent, setPreviewContent] = useState<Content | null>(null);
  const [previewError, setPreviewError] = useState("");
  const [previewLoading, setPreviewLoading] = useState(false);
  const [contentCacheById, setContentCacheById] = useState<Record<number, Content>>(
    {},
  );
  const previewRequestIdRef = useRef(0);
  const filterApplyTimeoutRef = useRef<number | null>(null);
  const listRequestIdRef = useRef(0);
  const listAbortControllerRef = useRef<AbortController | null>(null);

  const totemSearchSuggestions = useMemo(() => {
    const suggestions: Array<{ value: string; label: string; description: string }> = [];
    const seenValues = new Set<string>();

    for (const assignment of items) {
      const totem = assignment.totem;
      if (!totem) {
        continue;
      }

      const campusName = totem.campus?.name?.trim() || "Sin campus";
      const candidateOptions = [
        {
          value: totem.name,
          label: isSuperAdmin ? `${totem.name} · ${campusName}` : totem.name,
          description: `Código: ${totem.code}`,
        },
        {
          value: totem.code,
          label: totem.code,
          description: `Tótem: ${totem.name}`,
        },
      ];

      for (const candidate of candidateOptions) {
        const normalizedCandidateValue = normalizeTextForSearch(candidate.value);
        if (!normalizedCandidateValue || seenValues.has(normalizedCandidateValue)) {
          continue;
        }

        seenValues.add(normalizedCandidateValue);
        suggestions.push(candidate);
      }
    }

    return suggestions;
  }, [isSuperAdmin, items]);

  const contentSearchSuggestions = useMemo(() => {
    const suggestions: Array<{ value: string; label: string; description: string }> = [];
    const seenValues = new Set<string>();

    for (const assignment of items) {
      const content = assignment.content;
      if (!content) {
        continue;
      }

      const normalizedTitle = normalizeTextForSearch(content.title);
      if (!normalizedTitle || seenValues.has(normalizedTitle)) {
        continue;
      }

      seenValues.add(normalizedTitle);
      suggestions.push({
        value: content.title,
        label: content.title,
        description: `Tipo: ${getContentTypeLabel(content.contentType)}`,
      });
    }

    return suggestions;
  }, [items]);

  async function loadAssignments(currentQuery: TotemContentListParams) {
    const requestId = listRequestIdRef.current + 1;
    listRequestIdRef.current = requestId;
    listAbortControllerRef.current?.abort();
    const requestAbortController = new AbortController();
    listAbortControllerRef.current = requestAbortController;

    setLoading(true);
    setError("");

    try {
      const response = await totemContentService.getAssignments(currentQuery, {
        signal: requestAbortController.signal,
      });
      if (listRequestIdRef.current !== requestId) {
        return;
      }
      setItems(response.data);
      setMeta(response.meta);
    } catch (err) {
      if (
        listRequestIdRef.current !== requestId
        || requestAbortController.signal.aborted
      ) {
        return;
      }
      setError(getErrorMessage(err, "No se pudo cargar la lista de asignaciones"));
    } finally {
      if (listAbortControllerRef.current === requestAbortController) {
        listAbortControllerRef.current = null;
      }

      if (listRequestIdRef.current === requestId) {
        setLoading(false);
      }
    }
  }

  useEffect(() => {
    void loadAssignments(query);
  }, [query]);

  useEffect(() => {
    async function loadCampusOptions() {
      try {
        const campuses = await campusService.getCampusOptions();
        setCampusOptions(campuses);
      } catch {
        setCampusOptions([]);
      }
    }

    loadCampusOptions();
  }, []);

  useEffect(() => {
    return () => {
      if (filterApplyTimeoutRef.current !== null) {
        window.clearTimeout(filterApplyTimeoutRef.current);
        filterApplyTimeoutRef.current = null;
      }

      listAbortControllerRef.current?.abort();
      listAbortControllerRef.current = null;
      listRequestIdRef.current += 1;
    };
  }, []);

  useEffect(() => {
    const navigationState = location.state as FlashMessageState;

    if (navigationState?.dashboardFilters) {
      const nextFilters = {
        ...DEFAULT_FILTERS,
        ...navigationState.dashboardFilters,
      };

      setFiltersForm(nextFilters);
      setQuery((previousQuery) => {
        const nextQuery = buildTotemContentQueryFromFilters(
          nextFilters,
          previousQuery.limit || DEFAULT_TOTEM_CONTENT_PAGE_SIZE,
        );

        return areAssignmentQueriesEqual(previousQuery, nextQuery)
          ? previousQuery
          : nextQuery;
      });
    }

    if (navigationState?.message) {
      setSuccessType(navigationState.messageType ?? "success");
      setSuccess(navigationState.message);
    }

    if (navigationState?.message || navigationState?.dashboardFilters) {
      navigate(location.pathname, { replace: true, state: null });
    }
  }, [location.pathname, location.state, navigate]);

  useEffect(() => {
    const queryFilters = parseAssignmentFiltersFromSearchParams(location.search);

    if (!queryFilters) {
      return;
    }

    const nextFilters = {
      ...DEFAULT_FILTERS,
      ...queryFilters,
    };

    setFiltersForm(nextFilters);
    setQuery((previousQuery) => {
      const nextQuery = buildTotemContentQueryFromFilters(
        nextFilters,
        previousQuery.limit || DEFAULT_TOTEM_CONTENT_PAGE_SIZE,
      );

      return areAssignmentQueriesEqual(previousQuery, nextQuery)
        ? previousQuery
        : nextQuery;
    });
  }, [location.search]);

  function clearPendingFilterApply() {
    if (filterApplyTimeoutRef.current === null) {
      return;
    }

    window.clearTimeout(filterApplyTimeoutRef.current);
    filterApplyTimeoutRef.current = null;
  }

  function scheduleFilterApply(
    nextFilters: typeof DEFAULT_FILTERS,
    mode: "debounced" | "immediate",
  ) {
    const applyFilters = () => {
      setQuery((previousQuery) => {
        const nextQuery = buildTotemContentQueryFromFilters(
          nextFilters,
          previousQuery.limit || DEFAULT_TOTEM_CONTENT_PAGE_SIZE,
        );

        return areAssignmentQueriesEqual(previousQuery, nextQuery)
          ? previousQuery
          : nextQuery;
      });
    };

    clearPendingFilterApply();

    if (mode === "debounced") {
      filterApplyTimeoutRef.current = window.setTimeout(() => {
        applyFilters();
        filterApplyTimeoutRef.current = null;
      }, LIST_FILTER_DEBOUNCE_MS);
      return;
    }

    applyFilters();
  }

  function handleFilterFieldChange(
    name: keyof typeof DEFAULT_FILTERS,
    value: string,
    mode: "debounced" | "immediate",
  ) {
    setFiltersForm((previousFilters) => {
      const nextFilters = {
        ...previousFilters,
        [name]: value,
      };

      scheduleFilterApply(nextFilters, mode);
      return nextFilters;
    });
  }

  function handleClearFilters() {
    clearPendingFilterApply();
    setFiltersForm(DEFAULT_FILTERS);
    setQuery((previousQuery) => {
      const nextQuery = {
        page: 1,
        limit: previousQuery.limit || DEFAULT_TOTEM_CONTENT_PAGE_SIZE,
      };

      return areAssignmentQueriesEqual(previousQuery, nextQuery)
        ? previousQuery
        : nextQuery;
    });

    if (location.search) {
      navigate(location.pathname, { replace: true });
    }
  }

  function handlePageChange(page: number) {
    setQuery((prev) => ({
      ...prev,
      page,
    }));
  }

  function handlePageSizeChange(limit: number) {
    setQuery((prev) => ({
      ...prev,
      limit,
      page: 1,
    }));
  }

  function handleDeleteClick(assignment: TotemContent) {
    setConfirmState({
      type: "delete",
      assignment,
    });
  }

  function handleToggleStatusClick(assignment: TotemContent) {
    const nextStatus: TotemContentStatus =
      assignment.status === "active" ? "inactive" : "active";

    setConfirmState({
      type: "status",
      assignment,
      nextStatus,
    });
  }

  async function handleConfirmAction() {
    if (!confirmState) return;

    setActionLoading(true);
    setError("");
    setSuccess("");
    setSuccessType("success");

    try {
      if (confirmState.type === "delete") {
        await totemContentService.deleteAssignment(confirmState.assignment.id);
        setSuccessType("success");
        setSuccess("Asignación eliminada correctamente");
      } else {
        await totemContentService.changeAssignmentStatus(
          confirmState.assignment.id,
          confirmState.nextStatus,
        );

        setSuccessType("success");
        setSuccess(
          confirmState.nextStatus === "active"
            ? "Asignación activada correctamente"
            : "Asignación desactivada correctamente",
        );
      }

      setConfirmState(null);
      await loadAssignments(query);
    } catch (err) {
      setError(getErrorMessage(err, "No se pudo completar la acción"));
    } finally {
      setActionLoading(false);
    }
  }

  function handleOpenCreatePage() {
    setError("");
    setSuccess("");
    setSuccessType("success");
    navigate("/admin/assignments/new");
  }

  function handleOpenEditPage(assignment: TotemContent) {
    setError("");
    setSuccess("");
    setSuccessType("success");
    navigate(`/admin/assignments/${assignment.id}/edit`);
  }

  function handleClosePreviewDrawer() {
    previewRequestIdRef.current += 1;
    setPreviewAssignment(null);
    setPreviewContent(null);
    setPreviewError("");
    setPreviewLoading(false);
  }

  async function handleOpenPreviewDrawer(assignment: TotemContent) {
    setPreviewAssignment(assignment);
    setPreviewError("");

    const cachedContent = contentCacheById[assignment.contentId];
    if (cachedContent) {
      setPreviewContent(cachedContent);
      setPreviewLoading(false);
      return;
    }

    setPreviewContent(null);
    setPreviewLoading(true);

    const requestId = previewRequestIdRef.current + 1;
    previewRequestIdRef.current = requestId;

    try {
      const response = await contentService.getContentById(assignment.contentId);
      if (previewRequestIdRef.current !== requestId) return;

      setPreviewContent(response.data);
      setContentCacheById((previous) => ({
        ...previous,
        [response.data.id]: response.data,
      }));
    } catch (err) {
      if (previewRequestIdRef.current !== requestId) return;
      setPreviewError(getErrorMessage(err, "No se pudo cargar el archivo del contenido."));
    } finally {
      if (previewRequestIdRef.current === requestId) {
        setPreviewLoading(false);
      }
    }
  }

  return (
    <main className="min-h-screen bg-(--color-bg) px-4 py-6 sm:px-6 lg:px-10">
      <div className="mx-auto flex w-full max-w-none flex-col gap-4">
        {success && (
          <FeedbackMessage
            type={successType}
            message={success}
            onClose={() => setSuccess("")}
          />
        )}

        {error && (
          <FeedbackMessage
            type="error"
            message={error}
            onClose={() => setError("")}
          />
        )}

        <section className="space-y-4">
          <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-1">
              <h1 className="text-2xl font-bold tracking-tight text-(--color-text-main)">
                Asignaciones Tótem - Contenido
              </h1>
              <p className="text-xs text-(--color-text-secondary) sm:text-xs">
                Gestiona qué contenido se publica en cada tótem
              </p>
            </div>

            <button
              type="button"
              onClick={handleOpenCreatePage}
              className="inline-flex items-center justify-center gap-2 rounded-full bg-(--color-red-button) px-6 py-2.5 text-xs font-semibold text-white shadow-md shadow-(--color-red-button)/30 transition hover:bg-(--color-red-dark) focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--color-red-main) focus-visible:ring-offset-2"
            >
              <Plus className="h-4 w-4" />
              Nueva Asignación
            </button>
          </header>

          <div>
            <TotemContentFilters
              values={filtersForm}
              totemOptions={totemSearchSuggestions}
              contentOptions={contentSearchSuggestions}
              campusOptions={campusOptions}
              isSuperAdmin={isSuperAdmin}
              onFieldChange={handleFilterFieldChange}
              onClear={handleClearFilters}
            />
          </div>

          <div>
            {loading ? (
              <LoadingState message="Cargando asignaciones..." />
            ) : items.length === 0 ? (
              <EmptyState
                title="No hay asignaciones"
                description="No se encontraron asignaciones con los filtros actuales."
              />
            ) : (
              <div className="space-y-5">
                <TotemContentTable
                  items={items}
                  onPreview={handleOpenPreviewDrawer}
                  onEdit={handleOpenEditPage}
                  onDelete={handleDeleteClick}
                  onToggleStatus={handleToggleStatusClick}
                />

                <Pagination
                  currentPage={meta.currentPage}
                  totalPages={meta.totalPages}
                  totalItems={meta.totalItems}
                  pageSize={meta.pageSize}
                  onPageChange={handlePageChange}
                  onPageSizeChange={handlePageSizeChange}
                />
              </div>
            )}
          </div>
        </section>

        <ConfirmDialog
          isOpen={Boolean(confirmState)}
          title={
            confirmState?.type === "delete"
              ? "Confirmar eliminación"
              : "Confirmar cambio de estado"
          }
          message={
            confirmState?.type === "delete"
              ? `¿Deseas eliminar la asignación del tótem "${confirmState.assignment.totem?.name}"?`
              : `¿Deseas ${confirmState?.nextStatus === "active" ? "activar" : "desactivar"} la asignación del tótem "${confirmState?.assignment.totem?.name}"?`
          }
          confirmLabel={
            confirmState?.type === "delete"
              ? "Sí, eliminar"
              : confirmState?.nextStatus === "active"
                ? "Sí, activar"
                : "Sí, desactivar"
          }
          loading={actionLoading}
          onCancel={() => setConfirmState(null)}
          onConfirm={handleConfirmAction}
        />

        <TotemContentDetailPanel
          isOpen={Boolean(previewAssignment)}
          assignment={previewAssignment}
          content={previewContent}
          loadingContent={previewLoading}
          error={previewError}
          onClose={handleClosePreviewDrawer}
          onEdit={(assignment) => {
            handleClosePreviewDrawer();
            handleOpenEditPage(assignment);
          }}
        />
      </div>
    </main>
  );
}

