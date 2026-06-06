import { z } from 'zod'
import { RequestValidationError } from '../errors/AppError.js'

const PASSWORD_RULE = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z\d]).{8,}$/
const RESET_TOKEN_RULE = /^[A-Za-z0-9_-]+$/

const loginSchema = z
  .object({
    email: z
      .string({
        required_error: 'El correo electrónico es obligatorio',
      })
      .trim()
      .min(1, 'El correo electrónico es obligatorio')
      .email('El correo electrónico debe tener un formato válido'),
    password: z
      .string({
        required_error: 'La contraseña es obligatoria',
      })
      .min(1, 'La contraseña es obligatoria'),
  })
  .strict('No se permiten campos adicionales en el inicio de sesión')

const forgotPasswordSchema = z
  .object({
    email: z
      .string({
        required_error: 'El correo electrónico es obligatorio',
      })
      .trim()
      .min(1, 'El correo electrónico es obligatorio')
      .email('El correo electrónico debe tener un formato válido'),
  })
  .strict('No se permiten campos adicionales en la recuperación de contraseña')

const changePasswordSchema = z
  .object({
    currentPassword: z
      .string({
        required_error: 'La contraseña actual es obligatoria',
      })
      .min(1, 'La contraseña actual es obligatoria'),
    newPassword: z
      .string({
        required_error: 'La nueva contraseña es obligatoria',
      })
      .min(1, 'La nueva contraseña es obligatoria')
      .regex(
        PASSWORD_RULE,
        'La nueva contraseña debe tener mínimo 8 caracteres, una minúscula, una mayúscula, un número y un carácter especial'
      ),
    confirmNewPassword: z
      .string({
        required_error: 'La confirmación de la nueva contraseña es obligatoria',
      })
      .min(1, 'La confirmación de la nueva contraseña es obligatoria'),
  })
  .strict('No se permiten campos adicionales en el cambio de contraseña')
  .superRefine((value, ctx) => {
    if (value.confirmNewPassword !== value.newPassword) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['confirmNewPassword'],
        message: 'La confirmación no coincide con la nueva contraseña',
      })
    }
  })

const resetPasswordTokenSchema = z
  .object({
    token: z
      .string({
        required_error: 'El token de recuperación es obligatorio',
      })
      .trim()
      .min(20, 'El token de recuperación no es válido')
      .max(512, 'El token de recuperación no es válido')
      .regex(RESET_TOKEN_RULE, 'El token de recuperación no es válido'),
  })
  .strict('No se permiten campos adicionales en la validación del token')

const resetPasswordSchema = z
  .object({
    token: z
      .string({
        required_error: 'El token de recuperación es obligatorio',
      })
      .trim()
      .min(20, 'El token de recuperación no es válido')
      .max(512, 'El token de recuperación no es válido')
      .regex(RESET_TOKEN_RULE, 'El token de recuperación no es válido'),
    newPassword: z
      .string({
        required_error: 'La nueva contraseña es obligatoria',
      })
      .min(1, 'La nueva contraseña es obligatoria')
      .regex(
        PASSWORD_RULE,
        'La nueva contraseña debe tener mínimo 8 caracteres, una minúscula, una mayúscula, un número y un carácter especial'
      ),
    confirmNewPassword: z
      .string({
        required_error: 'La confirmación de la nueva contraseña es obligatoria',
      })
      .min(1, 'La confirmación de la nueva contraseña es obligatoria'),
  })
  .strict('No se permiten campos adicionales en el restablecimiento de contraseña')
  .superRefine((value, ctx) => {
    if (value.confirmNewPassword !== value.newPassword) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['confirmNewPassword'],
        message: 'La confirmación no coincide con la nueva contraseña',
      })
    }
  })

const invitationTokenSchema = z
  .object({
    token: z
      .string({
        required_error: 'El token de activación es obligatorio',
      })
      .trim()
      .min(20, 'El token de activación no es válido')
      .max(512, 'El token de activación no es válido')
      .regex(RESET_TOKEN_RULE, 'El token de activación no es válido'),
  })
  .strict('No se permiten campos adicionales en la validación del token')

