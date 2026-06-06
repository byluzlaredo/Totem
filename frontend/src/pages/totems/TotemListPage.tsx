import { useEffect, useMemo, useRef, useState } from "react";
import { Check, Copy, Plus } from "lucide-react";
import ConfirmDialog from "../../components/ConfirmDialog";
import EmptyState from "../../components/EmptyState";
import FeedbackMessage from "../../components/FeedbackMessage";
import FormModal from "../../components/FormModal";
import LoadingState from "../../components/LoadingState";
import Pagination from "../../components/Pagination";
import {
  LIST_FILTER_DEBOUNCE_MS,
  LIST_SEARCH_MIN_CHARS,
} from "../../constants/search";
import { DEFAULT_PAGE_SIZE, EMPTY_TOTEM_FORM } from "../../constants/totem";
import TotemFilters from "../../features/totems/components/TotemFilters";
import TotemForm from "../../features/totems/components/TotemForm";
import TotemDetailPanel from "../../features/totems/components/TotemDetailPanel";
import TotemTable from "../../features/totems/components/TotemTable";
import {
  getTotemFieldErrors,
  totemService,
} from "../../features/totems/services/totem.service";
import { campusService } from "../../features/campuses/services/campus.service";
import type {
  PaginationMeta,
  Totem,
  TotemFormErrors,
  TotemConnectionStatus,
  TotemFormValues,
  TotemLinkingCodeResponse,
  TotemListParams,
  TotemState,
} from "../../types/totem";
import type { CampusOption } from "../../types/campus";
import { copyTextToClipboard } from "../../utils/clipboard";
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
  pageSize: DEFAULT_PAGE_SIZE,
};

const DEFAULT_FILTERS = {
  search: "",
  campusId: "",
  state: "",
  connectionStatus: "",
};
type ConfirmState =
  | null
  | {
    type: "delete";
    totem: Totem;
  }
  | {
    type: "state";
    totem: Totem;
    nextState: TotemState;
  };

type LinkingCodeModalState =
  | null
  | {
    totem: Totem;
    linkingCode: TotemLinkingCodeResponse;
  };

function formatDateTime(value: string | null) {
  if (!value) return "Sin registro";

  const parsedDate = new Date(value);

  if (Number.isNaN(parsedDate.getTime())) {
    return value;
  }

  return parsedDate.toLocaleString("es-BO", {
    dateStyle: "short",
    timeStyle: "short",
  });
}

function resolveScopedCampusIdForAdmin(userCampusId: number | null) {
  return typeof userCampusId === "number" && userCampusId > 0 ? userCampusId : null;
}

function buildEmptyTotemFormValues(
  isSuperAdmin: boolean,
  scopedCampusId: number | null,
): TotemFormValues {
  return {
    ...EMPTY_TOTEM_FORM,
    campusId: !isSuperAdmin && scopedCampusId !== null ? String(scopedCampusId) : "",
  };
}

function buildTotemQueryFromFilters(
  filters: typeof DEFAULT_FILTERS,
  limit: number,
): TotemListParams {
  return {
    search: normalizeSearchInputForQuery(
      filters.search,
      LIST_SEARCH_MIN_CHARS,
    ),
    campusId: filters.campusId === "" ? undefined : Number(filters.campusId),
    state: (filters.state as TotemState | "") || undefined,
    connectionStatus:
      (filters.connectionStatus as TotemConnectionStatus | "") || undefined,
    page: 1,
    limit,
  };
}

function areTotemQueriesEqual(left: TotemListParams, right: TotemListParams) {
  return (
    left.search === right.search
    && left.campusId === right.campusId
    && left.state === right.state
    && left.connectionStatus === right.connectionStatus
    && left.page === right.page
    && left.limit === right.limit
  );
}

