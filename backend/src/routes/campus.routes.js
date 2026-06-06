import { Router } from 'express'
import * as campusController from '../controllers/campus.controller.js'

const router = Router()

router.get('/', campusController.listCampuses)

export default router
