import type { LucideIcon } from "lucide-react";

interface FilterSelectOption {
  value: string | number;
  label: string;
}

interface FilterSelectFieldProps {
  id: string;
  label: string;
  icon: LucideIcon;
  value: string | number;
  options: FilterSelectOption[];
  onChange: (value: string) => void;
  emptyOptionLabel?: string;
  showEmptyOption?: boolean;
  disabled?: boolean;
}

export default function FilterSelectField({
  id,
  label,
  icon: Icon,
  value,
  options,
  onChange,
  emptyOptionLabel = "Todos",
  showEmptyOption = true,
  disabled = false,
}: FilterSelectFieldProps) {
  return (
    <div>
      <label
        htmlFor={id}
        className="mb-2 inline-block text-xs font-semibold tracking-wide text-(--color-text-secondary)"
      >
        {label}
      </label>
      <div className="relative">
        <Icon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-(--color-text-secondary)" />
        <select
          id={id}
          name={id}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          disabled={disabled}
          className="w-full rounded-xl border border-(--color-border) bg-white py-2 pl-10 pr-3 text-xs text-(--color-text-main) outline-none transition focus:border-(--color-red-main) focus:ring-2 focus:ring-(--color-red-main)/20 disabled:cursor-not-allowed disabled:bg-[#f7f7f7] disabled:text-(--color-text-secondary)"
        >
          {showEmptyOption ? <option value="">{emptyOptionLabel}</option> : null}
          {options.map((option) => (
            <option key={String(option.value)} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