export default function TotemListPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const isSuperAdmin = user?.role === "SuperAdmin";
  const scopedCampusId = resolveScopedCampusIdForAdmin(user?.campusId ?? null);
  const defaultCreateFormValues = useMemo(
    () => buildEmptyTotemFormValues(isSuperAdmin, scopedCampusId),
    [isSuperAdmin, scopedCampusId],
  );

  const [items, setItems] = useState<Totem[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [submitLoading, setSubmitLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [serverErrors, setServerErrors] = useState<TotemFormErrors>({});
  const [meta, setMeta] = useState<PaginationMeta>(DEFAULT_META);
  const [campusOptions, setCampusOptions] = useState<CampusOption[]>([]);

  const [filtersForm, setFiltersForm] = useState(DEFAULT_FILTERS);
  const [query, setQuery] = useState<TotemListParams>({
    page: 1,
    limit: DEFAULT_PAGE_SIZE,
  });

  const [confirmState, setConfirmState] = useState<ConfirmState>(null);
  const [modalMode, setModalMode] = useState<"create" | "edit" | null>(null);
  const [editingTotem, setEditingTotem] = useState<Totem | null>(null);
  const [detailDrawerTotemId, setDetailDrawerTotemId] = useState<number | null>(
    null,
  );
  const [detailDrawerInitialTotem, setDetailDrawerInitialTotem] =
    useState<Totem | null>(null);
  const [linkingCodeModal, setLinkingCodeModal] =
    useState<LinkingCodeModalState>(null);
  const [linkingCodeLoadingTotemId, setLinkingCodeLoadingTotemId] = useState<
    number | null
  >(null);
  const [modalCopyState, setModalCopyState] = useState<"idle" | "copied" | "error">(
    "idle",
  );
  const modalCopyResetTimeoutRef = useRef<number | null>(null);
  const filterApplyTimeoutRef = useRef<number | null>(null);
  const listRequestIdRef = useRef(0);
  const listAbortControllerRef = useRef<AbortController | null>(null);

  const searchSuggestions = useMemo(() => {
    const suggestions: Array<{ value: string; label: string; description: string }> = [];
    const seenValues = new Set<string>();

    for (const totem of items) {
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

  function clearModalCopyResetTimeout() {
    if (modalCopyResetTimeoutRef.current === null) {
      return;
    }

    window.clearTimeout(modalCopyResetTimeoutRef.current);
    modalCopyResetTimeoutRef.current = null;
  }

  function scheduleModalCopyReset() {
    clearModalCopyResetTimeout();

    modalCopyResetTimeoutRef.current = window.setTimeout(() => {
      setModalCopyState("idle");
      modalCopyResetTimeoutRef.current = null;
    }, 2500);
  }

  useEffect(() => {
    return () => {
      if (modalCopyResetTimeoutRef.current !== null) {
        window.clearTimeout(modalCopyResetTimeoutRef.current);
        modalCopyResetTimeoutRef.current = null;
      }

      if (filterApplyTimeoutRef.current !== null) {
        window.clearTimeout(filterApplyTimeoutRef.current);
        filterApplyTimeoutRef.current = null;
      }

      listAbortControllerRef.current?.abort();
      listAbortControllerRef.current = null;
      listRequestIdRef.current += 1;
    };
  }, []);

  async function loadTotems(currentQuery: TotemListParams) {
    const requestId = listRequestIdRef.current + 1;
    listRequestIdRef.current = requestId;
    listAbortControllerRef.current?.abort();
    const requestAbortController = new AbortController();
    listAbortControllerRef.current = requestAbortController;

    setLoading(true);
    setError("");

    try {
      const response = await totemService.getTotems(currentQuery, {
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
      setError(getErrorMessage(err, "No se pudo cargar la lista de tótems"));
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
    void loadTotems(query);
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
    const navigationState = location.state as {
      message?: string;
      openEditTotem?: Totem;
      openTotemDetailId?: number;
      dashboardFilters?: Partial<typeof DEFAULT_FILTERS>;
    } | null;

    if (navigationState?.dashboardFilters) {
      const nextFilters = {
        ...DEFAULT_FILTERS,
        ...navigationState.dashboardFilters,
      };

      setFiltersForm(nextFilters);
      setQuery((previousQuery) => {
        const nextQuery = buildTotemQueryFromFilters(
          nextFilters,
          previousQuery.limit || DEFAULT_PAGE_SIZE,
        );

        return areTotemQueriesEqual(previousQuery, nextQuery)
          ? previousQuery
          : nextQuery;
      });
    }

    if (navigationState?.message) {
      setSuccess(navigationState.message);
    }

    if (navigationState?.openEditTotem) {
      setError("");
      setServerErrors({});
      setEditingTotem(navigationState.openEditTotem);
      setModalMode("edit");
    }

    if (navigationState?.openTotemDetailId) {
      const nextTotemId = Number(navigationState.openTotemDetailId);

      if (Number.isInteger(nextTotemId) && nextTotemId > 0) {
        setDetailDrawerTotemId(nextTotemId);
        setDetailDrawerInitialTotem(null);
      }
    }

    if (
      navigationState?.dashboardFilters
      || navigationState?.message
      || navigationState?.openEditTotem
      || navigationState?.openTotemDetailId
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
    const applyFilters = () => {
      setQuery((previousQuery) => {
        const nextQuery = buildTotemQueryFromFilters(
          nextFilters,
          previousQuery.limit || DEFAULT_PAGE_SIZE,
        );

        return areTotemQueriesEqual(previousQuery, nextQuery)
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
        limit: previousQuery.limit || DEFAULT_PAGE_SIZE,
      };

      return areTotemQueriesEqual(previousQuery, nextQuery)
        ? previousQuery
        : nextQuery;
    });
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

  function handleDeleteClick(totem: Totem) {
    setConfirmState({
      type: "delete",
      totem,
    });
  }

  function handleToggleStateClick(totem: Totem) {
    const nextState: TotemState =
      totem.state === "active" ? "inactive" : "active";

    setConfirmState({
      type: "state",
      totem,
      nextState,
    });
  }

  async function handleConfirmAction() {
    if (!confirmState) return;

    setActionLoading(true);
    setError("");
    setSuccess("");

    try {
      if (confirmState.type === "delete") {
        await totemService.deleteTotem(confirmState.totem.id);
        setSuccess("Tótem y asignaciones relacionadas eliminados correctamente");
      } else {
        await totemService.changeTotemState(
          confirmState.totem.id,
          confirmState.nextState,
        );

        setSuccess(
          confirmState.nextState === "active"
            ? "Tótem activado correctamente"
            : "Tótem desactivado correctamente",
        );
      }

      setConfirmState(null);
      await loadTotems(query);
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
    setEditingTotem(null);
    setModalMode("create");
  }

  function handleOpenEditModal(totem: Totem) {
    setError("");
    setSuccess("");
    setServerErrors({});
    setEditingTotem(totem);
    setModalMode("edit");
  }

  function handleOpenDetailDrawer(totem: Totem) {
    setError("");
    setSuccess("");
    setDetailDrawerInitialTotem(totem);
    setDetailDrawerTotemId(totem.id);
  }

  function handleCloseDetailDrawer() {
    setDetailDrawerTotemId(null);
    setDetailDrawerInitialTotem(null);
  }

  function handleEditFromDetailDrawer(totem: Totem) {
    handleCloseDetailDrawer();
    handleOpenEditModal(totem);
  }

  async function handleGenerateLinkingCodeClick(totem: Totem) {
    if (totem.state !== "active") {
      setError("Solo se puede generar código temporal para tótems activos.");
      return;
    }

    setLinkingCodeLoadingTotemId(totem.id);
    setError("");
    setSuccess("");

    try {
      const response = await totemService.generateTotemLinkingCode(totem.id, 10);
      setLinkingCodeModal({
        totem,
        linkingCode: response.data,
      });
      clearModalCopyResetTimeout();
      setModalCopyState("idle");
    } catch (err) {
      setError(
        getErrorMessage(err, "No se pudo generar el código temporal de vinculación."),
      );
    } finally {
      setLinkingCodeLoadingTotemId(null);
    }
  }

  async function handleCopyLinkingCodeFromModal() {
    const code = linkingCodeModal?.linkingCode.code?.trim();

    if (!code) {
      setModalCopyState("error");
      return;
    }

    const copied = await copyTextToClipboard(code);

    if (copied) {
      setModalCopyState("copied");
      scheduleModalCopyReset();
      return;
    }

    clearModalCopyResetTimeout();
    setModalCopyState("error");
    setError("No se pudo copiar el código de vinculación.");
  }

  function handleCloseLinkingCodeModal() {
    clearModalCopyResetTimeout();
    setLinkingCodeModal(null);
    setModalCopyState("idle");
  }

  function handleCloseModal() {
    if (submitLoading) return;

    setModalMode(null);
    setEditingTotem(null);
    setServerErrors({});
  }

  async function handleModalSubmit(values: TotemFormValues) {
    setSubmitLoading(true);
    setError("");
    setSuccess("");
    setServerErrors({});

    try {
      if (modalMode === "edit" && editingTotem) {
        const updateResponse = await totemService.updateTotem(editingTotem.id, values);

        if (updateResponse.data.state !== values.state) {
          await totemService.changeTotemState(editingTotem.id, values.state);
        }

        setSuccess("Tótem actualizado correctamente");
      } else {
        const createResponse = await totemService.createTotem(values);

        if (values.state === "inactive") {
          await totemService.changeTotemState(createResponse.data.id, values.state);
        }

        setSuccess("Tótem registrado correctamente");
      }

      setModalMode(null);
      setEditingTotem(null);
      setServerErrors({});
      await loadTotems(query);
    } catch (err) {
      const nextFieldErrors = getTotemFieldErrors(err);
      setServerErrors(nextFieldErrors);

      if (Object.keys(nextFieldErrors).length === 0) {
        setError(getErrorMessage(err, "No se pudo guardar el tótem"));
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
                Gestión de Tótems
              </h1>
              <p className="text-xs text-(--color-text-secondary) sm:text-xs">
                Administra todos los tótems del sistema
              </p>
            </div>

            <button
              type="button"
              onClick={handleOpenCreateModal}
              className="inline-flex items-center justify-center gap-2 rounded-full bg-(--color-red-button) px-6 py-2.5 text-xs font-semibold text-white shadow-md shadow-(--color-red-button)/30 transition hover:bg-(--color-red-dark) focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--color-red-main) focus-visible:ring-offset-2"
            >
              <Plus className="h-4 w-4" />
              Crear Tótem
            </button>
          </header>

          <div>
            <TotemFilters
              values={filtersForm}
              campusOptions={campusOptions}
              isSuperAdmin={isSuperAdmin}
              searchOptions={searchSuggestions}
              onFieldChange={handleFilterFieldChange}
              onClear={handleClearFilters}
            />
          </div>

          <div>
            <div className="space-y-4">
              <section className="rounded-2xl border border-[#d7e2f3] bg-[#f7faff] px-4 py-3 text-xs text-[#23416f] sm:px-5">
                Para vincular un dispositivo, genera un código temporal desde Acciones
                o desde la vista de detalles del tótem.
              </section>

              {loading ? (
                <LoadingState message="Cargando tótems..." />
              ) : items.length === 0 ? (
                <EmptyState
                  title="No hay tótems"
                  description="No se encontraron registros con los filtros actuales."
                />
              ) : (
                <div className="space-y-4">
                  <TotemTable
                    items={items}
                    onView={handleOpenDetailDrawer}
                    onEdit={handleOpenEditModal}
                    onDelete={handleDeleteClick}
                    onToggleState={handleToggleStateClick}
                    onGenerateLinkingCode={handleGenerateLinkingCodeClick}
                    linkingCodeLoadingTotemId={linkingCodeLoadingTotemId}
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
              ? `¿Deseas eliminar el tótem "${confirmState.totem.name}"? También se eliminarán sus asignaciones relacionadas.`
              : `¿Deseas ${confirmState?.nextState === "active" ? "activar" : "desactivar"} el tótem "${confirmState?.totem.name}"?`
          }
          confirmLabel={
            confirmState?.type === "delete"
              ? "Sí, eliminar"
              : confirmState?.nextState === "active"
                ? "Sí, activar"
                : "Sí, desactivar"
          }
          loading={actionLoading}
          onCancel={() => setConfirmState(null)}
          onConfirm={handleConfirmAction}
        />

        <FormModal
          isOpen={modalMode === "create" || modalMode === "edit"}
          title={modalMode === "edit" ? "Editar Tótem" : "Crear Tótem"}
          description="Completa los datos para guardar el registro."
          onClose={handleCloseModal}
          maxWidthClassName="max-w-3xl"
          disableClose={submitLoading}
        >
          <TotemForm
            key={editingTotem ? `edit-${editingTotem.id}` : "create-totem"}
            campusOptions={campusOptions}
            initialValues={
              editingTotem
                ? {
                  code: editingTotem.code,
                  name: editingTotem.name,
                  campusId: String(editingTotem.campusId),
                  state: editingTotem.state,
                }
                : defaultCreateFormValues
            }
            isSuperAdmin={isSuperAdmin}
            lockedCampusName={user?.campus?.name ?? null}
            submitLabel={
              modalMode === "edit" ? "Guardar Cambios" : "Crear Tótem"
            }
            submitting={submitLoading}
            serverErrors={serverErrors}
            onSubmit={handleModalSubmit}
          />
        </FormModal>

        <FormModal
          isOpen={Boolean(linkingCodeModal)}
          title="Código Temporal de Vinculación"
          description={
            linkingCodeModal
              ? `Comparte este código para vincular el dispositivo del tótem "${linkingCodeModal.totem.name}".`
              : undefined
          }
          onClose={handleCloseLinkingCodeModal}
          maxWidthClassName="max-w-xl"
        >
          {linkingCodeModal ? (
            <div className="space-y-4">
              <div className="rounded-2xl border border-[#d7e2f3] bg-[#f7faff] p-5 text-center">
                <p className="text-xs font-semibold tracking-[0.08em] text-[#44618f]">
                  Código vigente
                </p>
                <p className="mt-2 font-mono text-3xl font-bold tracking-[0.2em] text-[#123462]">
                  {linkingCodeModal.linkingCode.code ?? "No disponible"}
                </p>

                <div className="mt-4">
                  <button
                    type="button"
                    onClick={handleCopyLinkingCodeFromModal}
                    disabled={!linkingCodeModal.linkingCode.code}
                    className="inline-flex items-center justify-center gap-2 rounded-xl border border-[#b7c9e4] bg-white px-3.5 py-2 text-xs font-semibold text-[#23416f] transition hover:bg-[#eef4ff] disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {modalCopyState === "copied" ? (
                      <Check className="h-4 w-4" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                    {modalCopyState === "copied" ? "Código copiado" : "Copiar código"}
                  </button>
                </div>
              </div>

              <dl className="grid grid-cols-1 gap-3 rounded-2xl border border-(--color-border) bg-white p-4 text-sm sm:grid-cols-2">
                <div>
                  <dt className="text-xs font-semibold tracking-[0.08em] text-(--color-text-secondary)">
                    Estado
                  </dt>
                  <dd className="mt-1 font-semibold text-xs text-(--color-text-main)">
                    Activo
                  </dd>
                </div>
                <div>
                  <dt className="text-xs font-semibold tracking-[0.08em] text-(--color-text-secondary)">
                    Vigencia
                  </dt>
                  <dd className="mt-1 text-xs font-semibold text-(--color-text-main)">
                    {linkingCodeModal.linkingCode.ttlMinutes ?? 10} minutos
                  </dd>
                </div>
                <div>
                  <dt className="text-xs font-semibold tracking-[0.08em] text-(--color-text-secondary)">
                    Generado en
                  </dt>
                  <dd className="mt-1 text-xs font-medium text-(--color-text-main)">
                    {formatDateTime(linkingCodeModal.linkingCode.generatedAt)}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs font-semibold tracking-[0.08em] text-(--color-text-secondary)">
                    Expira en
                  </dt>
                  <dd className="mt-1 text-xs font-medium text-(--color-text-main)">
                    {formatDateTime(linkingCodeModal.linkingCode.expiresAt)}
                  </dd>
                </div>
              </dl>
            </div>
          ) : null}
        </FormModal>

        <TotemDetailPanel
          isOpen={Boolean(detailDrawerTotemId)}
          totemId={detailDrawerTotemId}
          initialTotem={detailDrawerInitialTotem}
          onClose={handleCloseDetailDrawer}
          onEdit={handleEditFromDetailDrawer}
        />
      </div>
    </main>
  );
}
