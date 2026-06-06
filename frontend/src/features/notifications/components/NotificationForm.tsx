import {
  Building2,
  CalendarDays,
  CirclePower,
  Clock3,
  Search,
  Globe2,
  LoaderCircle,
  MessageSquareText,
  MonitorSmartphone,
  Send,
  Tags,
  Type,
  University,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  NOTIFICATION_DELIVERY_MODE_OPTIONS,
  NOTIFICATION_DURATION_UNIT_OPTIONS,
  NOTIFICATION_FORM_TOTEM_PAGE_SIZE,
  NOTIFICATION_FORM_TOTEM_SEARCH_DEBOUNCE_MS,
  NOTIFICATION_MESSAGE_MAX_LENGTH,
  NOTIFICATION_RECORD_STATUS_OPTIONS,
  NOTIFICATION_TITLE_MAX_LENGTH,
  NOTIFICATION_TYPE_OPTIONS,
  EMPTY_NOTIFICATION_FORM,
} from "../../../constants/notification";
import { ASSIGNMENT_CATALOG_SEARCH_MIN_CHARS } from "../../../constants/search";
import type {
  NotificationCampusOption,
  NotificationFormErrors,
  NotificationFormValues,
  NotificationTotemOption,
} from "../../../types/notification";
import {
  useModalErrorScrollToField,
  useModalErrorScrollToTop,
} from "../../../hooks/useModalErrorScrollToTop";
import { useDebouncedValue } from "../../../hooks/useDebouncedValue";
import { normalizeSearchInputForQuery } from "../../../utils/textSearch";
import { useNotificationForm } from "../hooks/useNotificationForm";
import { useInfiniteCatalogOptions } from "../../totemContents/hooks/useInfiniteCatalogOptions";
import { notificationService } from "../services/notification.service";

interface NotificationFormProps {
  initialValues?: NotificationFormValues;
  mode?: "create" | "edit";
  submitLabel: string;
  submitting?: boolean;
  remainingTimeLabel?: string;
  isSuperAdmin: boolean;
  lockedCampusId?: number | null;
  lockedCampusName?: string | null;
  campusOptions: NotificationCampusOption[];
  totemOptions: NotificationTotemOption[];
  serverErrors?: NotificationFormErrors;
  onSubmit: (values: NotificationFormValues) => Promise<void>;
}

function baseControlClass(hasError = false) {
  return `w-full rounded-2xl border bg-white py-2 pl-11 pr-4 text-xs text-(--color-text-main) outline-none transition focus:ring-2 ${hasError
    ? "border-(--color-red-main) focus:border-(--color-red-main) focus:ring-(--color-red-main)/20"
    : "border-(--color-border) focus:border-(--color-red-main) focus:ring-(--color-red-main)/20"
    }`;
}

function getScopeIcon(scope: string) {
  if (scope === "all") return <Globe2 className="h-4 w-4 text-(--color-text-secondary)" />;
  return <MonitorSmartphone className="h-4 w-4 text-(--color-text-secondary)" />;
}

function toDateTimeLocalMinValue(date = new Date()) {
  const localDate = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return localDate.toISOString().slice(0, 16);
}

function resolveSelectedTotemsByIds(
  ids: number[],
  optionById: Map<number, NotificationTotemOption>,
) {
  const selectedItems: NotificationTotemOption[] = [];
  const seenIds = new Set<number>();

  for (const id of ids) {
    const parsedId = Number(id);

    if (!Number.isInteger(parsedId) || parsedId <= 0 || seenIds.has(parsedId)) {
      continue;
    }

    const totem = optionById.get(parsedId);

    if (!totem) {
      continue;
    }

    seenIds.add(parsedId);
    selectedItems.push(totem);
  }

  return selectedItems;
}

