import rateLimit from 'express-rate-limit'

export const loginRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    ok: false,
    code: 'TOO_MANY_REQUESTS',
    message: 'Demasiados intentos de inicio de sesión. Intenta nuevamente más tarde',
  },
})

export const forgotPasswordRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    ok: false,
    code: 'TOO_MANY_REQUESTS',
    message:
      'Demasiadas solicitudes de recuperación de contraseña. Intenta nuevamente más tarde',
  },
})

export const resetPasswordRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    ok: false,
    code: 'TOO_MANY_REQUESTS',
    message:
      'Demasiados intentos de restablecimiento de contraseña. Intenta nuevamente más tarde',
  },
})
