import {
  Building2,
  CirclePower,
  Search,
  Send,
  Tags,
} from "lucide-react";
import CompactFilterBar, {
  type CompactFilterChip,
} from "../../../components/CompactFilterBar";
import FilterAutocompleteInput, {
  type AutocompleteChangeReason,
  type FilterAutocompleteOption,
} from "../../../components/FilterAutocompleteInput";
import FilterSelectField from "../../../components/FilterSelectField";
import {
  NOTIFICATION_SCOPE_FILTER_OPTIONS,
  NOTIFICATION_STATUS_OPTIONS,
  NOTIFICATION_TYPE_OPTIONS,
} from "../../../constants/notification";
import type {
  NotificationCampusOption,
  NotificationScope,
  NotificationStatus,
  NotificationType,
} from "../../../types/notification";

type NotificationFilterValues = {
  search: string;
  type: NotificationType | "";
  scope: NotificationScope | "";
  campusId: number | "";
  status: NotificationStatus;
};

interface NotificationFiltersProps {
  values: NotificationFilterValues;
  campusOptions: NotificationCampusOption[];
  isSuperAdmin: boolean;
  searchOptions: FilterAutocompleteOption[];
  onFieldChange: (
    name: keyof NotificationFilterValues,
    value: string,
    mode: "debounced" | "immediate",
  ) => void;
  onClear: () => void;
}

export default function NotificationFilters({
  values,
  campusOptions,
  isSuperAdmin,
  searchOptions,
  onFieldChange,
  onClear,
}: NotificationFiltersProps) {
  function mapAutocompleteReasonToMode(reason: AutocompleteChangeReason) {
    return reason === "input" ? "debounced" : "immediate";
  }

  function getOptionLabel(
    options: Array<{ value: string; label: string }>,
    value: string,
  ) {
    return options.find((option) => option.value === value)?.label ?? value;
  }

  const scopeOptions = isSuperAdmin
    ? NOTIFICATION_SCOPE_FILTER_OPTIONS
    : [
      { value: "campus", label: "Todos los tótems de mi campus" },
      { value: "totems", label: "Tótems específicos de mi campus" },
    ];

  const activeChips: CompactFilterChip[] = [];

  if (values.search.trim()) {
    activeChips.push({
      key: "search",
      label: "Búsqueda",
      valueLabel: values.search.trim(),
      onRemove: () => onFieldChange("search", "", "immediate"),
    });
  }

  if (values.type) {
    activeChips.push({
      key: "type",
      label: "Tipo",
      valueLabel: getOptionLabel(NOTIFICATION_TYPE_OPTIONS, values.type),
      onRemove: () => onFieldChange("type", "", "immediate"),
    });
  }

  if (values.scope) {
    activeChips.push({
      key: "scope",
      label: "Destino",
      valueLabel: getOptionLabel(scopeOptions, values.scope),
      onRemove: () => onFieldChange("scope", "", "immediate"),
    });
  }

  if (isSuperAdmin && values.scope === "campus" && values.campusId !== "") {
    const selectedCampus = campusOptions.find(
      (campus) => campus.id === Number(values.campusId),
    );
    activeChips.push({
      key: "campusId",
      label: "Campus",
      valueLabel: selectedCampus?.name ?? String(values.campusId),
      onRemove: () => onFieldChange("campusId", "", "immediate"),
    });
  }

  if (values.status !== "all") {
    activeChips.push({
      key: "status",
      label: "Estado",
      valueLabel: getOptionLabel(NOTIFICATION_STATUS_OPTIONS, values.status),
      onRemove: () => onFieldChange("status", "all", "immediate"),
    });
  }

  return (
    <CompactFilterBar
      panelTitle="Filtros de notificaciones"
      activeChips={activeChips}
      onClearAll={onClear}
      searchControls={
        <div className="w-full">
          <FilterAutocompleteInput
            id="search"
            label="Buscar por título"
            value={values.search}
            icon={Search}
            hideLabel
            placeholder="Buscar por título"
            options={searchOptions}
            onValueChange={(nextValue, reason) =>
              onFieldChange("search", nextValue, mapAutocompleteReasonToMode(reason))
            }
          />
        </div>
      }
      secondaryControls={
        <div className="flex flex-col">
          <FilterSelectField
            id="type"
            label="Tipo"
            icon={Tags}
            value={values.type}
            options={NOTIFICATION_TYPE_OPTIONS}
            onChange={(nextValue) => onFieldChange("type", nextValue, "immediate")}
          />

          <FilterSelectField
            id="scope"
            label="Destino"
            icon={Send}
            value={values.scope}
            options={scopeOptions}
            onChange={(nextValue) => onFieldChange("scope", nextValue, "immediate")}
          />

          {isSuperAdmin ? (
            <FilterSelectField
              id="campusId"
              label="Campus"
              icon={Building2}
              value={values.campusId}
              options={campusOptions.map((campus) => ({
                value: campus.id,
                label: campus.name,
              }))}
              disabled={values.scope !== "campus"}
              onChange={(nextValue) => onFieldChange("campusId", nextValue, "immediate")}
            />
          ) : null}

          <FilterSelectField
            id="status"
            label="Estado"
            icon={CirclePower}
            value={values.status}
            options={NOTIFICATION_STATUS_OPTIONS}
            showEmptyOption={false}
            onChange={(nextValue) => onFieldChange("status", nextValue, "immediate")}
          />
        </div>
      }
    />
  );
}
