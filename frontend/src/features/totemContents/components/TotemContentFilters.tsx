import {
  Building2,
  CirclePower,
  Search,
  Tags,
} from "lucide-react";
import { CONTENT_TYPE_OPTIONS } from "../../../constants/content";
import { TOTEM_CONTENT_FILTER_STATUS_OPTIONS } from "../../../constants/totemContent";
import CompactFilterBar, {
  type CompactFilterChip,
} from "../../../components/CompactFilterBar";
import FilterAutocompleteInput, {
  type AutocompleteChangeReason,
  type FilterAutocompleteOption,
} from "../../../components/FilterAutocompleteInput";
import FilterSelectField from "../../../components/FilterSelectField";
import type { CampusOption } from "../../../types/campus";

interface TotemContentFiltersValues {
  totemSearch: string;
  contentSearch: string;
  contentType: string;
  status: string;
  campusId: string;
}

interface TotemContentFiltersProps {
  values: TotemContentFiltersValues;
  totemOptions: FilterAutocompleteOption[];
  contentOptions: FilterAutocompleteOption[];
  campusOptions: CampusOption[];
  isSuperAdmin: boolean;
  onFieldChange: (
    name: keyof TotemContentFiltersValues,
    value: string,
    mode: "debounced" | "immediate",
  ) => void;
  onClear: () => void;
}

export default function TotemContentFilters({
  values,
  totemOptions,
  contentOptions,
  campusOptions,
  isSuperAdmin,
  onFieldChange,
  onClear,
}: TotemContentFiltersProps) {
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

  if (values.totemSearch.trim()) {
    activeChips.push({
      key: "totemSearch",
      label: "Tótem",
      valueLabel: values.totemSearch.trim(),
      onRemove: () => onFieldChange("totemSearch", "", "immediate"),
    });
  }

  if (values.contentSearch.trim()) {
    activeChips.push({
      key: "contentSearch",
      label: "Contenido",
      valueLabel: values.contentSearch.trim(),
      onRemove: () => onFieldChange("contentSearch", "", "immediate"),
    });
  }

  if (values.contentType) {
    activeChips.push({
      key: "contentType",
      label: "Tipo",
      valueLabel: getOptionLabel(CONTENT_TYPE_OPTIONS, values.contentType),
      onRemove: () => onFieldChange("contentType", "", "immediate"),
    });
  }

  if (values.status) {
    activeChips.push({
      key: "status",
      label: "Estado",
      valueLabel: getOptionLabel(TOTEM_CONTENT_FILTER_STATUS_OPTIONS, values.status),
      onRemove: () => onFieldChange("status", "", "immediate"),
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

  return (
    <CompactFilterBar
      panelTitle="Filtros de asignaciones"
      activeChips={activeChips}
      onClearAll={onClear}
      panelWidthClassName="sm:w-[24rem]"
      searchControls={
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <FilterAutocompleteInput
            id="totemSearch"
            label="Tótem"
            value={values.totemSearch}
            icon={Search}
            hideLabel
            placeholder="Buscar por nombre o código"
            options={totemOptions}
            onValueChange={(nextValue, reason) =>
              onFieldChange(
                "totemSearch",
                nextValue,
                mapAutocompleteReasonToMode(reason),
              )
            }
          />

          <FilterAutocompleteInput
            id="contentSearch"
            label="Contenido"
            value={values.contentSearch}
            icon={Search}
            hideLabel
            placeholder="Buscar por título del contenido"
            options={contentOptions}
            onValueChange={(nextValue, reason) =>
              onFieldChange(
                "contentSearch",
                nextValue,
                mapAutocompleteReasonToMode(reason),
              )
            }
          />
        </div>
      }
      secondaryControls={
        <div className="flex flex-col">
          <FilterSelectField
            id="contentType"
            label="Tipo de contenido"
            icon={Tags}
            value={values.contentType}
            options={CONTENT_TYPE_OPTIONS}
            onChange={(nextValue) =>
              onFieldChange("contentType", nextValue, "immediate")
            }
          />

          <FilterSelectField
            id="status"
            label="Estado"
            icon={CirclePower}
            value={values.status}
            options={TOTEM_CONTENT_FILTER_STATUS_OPTIONS}
            onChange={(nextValue) => onFieldChange("status", nextValue, "immediate")}
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
              onChange={(nextValue) => onFieldChange("campusId", nextValue, "immediate")}
            />
          ) : null}
        </div>
      }
    />
  );
}
