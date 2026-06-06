import { ArrowLeft, Mail, Send } from "lucide-react";
import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import loginBg from "../../../assets/images/Login-bg.webp";
import logoIcon from "../../../assets/images/Logo.webp";
import FeedbackMessage from "../../components/FeedbackMessage";
import {
  authService,
  getForgotPasswordFieldErrors,
} from "../../features/auth/services/auth.service";
import {
  EMPTY_FORGOT_PASSWORD_FORM,
  validateForgotPasswordForm,
} from "../../features/auth/utils/forgotPassword.validators";
import type {
  ForgotPasswordFormErrors,
  ForgotPasswordPayload,
} from "../../types/auth";
import { getErrorMessage } from "../../utils/getErrorMessage";
import {
  blockWhitespaceKeyDown,
  normalizeEmailInputForSubmit,
  normalizeEmailInputForTyping,
} from "../../utils/inputNormalization";

const DEFAULT_NEUTRAL_MESSAGE =
  "Si la cuenta existe, te enviamos un enlace para restablecer tu contraseña.";

export default function ForgotPasswordPage() {
  const [values, setValues] = useState<ForgotPasswordPayload>(
    EMPTY_FORGOT_PASSWORD_FORM
  );
  const [errors, setErrors] = useState<ForgotPasswordFormErrors>({});
  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  function updateField<K extends keyof ForgotPasswordPayload>(
    field: K,
    value: ForgotPasswordPayload[K]
  ) {
    const nextValue =
      field === "email"
        ? normalizeEmailInputForTyping(String(value))
        : value;

    setValues((previousValues) => ({
      ...previousValues,
      [field]: nextValue,
    }));

    setErrors((previousErrors) => ({
      ...previousErrors,
      [field]: undefined,
    }));

    setServerError("");
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const trimmedValues: ForgotPasswordPayload = {
      email: normalizeEmailInputForSubmit(values.email),
    };
    const validationErrors = validateForgotPasswordForm(trimmedValues);

    setErrors(validationErrors);
    setServerError("");
    setSuccessMessage("");

    if (Object.keys(validationErrors).length > 0) {
      return;
    }

    setSubmitting(true);

    try {
      const response = await authService.requestPasswordReset(trimmedValues);
      setSuccessMessage(response.message || DEFAULT_NEUTRAL_MESSAGE);
      setValues(EMPTY_FORGOT_PASSWORD_FORM);
    } catch (error) {
      const fieldErrors = getForgotPasswordFieldErrors(error);

      if (Object.keys(fieldErrors).length > 0) {
        setErrors((previousErrors) => ({
          ...previousErrors,
          ...fieldErrors,
        }));
        return;
      }

      setServerError(
        getErrorMessage(error, "No se pudo procesar la solicitud de recuperación")
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="relative min-h-screen overflow-hidden">
      <div
        className="absolute inset-0 bg-cover bg-center"
        style={{ backgroundImage: `url(${loginBg})` }}
      />
      <div className="absolute inset-0 bg-black/55" />

      <div className="relative z-10 flex min-h-screen items-center justify-center px-4 py-8 sm:px-6 lg:px-10">
        <section className="w-full max-w-lg overflow-hidden rounded-3xl border border-white/15 bg-white/92 shadow-2xl backdrop-blur-sm">
          <header className="border-b border-(--color-border) px-6 py-4 text-center sm:px-8">
            <div className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-full bg-white/92">
              <img src={logoIcon} alt="Logo Totem" className="h-12 w-12" />
            </div>
            <p className="text-xs font-semibold tracking-[0.08em] text-(--color-red-main)">
              Recuperación de acceso
            </p>
            <h1 className="mt-1 text-lg font-bold text-(--color-text-main)">
              ¿Olvidaste tu contraseña?
            </h1>
            <p className="mt-2 text-xs text-(--color-text-secondary)">
              Ingresa tu correo y te enviaremos un enlace para restablecerla.
            </p>
          </header>

          <div className="space-y-5 px-6 py-4 sm:px-8 sm:py-6">
            {successMessage && (
              <FeedbackMessage
                type="success"
                message={successMessage}
                layout="inline"
                containerClassName="mx-auto"
              />
            )}

            {serverError && (
              <FeedbackMessage
                type="error"
                message={serverError}
                layout="inline"
                containerClassName="mx-auto"
              />
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
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
                    onChange={(event) => updateField("email", event.target.value)}
                    onKeyDown={blockWhitespaceKeyDown}
                    placeholder="admin@totem.com"
                    className={`w-full rounded-xl border bg-white py-2 pl-10 pr-3 text-xs text-(--color-text-main) outline-none transition placeholder:text-(--color-text-secondary) focus:ring-2 ${errors.email
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

              <button
                type="submit"
                disabled={submitting}
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-(--color-red-button) px-5 py-2.5 text-xs font-semibold text-white shadow-md shadow-(--color-red-button)/30 transition hover:bg-(--color-red-dark) disabled:cursor-not-allowed disabled:opacity-70"
              >
                <Send className="h-4 w-4" />
                {submitting ? "Enviando..." : "Enviar enlace"}
              </button>
            </form>

            <Link
              to="/admin/login"
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-(--color-border) bg-white px-5 py-2.5 text-xs font-semibold text-(--color-text-main) shadow-md transition hover:bg-(--color-bg)"
            >
              <ArrowLeft className="h-4 w-4" />
              Volver al inicio de sesión
            </Link>
          </div>
        </section>
      </div>
    </main>
  );
}
