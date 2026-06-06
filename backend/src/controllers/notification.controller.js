import notificationService from '../services/notification.service.js'

export async function listNotificationCampuses(req, res) {
    const data = await notificationService.listCampusOptions(req.authUser)

    res.status(200).json({
        ok: true,
        data,
    })
}

export async function listNotificationTotemOptions(req, res) {
    const data = await notificationService.listTotemOptions(req.authUser)

    res.status(200).json({
        ok: true,
        data,
    })
}

export async function createNotification(req, res) {
  const notification = await notificationService.createNotification(
    req.validated.body,
    req.authUser
  )

  res.status(201).json({
    ok: true,
    message: 'Notificación registrada correctamente',
    data: notification,
  })
}

export async function listNotifications(req, res) {
  const result = await notificationService.listNotifications(req.validated.query, req.authUser)

  res.status(200).json({
    ok: true,
    data: result.items,
    meta: result.meta,
  })
}

export async function getNotificationById(req, res) {
  const { id } = req.validated.params
  const notification = await notificationService.getNotificationById(id, req.authUser)

  res.status(200).json({
    ok: true,
    data: notification,
  })
}

export async function updateNotification(req, res) {
  const { id } = req.validated.params
  const notification = await notificationService.updateNotification(
    id,
    req.validated.body,
    req.authUser
  )

  res.status(200).json({
    ok: true,
    message: 'Notificación actualizada correctamente',
    data: notification,
  })
}

export async function deleteNotification(req, res) {
  const { id } = req.validated.params

  await notificationService.deleteNotification(id, req.authUser)

  res.status(200).json({
    ok: true,
    message: 'Notificación eliminada correctamente',
  })
}

export async function changeNotificationStatus(req, res) {
  const { id } = req.validated.params
  const { status } = req.validated.body

  const notification = await notificationService.changeNotificationStatus(
    id,
    status,
    req.authUser
  )

  res.status(200).json({
    ok: true,
    message:
      notification.status === 'active'
        ? 'Notificación activada correctamente'
        : 'Notificación desactivada correctamente',
    data: notification,
  })
}
