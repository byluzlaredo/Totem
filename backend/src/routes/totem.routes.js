import { Router } from 'express'
import * as totemController from '../controllers/totem.controller.js'
import {
  validateChangeTotemState,
  validateCreateTotem,
  validateGenerateTotemLinkingCode,
  validateListTotems,
  validateTotemIdParam,
  validateUpdateTotem,
} from '../validators/totem.validators.js'

const router = Router()

router.post('/', validateCreateTotem, totemController.createTotem)
router.get('/', validateListTotems, totemController.listTotems)
router.get('/:id/linking-code', validateTotemIdParam, totemController.getTotemLinkingCode)
router.post(
  '/:id/linking-code',
  validateTotemIdParam,
  validateGenerateTotemLinkingCode,
  totemController.generateTotemLinkingCode
)
router.get('/:id', validateTotemIdParam, totemController.getTotemById)
router.patch('/:id', validateTotemIdParam, validateUpdateTotem, totemController.updateTotem)
router.patch('/:id/state', validateTotemIdParam, validateChangeTotemState, totemController.changeTotemState)
router.delete('/:id', validateTotemIdParam, totemController.deleteTotem)

export default router
