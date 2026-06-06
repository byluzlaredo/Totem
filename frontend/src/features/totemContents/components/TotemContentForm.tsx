import { CalendarDays, Check, LoaderCircle, Layers, ListOrdered, Monitor, Newspaper, Search, Tags, Users, CirclePower, Link2, X } from "lucide-react";
import {
  JSX,
  type UIEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useTotemContentForm } from "../hooks/useTotemContentForm";
import { useInfiniteCatalogOptions } from "../hooks/useInfiniteCatalogOptions";
import {
  ASSIGNMENT_MODE_OPTIONS,
  CONTENT_ASSIGNMENT_MODE_OPTIONS,
  EMPTY_TOTEM_CONTENT_FORM,
  TOTEM_CONTENT_STATUS_OPTIONS,
} from "../../../constants/totemContent";
import { CONTENT_TYPE_OPTIONS } from "../../../constants/content";
import {
  ASSIGNMENT_CATALOG_SEARCH_MIN_CHARS,
  LIST_FILTER_DEBOUNCE_MS,
} from "../../../constants/search";
import type { Totem } from "../../../types/totem";
import type { Content } from "../../../types/content";
import type {
  TotemContentFormErrors,
  TotemContentFormValues,
} from "../../../types/totemContent";
import FileActionButton from "../../../components/FileActionButton";
import SafeText from "../../../components/SafeText";
import { resolveAssetUrl } from "../../../utils/assetUrl";
import { useDebouncedValue } from "../../../hooks/useDebouncedValue";
import ContentPreviewMedia from "../../contents/components/ContentPreviewMedia";
import {
  inferPreviewKindFromContent,
  resolveMissingPreviewCopy,
} from "../../contents/utils/contentPreview";
import { useModalErrorScrollToTop } from "../../../hooks/useModalErrorScrollToTop";
import { normalizeSearchInputForQuery } from "../../../utils/textSearch";
import {
  ASSIGNMENT_CATALOG_PAGE_SIZE,
  fetchActiveContentsCatalogPage,
  fetchActiveTotemsCatalogPage,
} from "../services/totemContentCatalog.service";

interface TotemContentFormProps {
  initialValues?: TotemContentFormValues;
  mode?: "create" | "edit";
  totems: Totem[];
  contents: Content[];
  submitLabel: string;
  cancelLabel?: string;
  onCancel?: () => void;
  modeEnabled?: boolean;
  submitting?: boolean;
  serverErrors?: TotemContentFormErrors;
  onSubmit: (values: TotemContentFormValues) => Promise<void>;
}

function getContentTypeLabel(contentType: Content["contentType"]) {
  if (contentType === "image") return "Imagen";
  if (contentType === "video") return "Video";
  if (contentType === "news") return "Noticia";
  if (contentType === "advertisement") return "Publicidad";
  return "PDF";
}

function selectedContentCountText(count: number) {
  return count === 1 ? "1 contenido seleccionado" : `${count} contenidos seleccionados`;
}

function toDateTimeLocalMinValue(date = new Date()) {
  const localDate = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return localDate.toISOString().slice(0, 16);
}

function resolveSelectedItemsByIds<T extends { id: number }>(
  ids: string[],
  itemById: Map<number, T>,
) {
  const selectedItems: T[] = [];
  const knownIds = new Set<number>();

  for (const id of ids) {
    const parsedId = Number(id);

    if (!Number.isInteger(parsedId) || parsedId <= 0 || knownIds.has(parsedId)) {
      continue;
    }

    const item = itemById.get(parsedId);

    if (!item) {
      continue;
    }

    knownIds.add(parsedId);
    selectedItems.push(item);
  }

  return selectedItems;
}

function renderOptionSections<T>({
  selectedItems,
  resultItems,
  renderItem,
  emptyLabel,
  isLoading,
  isLoadingMore,
  hasMore,
  errorMessage,
  onResultsScroll,
}: {
  selectedItems: T[];
  resultItems: T[];
  renderItem: (item: T, isSelected: boolean) => JSX.Element;
  emptyLabel: string;
  isLoading: boolean;
  isLoadingMore: boolean;
  hasMore: boolean;
  errorMessage: string;
  onResultsScroll: (event: UIEvent<HTMLDivElement>) => void;
}) {
  const hasSelectedItems = selectedItems.length > 0;
  const hasResultItems = resultItems.length > 0;

  return (
    <div className="space-y-2">
      {hasSelectedItems && (
        <section className="rounded-xl border border-(--color-border) bg-[#f8f9fb] p-1.5">
          <p className="px-3 pb-1 pt-2 text-xs font-semibold tracking-[0.08em] text-(--color-text-secondary)">
            Seleccionados
          </p>
          <div className="max-h-56 space-y-0.5 overflow-y-auto pr-0.5">
            {selectedItems.map((item) => renderItem(item, true))}
          </div>
        </section>
      )}

      <section className="rounded-xl border border-(--color-border) bg-white p-1.5">
        <div
          className="max-h-56 overflow-y-auto pr-0.5"
          onScroll={onResultsScroll}
        >
          <p className="px-3 pb-1 pt-2 text-xs font-semibold tracking-[0.08em] text-(--color-text-secondary)">
            Resultados
          </p>
          {hasResultItems ? (
            resultItems.map((item) => renderItem(item, false))
          ) : (
            !isLoading &&
            !errorMessage && (
              <p className="px-3 py-2 text-xs text-(--color-text-secondary)">
                {emptyLabel}
              </p>
            )
          )}
          {isLoading && (
            <p className="inline-flex items-center gap-2 px-3 py-2 text-xs text-(--color-text-secondary)">
              <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
              Cargando resultados...
            </p>
          )}
          {errorMessage && (
            <p className="px-3 py-2 text-xs text-(--color-red-main)">
              {errorMessage}
            </p>
          )}
          {isLoadingMore && (
            <p className="inline-flex items-center gap-2 px-3 py-2 text-xs text-(--color-text-secondary)">
              <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
              Cargando más resultados...
            </p>
          )}
          {hasMore && !isLoading && !isLoadingMore && hasResultItems && (
            <p className="px-3 py-2 text-xs text-(--color-text-secondary)">
              Desliza para cargar más resultados.
            </p>
          )}
        </div>
      </section>
    </div>
  );
}

