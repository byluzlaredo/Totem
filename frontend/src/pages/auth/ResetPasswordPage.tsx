import { ArrowLeft, KeyRound, LoaderCircle, LockKeyhole } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import loginBg from "../../../assets/images/Login-bg.webp";
import logoIcon from "../../../assets/images/Logo.webp";
import FeedbackMessage from "../../components/FeedbackMessage";
import PasswordInput from "../../components/PasswordInput";
import {
  authService,
  getResetPasswordFieldErrors,
} from "../../features/auth/services/auth.service";
import {
  EMPTY_RESET_PASSWORD_FORM,
  validateResetPasswordForm,
} from "../../features/auth/utils/resetPassword.validators";
import type { ResetPasswordFormErrors } from "../../types/auth";
import { getErrorMessage } from "../../utils/getErrorMessage";

type TokenStatus = "checking" | "valid" | "invalid";

export default function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get("token")?.trim() ?? "";

  const [tokenStatus, setTokenStatus] = useState<TokenStatus>("checking");
  const [tokenError, setTokenError] = useState("");
  const [values, setValues] = useState(EMPTY_RESET_PASSWORD_FORM);
  const [errors, setErrors] = useState<ResetPasswordFormErrors>({});
  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState("");

  useEffect(() => {
    let isMounted = true;

    async function validateToken() {
      if (!token) {
        if (!isMounted) return;
        setTokenStatus("invalid");
        setTokenError("El enlace de recuperación es inválido o incompleto.");
        return;
      }

      setTokenStatus("checking");
      setTokenError("");

      try {
        const response = await authService.validateResetPasswordToken({ token });

        if (!isMounted) return;

        if (response.data.valid) {
          setTokenStatus("valid");
          return;
        }

        setTokenStatus("invalid");
        setTokenError("El enlace de recuperación ya expiró o no es válido.");
      } catch (error) {
        if (!isMounted) return;
        setTokenStatus("invalid");
        setTokenError(
          getErrorMessage(error, "No se pudo validar el enlace de recuperación.")
        );
      }
    }

    void validateToken();

    return () => {
      isMounted = false;
    };
  }, [token]);

  function updateField(field: "newPassword" | "confirmNewPassword", value: string) {
    setValues((previousValues) => ({
      ...previousValues,
      [field]: value,
    }));

    setErrors((previousErrors) => ({
      ...previousErrors,
      [field]: undefined,
    }));
    setServerError("");
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const validationErrors = validateResetPasswordForm(values);
    setErrors(validationErrors);
    setServerError("");

    if (Object.keys(validationErrors).length > 0) {
      return;
    }

    setSubmitting(true);

    try {
      await authService.resetPassword({
        token,
        newPassword: values.newPassword,
        confirmNewPassword: values.confirmNewPassword,
      });

      navigate("/admin/login?passwordReset=success", { replace: true });
    } catch (error) {
      const fieldErrors = getResetPasswordFieldErrors(error);

      if (Object.keys(fieldErrors).length > 0) {
        setErrors((previousErrors) => ({
          ...previousErrors,
          ...fieldErrors,
        }));
        return;
      }

      setServerError(
        getErrorMessage(error, "No se pudo restablecer la contraseña")
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
              Seguridad de cuenta
            </p>
            <h1 className="mt-1 text-lg font-bold text-(--color-text-main)">
              Restablecer contraseña
            </h1>
          </header>

          <div className="space-y-5 px-6 py-4 sm:px-8 sm:py-6">
            {tokenStatus === "checking" && (
              <div className="rounded-xl border border-(--color-border) bg-[#fafafa] px-4 py-2 text-xs text-(--color-text-secondary)">
                <div className="inline-flex items-center gap-2">
                  <LoaderCircle className="h-4 w-4 animate-spin text-(--color-red-main)" />
                  Validando enlace de recuperación...
                </div>
              </div>
            )}

            {tokenStatus === "invalid" && (
              <>
                <FeedbackMessage
                  type="error"
                  message={
                    tokenError || "El enlace de recuperación ya expiró o no es válido."
                  }
                  layout="inline"
                  containerClassName="mx-auto"
                />
                <div className="space-y-2">
                  <Link
                    to="/admin/forgot-password"
                    className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-(--color-red-button) px-5 py-2.5 text-xs font-semibold text-white shadow-md shadow-(--color-red-button)/30 transition hover:bg-(--color-red-dark)"
                  >
                    <KeyRound className="h-4 w-4" />
                    Solicitar nuevo enlace
                  </Link>
                  <Link
                    to="/admin/login"
                    className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-(--color-border) bg-white px-5 py-2.5 text-xs font-semibold text-(--color-text-main) shadow-md transition hover:bg-(--color-bg)"
                  >
                    <ArrowLeft className="h-4 w-4" />
                    Volver al inicio de sesión
                  </Link>
                </div>
              </>
            )}

            {tokenStatus === "valid" && (
              <>
                {serverError && (
                  <FeedbackMessage
                    type="error"
                    message={serverError}
                    layout="inline"
                    containerClassName="mx-auto"
                  />
                )}

                <form onSubmit={handleSubmit} className="space-y-4">
                  <p className="rounded-xl border border-(--color-border) bg-[#fafafa] px-4 py-2 text-xs text-(--color-text-secondary)">
                    Usa una contraseña segura con al menos 8 caracteres,
                    incluyendo mayúsculas, minúsculas, números y caracteres
                    especiales.
                  </p>

                  <div className="space-y-2">
                    <label
                      htmlFor="newPassword"
                      className="text-sm font-semibold text-(--color-text-main)"
                    >
                      Nueva contraseña
                    </label>
                    <div className="relative">
                      <LockKeyhole className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-(--color-text-secondary)" />
                      <PasswordInput
                        id="newPassword"
                        name="newPassword"
                        autoComplete="new-password"
                        value={values.newPassword}
                        onChange={(event) =>
                          updateField("newPassword", event.target.value)
                        }
                        placeholder="Ingresa tu nueva contraseña"
                        className={`w-full rounded-xl border bg-white py-2 pl-10 pr-10 text-xs text-(--color-text-main) outline-none transition placeholder:text-(--color-text-secondary) focus:ring-2 ${errors.newPassword
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
                      <LockKeyhole className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-(--color-text-secondary)" />
                      <PasswordInput
                        id="confirmNewPassword"
                        name="confirmNewPassword"
                        autoComplete="new-password"
                        value={values.confirmNewPassword}
                        onChange={(event) =>
                          updateField("confirmNewPassword", event.target.value)
                        }
                        placeholder="Vuelve a escribir la nueva contraseña"
                        className={`w-full rounded-xl border bg-white py-2 pl-10 pr-10 text-xs text-(--color-text-main) outline-none transition placeholder:text-(--color-text-secondary) focus:ring-2 ${errors.confirmNewPassword
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
                    disabled={submitting}
                    className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-(--color-red-button) px-5 py-2.5 text-xs font-semibold text-white shadow-md shadow-(--color-red-button)/30 transition hover:bg-(--color-red-dark) disabled:cursor-not-allowed disabled:opacity-70"
                  >
                    {submitting && (
                      <LoaderCircle className="h-4 w-4 animate-spin" />
                    )}
                    {submitting
                      ? "Guardando..."
                      : "Actualizar contraseña y continuar"}
                  </button>
                </form>
              </>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}
