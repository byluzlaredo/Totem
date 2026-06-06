import { Router } from 'express'
import * as notificationController from '../controllers/notification.controller.js'
import {
  validateChangeNotificationStatus,
  validateCreateNotification,
  validateListNotifications,
  validateNotificationIdParam,
  validateUpdateNotification,
} from '../validators/notification.validators.js'

const router = Router()

router.post('/', validateCreateNotification, notificationController.createNotification)
router.get('/campuses', notificationController.listNotificationCampuses)
router.get('/totem-options', notificationController.listNotificationTotemOptions)
router.get('/', validateListNotifications, notificationController.listNotifications)
router.get('/:id', validateNotificationIdParam, notificationController.getNotificationById)
router.patch(
  '/:id',
  validateNotificationIdParam,
  validateUpdateNotification,
  notificationController.updateNotification
)
router.patch(
  '/:id/status',
  validateNotificationIdParam,
  validateChangeNotificationStatus,
  notificationController.changeNotificationStatus
)
router.delete('/:id', validateNotificationIdParam, notificationController.deleteNotification)

export default router