const setPasswordFromInvitationSchema = z
  .object({
    token: z
      .string({
        required_error: 'El token de activación es obligatorio',
      })
      .trim()
      .min(20, 'El token de activación no es válido')
      .max(512, 'El token de activación no es válido')
      .regex(RESET_TOKEN_RULE, 'El token de activación no es válido'),
    newPassword: z
      .string({
        required_error: 'La nueva contraseña es obligatoria',
      })
      .min(1, 'La nueva contraseña es obligatoria')
      .regex(
        PASSWORD_RULE,
        'La nueva contraseña debe tener mínimo 8 caracteres, una minúscula, una mayúscula, un número y un carácter especial'
      ),
    confirmNewPassword: z
      .string({
        required_error: 'La confirmación de la nueva contraseña es obligatoria',
      })
      .min(1, 'La confirmación de la nueva contraseña es obligatoria'),
  })
  .strict('No se permiten campos adicionales en la activación de cuenta')
  .superRefine((value, ctx) => {
    if (value.confirmNewPassword !== value.newPassword) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['confirmNewPassword'],
        message: 'La confirmación no coincide con la nueva contraseña',
      })
    }
  })

function formatZodError(error) {
  const details = {}

  for (const issue of error.issues) {
    const field = issue.path[0]

    if (typeof field === 'string' && !details[field]) {
      details[field] = issue.message
    }
  }

  return Object.keys(details).length > 0 ? details : null
}

export function validateLogin(req, res, next) {
  const payload = req.body ?? {}
  const parsed = loginSchema.safeParse(payload)

  if (!parsed.success) {
    throw new RequestValidationError(
      'Datos inválidos para iniciar sesión',
      formatZodError(parsed.error)
    )
  }

  req.validated = {
    ...(req.validated ?? {}),
    body: {
      email: parsed.data.email.trim().toLowerCase(),
      password: parsed.data.password,
    },
  }

  next()
}

export function validateForgotPassword(req, res, next) {
  const payload = req.body ?? {}
  const parsed = forgotPasswordSchema.safeParse(payload)

  if (!parsed.success) {
    throw new RequestValidationError(
      'Datos inválidos para solicitar recuperación de contraseña',
      formatZodError(parsed.error)
    )
  }

  req.validated = {
    ...(req.validated ?? {}),
    body: {
      email: parsed.data.email.trim().toLowerCase(),
    },
  }

  next()
}

export function validateChangePassword(req, res, next) {
  const payload = req.body ?? {}
  const parsed = changePasswordSchema.safeParse(payload)

  if (!parsed.success) {
    throw new RequestValidationError(
      'Datos inválidos para cambiar la contraseña',
      formatZodError(parsed.error)
    )
  }

  req.validated = {
    ...(req.validated ?? {}),
    body: {
      currentPassword: parsed.data.currentPassword,
      newPassword: parsed.data.newPassword,
      confirmNewPassword: parsed.data.confirmNewPassword,
    },
  }

  next()
}

export function validateResetPasswordToken(req, res, next) {
  const payload = req.body ?? {}
  const parsed = resetPasswordTokenSchema.safeParse(payload)

  if (!parsed.success) {
    throw new RequestValidationError(
      'Token de recuperación inválido',
      formatZodError(parsed.error)
    )
  }

  req.validated = {
    ...(req.validated ?? {}),
    body: {
      token: parsed.data.token,
    },
  }

  next()
}

export function validateResetPassword(req, res, next) {
  const payload = req.body ?? {}
  const parsed = resetPasswordSchema.safeParse(payload)

  if (!parsed.success) {
    throw new RequestValidationError(
      'Datos inválidos para restablecer la contraseña',
      formatZodError(parsed.error)
    )
  }

  req.validated = {
    ...(req.validated ?? {}),
    body: {
      token: parsed.data.token,
      newPassword: parsed.data.newPassword,
      confirmNewPassword: parsed.data.confirmNewPassword,
    },
  }

  next()
}

export function validateUserInvitationToken(req, res, next) {
  const payload = req.body ?? {}
  const parsed = invitationTokenSchema.safeParse(payload)

  if (!parsed.success) {
    throw new RequestValidationError(
      'Token de activación inválido',
      formatZodError(parsed.error)
    )
  }

  req.validated = {
    ...(req.validated ?? {}),
    body: {
      token: parsed.data.token,
    },
  }

  next()
}

export function validateSetPasswordFromInvitation(req, res, next) {
  const payload = req.body ?? {}
  const parsed = setPasswordFromInvitationSchema.safeParse(payload)

  if (!parsed.success) {
    throw new RequestValidationError(
      'Datos inválidos para activar la cuenta',
      formatZodError(parsed.error)
    )
  }

  req.validated = {
    ...(req.validated ?? {}),
    body: {
      token: parsed.data.token,
      newPassword: parsed.data.newPassword,
      confirmNewPassword: parsed.data.confirmNewPassword,
    },
  }

  next()
}