export default function TotemContentForm({
  initialValues = EMPTY_TOTEM_CONTENT_FORM,
  mode = "create",
  totems,
  contents,
  submitLabel,
  cancelLabel = "Cancelar",
  onCancel,
  modeEnabled = true,
  submitting = false,
  serverErrors,
  onSubmit,
}: TotemContentFormProps) {
  const formRef = useRef<HTMLFormElement | null>(null);
  const [totemSearchTerm, setTotemSearchTerm] = useState("");
  const [contentSearchTerm, setContentSearchTerm] = useState("");
  const [contentTypeFilter, setContentTypeFilter] =
    useState<Content["contentType"] | "">("");
  const [activeTotemCount, setActiveTotemCount] = useState(0);
  const {
    values,
    errors,
    submitAttempts,
    removeSelectedContent,
    setSingleTotemId,
    setSingleContentId,
    toggleMultipleTotemId,
    toggleMultipleContentId,
    handleChange,
    handleSubmit,
    setFieldErrors,
  } = useTotemContentForm(
    initialValues,
    onSubmit,
    {
      mode,
      initialStartAt: initialValues.startAt,
    },
  );
  const minDateTimeLocal = toDateTimeLocalMinValue();
  const initialStartAtDate = initialValues.startAt
    ? new Date(initialValues.startAt)
    : null;
  const allowPastStartAtInput =
    mode === "edit" &&
    initialStartAtDate !== null &&
    !Number.isNaN(initialStartAtDate.getTime()) &&
    initialStartAtDate < new Date();
  const minEndAt = values.startAt || minDateTimeLocal;
  const debouncedTotemSearchTerm = useDebouncedValue(
    totemSearchTerm.trim(),
    LIST_FILTER_DEBOUNCE_MS,
  );
  const debouncedContentSearchTerm = useDebouncedValue(
    contentSearchTerm.trim(),
    LIST_FILTER_DEBOUNCE_MS,
  );
  const normalizedTotemCatalogSearchTerm = useMemo(
    () =>
      normalizeSearchInputForQuery(
        debouncedTotemSearchTerm,
        ASSIGNMENT_CATALOG_SEARCH_MIN_CHARS,
      ),
    [debouncedTotemSearchTerm],
  );
  const normalizedContentCatalogSearchTerm = useMemo(
    () =>
      normalizeSearchInputForQuery(
        debouncedContentSearchTerm,
        ASSIGNMENT_CATALOG_SEARCH_MIN_CHARS,
      ),
    [debouncedContentSearchTerm],
  );

  const fetchTotemCatalogPage = useCallback(
    (
      page: number,
      limit: number,
      options?: { signal?: AbortSignal },
    ) =>
      fetchActiveTotemsCatalogPage({
        page,
        limit,
        search: normalizedTotemCatalogSearchTerm,
        signal: options?.signal,
      }),
    [normalizedTotemCatalogSearchTerm],
  );

  const fetchContentCatalogPage = useCallback(
    (
      page: number,
      limit: number,
      options?: { signal?: AbortSignal },
    ) =>
      fetchActiveContentsCatalogPage({
        page,
        limit,
        search: normalizedContentCatalogSearchTerm,
        contentType: contentTypeFilter,
        signal: options?.signal,
      }),
    [contentTypeFilter, normalizedContentCatalogSearchTerm],
  );

  const totemCatalog = useInfiniteCatalogOptions<Totem>({
    initialItems: totems,
    pageSize: ASSIGNMENT_CATALOG_PAGE_SIZE,
    queryKey: normalizedTotemCatalogSearchTerm ?? "",
    fetchPage: fetchTotemCatalogPage,
  });

  const contentCatalog = useInfiniteCatalogOptions<Content>({
    initialItems: contents,
    pageSize: ASSIGNMENT_CATALOG_PAGE_SIZE,
    queryKey: `${normalizedContentCatalogSearchTerm ?? ""}:${contentTypeFilter || "all"}`,
    fetchPage: fetchContentCatalogPage,
  });

  useEffect(() => {
    if (!normalizedTotemCatalogSearchTerm) {
      setActiveTotemCount(totemCatalog.totalItems);
    }
  }, [normalizedTotemCatalogSearchTerm, totemCatalog.totalItems]);

  const totemById = totemCatalog.knownItemById;
  const contentById = contentCatalog.knownItemById;

  const selectedSingleTotem = useMemo(() => {
    const totemId = Number(values.totemId);

    if (!Number.isInteger(totemId) || totemId <= 0) {
      return null;
    }

    return totemById.get(totemId) ?? null;
  }, [totemById, values.totemId]);

  const selectedSingleContent = useMemo(() => {
    const contentId = Number(values.contentId);

    if (!Number.isInteger(contentId) || contentId <= 0) {
      return null;
    }

    return contentById.get(contentId) ?? null;
  }, [contentById, values.contentId]);

  const selectedMultipleTotemIds = useMemo(
    () =>
      new Set(
        values.totemIds
          .map((totemId) => Number(totemId))
          .filter((totemId) => Number.isInteger(totemId) && totemId > 0),
      ),
    [values.totemIds],
  );

  const selectedMultipleContentIds = useMemo(
    () =>
      new Set(
        values.contentIds
          .map((contentId) => Number(contentId))
          .filter((contentId) => Number.isInteger(contentId) && contentId > 0),
      ),
    [values.contentIds],
  );

  const singleTotemOptions = useMemo(() => {
    const selectedTotemId = Number(values.totemId);
    const selectedItems = selectedSingleTotem ? [selectedSingleTotem] : [];
    const resultItems = totemCatalog.resultItems.filter(
      (totem) => totem.id !== selectedTotemId,
    );

    return { selectedItems, resultItems };
  }, [selectedSingleTotem, totemCatalog.resultItems, values.totemId]);

  const multipleTotemOptions = useMemo(() => {
    const selectedItems = resolveSelectedItemsByIds(values.totemIds, totemById);
    const resultItems = totemCatalog.resultItems.filter(
      (totem) => !selectedMultipleTotemIds.has(totem.id),
    );

    return { selectedItems, resultItems };
  }, [
    selectedMultipleTotemIds,
    totemById,
    totemCatalog.resultItems,
    values.totemIds,
  ]);

  const singleContentOptions = useMemo(() => {
    const selectedContentId = Number(values.contentId);
    const selectedItems = selectedSingleContent ? [selectedSingleContent] : [];
    const resultItems = contentCatalog.resultItems.filter(
      (content) => content.id !== selectedContentId,
    );

    return { selectedItems, resultItems };
  }, [contentCatalog.resultItems, selectedSingleContent, values.contentId]);

  const multipleContentOptions = useMemo(() => {
    const selectedItems = resolveSelectedItemsByIds(values.contentIds, contentById);
    const resultItems = contentCatalog.resultItems.filter(
      (content) => !selectedMultipleContentIds.has(content.id),
    );

    return { selectedItems, resultItems };
  }, [
    contentById,
    contentCatalog.resultItems,
    selectedMultipleContentIds,
    values.contentIds,
  ]);

  useEffect(() => {
    if (!serverErrors) return;
    setFieldErrors(serverErrors);
  }, [serverErrors, setFieldErrors]);

  const selectedContentIds = useMemo(() => {
    if (values.contentAssignmentMode === "multiple") {
      return [...new Set(values.contentIds.map((contentId) => Number(contentId)))]
        .filter((contentId) => Number.isInteger(contentId) && contentId > 0);
    }

    const contentId = Number(values.contentId);

    if (!Number.isInteger(contentId) || contentId <= 0) {
      return [];
    }

    return [contentId];
  }, [
    values.contentAssignmentMode,
    values.contentId,
    values.contentIds,
  ]);

  const selectedContents = useMemo(() => {
    if (selectedContentIds.length === 0) {
      return [];
    }

    return selectedContentIds
      .map((contentId) => contentById.get(contentId))
      .filter((content): content is Content => Boolean(content));
  }, [contentById, selectedContentIds]);

  const selectedTotemCount = useMemo(() => {
    if (values.assignmentMode === "all") {
      return activeTotemCount;
    }

    if (values.assignmentMode === "multiple") {
      return selectedMultipleTotemIds.size;
    }

    return selectedSingleTotem ? 1 : 0;
  }, [
    activeTotemCount,
    selectedMultipleTotemIds.size,
    selectedSingleTotem,
    values.assignmentMode,
  ]);

  useModalErrorScrollToTop(
    formRef,
    submitAttempts,
    Boolean(errors.totemId || errors.totemIds),
  );

  function renderTotemOption(
    totem: Totem,
    isSelected: boolean,
    onSelect: () => void,
  ) {
    return (
      <button
        key={totem.id}
        type="button"
        role="option"
        aria-selected={isSelected}
        onClick={onSelect}
        className={`flex w-full items-center justify-between gap-3 rounded-xl px-3 py-2 text-left transition ${isSelected
          ? "bg-[#fdebef] text-(--color-red-main)"
          : "text-(--color-text-main) hover:bg-[#f8f9fb]"
          }`}
      >
        <span className="inline-flex min-w-0 items-center gap-2">
          <Monitor className="h-4 w-4 shrink-0 text-(--color-text-secondary)" />
          <span className="min-w-0">
            <span className="block truncate text-xs font-semibold">
              {totem.code} - {totem.name}
            </span>
            <span className="block truncate text-xs text-(--color-text-secondary)">
              {totem.campus?.name ?? "Sin campus"}
            </span>
          </span>
        </span>
        {isSelected && <Check className="h-4 w-4 shrink-0" />}
      </button>
    );
  }

  function renderContentOption(
    content: Content,
    isSelected: boolean,
    onSelect: () => void,
  ) {
    return (
      <button
        key={content.id}
        type="button"
        role="option"
        aria-selected={isSelected}
        onClick={onSelect}
        className={`flex w-full items-center justify-between gap-3 rounded-xl px-3 py-2 text-left transition ${isSelected
          ? "bg-[#fdebef] text-(--color-red-main)"
          : "text-(--color-text-main) hover:bg-[#f8f9fb]"
          }`}
      >
        <span className="inline-flex min-w-0 items-center gap-2">
          <Newspaper className="h-4 w-4 shrink-0 text-(--color-text-secondary)" />
          <span className="min-w-0">
            <span className="block truncate text-xs font-semibold">
              {content.title}
            </span>
            <span className="block truncate text-xs text-(--color-text-secondary)">
              {getContentTypeLabel(content.contentType)}
            </span>
          </span>
        </span>
        {isSelected && <Check className="h-4 w-4 shrink-0" />}
      </button>
    );
  }

  return (
    <form ref={formRef} onSubmit={handleSubmit}>
      <fieldset disabled={submitting} className="space-y-6">
        <legend className="sr-only">Formulario de asignación</legend>
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1.25fr)_minmax(0,0.75fr)]">
          <div className="space-y-6">
            <section className="space-y-4 rounded-2xl border border-(--color-border) bg-white p-4 sm:p-5">
              <header>
                <h3 className="text-sm font-semibold tracking-[0.08em] text-(--color-text-secondary)">
                  Selección de Tótems
                </h3>
              </header>

              {modeEnabled && (
                <div className="space-y-2">
                  <label
                    htmlFor="assignmentMode"
                    className="text-sm font-semibold text-(--color-text-main)"
                  >
                    Modo de asignación
                  </label>
                  <div className="relative">
                    <Users className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-(--color-text-secondary)" />
                    <select
                      id="assignmentMode"
                      name="assignmentMode"
                      value={values.assignmentMode}
                      onChange={handleChange}
                      className={`w-full rounded-2xl border bg-white py-2 pl-11 pr-4 text-xs text-(--color-text-main) outline-none transition focus:ring-2 ${errors.assignmentMode
                        ? "border-(--color-red-main) focus:border-(--color-red-main) focus:ring-(--color-red-main)/20"
                        : "border-(--color-border) focus:border-(--color-red-main) focus:ring-(--color-red-main)/20"
                        }`}
                    >
                      {ASSIGNMENT_MODE_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  {errors.assignmentMode && (
                    <p className="text-xs font-medium text-(--color-red-main)">
                      {errors.assignmentMode}
                    </p>
                  )}
                </div>
              )}

              {(values.assignmentMode === "single" || !modeEnabled) && (
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-(--color-text-main)">
                    Tótem
                  </label>
                  <div className="relative">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-(--color-text-secondary)" />
                    <input
                      type="search"
                      value={totemSearchTerm}
                      onChange={(event) => setTotemSearchTerm(event.target.value)}
                      placeholder="Buscar tótem por nombre o código"
                      className="w-full rounded-2xl border border-(--color-border) bg-white py-2 pl-9 pr-3 text-xs text-(--color-text-main) outline-none transition focus:border-(--color-red-main) focus:ring-2 focus:ring-(--color-red-main)/20"
                    />
                  </div>
                  <div
                    role="listbox"
                    aria-label="Tótems disponibles"
                    className={`rounded-2xl border bg-white p-2 ${errors.totemId
                      ? "border-(--color-red-main)"
                      : "border-(--color-border)"
                      }`}
                  >
                    {renderOptionSections({
                      selectedItems: singleTotemOptions.selectedItems,
                      resultItems: singleTotemOptions.resultItems,
                      emptyLabel: "No se encontraron tótems para la búsqueda actual.",
                      isLoading: totemCatalog.isLoading,
                      isLoadingMore: totemCatalog.isLoadingMore,
                      hasMore: totemCatalog.hasMore,
                      errorMessage: totemCatalog.errorMessage,
                      onResultsScroll: totemCatalog.handleResultsScroll,
                      renderItem: (totem, isSelected) =>
                        renderTotemOption(
                          totem,
                          isSelected,
                          () => setSingleTotemId(totem.id),
                        ),
                    })}
                  </div>
                  {selectedSingleTotem ? (
                    <div className="min-w-0 text-xs text-(--color-text-secondary)">
                      <span>Seleccionado:</span>
                      <SafeText
                        as="p"
                        value={`${selectedSingleTotem.code} - ${selectedSingleTotem.name}`}
                        className="font-medium text-(--color-text-main)"
                      />
                    </div>
                  ) : (
                    <p className="text-xs text-(--color-text-secondary)">
                      Selecciona un tótem de la lista.
                    </p>
                  )}
                  {errors.totemId && (
                    <p className="text-xs font-medium text-(--color-red-main)">
                      {errors.totemId}
                    </p>
                  )}
                </div>
              )}

              {values.assignmentMode === "multiple" && modeEnabled && (
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-(--color-text-main)">
                    Tótems
                  </label>
                  <div className="relative">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-(--color-text-secondary)" />
                    <input
                      type="search"
                      value={totemSearchTerm}
                      onChange={(event) => setTotemSearchTerm(event.target.value)}
                      placeholder="Buscar tótems por nombre o código"
                      className="w-full rounded-2xl border border-(--color-border) bg-white py-2 pl-9 pr-3 text-xs text-(--color-text-main) outline-none transition focus:border-(--color-red-main) focus:ring-2 focus:ring-(--color-red-main)/20"
                    />
                  </div>
                  <div
                    role="listbox"
                    aria-label="Tótems disponibles"
                    aria-multiselectable="true"
                    className={`rounded-2xl border bg-white p-2 ${errors.totemIds
                      ? "border-(--color-red-main)"
                      : "border-(--color-border)"
                      }`}
                  >
                    {renderOptionSections({
                      selectedItems: multipleTotemOptions.selectedItems,
                      resultItems: multipleTotemOptions.resultItems,
                      emptyLabel: "No se encontraron tótems para la búsqueda actual.",
                      isLoading: totemCatalog.isLoading,
                      isLoadingMore: totemCatalog.isLoadingMore,
                      hasMore: totemCatalog.hasMore,
                      errorMessage: totemCatalog.errorMessage,
                      onResultsScroll: totemCatalog.handleResultsScroll,
                      renderItem: (totem, isSelected) =>
                        renderTotemOption(
                          totem,
                          isSelected,
                          () => toggleMultipleTotemId(totem.id),
                        ),
                    })}
                  </div>
                  {selectedMultipleTotemIds.size > 0 ? (
                    <p className="text-xs text-(--color-text-secondary)">
                      Seleccionados:{" "}
                      <span className="font-medium text-(--color-text-main)">
                        {selectedMultipleTotemIds.size}
                      </span>
                    </p>
                  ) : (
                    <p className="text-xs text-(--color-text-secondary)">
                      Selecciona uno o varios tótems de la lista.
                    </p>
                  )}
                  {errors.totemIds && (
                    <p className="text-xs font-medium text-(--color-red-main)">
                      {errors.totemIds}
                    </p>
                  )}
                </div>
              )}

              {values.assignmentMode === "all" && modeEnabled && (
                <div className="rounded-2xl border border-(--color-border) bg-[#f8f9fb] p-2.5 text-xs text-(--color-text-secondary)">
                  Esta asignación se aplicará a todos los tótems activos.
                </div>
              )}
            </section>

            <section className="space-y-4 rounded-2xl border border-(--color-border) bg-white p-4 sm:p-5">
              <header>
                <h3 className="text-sm font-semibold tracking-[0.08em] text-(--color-text-secondary)">
                  Selección de Contenidos
                </h3>
              </header>

              {modeEnabled && (
                <div className="space-y-2">
                  <label
                    htmlFor="contentAssignmentMode"
                    className="text-sm font-semibold text-(--color-text-main)"
                  >
                    Modo de contenido
                  </label>
                  <div className="relative">
                    <Newspaper className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-(--color-text-secondary)" />
                    <select
                      id="contentAssignmentMode"
                      name="contentAssignmentMode"
                      value={values.contentAssignmentMode}
                      onChange={handleChange}
                      className={`w-full rounded-2xl border bg-white py-2 pl-11 pr-4 text-xs text-(--color-text-main) outline-none transition focus:ring-2 ${errors.contentAssignmentMode
                        ? "border-(--color-red-main) focus:border-(--color-red-main) focus:ring-(--color-red-main)/20"
                        : "border-(--color-border) focus:border-(--color-red-main) focus:ring-(--color-red-main)/20"
                        }`}
                    >
                      {CONTENT_ASSIGNMENT_MODE_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  {errors.contentAssignmentMode && (
                    <p className="text-xs font-medium text-(--color-red-main)">
                      {errors.contentAssignmentMode}
                    </p>
                  )}
                </div>
              )}

              {(values.contentAssignmentMode === "single" || !modeEnabled) && (
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-(--color-text-main)">
                    Contenido
                  </label>
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    <div className="relative">
                      <Search className="pointer-events-none absolute left-3 top-4 h-4 w-4 -translate-y-1/2 text-(--color-text-secondary)" />
                      <input
                        type="search"
                        value={contentSearchTerm}
                        onChange={(event) => setContentSearchTerm(event.target.value)}
                        placeholder="Buscar contenido por nombre"
                        className="w-full rounded-2xl border border-(--color-border) bg-white py-2 pl-9 pr-3 text-xs text-(--color-text-main) outline-none transition focus:border-(--color-red-main) focus:ring-2 focus:ring-(--color-red-main)/20"
                      />
                    </div>
                    <div className="relative">
                      <Tags className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-(--color-text-secondary)" />
                      <select
                        value={contentTypeFilter}
                        onChange={(event) =>
                          setContentTypeFilter(
                            event.target.value as Content["contentType"] | "",
                          )
                        }
                        className="w-full rounded-2xl border border-(--color-border) bg-white py-2 pl-9 pr-3 text-xs text-(--color-text-main) outline-none transition focus:border-(--color-red-main) focus:ring-2 focus:ring-(--color-red-main)/20"
                      >
                        <option value="">Todos los tipos</option>
                        {CONTENT_TYPE_OPTIONS.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div
                    role="listbox"
                    aria-label="Contenidos disponibles"
                    className={`rounded-2xl border bg-white p-2 ${errors.contentId
                      ? "border-(--color-red-main)"
                      : "border-(--color-border)"
                      }`}
                  >
                    {renderOptionSections({
                      selectedItems: singleContentOptions.selectedItems,
                      resultItems: singleContentOptions.resultItems,
                      emptyLabel: "No se encontraron contenidos para la búsqueda actual.",
                      isLoading: contentCatalog.isLoading,
                      isLoadingMore: contentCatalog.isLoadingMore,
                      hasMore: contentCatalog.hasMore,
                      errorMessage: contentCatalog.errorMessage,
                      onResultsScroll: contentCatalog.handleResultsScroll,
                      renderItem: (content, isSelected) =>
                        renderContentOption(
                          content,
                          isSelected,
                          () => setSingleContentId(content.id),
                        ),
                    })}
                  </div>
                  {selectedSingleContent ? (
                    <div className="min-w-0 text-xs text-(--color-text-secondary)">
                      <span>Seleccionado:</span>
                      <SafeText
                        as="p"
                        value={selectedSingleContent.title}
                        className="font-medium text-(--color-text-main)"
                      />
                    </div>
                  ) : (
                    <p className="text-xs text-(--color-text-secondary)">
                      Selecciona un contenido de la lista.
                    </p>
                  )}
                  {errors.contentId && (
                    <p className="text-xs font-medium text-(--color-red-main)">
                      {errors.contentId}
                    </p>
                  )}
                </div>
              )}

              {values.contentAssignmentMode === "multiple" && modeEnabled && (
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-(--color-text-main)">
                    Contenidos
                  </label>
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    <div className="relative">
                      <Search className="pointer-events-none absolute left-3 top-4 h-4 w-4 -translate-y-1/2 text-(--color-text-secondary)" />
                      <input
                        type="search"
                        value={contentSearchTerm}
                        onChange={(event) => setContentSearchTerm(event.target.value)}
                        placeholder="Buscar contenidos por nombre"
                        className="w-full rounded-2xl border border-(--color-border) bg-white py-2 pl-9 pr-3 text-xs text-(--color-text-main) outline-none transition focus:border-(--color-red-main) focus:ring-2 focus:ring-(--color-red-main)/20"
                      />
                    </div>
                    <div className="relative">
                      <Tags className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-(--color-text-secondary)" />
                      <select
                        value={contentTypeFilter}
                        onChange={(event) =>
                          setContentTypeFilter(
                            event.target.value as Content["contentType"] | "",
                          )
                        }
                        className="w-full rounded-2xl border border-(--color-border) bg-white py-2 pl-9 pr-3 text-xs text-(--color-text-main) outline-none transition focus:border-(--color-red-main) focus:ring-2 focus:ring-(--color-red-main)/20"
                      >
                        <option value="">Todos los tipos</option>
                        {CONTENT_TYPE_OPTIONS.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div
                    role="listbox"
                    aria-label="Contenidos disponibles"
                    aria-multiselectable="true"
                    className={`rounded-2xl border bg-white p-2 ${errors.contentIds
                      ? "border-(--color-red-main)"
                      : "border-(--color-border)"
                      }`}
                  >
                    {renderOptionSections({
                      selectedItems: multipleContentOptions.selectedItems,
                      resultItems: multipleContentOptions.resultItems,
                      emptyLabel: "No se encontraron contenidos para la búsqueda actual.",
                      isLoading: contentCatalog.isLoading,
                      isLoadingMore: contentCatalog.isLoadingMore,
                      hasMore: contentCatalog.hasMore,
                      errorMessage: contentCatalog.errorMessage,
                      onResultsScroll: contentCatalog.handleResultsScroll,
                      renderItem: (content, isSelected) =>
                        renderContentOption(
                          content,
                          isSelected,
                          () => toggleMultipleContentId(content.id),
                        ),
                    })}
                  </div>
                  {selectedMultipleContentIds.size > 0 ? (
                    <p className="text-xs text-(--color-text-secondary)">
                      Seleccionados:{" "}
                      <span className="font-medium text-(--color-text-main)">
                        {selectedMultipleContentIds.size}
                      </span>
                    </p>
                  ) : (
                    <p className="text-xs text-(--color-text-secondary)">
                      Selecciona uno o varios contenidos de la lista.
                    </p>
                  )}
                  {errors.contentIds && (
                    <p className="text-xs font-medium text-(--color-red-main)">
                      {errors.contentIds}
                    </p>
                  )}
                </div>
              )}
            </section>

            <section className="space-y-4 rounded-2xl border border-(--color-border) bg-white p-4 sm:p-5">
              <header>
                <h3 className="text-sm font-semibold tracking-[0.08em] text-(--color-text-secondary)">
                  Configuración de Asignación
                </h3>
              </header>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                <div className="space-y-2">
                  <label
                    htmlFor="status"
                    className="text-sm font-semibold text-(--color-text-main)"
                  >
                    Estado
                  </label>
                  <div className="relative">
                    <CirclePower className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-(--color-text-secondary)" />
                    <select
                      id="status"
                      name="status"
                      value={values.status}
                      onChange={handleChange}
                      className={`w-full rounded-2xl border bg-white py-2 pl-11 pr-4 text-xs text-(--color-text-main) outline-none transition focus:ring-2 ${errors.status
                        ? "border-(--color-red-main) focus:border-(--color-red-main) focus:ring-(--color-red-main)/20"
                        : "border-(--color-border) focus:border-(--color-red-main) focus:ring-(--color-red-main)/20"
                        }`}
                    >
                      {TOTEM_CONTENT_STATUS_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  {errors.status && (
                    <p className="text-xs font-medium text-(--color-red-main)">
                      {errors.status}
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <label
                    htmlFor="priority"
                    className="text-sm font-semibold text-(--color-text-main)"
                  >
                    Prioridad
                  </label>
                  <div className="relative">
                    <Layers className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-(--color-text-secondary)" />
                    <input
                      id="priority"
                      name="priority"
                      type="number"
                      min={1}
                      value={values.priority}
                      onChange={handleChange}
                      className={`w-full rounded-2xl border bg-white py-2 pl-11 pr-4 text-xs text-(--color-text-main) outline-none transition focus:ring-2 ${errors.priority
                        ? "border-(--color-red-main) focus:border-(--color-red-main) focus:ring-(--color-red-main)/20"
                        : "border-(--color-border) focus:border-(--color-red-main) focus:ring-(--color-red-main)/20"
                        }`}
                    />
                  </div>
                  {errors.priority && (
                    <p className="text-xs font-medium text-(--color-red-main)">
                      {errors.priority}
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <label
                    htmlFor="sortOrder"
                    className="text-sm font-semibold text-(--color-text-main)"
                  >
                    Orden
                  </label>
                  <div className="relative">
                    <ListOrdered className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-(--color-text-secondary)" />
                    <input
                      id="sortOrder"
                      name="sortOrder"
                      type="number"
                      min={1}
                      value={values.sortOrder}
                      onChange={handleChange}
                      disabled={modeEnabled}
                      className={`w-full rounded-2xl border bg-white py-2 pl-11 pr-4 text-xs text-(--color-text-main) outline-none transition focus:ring-2 ${errors.sortOrder
                        ? "border-(--color-red-main) focus:border-(--color-red-main) focus:ring-(--color-red-main)/20"
                        : "border-(--color-border) focus:border-(--color-red-main) focus:ring-(--color-red-main)/20"
                        } ${modeEnabled ? "cursor-not-allowed bg-[#f4f5f7] text-(--color-text-secondary)" : ""}`}
                    />
                  </div>
                  {modeEnabled && (
                    <p className="text-xs text-(--color-text-secondary)">
                      En nuevas asignaciones, el orden se genera automáticamente por tótem y tipo de contenido.
                    </p>
                  )}
                  {errors.sortOrder && (
                    <p className="text-xs font-medium text-(--color-red-main)">
                      {errors.sortOrder}
                    </p>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <label
                    htmlFor="startAt"
                    className="text-sm font-semibold text-(--color-text-main)"
                  >
                    Inicio
                  </label>
                  <div className="relative">
                    <CalendarDays className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-(--color-text-secondary)" />
                    <input
                      id="startAt"
                      name="startAt"
                      type="datetime-local"
                      min={allowPastStartAtInput ? undefined : minDateTimeLocal}
                      value={values.startAt}
                      onChange={handleChange}
                      className={`w-full rounded-2xl border bg-white py-2 pl-11 pr-4 text-xs text-(--color-text-main) outline-none transition focus:ring-2 ${errors.startAt
                        ? "border-(--color-red-main) focus:border-(--color-red-main) focus:ring-(--color-red-main)/20"
                        : "border-(--color-border) focus:border-(--color-red-main) focus:ring-(--color-red-main)/20"
                        }`}
                    />
                  </div>
                  {errors.startAt && (
                    <p className="text-xs font-medium text-(--color-red-main)">
                      {errors.startAt}
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <label
                    htmlFor="endAt"
                    className="text-sm font-semibold text-(--color-text-main)"
                  >
                    Fin
                  </label>
                  <div className="relative">
                    <CalendarDays className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-(--color-text-secondary)" />
                    <input
                      id="endAt"
                      name="endAt"
                      type="datetime-local"
                      min={minEndAt}
                      value={values.endAt}
                      onChange={handleChange}
                      className={`w-full rounded-2xl border bg-white py-2 pl-11 pr-4 text-xs text-(--color-text-main) outline-none transition focus:ring-2 ${errors.endAt
                        ? "border-(--color-red-main) focus:border-(--color-red-main) focus:ring-(--color-red-main)/20"
                        : "border-(--color-border) focus:border-(--color-red-main) focus:ring-(--color-red-main)/20"
                        }`}
                    />
                  </div>
                  {errors.endAt && (
                    <p className="text-xs font-medium text-(--color-red-main)">
                      {errors.endAt}
                    </p>
                  )}
                </div>
              </div>
            </section>
          </div>

          <aside className="self-start xl:sticky xl:top-20">
            <section className="space-y-4 rounded-2xl border border-(--color-border) bg-white p-4 sm:p-5">
              <header className="space-y-1">
                <h3 className="text-sm font-semibold tracking-[0.08em] text-(--color-text-secondary)">
                  Previsualización de Contenidos
                </h3>
                <p className="text-xs text-(--color-text-secondary)">
                  {selectedContentCountText(selectedContents.length)} • {selectedTotemCount} totems
                </p>
              </header>

              {selectedContents.length > 0 ? (
                <div className="space-y-3 xl:max-h-[calc(100vh-18rem)] xl:overflow-y-auto xl:pr-1">
                  {selectedContents.map((content) => {
                    const sourceUrl = resolveAssetUrl(content.fileUrl);
                    const previewKind = inferPreviewKindFromContent(
                      content.contentType,
                      content.fileUrl,
                    );
                    const missingPreviewCopy = resolveMissingPreviewCopy(
                      content.contentType,
                      content.fileUrl,
                    );

                    return (
                      <article
                        key={content.id}
                        className="overflow-hidden rounded-2xl border border-(--color-border) bg-[#fcfcfd]"
                      >
                        <div className="border-b border-(--color-border) bg-[#1b1e39]">
                          <div className="aspect-16/10 w-full">
                            <ContentPreviewMedia
                              kind={previewKind}
                              sourceUrl={sourceUrl}
                              title={`Vista previa de ${content.title}`}
                              imageClassName="h-full w-full bg-[#f8f9fb] object-contain p-2.5"
                              videoClassName="h-full w-full bg-[#f8f9fb] object-contain"
                              pdfClassName="h-full w-full bg-[#f8f9fb]"
                              fallbackClassName="h-full"
                              placeholderTone="dark"
                              unknownTitle={getContentTypeLabel(content.contentType)}
                              unknownMessage={content.description || "Sin vista previa disponible"}
                              missingTitle={missingPreviewCopy.title}
                              missingMessage={missingPreviewCopy.message}
                            />
                          </div>
                        </div>

                        <div className="space-y-2 px-4 py-3">
                          <div className="flex min-w-0 items-start justify-between gap-3">
                            <p
                              className="min-w-0 truncate text-xs font-semibold text-(--color-text-main)"
                              title={content.title}
                            >
                              {content.title}
                            </p>
                            <button
                              type="button"
                              onClick={() => removeSelectedContent(content.id)}
                              className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-(--color-text-secondary) transition hover:bg-[#fdebef] hover:text-(--color-red-main)"
                              title="Quitar contenido"
                              aria-label={`Quitar ${content.title}`}
                            >
                              <X className="h-4 w-4" />
                            </button>
                          </div>
                          <div className="flex items-center justify-between gap-3">
                            <div className="inline-flex items-center rounded-full border border-(--color-border) bg-[#f5f6f8] px-3 py-1 text-xs font-medium text-(--color-text-secondary)">
                              {getContentTypeLabel(content.contentType)}
                            </div>

                            <FileActionButton
                              fileUrl={content.fileUrl}
                              label="Ver archivo"
                              className="inline-flex items-center gap-1 text-xs font-semibold text-(--color-red-main) hover:underline"
                              disabledClassName="inline-flex items-center gap-1 text-xs font-semibold text-(--color-text-secondary) disabled:cursor-not-allowed"
                              icon={<Link2 className="h-4 w-4" />}
                            />
                          </div>
                        </div>
                      </article>
                    );
                  })}
                </div>
              ) : (
                <div className="rounded-2xl border border-dashed border-(--color-border) bg-[#fcfcfd] px-4 py-6 text-center text-xs text-(--color-text-secondary)">
                  Selecciona uno o varios contenidos para ver su previsualización aquí.
                </div>
              )}
            </section>
          </aside>
        </div>

        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-end">
          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              className="inline-flex w-full items-center justify-center rounded-2xl border border-(--color-border) bg-white px-5 py-2.5 text-xs font-semibold text-(--color-text-main) transition hover:bg-[#f7f7f7] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--color-red-main) focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-70 sm:w-auto"
            >
              {cancelLabel}
            </button>
          )}

          <button
            type="submit"
            className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-(--color-red-button) px-5 py-2.5 text-xs font-semibold text-white shadow-md shadow-(--color-red-button)/30 transition hover:bg-(--color-red-dark) focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--color-red-main) focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-70 sm:w-auto sm:min-w-58"
          >
            {submitting && <LoaderCircle className="h-4 w-4 animate-spin" />}
            {submitting ? "Guardando..." : submitLabel}
          </button>
        </div>
      </fieldset>
    </form>
  );
}
