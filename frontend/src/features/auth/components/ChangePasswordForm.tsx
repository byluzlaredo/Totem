import { LoaderCircle, LockKeyhole } from "lucide-react";
import { useEffect, useRef, useState, type FormEvent } from "react";
import FeedbackMessage from "../../../components/FeedbackMessage";
import PasswordInput from "../../../components/PasswordInput";
import { useModalErrorScrollToTop } from "../../../hooks/useModalErrorScrollToTop";
import type {
  ChangePasswordFormErrors,
  ChangePasswordPayload,
} from "../../../types/auth";
import {
  EMPTY_CHANGE_PASSWORD_FORM,
  validateChangePasswordForm,
} from "../utils/changePassword.validators";

interface ChangePasswordFormProps {
  submitting?: boolean;
  serverError?: string;
  serverErrors?: ChangePasswordFormErrors;
  onSubmit: (values: ChangePasswordPayload) => Promise<void>;
}

export default function ChangePasswordForm({
  submitting = false,
  serverError = "",
  serverErrors,
  onSubmit,
}: ChangePasswordFormProps) {
  const [values, setValues] = useState<ChangePasswordPayload>(
    EMPTY_CHANGE_PASSWORD_FORM
  );
  const [errors, setErrors] = useState<ChangePasswordFormErrors>({});
  const [submitAttempts, setSubmitAttempts] = useState(0);
  const formRef = useRef<HTMLFormElement | null>(null);
  const hasErrors = Object.keys(errors).length > 0;

  useModalErrorScrollToTop(formRef, submitAttempts, hasErrors);

  useEffect(() => {
    if (!serverErrors || Object.keys(serverErrors).length === 0) {
      return;
    }

    setErrors((previousErrors) => ({
      ...previousErrors,
      ...serverErrors,
    }));
  }, [serverErrors]);

  function updateField<K extends keyof ChangePasswordPayload>(
    field: K,
    value: ChangePasswordPayload[K]
  ) {
    setValues((previousValues) => ({
      ...previousValues,
      [field]: value,
    }));

    setErrors((previousErrors) => ({
      ...previousErrors,
      [field]: undefined,
    }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const validationErrors = validateChangePasswordForm(values);
    setErrors(validationErrors);
    setSubmitAttempts((previousAttempts) => previousAttempts + 1);

    if (Object.keys(validationErrors).length > 0) {
      return;
    }

    await onSubmit(values);
  }

  return (
    <form ref={formRef} onSubmit={handleSubmit}>
      <fieldset disabled={submitting} className="space-y-4">
        <legend className="sr-only">Formulario de cambio de contraseña</legend>

        <p className="rounded-2xl border border-(--color-border) bg-[#fafafa] px-4 py-2 text-xs text-(--color-text-secondary)">
          Usa una contraseña segura con al menos 8 caracteres, incluyendo
          mayúsculas, minúsculas, números y caracteres especiales.
        </p>

        {serverError && (
          <FeedbackMessage
            type="error"
            message={serverError}
            layout="inline"
            containerClassName="mx-auto"
          />
        )}

        <div className="space-y-2">
          <label
            htmlFor="currentPassword"
            className="text-sm font-semibold text-(--color-text-main)"
          >
            Contraseña actual
          </label>
          <div className="relative">
            <LockKeyhole className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-(--color-text-secondary)" />
            <PasswordInput
              id="currentPassword"
              name="currentPassword"
              autoComplete="current-password"
              autoFocus
              value={values.currentPassword}
              onChange={(event) =>
                updateField("currentPassword", event.target.value)
              }
              placeholder="Ingresa tu contraseña actual"
              className={`w-full rounded-2xl border bg-white py-2 pl-11 pr-12 text-xs text-(--color-text-main) outline-none transition placeholder:text-(--color-text-secondary) focus:ring-2 ${errors.currentPassword
                ? "border-(--color-red-main) focus:border-(--color-red-main) focus:ring-(--color-red-main)/20"
                : "border-(--color-border) focus:border-(--color-red-main) focus:ring-(--color-red-main)/20"
                }`}
            />
          </div>
          {errors.currentPassword && (
            <p className="text-xs font-medium text-(--color-red-main)">
              {errors.currentPassword}
            </p>
          )}
        </div>

        <div className="space-y-2">
          <label
            htmlFor="newPassword"
            className="text-sm font-semibold text-(--color-text-main)"
          >
            Nueva contraseña
          </label>
          <div className="relative">
            <LockKeyhole className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-(--color-text-secondary)" />
            <PasswordInput
              id="newPassword"
              name="newPassword"
              autoComplete="new-password"
              value={values.newPassword}
              onChange={(event) => updateField("newPassword", event.target.value)}
              placeholder="Ingresa tu nueva contraseña"
              className={`w-full rounded-2xl border bg-white py-2 pl-11 pr-12 text-xs text-(--color-text-main) outline-none transition placeholder:text-(--color-text-secondary) focus:ring-2 ${errors.newPassword
                ? "border-(--color-red-main) focus:border-(--color-red-main) focus:ring-(--color-red-main)/20"
                : "border-(--color-border) focus:border-(--color-red-main) focus:ring-(--color-red-main)/20"
                }`}
            />
          </div>
          {errors.newPassword && (
            <p className="text-xs font-medium text-(--color-red-main)">
              {errors.newPassword}
            </p>
          )}
        </div>

        <div className="space-y-2">
          <label
            htmlFor="confirmNewPassword"
            className="text-sm font-semibold text-(--color-text-main)"
          >
            Confirmar nueva contraseña
          </label>
          <div className="relative">
            <LockKeyhole className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-(--color-text-secondary)" />
            <PasswordInput
              id="confirmNewPassword"
              name="confirmNewPassword"
              autoComplete="new-password"
              value={values.confirmNewPassword}
              onChange={(event) =>
                updateField("confirmNewPassword", event.target.value)
              }
              placeholder="Vuelve a escribir la nueva contraseña"
              className={`w-full rounded-2xl border bg-white py-2 pl-11 pr-12 text-xs text-(--color-text-main) outline-none transition placeholder:text-(--color-text-secondary) focus:ring-2 ${errors.confirmNewPassword
                ? "border-(--color-red-main) focus:border-(--color-red-main) focus:ring-(--color-red-main)/20"
                : "border-(--color-border) focus:border-(--color-red-main) focus:ring-(--color-red-main)/20"
                }`}
            />
          </div>
          {errors.confirmNewPassword && (
            <p className="text-xs font-medium text-(--color-red-main)">
              {errors.confirmNewPassword}
            </p>
          )}
        </div>

        <button
          type="submit"
          className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-(--color-red-button) px-5 py-2.5 text-xs font-semibold text-white shadow-md shadow-(--color-red-button)/30 transition hover:bg-(--color-red-dark) focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--color-red-main) focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-70"
        >
          {submitting && <LoaderCircle className="h-4 w-4 animate-spin" />}
          {submitting ? "Guardando..." : "Actualizar contraseña"}
        </button>
      </fieldset>
    </form>
  );
}
