import { AlertTriangle, Building2, CirclePower, Search, Tags } from "lucide-react";
import CompactFilterBar, {
  type CompactFilterChip,
} from "../../../components/CompactFilterBar";
import {
  CONTENT_OPERATIONAL_STATUS_OPTIONS,
  CONTENT_FILTER_STATUS_OPTIONS,
  CONTENT_TYPE_OPTIONS,
} from "../../../constants/content";
import FilterAutocompleteInput, {
  type AutocompleteChangeReason,
  type FilterAutocompleteOption,
} from "../../../components/FilterAutocompleteInput";
import FilterSelectField from "../../../components/FilterSelectField";
import type { CampusOption } from "../../../types/campus";

interface ContentFiltersValues {
  title: string;
  contentType: string;
  status: string;
  operationalStatus: string;
  campusId: string;
}

interface ContentFiltersProps {
  values: ContentFiltersValues;
  campusOptions: CampusOption[];
  isSuperAdmin: boolean;
  titleOptions: FilterAutocompleteOption[];
  onFieldChange: (
    name: keyof ContentFiltersValues,
    value: string,
    mode: "debounced" | "immediate",
  ) => void;
  onClear: () => void;
}

export default function ContentFilters({
  values,
  campusOptions,
  isSuperAdmin,
  titleOptions,
  onFieldChange,
  onClear,
}: ContentFiltersProps) {
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

  if (values.title.trim()) {
    activeChips.push({
      key: "title",
      label: "Búsqueda",
      valueLabel: values.title.trim(),
      onRemove: () => onFieldChange("title", "", "immediate"),
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

  if (values.status) {
    activeChips.push({
      key: "status",
      label: "Estado",
      valueLabel: getOptionLabel(CONTENT_FILTER_STATUS_OPTIONS, values.status),
      onRemove: () => onFieldChange("status", "", "immediate"),
    });
  }

  if (values.operationalStatus) {
    activeChips.push({
      key: "operationalStatus",
      label: "Estado operativo",
      valueLabel: getOptionLabel(
        CONTENT_OPERATIONAL_STATUS_OPTIONS,
        values.operationalStatus,
      ),
      onRemove: () => onFieldChange("operationalStatus", "", "immediate"),
    });
  }

  return (
    <CompactFilterBar
      panelTitle="Filtros de contenidos"
      activeChips={activeChips}
      onClearAll={onClear}
      searchControls={
        <div className="w-full">
          <FilterAutocompleteInput
            id="title"
            label="Buscar por título"
            value={values.title}
            icon={Search}
            hideLabel
            placeholder="Buscar por título"
            options={titleOptions}
            onValueChange={(nextValue, reason) =>
              onFieldChange("title", nextValue, mapAutocompleteReasonToMode(reason))
            }
          />
        </div>
      }
      secondaryControls={
        <div className="flex flex-col">
          <FilterSelectField
            id="contentType"
            label="Tipo"
            icon={Tags}
            value={values.contentType}
            options={CONTENT_TYPE_OPTIONS}
            onChange={(nextValue) =>
              onFieldChange("contentType", nextValue, "immediate")
            }
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

          <FilterSelectField
            id="status"
            label="Estado"
            icon={CirclePower}
            value={values.status}
            options={CONTENT_FILTER_STATUS_OPTIONS}
            onChange={(nextValue) => onFieldChange("status", nextValue, "immediate")}
          />

          <FilterSelectField
            id="operationalStatus"
            label="Estado operativo"
            icon={AlertTriangle}
            value={values.operationalStatus}
            options={CONTENT_OPERATIONAL_STATUS_OPTIONS}
            onChange={(nextValue) =>
              onFieldChange("operationalStatus", nextValue, "immediate")
            }
          />
        </div>
      }
    />
  );
}
