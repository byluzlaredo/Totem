import { LockKeyhole, LogIn, Mail } from "lucide-react";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import loginBg from "../../../assets/images/Login-bg.webp";
import logoIcon from "../../../assets/images/Logo.webp";
import FeedbackMessage from "../../components/FeedbackMessage";
import PasswordInput from "../../components/PasswordInput";
import { useAuth } from "../../context/AuthContext";
import {
  consumeAdminSessionNotice,
  getAdminSessionNoticeMessage,
  type AdminSessionInvalidationReason,
} from "../../utils/sessionReauth";
import {
  blockWhitespaceKeyDown,
  normalizeEmailInputForSubmit,
  normalizeEmailInputForTyping,
} from "../../utils/inputNormalization";
import { pickFieldErrors } from "../../utils/apiFieldErrors";
import { getErrorMessage } from "../../utils/getErrorMessage";

interface LoginFormState {
  email: string
  password: string
}

interface LoginFormErrors {
  email?: string
  password?: string
}

const LOGIN_FORM_ERROR_KEYS = ["email", "password"] as const

function validate(values: LoginFormState) {
  const errors: LoginFormErrors = {}

  if (!values.email.trim()) {
    errors.email = 'El correo es obligatorio'
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email.trim())) {
    errors.email = 'Ingresa un correo válido'
  }

  if (!values.password) {
    errors.password = 'La contraseña es obligatoria'
  }

  return errors
}

