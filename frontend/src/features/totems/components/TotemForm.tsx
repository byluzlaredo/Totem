import {
  Building2,
  Cable,
  CirclePower,
  LoaderCircle,
  Signature,
} from "lucide-react";
import { useEffect } from "react";
import { useTotemForm } from "../hooks/useTotemForm";
import { EMPTY_TOTEM_FORM, TOTEM_STATE_OPTIONS } from "../../../constants/totem";
import type { TotemFormErrors, TotemFormValues } from "../../../types/totem";
import type { CampusOption } from "../../../types/campus";

interface TotemFormProps {
  initialValues?: TotemFormValues;
  campusOptions: CampusOption[];
  isSuperAdmin: boolean;
  lockedCampusName?: string | null;
  submitLabel: string;
  submitting?: boolean;
  serverErrors?: TotemFormErrors;
  onSubmit: (values: TotemFormValues) => Promise<void>;
}

export default function TotemForm({
  initialValues = EMPTY_TOTEM_FORM,
  campusOptions,
  isSuperAdmin,
  lockedCampusName = null,
  submitLabel,
  submitting = false,
  serverErrors,
  onSubmit,
}: TotemFormProps) {
  const { values, errors, handleChange, handleSubmit, setFieldErrors } = useTotemForm(
    initialValues,
    onSubmit,
  );

  useEffect(() => {
    if (!serverErrors) return;
    setFieldErrors(serverErrors);
  }, [serverErrors, setFieldErrors]);

  return (
    <form onSubmit={handleSubmit}>
      <fieldset disabled={submitting} className="space-y-4">
        <legend className="sr-only">Formulario de tótem</legend>

        <div className="space-y-2">
          <label
            htmlFor="code"
            className="text-sm font-semibold text-(--color-text-main)"
          >
            Código
          </label>
          <div className="relative">
            <Cable className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-(--color-text-secondary)" />
            <input
              id="code"
              name="code"
              type="text"
              value={values.code}
              onChange={handleChange}
              placeholder="Ej: TOTEM-ENTRADA-01"
              className={`w-full rounded-2xl border bg-white py-2 pl-11 pr-4 text-xs text-(--color-text-main) outline-none transition placeholder:text-(--color-text-secondary) focus:ring-2 ${errors.code
                ? "border-(--color-red-main) focus:border-(--color-red-main) focus:ring-(--color-red-main)/20"
                : "border-(--color-border) focus:border-(--color-red-main) focus:ring-(--color-red-main)/20"
                }`}
            />
          </div>
          {errors.code && (
            <p className="text-xs font-medium text-(--color-red-main)">
              {errors.code}
            </p>
          )}
        </div>

        <div className="space-y-2">
          <label
            htmlFor="name"
            className="text-sm font-semibold text-(--color-text-main)"
          >
            Nombre
          </label>
          <div className="relative">
            <Signature className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-(--color-text-secondary)" />
            <input
              id="name"
              name="name"
              type="text"
              value={values.name}
              onChange={handleChange}
              placeholder="Ej: Tótem Principal Entrada"
              className={`w-full rounded-2xl border bg-white py-2 pl-11 pr-4 text-xs text-(--color-text-main) outline-none transition placeholder:text-(--color-text-secondary) focus:ring-2 ${errors.name
                ? "border-(--color-red-main) focus:border-(--color-red-main) focus:ring-(--color-red-main)/20"
                : "border-(--color-border) focus:border-(--color-red-main) focus:ring-(--color-red-main)/20"
                }`}
            />
          </div>
          {errors.name && (
            <p className="text-xs font-medium text-(--color-red-main)">
              {errors.name}
            </p>
          )}
        </div>

        {isSuperAdmin ? (
          <div className="space-y-2">
            <label
              htmlFor="campusId"
              className="text-sm font-semibold text-(--color-text-main)"
            >
              Campus
            </label>
            <div className="relative">
              <Building2 className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-(--color-text-secondary)" />
              <select
                id="campusId"
                name="campusId"
                value={values.campusId}
                onChange={handleChange}
                className={`w-full rounded-2xl border bg-white py-2 pl-11 pr-4 text-xs text-(--color-text-main) outline-none transition focus:ring-2 ${errors.campusId
                  ? "border-(--color-red-main) focus:border-(--color-red-main) focus:ring-(--color-red-main)/20"
                  : "border-(--color-border) focus:border-(--color-red-main) focus:ring-(--color-red-main)/20"
                  }`}
              >
                <option value="">Selecciona un campus</option>
                {campusOptions.map((campus) => (
                  <option key={campus.id} value={campus.id}>
                    {campus.name}
                  </option>
                ))}
              </select>
            </div>
            {errors.campusId && (
              <p className="text-xs font-medium text-(--color-red-main)">
                {errors.campusId}
              </p>
            )}
          </div>
        ) : (
          <div className="space-y-2">
            <label
              htmlFor="campusReadOnly"
              className="text-sm font-semibold text-(--color-text-main)"
            >
              Campus
            </label>
            <div className="relative">
              <Building2 className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-(--color-text-secondary)" />
              <input
                id="campusReadOnly"
                type="text"
                readOnly
                value={lockedCampusName ?? "No disponible"}
                className="w-full rounded-2xl border border-(--color-border) bg-[#f9f9f9] py-2 pl-11 pr-4 text-xs text-(--color-text-main)"
              />
            </div>
            {errors.campusId && (
              <p className="text-xs font-medium text-(--color-red-main)">
                {errors.campusId}
              </p>
            )}
          </div>
        )}

        <div className="space-y-2">
          <label
            htmlFor="state"
            className="text-xs font-semibold text-(--color-text-main)"
          >
            Estado
          </label>
          <div className="relative">
            <CirclePower className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-(--color-text-secondary)" />
            <select
              id="state"
              name="state"
              value={values.state}
              onChange={handleChange}
              className={`w-full rounded-2xl border bg-white py-2 pl-11 pr-4 text-xs text-(--color-text-main) outline-none transition focus:ring-2 ${errors.state
                ? "border-(--color-red-main) focus:border-(--color-red-main) focus:ring-(--color-red-main)/20"
                : "border-(--color-border) focus:border-(--color-red-main) focus:ring-(--color-red-main)/20"
                }`}
            >
              {TOTEM_STATE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
          {errors.state && (
            <p className="text-xs font-medium text-(--color-red-main)">
              {errors.state}
            </p>
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
