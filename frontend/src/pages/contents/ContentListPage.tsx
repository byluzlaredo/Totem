import { Plus } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import ConfirmDialog from "../../components/ConfirmDialog";
import EmptyState from "../../components/EmptyState";
import FeedbackMessage from "../../components/FeedbackMessage";
import FormModal from "../../components/FormModal";
import LoadingState from "../../components/LoadingState";
import Pagination from "../../components/Pagination";
import SideDrawer from "../../components/SideDrawer";
import {
  LIST_FILTER_DEBOUNCE_MS,
  LIST_SEARCH_MIN_CHARS,
} from "../../constants/search";
import {
  CONTENT_PAGE_SIZE_OPTIONS,
  CONTENT_TYPE_OPTIONS,
  DEFAULT_CONTENT_PAGE_SIZE,
  EMPTY_CONTENT_FORM,
} from "../../constants/content";
import ContentDetailPanel from "../../features/contents/components/ContentDetailPanel";
import ContentFilters from "../../features/contents/components/ContentFilters";
import ContentForm from "../../features/contents/components/ContentForm";
import ContentTable from "../../features/contents/components/ContentTable";
import {
  contentService,
  getContentFieldErrors,
} from "../../features/contents/services/content.service";
import { campusService } from "../../features/campuses/services/campus.service";
import type {
  Content,
  ContentFormErrors,
  ContentFormValues,
  ContentListParams,
  ContentOperationalStatus,
  ContentStatus,
  ContentType,
} from "../../types/content";
import type { CampusOption } from "../../types/campus";
import type { PaginationMeta } from "../../types/totem";
import { getErrorMessage } from "../../utils/getErrorMessage";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import {
  normalizeSearchInputForQuery,
  normalizeTextForSearch,
} from "../../utils/textSearch";

const DEFAULT_META: PaginationMeta = {
  totalItems: 0,
  totalPages: 0,
  currentPage: 1,
  pageSize: DEFAULT_CONTENT_PAGE_SIZE,
};

const DEFAULT_FILTERS = {
  title: "",
  contentType: "",
  status: "",
  operationalStatus: "",
  campusId: "",
};
const ALLOWED_CONTENT_TYPES = new Set<string>(
  CONTENT_TYPE_OPTIONS.map((option) => option.value),
);
const ALLOWED_CONTENT_STATUSES = new Set<ContentStatus>(["active", "inactive"]);
const ALLOWED_CONTENT_OPERATIONAL_STATUSES = new Set<ContentOperationalStatus>([
  "activeWithoutAssignment",
  "activeWithUnavailableFile",
]);

type ConfirmState =
  | null
  | {
    type: "delete";
    content: Content;
  }
  | {
    type: "status";
    content: Content;
    nextStatus: ContentStatus;
  };

function resolveScopedCampusIdForAdmin(userCampusId: number | null) {
  return typeof userCampusId === "number" && userCampusId > 0 ? userCampusId : null;
}

function buildEmptyContentFormValues(
  isSuperAdmin: boolean,
  scopedCampusId: number | null,
): ContentFormValues {
  return {
    ...EMPTY_CONTENT_FORM,
    campusId: !isSuperAdmin && scopedCampusId !== null ? String(scopedCampusId) : "",
  };
}

function getContentTypeLabel(contentType: ContentType) {
  return (
    CONTENT_TYPE_OPTIONS.find((option) => option.value === contentType)?.label
    ?? contentType
  );
}

function buildContentQueryFromFilters(
  filters: typeof DEFAULT_FILTERS,
  limit: number,
): ContentListParams {
  return {
    title: normalizeSearchInputForQuery(
      filters.title,
      LIST_SEARCH_MIN_CHARS,
    ),
    contentType: (filters.contentType as ContentType | "") || undefined,
    status: (filters.status as ContentStatus | "") || undefined,
    operationalStatus:
      (filters.operationalStatus as ContentOperationalStatus | "") || undefined,
    campusId: filters.campusId === "" ? undefined : Number(filters.campusId),
    page: 1,
    limit,
  };
}

function areContentQueriesEqual(left: ContentListParams, right: ContentListParams) {
  return (
    left.title === right.title
    && left.contentType === right.contentType
    && left.status === right.status
    && left.operationalStatus === right.operationalStatus
    && left.campusId === right.campusId
    && left.page === right.page
    && left.limit === right.limit
  );
}

function normalizeContentFilters(filters: typeof DEFAULT_FILTERS) {
  if (!filters.operationalStatus) {
    return filters;
  }

  return {
    ...filters,
    status: "active",
  };
}