export default function LoginPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const { login } = useAuth()

  const [values, setValues] = useState<LoginFormState>({
    email: '',
    password: '',
  })
  const [errors, setErrors] = useState<LoginFormErrors>({})
  const [submitting, setSubmitting] = useState(false)
  const [error, setServerError] = useState('')
  const [sessionNoticeReason, setSessionNoticeReason] =
    useState<AdminSessionInvalidationReason | null>(() =>
      consumeAdminSessionNotice()
    )

  const searchParams = new URLSearchParams(location.search)
  const passwordResetSuccess = searchParams.get("passwordReset") === "success"
  const accountActivatedSuccess = searchParams.get("accountActivated") === "success"
  const redirectFromQuery = searchParams.get("from")
  const sessionFromQuery = searchParams.get("session")

  const querySessionNoticeReason: AdminSessionInvalidationReason | null =
    sessionFromQuery === "invalid" || sessionFromQuery === "expired"
      ? sessionFromQuery
      : null

  const sessionNoticeMessage = useMemo(() => {
    if (!sessionNoticeReason) {
      return ""
    }

    return getAdminSessionNoticeMessage(sessionNoticeReason)
  }, [sessionNoticeReason])

  useEffect(() => {
    if (!querySessionNoticeReason) {
      return
    }

    setSessionNoticeReason(querySessionNoticeReason)
  }, [querySessionNoticeReason])

  function resolveRedirectTarget(
    stateFrom: string | null | undefined,
    queryFrom: string | null
  ) {
    if (typeof stateFrom === "string" && stateFrom.startsWith("/admin")) {
      return stateFrom
    }

    if (typeof queryFrom === "string" && queryFrom.startsWith("/admin")) {
      return queryFrom
    }

    return "/admin/dashboard"
  }

  const redirectTo = resolveRedirectTarget(
    (location.state as { from?: string } | null)?.from,
    redirectFromQuery
  )

  function updateField<K extends keyof LoginFormState>(field: K, value: LoginFormState[K]) {
    const nextValue =
      field === "email"
        ? normalizeEmailInputForTyping(String(value))
        : value

    setValues((prev) => ({
      ...prev,
      [field]: nextValue,
    }))

    setErrors((prev) => ({
      ...prev,
      [field]: undefined,
    }))

    setServerError('')
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const trimmedValues = {
      email: normalizeEmailInputForSubmit(values.email),
      password: values.password,
    }

    const validationErrors = validate(trimmedValues)
    setErrors(validationErrors)

    if (Object.keys(validationErrors).length > 0) {
      return
    }

    setSubmitting(true)
    setServerError('')

    try {
      await login(trimmedValues)
      navigate(redirectTo, { replace: true })
    } catch (err) {
      const nextFieldErrors = pickFieldErrors(err, LOGIN_FORM_ERROR_KEYS)

      if (Object.keys(nextFieldErrors).length > 0) {
        setErrors((prev) => ({
          ...prev,
          ...nextFieldErrors,
        }))
        setServerError("")
        return
      }

      setServerError(getErrorMessage(err, 'No se pudo iniciar sesión'))
    } finally {
      setSubmitting(false)
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
              Panel Administrativo
            </p>
            <h1 className="mt-1 text-lg font-bold text-(--color-text-main)">
              Iniciar Sesión
            </h1>
          </header>

          <div className="space-y-5 px-6 py-4 sm:px-8 sm:py-6">
            {passwordResetSuccess && (
              <div className="flex justify-center">
                <FeedbackMessage
                  type="success"
                  message="Tu contraseña fue actualizada. Inicia sesión con la nueva clave."
                  layout="inline"
                  containerClassName="mx-auto max-w-md"
                />
              </div>
            )}

            {accountActivatedSuccess && (
              <div className="flex justify-center">
                <FeedbackMessage
                  type="success"
                  message="Cuenta activada correctamente. Ya puedes iniciar sesión."
                  layout="inline"
                  containerClassName="mx-auto max-w-md"
                />
              </div>
            )}

            {sessionNoticeMessage && (
              <div className="flex justify-center">
                <FeedbackMessage
                  type="error"
                  message={sessionNoticeMessage}
                  onClose={() => setSessionNoticeReason(null)}
                  layout="inline"
                  containerClassName="mx-auto max-w-md"
                />
              </div>
            )}

            {error && (
              <div className="flex justify-center">
                <FeedbackMessage
                  type="error"
                  message={error}
                  onClose={() => setServerError("")}
                  layout="inline"
                  containerClassName="mx-auto max-w-md"
                />
              </div>
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
                    onChange={(event) => updateField('email', event.target.value)}
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

              <div className="space-y-2">
                <label
                  htmlFor="password"
                  className="text-sm font-semibold text-(--color-text-main)"
                >
                  Contraseña
                </label>
                <div className="relative">
                  <LockKeyhole className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-(--color-text-secondary)" />
                  <PasswordInput
                    id="password"
                    name="password"
                    value={values.password}
                    onChange={(event) => updateField('password', event.target.value)}
                    placeholder="Ingresa tu contraseña"
                    className={`w-full rounded-xl border bg-white py-2 pl-10 pr-10 text-xs text-(--color-text-main) outline-none transition placeholder:text-(--color-text-secondary) focus:ring-2 ${errors.password
                      ? "border-(--color-red-main) focus:border-(--color-red-main) focus:ring-(--color-red-main)/20"
                      : "border-(--color-border) focus:border-(--color-red-main) focus:ring-(--color-red-main)/20"
                      }`}
                  />
                </div>
                {errors.password && (
                  <p className="text-xs font-medium text-(--color-red-main)">
                    {errors.password}
                  </p>
                )}
              </div>

              <div className="flex justify-end">
                <Link
                  to="/admin/forgot-password"
                  className="text-xs font-semibold text-(--color-red-main) transition hover:text-(--color-red-dark)"
                >
                  ¿Olvidaste tu contraseña?
                </Link>
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-(--color-red-button) px-5 py-2.5 text-xs font-semibold text-white shadow-md shadow-(--color-red-button)/30 transition hover:bg-(--color-red-dark) disabled:cursor-not-allowed disabled:opacity-70"
              >
                <LogIn className="h-4 w-4" />
                {submitting ? 'Ingresando...' : 'Iniciar sesión'}
              </button>
            </form>
          </div>
        </section>
      </div>
    </main>
  );
}
