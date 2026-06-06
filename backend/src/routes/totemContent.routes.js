import { Router } from 'express'
import * as totemContentController from '../controllers/totemContent.controller.js'
import {
  validateCreateTotemContent,
  validateListTotemContents,
  validateTotemContentIdParam,
  validateUpdateTotemContent,
} from '../validators/totemContent.validators.js'

const router = Router()

router.post('/', validateCreateTotemContent, totemContentController.createTotemContent)
router.get('/', validateListTotemContents, totemContentController.listTotemContents)
router.get('/:id', validateTotemContentIdParam, totemContentController.getTotemContentById)
router.patch('/:id', validateTotemContentIdParam, validateUpdateTotemContent, totemContentController.updateTotemContent)
router.delete('/:id', validateTotemContentIdParam, totemContentController.deleteTotemContent)

export default router
