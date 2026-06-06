import { Building2, CirclePower, LoaderCircle, Mail, ShieldCheck, UserRound } from "lucide-react";
import { useEffect } from "react";
import { EMPTY_USER_FORM, USER_ROLE_OPTIONS, USER_STATUS_OPTIONS } from "../../../constants/user";
import type { UserFormErrors, UserFormValues } from "../../../types/user";
import { useUserForm } from "../hooks/useUserForm";
import type { CampusOption } from "../../../types/campus";
import { blockWhitespaceKeyDown } from "../../../utils/inputNormalization";

interface UserFormProps {
  initialValues?: UserFormValues;
  submitLabel: string;
  campusOptions: CampusOption[];
  submitting?: boolean;
  isEditing?: boolean;
  serverErrors?: UserFormErrors;
  onSubmit: (values: UserFormValues) => Promise<void>;
}

export default function UserForm({
  initialValues = EMPTY_USER_FORM,
  submitLabel,
  campusOptions,
  submitting = false,
  isEditing = false,
  serverErrors,
  onSubmit,
}: UserFormProps) {
  const { values, errors, handleChange, handleSubmit, setFieldErrors } = useUserForm(
    initialValues,
    onSubmit,
    isEditing
  )
  const statusOptions = USER_STATUS_OPTIONS.filter((option) => {
    if (!isEditing) return false;
    if (values.status === "invited") {
      return option.value !== "active";
    }
    return option.value !== "invited";
  });

  useEffect(() => {
    if (!serverErrors) return
    setFieldErrors(serverErrors)
  }, [serverErrors, setFieldErrors])

  return (
    <form onSubmit={handleSubmit}>
      <fieldset disabled={submitting} className="space-y-4">
        <legend className="sr-only">Formulario de usuario</legend>

        <div className="space-y-2">
          <label
            htmlFor="name"
            className="text-sm font-semibold text-(--color-text-main)"
          >
            Nombre
          </label>
          <div className="relative">
            <UserRound className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-(--color-text-secondary)" />
            <input
              id="name"
              name="name"
              type="text"
              value={values.name}
              onChange={handleChange}
              placeholder="Ej: Juan Perez"
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

        <div className="space-y-2">
          <label
            htmlFor="email"
            className="text-sm font-semibold text-(--color-text-main)"
          >
            Correo
          </label>
          <div className="relative">
            <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-(--color-text-secondary)" />
            <input
              id="email"
              name="email"
              type="email"
              value={values.email}
              onChange={handleChange}
              onKeyDown={blockWhitespaceKeyDown}
              placeholder="Ej: usuario@totem.com"
              className={`w-full rounded-2xl border bg-white py-2 pl-11 pr-4 text-xs text-(--color-text-main) outline-none transition placeholder:text-(--color-text-secondary) focus:ring-2 ${errors.email
                ? "border-(--color-red-main) focus:border-(--color-red-main) focus:ring-(--color-red-main)/20"
                : "border-(--color-border) focus:border-(--color-red-main) focus:ring-(--color-red-main)/20"
                }`}
            />
          </div>
          {errors.email && (
            <p className="text-xs font-medium text-(--color-red-main)">
              {errors.email}
            </p>
          )}
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          <div className="space-y-2">
            <label
              htmlFor="role"
              className="text-sm font-semibold text-(--color-text-main)"
            >
              Rol
            </label>
            <div className="relative">
              <ShieldCheck className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-(--color-text-secondary)" />
              <select
                id="role"
                name="role"
                value={values.role}
                onChange={handleChange}
                className={`w-full rounded-2xl border bg-white py-2 pl-11 pr-4 text-xs text-(--color-text-main) outline-none transition focus:ring-2 ${errors.role
                  ? "border-(--color-red-main) focus:border-(--color-red-main) focus:ring-(--color-red-main)/20"
                  : "border-(--color-border) focus:border-(--color-red-main) focus:ring-(--color-red-main)/20"
                  }`}
              >
                {USER_ROLE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
            {errors.role && (
              <p className="text-xs font-medium text-(--color-red-main)">
                {errors.role}
              </p>
            )}
          </div>

          {isEditing && (
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
                  {statusOptions.map((option) => (
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
          )}

          <div className={`space-y-2 ${isEditing ? "md:col-span-2" : "md:col-span-1"}`}>
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
