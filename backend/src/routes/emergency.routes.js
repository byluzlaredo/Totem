import { Router } from 'express'
import * as totemController from '../controllers/totem.controller.js'
import { validateTotemIdParam, validateSendEmergency } from '../validators/totem.validators.js'

const router = Router()

// Endpoint de emergencia sin autenticación (urgencias)
router.post('/:id/emergency', validateTotemIdParam, validateSendEmergency, totemController.sendEmergency)

export default router
