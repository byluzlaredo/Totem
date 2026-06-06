import { X } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type MouseEvent,
} from "react";
import { normalizeTextForSearch } from "../utils/textSearch";

export type AutocompleteChangeReason = "input" | "select" | "clear";

export interface FilterAutocompleteOption {
  value: string;
  label: string;
  description?: string;
}

interface FilterAutocompleteInputProps {
  id: string;
  label: string;
  value: string;
  icon: LucideIcon;
  placeholder?: string;
  hideLabel?: boolean;
  options: FilterAutocompleteOption[];
  onValueChange: (nextValue: string, reason: AutocompleteChangeReason) => void;
  noResultsLabel?: string;
  maxVisibleOptions?: number;
}

function optionMatchesQuery(option: FilterAutocompleteOption, query: string) {
  if (!query) {
    return true;
  }

  const normalizedQuery = normalizeTextForSearch(query);
  if (!normalizedQuery) {
    return true;
  }

  const optionText = `${option.value} ${option.label} ${option.description ?? ""}`;
  return normalizeTextForSearch(optionText).includes(normalizedQuery);
}

export default function FilterAutocompleteInput({
  id,
  label,
  value,
  icon: Icon,
  placeholder,
  hideLabel = false,
  options,
  onValueChange,
  noResultsLabel = "No hay coincidencias para la búsqueda actual.",
  maxVisibleOptions = 6,
}: FilterAutocompleteInputProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const listboxId = useId();
  const normalizedValue = normalizeTextForSearch(value);

  const filteredOptions = useMemo(() => {
    const deduplicatedOptions: FilterAutocompleteOption[] = [];
    const seenKeys = new Set<string>();

    for (const option of options) {
      if (!optionMatchesQuery(option, normalizedValue)) {
        continue;
      }

      const dedupeKey = normalizeTextForSearch(`${option.value}::${option.label}`);
      if (!dedupeKey || seenKeys.has(dedupeKey)) {
        continue;
      }

      seenKeys.add(dedupeKey);
      deduplicatedOptions.push(option);

      if (deduplicatedOptions.length >= maxVisibleOptions) {
        break;
      }
    }

    return deduplicatedOptions;
  }, [maxVisibleOptions, normalizedValue, options]);

  const canDisplayPanel = isOpen && normalizedValue.length > 0;

  useEffect(() => {
    if (!canDisplayPanel || filteredOptions.length === 0) {
      setHighlightedIndex(-1);
      return;
    }

    setHighlightedIndex((previousIndex) => {
      if (previousIndex < 0) {
        return 0;
      }

      if (previousIndex >= filteredOptions.length) {
        return filteredOptions.length - 1;
      }

      return previousIndex;
    });
  }, [canDisplayPanel, filteredOptions.length]);

  useEffect(() => {
    function handlePointerDown(event: globalThis.MouseEvent) {
      const targetElement = event.target as Node;

      if (!containerRef.current?.contains(targetElement)) {
        setIsOpen(false);
      }
    }

    document.addEventListener("mousedown", handlePointerDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
    };
  }, []);

  function handleSelectOption(option: FilterAutocompleteOption) {
    onValueChange(option.value, "select");
    setIsOpen(false);
    setHighlightedIndex(-1);
  }

  function handleInputKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Escape") {
      setIsOpen(false);
      return;
    }

    if (event.key !== "ArrowDown" && event.key !== "ArrowUp" && event.key !== "Enter") {
      return;
    }

    if (filteredOptions.length === 0) {
      return;
    }

    if (event.key === "Enter") {
      if (!canDisplayPanel || highlightedIndex < 0) {
        return;
      }

      event.preventDefault();
      handleSelectOption(filteredOptions[highlightedIndex]);
      return;
    }

    event.preventDefault();
    setIsOpen(true);

    if (event.key === "ArrowDown") {
      setHighlightedIndex((previousIndex) =>
        previousIndex < filteredOptions.length - 1 ? previousIndex + 1 : 0,
      );
      return;
    }

    setHighlightedIndex((previousIndex) =>
      previousIndex > 0 ? previousIndex - 1 : filteredOptions.length - 1,
    );
  }

  function handleClear(event: MouseEvent<HTMLButtonElement>) {
    event.preventDefault();
    onValueChange("", "clear");
    setIsOpen(false);
    setHighlightedIndex(-1);
    inputRef.current?.focus();
  }

  return (
    <div ref={containerRef} className={hideLabel ? "" : "space-y-2"}>
      <label
        htmlFor={id}
        className={
          hideLabel
            ? "sr-only"
            : "mb-2 inline-block text-xs font-semibold uppercase tracking-wide text-(--color-text-secondary)"
        }
      >
        {label}
      </label>

      <div className="relative">
        <Icon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-(--color-text-secondary)" />
        <input
          ref={inputRef}
          id={id}
          type="text"
          role="combobox"
          autoComplete="off"
          value={value}
          placeholder={placeholder}
          aria-expanded={canDisplayPanel}
          aria-controls={canDisplayPanel ? listboxId : undefined}
          aria-autocomplete="list"
          onFocus={() => {
            if (normalizedValue.length > 0) {
              setIsOpen(true);
            }
          }}
          onBlur={(event) => {
            const nextFocusedElement = event.relatedTarget as Node | null;

            if (!nextFocusedElement || !containerRef.current?.contains(nextFocusedElement)) {
              setIsOpen(false);
            }
          }}
          onChange={(event) => {
            const nextValue = event.target.value;
            onValueChange(nextValue, "input");
            setIsOpen(normalizeTextForSearch(nextValue).length > 0);
          }}
          onKeyDown={handleInputKeyDown}
          className="w-full rounded-xl border border-(--color-border) bg-white py-2.5 pl-10 pr-10 text-xs text-(--color-text-main) outline-none transition placeholder:text-(--color-text-secondary) focus:border-(--color-red-main) focus:ring-2 focus:ring-(--color-red-main)/20"
        />
        {value ? (
          <button
            type="button"
            onClick={handleClear}
            className="absolute right-2.5 top-1/2 inline-flex h-5 w-5 -translate-y-1/2 items-center justify-center rounded-full text-(--color-text-secondary) transition hover:bg-[#f3f4f6] hover:text-(--color-text-main)"
            aria-label={`Limpiar ${label}`}
            title="Limpiar"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        ) : null}

        {canDisplayPanel ? (
          <div
            className="absolute left-0 right-0 z-30 mt-2 overflow-hidden rounded-xl border border-(--color-border) bg-white shadow-lg"
            role="listbox"
            id={listboxId}
            aria-label={label}
          >
            {filteredOptions.length > 0 ? (
              <ul className="max-h-56 overflow-y-auto py-1">
                {filteredOptions.map((option, index) => {
                  const isHighlighted = index === highlightedIndex;

                  return (
                    <li key={`${option.value}-${option.label}-${index}`}>
                      <button
                        type="button"
                        role="option"
                        aria-selected={isHighlighted}
                        onMouseDown={(event) => event.preventDefault()}
                        onClick={() => handleSelectOption(option)}
                        className={`flex w-full items-start gap-2 px-3 py-2 text-left text-xs transition ${isHighlighted
                          ? "bg-[#fdebef] text-(--color-red-main)"
                          : "text-(--color-text-main) hover:bg-[#f8f9fb]"
                          }`}
                      >
                        <span className="min-w-0">
                          <span className="block truncate font-medium">{option.label}</span>
                          {option.description ? (
                            <span className="block truncate text-xs text-(--color-text-secondary)">
                              {option.description}
                            </span>
                          ) : null}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="px-3 py-2 text-xs text-(--color-text-secondary)">
                {noResultsLabel}
              </p>
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
}
