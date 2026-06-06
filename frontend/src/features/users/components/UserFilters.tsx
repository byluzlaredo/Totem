import {
  Building2,
  CirclePower,
  Search,
  ShieldCheck,
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
  USER_ROLE_OPTIONS,
  USER_STATUS_OPTIONS,
} from "../../../constants/user";
import type { CampusOption } from "../../../types/campus";

interface UserFiltersValues {
  search: string;
  role: string;
  status: string;
  campusId: string;
}

interface UserFiltersProps {
  values: UserFiltersValues;
  campusOptions: CampusOption[];
  isSuperAdmin: boolean;
  searchOptions: FilterAutocompleteOption[];
  onFieldChange: (
    name: keyof UserFiltersValues,
    value: string,
    mode: "debounced" | "immediate",
  ) => void;
  onClear: () => void;
}

export default function UserFilters({
  values,
  campusOptions,
  isSuperAdmin,
  searchOptions,
  onFieldChange,
  onClear,
}: UserFiltersProps) {
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

  if (values.role) {
    activeChips.push({
      key: "role",
      label: "Rol",
      valueLabel: getOptionLabel(USER_ROLE_OPTIONS, values.role),
      onRemove: () => onFieldChange("role", "", "immediate"),
    });
  }

  if (values.status) {
    activeChips.push({
      key: "status",
      label: "Estado",
      valueLabel: getOptionLabel(USER_STATUS_OPTIONS, values.status),
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
      panelTitle="Filtros de usuarios"
      activeChips={activeChips}
      onClearAll={onClear}
      searchControls={
        <div className="w-full">
          <FilterAutocompleteInput
            id="search"
            label="Buscar por nombre o correo"
            value={values.search}
            icon={Search}
            hideLabel
            placeholder="Buscar por nombre o correo"
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
            id="role"
            label="Rol"
            icon={ShieldCheck}
            value={values.role}
            options={USER_ROLE_OPTIONS}
            onChange={(nextValue) => onFieldChange("role", nextValue, "immediate")}
          />

          <FilterSelectField
            id="status"
            label="Estado"
            icon={CirclePower}
            value={values.status}
            options={USER_STATUS_OPTIONS}
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
