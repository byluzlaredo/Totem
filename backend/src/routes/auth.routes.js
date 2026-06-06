import { Router } from 'express'
import * as authController from '../controllers/auth.controller.js'
import {
  validateForgotPassword,
  validateChangePassword,
  validateLogin,
  validateResetPassword,
  validateResetPasswordToken,
  validateSetPasswordFromInvitation,
  validateUserInvitationToken,
} from '../validators/auth.validator.js'
import { requireAuthenticatedUser } from '../middlewares/auth.middleware.js'
import {
  forgotPasswordRateLimiter,
  loginRateLimiter,
  resetPasswordRateLimiter,
} from '../middlewares/security.middleware.js'

const router = Router()

router.post('/login', loginRateLimiter, validateLogin, authController.login)
router.post('/', loginRateLimiter, validateLogin, authController.login)
router.post(
  '/forgot-password',
  forgotPasswordRateLimiter,
  validateForgotPassword,
  authController.forgotPassword
)
router.post(
  '/reset-password/validate',
  resetPasswordRateLimiter,
  validateResetPasswordToken,
  authController.validateResetPasswordToken
)
router.post(
  '/reset-password',
  resetPasswordRateLimiter,
  validateResetPassword,
  authController.resetPassword
)
router.post(
  '/set-password/validate',
  resetPasswordRateLimiter,
  validateUserInvitationToken,
  authController.validateUserInvitationToken
)
router.post(
  '/set-password',
  resetPasswordRateLimiter,
  validateSetPasswordFromInvitation,
  authController.setPasswordFromInvitation
)
router.post('/logout', requireAuthenticatedUser, authController.logout)
router.post(
  '/change-password',
  requireAuthenticatedUser,
  validateChangePassword,
  authController.changePassword
)
router.get('/me', requireAuthenticatedUser, authController.me)

export default router
