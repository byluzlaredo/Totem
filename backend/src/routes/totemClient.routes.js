import { Router } from 'express'
import * as totemClientController from '../controllers/totemClient.controller.js'
import { authenticateTotemClient } from '../middlewares/totemClientAuth.js'
import {
  validateEndQuestionSession,
  validateTotemDeviceLink,
  validateTotemSessionRefresh,
  validateQuestionSessionIdParam,
  validateQuestionSubmission,
  validateQuestionModeActivity,
  validateQuestionModeEnter,
  validateQuestionModeExit,
  validateStartQuestionSession,
  validateTotemDeviceStatusReport,
} from '../validators/totemClient.validators.js'

const router = Router()

router.post('/totem/link', validateTotemDeviceLink, totemClientController.postTotemDeviceLink)
router.post(
  '/totem/session/refresh',
  validateTotemSessionRefresh,
  totemClientController.postTotemSessionRefresh
)
router.post(
  '/totem/session/unlink',
  authenticateTotemClient,
  totemClientController.postTotemSessionUnlink
)

router.get('/totem/bootstrap', authenticateTotemClient, totemClientController.getTotemBootstrap)
router.post('/totem/heartbeat', authenticateTotemClient, totemClientController.postTotemHeartbeat)
router.post(
  '/totem/question-mode/enter',
  authenticateTotemClient,
  validateQuestionModeEnter,
  totemClientController.postEnterQuestionMode
)
router.post(
  '/totem/question-mode/activity',
  authenticateTotemClient,
  validateQuestionModeActivity,
  totemClientController.postQuestionModeActivity
)
router.post(
  '/totem/question-mode/exit',
  authenticateTotemClient,
  validateQuestionModeExit,
  totemClientController.postExitQuestionMode
)
router.post(
  '/totem/device-status',
  authenticateTotemClient,
  validateTotemDeviceStatusReport,
  totemClientController.postDeviceStatus
)
router.post(
  '/totem/question-sessions',
  authenticateTotemClient,
  validateStartQuestionSession,
  totemClientController.postStartQuestionSession
)
router.post(
  '/totem/question-sessions/:sessionId/questions',
  authenticateTotemClient,
  validateQuestionSessionIdParam,
  validateQuestionSubmission,
  totemClientController.postQuestion
)
router.post(
  '/totem/question-sessions/:sessionId/end',
  authenticateTotemClient,
  validateQuestionSessionIdParam,
  validateEndQuestionSession,
  totemClientController.postEndQuestionSession
)

export default router
