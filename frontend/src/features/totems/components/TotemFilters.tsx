import { Activity, Building2, CirclePower, Search } from "lucide-react";
import CompactFilterBar, {
  type CompactFilterChip,
} from "../../../components/CompactFilterBar";
import {
  TOTEM_CONNECTION_STATUS_OPTIONS,
  TOTEM_STATE_OPTIONS,
} from "../../../constants/totem";
import FilterAutocompleteInput, {
  type AutocompleteChangeReason,
  type FilterAutocompleteOption,
} from "../../../components/FilterAutocompleteInput";
import FilterSelectField from "../../../components/FilterSelectField";
import type { CampusOption } from "../../../types/campus";

interface TotemFiltersValues {
  search: string;
  campusId: string;
  state: string;
  connectionStatus: string;
}

interface TotemFiltersProps {
  values: TotemFiltersValues;
  campusOptions: CampusOption[];
  isSuperAdmin: boolean;
  searchOptions: FilterAutocompleteOption[];
  onFieldChange: (
    name: keyof TotemFiltersValues,
    value: string,
    mode: "debounced" | "immediate",
  ) => void;
  onClear: () => void;
}

export default function TotemFilters({
  values,
  campusOptions,
  isSuperAdmin,
  searchOptions,
  onFieldChange,
  onClear,
}: TotemFiltersProps) {
  function mapAutocompleteReasonToMode(reason: AutocompleteChangeReason) {
    return reason === "input" ? "debounced" : "immediate";
  }

  function getOptionLabel(
    options: Array<{ value: string; label: string }>,
    value: string,
  ) {
    return options.find((option) => option.value === value)?.label ?? value;
  }

  const activeChips: CompactFilterChip[] = [];

  if (values.search.trim()) {
    activeChips.push({
      key: "search",
      label: "Búsqueda",
      valueLabel: values.search.trim(),
      onRemove: () => onFieldChange("search", "", "immediate"),
    });
  }

  if (isSuperAdmin && values.campusId) {
    const selectedCampus = campusOptions.find(
      (campus) => String(campus.id) === values.campusId,
    );
    activeChips.push({
      key: "campusId",
      label: "Campus",
      valueLabel: selectedCampus?.name ?? values.campusId,
      onRemove: () => onFieldChange("campusId", "", "immediate"),
    });
  }

  if (values.state) {
    activeChips.push({
      key: "state",
      label: "Estado",
      valueLabel: getOptionLabel(TOTEM_STATE_OPTIONS, values.state),
      onRemove: () => onFieldChange("state", "", "immediate"),
    });
  }

  if (values.connectionStatus) {
    activeChips.push({
      key: "connectionStatus",
      label: "Conexión",
      valueLabel: getOptionLabel(TOTEM_CONNECTION_STATUS_OPTIONS, values.connectionStatus),
      onRemove: () => onFieldChange("connectionStatus", "", "immediate"),
    });
  }

  return (
    <CompactFilterBar
      panelTitle="Filtros de tótems"
      activeChips={activeChips}
      onClearAll={onClear}
      searchControls={
        <div className="w-full">
          <FilterAutocompleteInput
            id="search"
            label="Buscar por nombre o código"
            value={values.search}
            icon={Search}
            hideLabel
            placeholder="Buscar por nombre o código"
            options={searchOptions}
            onValueChange={(nextValue, reason) =>
              onFieldChange("search", nextValue, mapAutocompleteReasonToMode(reason))
            }
          />
        </div>
      }
      secondaryControls={
        <div className="flex flex-col">
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
              onChange={(nextValue) => onFieldChange("campusId", nextValue, "immediate")}
            />
          ) : null}

          <FilterSelectField
            id="state"
            label="Estado"
            icon={CirclePower}
            value={values.state}
            options={TOTEM_STATE_OPTIONS}
            onChange={(nextValue) => onFieldChange("state", nextValue, "immediate")}
          />

          <FilterSelectField
            id="connectionStatus"
            label="Conexión"
            icon={Activity}
            value={values.connectionStatus}
            options={TOTEM_CONNECTION_STATUS_OPTIONS}
            emptyOptionLabel="Todas"
            onChange={(nextValue) =>
              onFieldChange("connectionStatus", nextValue, "immediate")
            }
          />
        </div>
      }
    />
  );
}