function parseContentFiltersFromSearchParams(search: string) {
  const params = new URLSearchParams(search);
  const parsedFilters: Partial<typeof DEFAULT_FILTERS> = {};

  const title = params.get("title");
  if (title && title.trim().length > 0) {
    parsedFilters.title = title.trim();
  }

  const contentType = params.get("contentType");
  if (contentType && ALLOWED_CONTENT_TYPES.has(contentType)) {
    parsedFilters.contentType = contentType;
  }

  const status = params.get("status");
  if (status && ALLOWED_CONTENT_STATUSES.has(status as ContentStatus)) {
    parsedFilters.status = status;
  }

  const operationalStatus = params.get("operationalStatus");
  if (
    operationalStatus
    && ALLOWED_CONTENT_OPERATIONAL_STATUSES.has(
      operationalStatus as ContentOperationalStatus,
    )
  ) {
    parsedFilters.operationalStatus = operationalStatus;
  }

  const campusId = Number(params.get("campusId"));
  if (Number.isInteger(campusId) && campusId > 0) {
    parsedFilters.campusId = String(campusId);
  }

  return Object.keys(parsedFilters).length > 0 ? parsedFilters : null;
}

export default function ContentListPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const isSuperAdmin = user?.role === "SuperAdmin";
  const scopedCampusId = resolveScopedCampusIdForAdmin(user?.campusId ?? null);
  const defaultCreateFormValues = useMemo(
    () => buildEmptyContentFormValues(isSuperAdmin, scopedCampusId),
    [isSuperAdmin, scopedCampusId],
  );

  const [items, setItems] = useState<Content[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [submitLoading, setSubmitLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [serverErrors, setServerErrors] = useState<ContentFormErrors>({});
  const [meta, setMeta] = useState<PaginationMeta>(DEFAULT_META);
  const [campusOptions, setCampusOptions] = useState<CampusOption[]>([]);

  const [filtersForm, setFiltersForm] = useState(DEFAULT_FILTERS);
  const [query, setQuery] = useState<ContentListParams>({
    page: 1,
    limit: DEFAULT_CONTENT_PAGE_SIZE,
  });

  const [confirmState, setConfirmState] = useState<ConfirmState>(null);
  const [modalMode, setModalMode] = useState<"create" | "edit" | null>(null);
  const [editingContent, setEditingContent] = useState<Content | null>(null);
  const [viewingContent, setViewingContent] = useState<Content | null>(null);
  const filterApplyTimeoutRef = useRef<number | null>(null);
  const listRequestIdRef = useRef(0);
  const listAbortControllerRef = useRef<AbortController | null>(null);

  const titleSuggestions = useMemo(() => {
    const suggestions: Array<{ value: string; label: string; description: string }> = [];
    const seenValues = new Set<string>();

    for (const content of items) {
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

  async function loadContents(currentQuery: ContentListParams) {
    const requestId = listRequestIdRef.current + 1;
    listRequestIdRef.current = requestId;
    listAbortControllerRef.current?.abort();
    const requestAbortController = new AbortController();
    listAbortControllerRef.current = requestAbortController;

    setLoading(true);
    setError("");

    try {
      const response = await contentService.getContents(currentQuery, {
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
      setError(getErrorMessage(err, "No se pudo cargar la lista de contenidos"));
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
    void loadContents(query);
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
    if (!viewingContent) return;

    const nextContent = items.find((item) => item.id === viewingContent.id);
    if (!nextContent) return;

    setViewingContent(nextContent);
  }, [items, viewingContent]);

  useEffect(() => {
    const queryFilters = parseContentFiltersFromSearchParams(location.search);

    if (!queryFilters) {
      return;
    }

    const nextFilters = {
      ...DEFAULT_FILTERS,
      ...queryFilters,
    };
    const normalizedFilters = normalizeContentFilters(nextFilters);

    setFiltersForm(normalizedFilters);
    setQuery((previousQuery) => {
      const nextQuery = buildContentQueryFromFilters(
        normalizedFilters,
        previousQuery.limit || DEFAULT_CONTENT_PAGE_SIZE,
      );

      return areContentQueriesEqual(previousQuery, nextQuery)
        ? previousQuery
        : nextQuery;
    });
  }, [location.search]);

  useEffect(() => {
    const navigationState = location.state as {
      message?: string;
      openEditContent?: Content;
      dashboardFilters?: Partial<typeof DEFAULT_FILTERS>;
    } | null;

    if (navigationState?.dashboardFilters) {
      const nextFilters = {
        ...DEFAULT_FILTERS,
        ...navigationState.dashboardFilters,
      };
      const normalizedFilters = normalizeContentFilters(nextFilters);

      setFiltersForm(normalizedFilters);
      setQuery((previousQuery) => {
        const nextQuery = buildContentQueryFromFilters(
          normalizedFilters,
          previousQuery.limit || DEFAULT_CONTENT_PAGE_SIZE,
        );

        return areContentQueriesEqual(previousQuery, nextQuery)
          ? previousQuery
          : nextQuery;
      });
    }

    if (navigationState?.message) {
      setSuccess(navigationState.message);
    }

    if (navigationState?.openEditContent) {
      setError("");
      setServerErrors({});
      setEditingContent(navigationState.openEditContent);
      setModalMode("edit");
    }

    if (
      navigationState?.dashboardFilters
      || navigationState?.message
      || navigationState?.openEditContent
    ) {
      navigate(location.pathname, { replace: true, state: null });
    }
  }, [location.pathname, location.state, navigate]);

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
    const normalizedFilters = normalizeContentFilters(nextFilters);

    const applyFilters = () => {
      setQuery((previousQuery) => {
        const nextQuery = buildContentQueryFromFilters(
          normalizedFilters,
          previousQuery.limit || DEFAULT_CONTENT_PAGE_SIZE,
        );

        return areContentQueriesEqual(previousQuery, nextQuery)
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
      const nextFilters = normalizeContentFilters({
        ...previousFilters,
        [name]: value,
      });

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
        limit: previousQuery.limit || DEFAULT_CONTENT_PAGE_SIZE,
      };

      return areContentQueriesEqual(previousQuery, nextQuery)
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

  function handleDeleteClick(content: Content) {
    setConfirmState({
      type: "delete",
      content,
    });
  }

  function handleToggleStatusClick(content: Content) {
    const nextStatus: ContentStatus =
      content.status === "active" ? "inactive" : "active";

    setConfirmState({
      type: "status",
      content,
      nextStatus,
    });
  }

  async function handleConfirmAction() {
    if (!confirmState) return;

    setActionLoading(true);
    setError("");
    setSuccess("");

    try {
      if (confirmState.type === "delete") {
        await contentService.deleteContent(confirmState.content.id);
        setSuccess("Contenido eliminado correctamente");
      } else {
        await contentService.changeContentStatus(
          confirmState.content.id,
          confirmState.nextStatus,
        );

        setSuccess(
          confirmState.nextStatus === "active"
            ? "Contenido activado correctamente"
            : "Contenido desactivado correctamente",
        );
      }

      setConfirmState(null);
      await loadContents(query);
    } catch (err) {
      setError(getErrorMessage(err, "No se pudo completar la acción"));
    } finally {
      setActionLoading(false);
    }
  }

  function handleOpenCreateModal() {
    setError("");
    setSuccess("");
    setServerErrors({});
    setEditingContent(null);
    setModalMode("create");
  }

  function handleOpenEditModal(content: Content) {
    setError("");
    setSuccess("");
    setServerErrors({});
    setEditingContent(content);
    setModalMode("edit");
  }

  function handleOpenViewDrawer(content: Content) {
    setError("");
    setSuccess("");
    setViewingContent(content);
  }

  function handleCloseViewDrawer() {
    setViewingContent(null);
  }

  function handleEditFromDrawer() {
    if (!viewingContent) return;

    const targetContent = viewingContent;
    setViewingContent(null);
    handleOpenEditModal(targetContent);
  }

  function handleManageQuestionImages(content: Content) {
    if (content.contentType !== "pdf") {
      return;
    }

    navigate(`/admin/contents/${content.id}/question-images`);
  }

  function handleManageQuestionImagesFromDrawer() {
    if (!viewingContent || viewingContent.contentType !== "pdf") {
      return;
    }

    navigate(`/admin/contents/${viewingContent.id}/question-images`);
  }

  function handleCloseModal() {
    if (submitLoading) return;

    setModalMode(null);
    setEditingContent(null);
    setServerErrors({});
  }

  async function handleModalSubmit(values: ContentFormValues) {
    setSubmitLoading(true);
    setError("");
    setSuccess("");
    setServerErrors({});

    try {
      if (modalMode === "edit" && editingContent) {
        await contentService.updateContent(editingContent.id, values);
        setSuccess("Contenido actualizado correctamente");
      } else {
        await contentService.createContent(values);
        setSuccess("Contenido registrado correctamente");
      }

      setModalMode(null);
      setEditingContent(null);
      setServerErrors({});
      await loadContents(query);
    } catch (err) {
      const nextFieldErrors = getContentFieldErrors(err);
      setServerErrors(nextFieldErrors);

      if (Object.keys(nextFieldErrors).length === 0) {
        setError(getErrorMessage(err, "No se pudo guardar el contenido"));
      }
    } finally {
      setSubmitLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-(--color-bg) px-4 py-6 sm:px-6 lg:px-10">
      <div className="mx-auto flex w-full max-w-none flex-col gap-4">
        {success && (
          <FeedbackMessage
            type="success"
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
                Gestión de Contenidos
              </h1>
              <p className="text-xs text-(--color-text-secondary) sm:text-xs">
                Administra la biblioteca de contenidos disponibles
              </p>
            </div>

            <button
              type="button"
              onClick={handleOpenCreateModal}
              className="inline-flex items-center justify-center gap-2 rounded-full bg-(--color-red-button) px-6 py-2.5 text-xs font-semibold text-white shadow-md shadow-(--color-red-button)/30 transition hover:bg-(--color-red-dark) focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--color-red-main) focus-visible:ring-offset-2"
            >
              <Plus className="h-4 w-4" />
              Crear Contenido
            </button>
          </header>

          <div>
            <ContentFilters
              values={filtersForm}
              campusOptions={campusOptions}
              isSuperAdmin={isSuperAdmin}
              titleOptions={titleSuggestions}
              onFieldChange={handleFilterFieldChange}
              onClear={handleClearFilters}
            />
          </div>

          <div>
            {loading ? (
              <LoadingState message="Cargando contenidos..." />
            ) : items.length === 0 ? (
              <EmptyState
                title="No hay contenidos"
                description="No se encontraron contenidos con los filtros actuales."
              />
            ) : (
              <div className="space-y-5">
                <ContentTable
                  items={items}
                  onView={handleOpenViewDrawer}
                  onEdit={handleOpenEditModal}
                  onDelete={handleDeleteClick}
                  onToggleStatus={handleToggleStatusClick}
                  onManageQuestionImages={handleManageQuestionImages}
                />

                <Pagination
                  currentPage={meta.currentPage}
                  totalPages={meta.totalPages}
                  totalItems={meta.totalItems}
                  pageSize={meta.pageSize}
                  pageSizeOptions={CONTENT_PAGE_SIZE_OPTIONS}
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
              ? `¿Deseas eliminar el contenido "${confirmState.content.title}"?`
              : `¿Deseas ${confirmState?.nextStatus === "active" ? "activar" : "desactivar"} el contenido "${confirmState?.content.title}"?`
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

        <FormModal
          isOpen={modalMode === "create" || modalMode === "edit"}
          title={modalMode === "edit" ? "Editar Contenido" : "Crear Contenido"}
          description="Completa la información para guardar el contenido."
          onClose={handleCloseModal}
          maxWidthClassName="max-w-5xl"
          disableClose={submitLoading}
        >
          <ContentForm
            key={
              editingContent ? `edit-content-${editingContent.id}` : "create-content"
            }
            campusOptions={campusOptions}
            initialValues={
              editingContent
                ? {
                  title: editingContent.title,
                  description: editingContent.description ?? "",
                  contentType: editingContent.contentType,
                  file: null,
                  status: editingContent.status,
                  campusId: String(editingContent.campusId),
                }
                : defaultCreateFormValues
            }
            isSuperAdmin={isSuperAdmin}
            lockedCampusName={user?.campus?.name ?? null}
            submitLabel={
              modalMode === "edit" ? "Guardar Cambios" : "Crear Contenido"
            }
            submitting={submitLoading}
            existingFileUrl={editingContent?.fileUrl ?? null}
            requireFile={modalMode === "create"}
            serverErrors={serverErrors}
            onSubmit={handleModalSubmit}
          />
        </FormModal>

        <SideDrawer
          isOpen={Boolean(viewingContent)}
          title="Detalle de Contenido"
          description="Revisa toda la información del contenido seleccionado."
          onClose={handleCloseViewDrawer}
          widthClassName="max-w-4xl"
        >
          {viewingContent && (
            <ContentDetailPanel
              content={viewingContent}
              onEdit={handleEditFromDrawer}
              onManageQuestionImages={handleManageQuestionImagesFromDrawer}
            />
          )}
        </SideDrawer>
      </div>
    </main>
  );
}