export default function NotificationForm({
  initialValues = EMPTY_NOTIFICATION_FORM,
  mode = "create",
  submitLabel,
  submitting = false,
  remainingTimeLabel,
  isSuperAdmin,
  lockedCampusId = null,
  lockedCampusName = null,
  campusOptions,
  totemOptions,
  serverErrors,
  onSubmit,
}: NotificationFormProps) {
  const formRef = useRef<HTMLFormElement | null>(null);
  const {
    values,
    errors,
    submitAttempts,
    handleChange,
    handleTotemToggle,
    setTargetTotemIds,
    handleSubmit,
    setFieldErrors,
  } =
    useNotificationForm(initialValues, onSubmit, {
      mode,
      initialStartAt: initialValues.startAt,
    });
  const minDateTimeLocal = toDateTimeLocalMinValue();
  const initialStartAtDate = initialValues.startAt
    ? new Date(initialValues.startAt)
    : null;
  const allowPastStartAtInput =
    mode === "edit" &&
    initialStartAtDate !== null &&
    !Number.isNaN(initialStartAtDate.getTime()) &&
    initialStartAtDate < new Date();
  const resolvedLockedCampusId =
    typeof lockedCampusId === "number" && Number.isInteger(lockedCampusId) && lockedCampusId > 0
      ? lockedCampusId
      : null;
  const selectedCampusId = useMemo(() => {
    if (!isSuperAdmin) {
      return resolvedLockedCampusId;
    }

    return values.targetCampusId === "" ? null : Number(values.targetCampusId);
  }, [isSuperAdmin, resolvedLockedCampusId, values.targetCampusId]);
  const [totemSearchTerm, setTotemSearchTerm] = useState("");
  const debouncedTotemSearchTerm = useDebouncedValue(
    totemSearchTerm.trim(),
    NOTIFICATION_FORM_TOTEM_SEARCH_DEBOUNCE_MS,
  );
  const normalizedTotemCatalogSearchTerm = useMemo(
    () =>
      normalizeSearchInputForQuery(
        debouncedTotemSearchTerm,
        ASSIGNMENT_CATALOG_SEARCH_MIN_CHARS,
      ),
    [debouncedTotemSearchTerm],
  );
  const fetchTotemCatalogPage = useCallback(
    (
      page: number,
      limit: number,
      options?: { signal?: AbortSignal },
    ) =>
      notificationService.getActiveTotemOptionsPage(
        {
          page,
          limit,
          search: normalizedTotemCatalogSearchTerm,
          campusId: selectedCampusId,
        },
        {
          signal: options?.signal,
        },
      ),
    [normalizedTotemCatalogSearchTerm, selectedCampusId],
  );
  const totemCatalog = useInfiniteCatalogOptions<NotificationTotemOption>({
    initialItems: totemOptions,
    pageSize: NOTIFICATION_FORM_TOTEM_PAGE_SIZE,
    queryKey: `${selectedCampusId ?? "all"}:${normalizedTotemCatalogSearchTerm ?? ""}`,
    enabled: values.targetScope === "totems",
    fetchPage: fetchTotemCatalogPage,
  });
  const selectedTotemIdSet = useMemo(
    () =>
      new Set(
        values.targetTotemIds.filter(
          (totemId) => Number.isInteger(totemId) && totemId > 0,
        ),
      ),
    [values.targetTotemIds],
  );
  const selectedTotemOptions = useMemo(
    () => resolveSelectedTotemsByIds(values.targetTotemIds, totemCatalog.knownItemById),
    [totemCatalog.knownItemById, values.targetTotemIds],
  );
  const resultTotemOptions = useMemo(
    () =>
      totemCatalog.resultItems.filter(
        (totem) => !selectedTotemIdSet.has(totem.id),
      ),
    [selectedTotemIdSet, totemCatalog.resultItems],
  );
  const deliveryModeOptions = useMemo(() => {
    if (isSuperAdmin) {
      return NOTIFICATION_DELIVERY_MODE_OPTIONS;
    }

    return [
      { value: "all", label: "Todos los tótems de mi campus" },
      { value: "totems", label: "Tótems específicos de mi campus" },
    ] as const;
  }, [isSuperAdmin]);
  const hasPrimaryTopErrors = Boolean(errors.title || errors.message);
  const hasStartAtError = Boolean(errors.startAt);

  useModalErrorScrollToTop(
    formRef,
    submitAttempts,
    hasPrimaryTopErrors,
  );

  useModalErrorScrollToField(
    formRef,
    submitAttempts,
    hasStartAtError && !hasPrimaryTopErrors,
    "#startAt",
    {
      focusTarget: true,
    },
  );

  useEffect(() => {
    if (!serverErrors) return;
    setFieldErrors(serverErrors);
  }, [serverErrors, setFieldErrors]);

  useEffect(() => {
    if (values.targetTotemIds.length === 0) {
      return;
    }

    const nextTotemIds = values.targetTotemIds.filter((totemId) => {
      const totemOption = totemCatalog.knownItemById.get(totemId);

      if (!totemOption) {
        return false;
      }

      if (totemOption.state !== "active") {
        return false;
      }

      if (selectedCampusId === null) {
        return true;
      }

      return Number(totemOption.campusId) === selectedCampusId;
    });

    if (nextTotemIds.length !== values.targetTotemIds.length) {
      setTargetTotemIds(nextTotemIds);
    }
  }, [
    selectedCampusId,
    setTargetTotemIds,
    totemCatalog.knownItemById,
    values.targetTotemIds,
  ]);

  function renderTotemOption(totem: NotificationTotemOption) {
    const isSelected = selectedTotemIdSet.has(totem.id);

    return (
      <label
        key={totem.id}
        className={`flex min-w-0 items-start gap-2 rounded-xl border border-(--color-border) px-3 py-2 text-xs text-(--color-text-main) ${isSelected ? "bg-[#fdebef]" : "bg-white"}`}
      >
        <input
          type="checkbox"
          checked={isSelected}
          onChange={() => handleTotemToggle(totem.id)}
          className="mt-0.5 h-4 w-4 shrink-0 border-(--color-border) text-(--color-red-main) focus:ring-(--color-red-main)"
        />
        <span className="min-w-0 flex-1">
          <span className="flex min-w-0 items-start gap-1">
            <MonitorSmartphone className="h-4 w-4 shrink-0 text-(--color-text-secondary)" />
            <strong
              className="block min-w-0 wrap-anywhere"
              title={`${totem.name} - ${totem.code}`}
            >
              {totem.name} - {totem.code}
            </strong>
          </span>
          <span className="mt-1 flex min-w-0 items-start gap-1 text-xs text-(--color-text-secondary)">
            <Building2 className="h-4 w-4 shrink-0" />
            <span className="min-w-0 wrap-anywhere">
              {totem.campusName ?? "Sin campus"}
            </span>
          </span>
        </span>
      </label>
    );
  }

  return (
    <form ref={formRef} onSubmit={handleSubmit}>
      <fieldset disabled={submitting} className="space-y-4">
        <legend className="sr-only">Formulario de notificación</legend>

        {remainingTimeLabel && (
          <div className="rounded-2xl border border-(--color-border) bg-[#f7f7f7] px-4 py-2 text-xs font-medium text-(--color-text-main)">
            <span className="inline-flex items-center gap-2">
              <Clock3 className="h-4 w-4 text-(--color-text-secondary)" />
              Tiempo restante: {remainingTimeLabel}
            </span>
          </div>
        )}

        <div className="space-y-2">
          <label htmlFor="title" className="text-sm font-semibold text-(--color-text-main)">
            Título
          </label>
          <div className="relative">
            <Type className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-(--color-text-secondary)" />
            <input
              id="title"
              name="title"
              type="text"
              maxLength={NOTIFICATION_TITLE_MAX_LENGTH}
              value={values.title}
              onChange={handleChange}
              placeholder="Ej: Mantenimiento Programado"
              className={baseControlClass(Boolean(errors.title))}
            />
          </div>
          {errors.title && (
            <p className="text-xs font-medium text-(--color-red-main)">{errors.title}</p>
          )}
        </div>

        <div className="space-y-2">
          <label htmlFor="message" className="text-sm font-semibold text-(--color-text-main)">
            Mensaje
          </label>
          <div className="relative">
            <MessageSquareText className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-(--color-text-secondary)" />
            <textarea
              id="message"
              name="message"
              value={values.message}
              onChange={handleChange}
              placeholder="Escribe tu mensaje aquí..."
              maxLength={NOTIFICATION_MESSAGE_MAX_LENGTH}
              rows={4}
              className={baseControlClass(Boolean(errors.message))}
            />
          </div>
          <p className="text-xs text-(--color-text-secondary)">
            {values.message.length}/{NOTIFICATION_MESSAGE_MAX_LENGTH}
          </p>
          {errors.message && (
            <p className="text-xs font-medium text-(--color-red-main)">{errors.message}</p>
          )}
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <label htmlFor="type" className="text-sm font-semibold text-(--color-text-main)">
              Tipo de notificación
            </label>
            <div className="relative">
              <Tags className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-(--color-text-secondary)" />
              <select
                id="type"
                name="type"
                value={values.type}
                onChange={handleChange}
                className={`${baseControlClass()}`}
              >
                {NOTIFICATION_TYPE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="space-y-2">
            <label htmlFor="status" className="text-sm font-semibold text-(--color-text-main)">
              Estado
            </label>
            <div className="relative">
              <CirclePower className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-(--color-text-secondary)" />
              <select
                id="status"
                name="status"
                value={values.status}
                onChange={handleChange}
                className={`${baseControlClass(Boolean(errors.status))}`}
              >
                {NOTIFICATION_RECORD_STATUS_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
            {errors.status && (
              <p className="text-xs font-medium text-(--color-red-main)">{errors.status}</p>
            )}
          </div>
        </div>

        <div className="space-y-2">
          <label
            htmlFor="durationValue"
            className="text-sm font-semibold text-(--color-text-main)"
          >
            Duración
          </label>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1.4fr_1fr]">
            <div className="relative">
              <Clock3 className="pointer-events-none absolute left-3 top-4 h-4 w-4 -translate-y-1/2 text-(--color-text-secondary)" />
              <input
                id="durationValue"
                name="durationValue"
                type="number"
                min={1}
                value={values.durationValue}
                onChange={handleChange}
                className={baseControlClass(Boolean(errors.durationValue))}
              />
            </div>
            <div className="relative">
              <Clock3 className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-(--color-text-secondary)" />
              <select
                id="durationUnit"
                name="durationUnit"
                value={values.durationUnit}
                onChange={handleChange}
                className={baseControlClass(Boolean(errors.durationUnit))}
              >
                {NOTIFICATION_DURATION_UNIT_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
          {(errors.durationValue || errors.durationUnit) && (
            <p className="text-xs font-medium text-(--color-red-main)">
              {errors.durationValue ?? errors.durationUnit}
            </p>
          )}
        </div>

        <div className="space-y-2">
          <label htmlFor="startAt" className="text-sm font-semibold text-(--color-text-main)">
            Inicio (opcional)
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
              className={baseControlClass(Boolean(errors.startAt))}
            />
          </div>
          {errors.startAt && (
            <p className="text-xs font-medium text-(--color-red-main)">{errors.startAt}</p>
          )}
        </div>

        <div className="space-y-3">
          <p className="inline-flex items-center gap-2 text-xs font-semibold text-(--color-text-main)">
            <Send className="h-4 w-4 text-(--color-text-secondary)" />
            Enviar a
          </p>

          {isSuperAdmin ? (
            <div className="rounded-2xl border border-(--color-border) bg-[#f9f9f9] p-4">
              <label
                htmlFor="targetCampusId"
                className="mb-2 inline-flex items-center gap-2 text-xs font-semibold text-(--color-text-main)"
              >
                <University className="h-4 w-4 text-(--color-text-secondary)" />
                Campus de destino
              </label>
              <div className="relative">
                <Building2 className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-(--color-text-secondary)" />
                <select
                  id="targetCampusId"
                  name="targetCampusId"
                  value={values.targetCampusId}
                  onChange={handleChange}
                  className={`${baseControlClass(Boolean(errors.targetCampusId))} text-sm`}
                >
                  <option value="">Todos</option>
                  {campusOptions.map((campus) => (
                    <option key={campus.id} value={campus.id}>
                      {campus.name}
                    </option>
                  ))}
                </select>
              </div>
              {errors.targetCampusId && (
                <p className="mt-2 text-xs font-medium text-(--color-red-main)">
                  {errors.targetCampusId}
                </p>
              )}
            </div>
          ) : (
            <div className="rounded-2xl border border-(--color-border) bg-[#f9f9f9] p-4">
              <label
                htmlFor="lockedTargetCampusId"
                className="mb-2 inline-flex items-center gap-2 text-xs font-semibold text-(--color-text-main)"
              >
                <University className="h-4 w-4 text-(--color-text-secondary)" />
                Campus de destino
              </label>
              <div className="relative">
                <Building2 className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-(--color-text-secondary)" />
                <input
                  id="lockedTargetCampusId"
                  type="text"
                  readOnly
                  value={lockedCampusName ?? "No disponible"}
                  className={`${baseControlClass()} bg-[#f9f9f9] text-sm`}
                />
              </div>
            </div>
          )}

          <div className="space-y-2">
            {deliveryModeOptions.map((option) => (
              <label
                key={option.value}
                className="flex items-center gap-2 text-xs text-(--color-text-main)"
              >
                <input
                  type="radio"
                  name="targetScope"
                  value={option.value}
                  checked={values.targetScope === option.value}
                  onChange={handleChange}
                  className="h-4 w-4 border-(--color-border) text-(--color-red-main) focus:ring-(--color-red-main)"
                />
                {getScopeIcon(option.value)}
                {option.label}
              </label>
            ))}
          </div>

          {values.targetScope === "totems" && (
            <div className="rounded-2xl border border-(--color-border) bg-[#f9f9f9] p-4">
              <p className="mb-2 inline-flex items-center gap-2 text-xs font-semibold text-(--color-text-main)">
                <MonitorSmartphone className="h-4 w-4 text-(--color-text-secondary)" />
                {isSuperAdmin
                  ? "Selecciona uno o varios tótems"
                  : "Selecciona uno o varios tótems de tu campus"}
              </p>

              <div className="space-y-2">
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-(--color-text-secondary)" />
                  <input
                    type="search"
                    value={totemSearchTerm}
                    onChange={(event) => setTotemSearchTerm(event.target.value)}
                    placeholder="Buscar tótem por nombre o código"
                    className="w-full rounded-2xl border border-(--color-border) bg-white py-2 pl-10 pr-3 text-xs text-(--color-text-main) outline-none transition focus:border-(--color-red-main) focus:ring-2 focus:ring-(--color-red-main)/20"
                  />
                </div>

                <div
                  role="listbox"
                  aria-label="Tótems disponibles"
                  aria-multiselectable="true"
                  className={`space-y-2 rounded-2xl border bg-white p-2 ${errors.targetTotemIds
                    ? "border-(--color-red-main)"
                    : "border-(--color-border)"
                    }`}
                >
                  {selectedTotemOptions.length > 0 && (
                    <section className="rounded-xl border border-(--color-border) bg-[#f8f9fb] p-1.5">
                      <p className="px-3 pb-1 pt-2 text-xs font-semibold tracking-[0.08em] text-(--color-text-secondary)">
                        Seleccionados
                      </p>
                      <div className="max-h-56 space-y-2 overflow-y-auto pr-0.5">
                        {selectedTotemOptions.map((totem) => renderTotemOption(totem))}
                      </div>
                    </section>
                  )}

                  <section className="rounded-xl border border-(--color-border) bg-white p-1.5">
                    <p className="px-3 pb-1 pt-2 text-xs font-semibold tracking-[0.08em] text-(--color-text-secondary)">
                      Resultados
                    </p>
                    <div
                      className="max-h-56 space-y-2 overflow-y-auto pr-0.5"
                      onScroll={totemCatalog.handleResultsScroll}
                    >
                      {resultTotemOptions.map((totem) => renderTotemOption(totem))}

                      {!totemCatalog.isLoading &&
                        !totemCatalog.errorMessage &&
                        resultTotemOptions.length === 0 && (
                          <p className="px-3 py-2 text-xs text-(--color-text-secondary)">
                            {isSuperAdmin && selectedCampusId !== null && !normalizedTotemCatalogSearchTerm
                              ? "No hay tótems activos en el campus seleccionado"
                              : normalizedTotemCatalogSearchTerm
                                ? "No se encontraron tótems para la búsqueda actual."
                                : "No hay tótems activos disponibles"}
                          </p>
                        )}

                      {totemCatalog.isLoading && (
                        <p className="inline-flex items-center gap-2 px-3 py-2 text-xs text-(--color-text-secondary)">
                          <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
                          Cargando resultados...
                        </p>
                      )}

                      {totemCatalog.errorMessage && (
                        <p className="px-3 py-2 text-xs text-(--color-red-main)">
                          {totemCatalog.errorMessage}
                        </p>
                      )}

                      {totemCatalog.isLoadingMore && (
                        <p className="inline-flex items-center gap-2 px-3 py-2 text-xs text-(--color-text-secondary)">
                          <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
                          Cargando más resultados...
                        </p>
                      )}

                      {totemCatalog.hasMore &&
                        !totemCatalog.isLoading &&
                        !totemCatalog.isLoadingMore &&
                        resultTotemOptions.length > 0 && (
                          <p className="px-3 py-2 text-xs text-(--color-text-secondary)">
                            Desliza para cargar más resultados.
                          </p>
                        )}
                    </div>
                  </section>
                </div>

                <p className="text-xs text-(--color-text-secondary)">
                  Seleccionados:{" "}
                  <span className="font-medium text-(--color-text-main)">
                    {selectedTotemIdSet.size}
                  </span>
                </p>
              </div>

              {errors.targetTotemIds && (
                <p className="mt-2 text-xs font-medium text-(--color-red-main)">
                  {errors.targetTotemIds}
                </p>
              )}
            </div>
          )}
        </div>

        <button
          type="submit"
          className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-(--color-red-button) px-5 py-2.5 text-xs font-semibold text-white shadow-md shadow-(--color-red-button)/30 transition hover:bg-(--color-red-dark) focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--color-red-main) focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-70"
        >
          {submitting && <LoaderCircle className="h-4 w-4 animate-spin" />}
          {submitting ? "Guardando..." : submitLabel}
        </button>
      </fieldset>
    </form>
  );
}
