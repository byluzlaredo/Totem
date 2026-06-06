import { Router } from 'express'
import * as dashboardController from '../controllers/dashboard.controller.js'

const router = Router()

router.get('/summary', dashboardController.getDashboardSummary)

export default router
