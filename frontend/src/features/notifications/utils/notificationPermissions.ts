import type { Notification } from '../../../types/notification'

function targetBelongsToCampus(target: Notification['targets'][number], campusId: number) {
  if (target.targetType === 'campus') {
    return Number(target.campusId) === campusId
  }

  if (target.targetType === 'totem') {
    return Number(target.totem?.campusId) === campusId
  }

  return false
}

export function isGlobalNotification(notification: Notification) {
  if (notification.targetScope === 'all') {
    return true
  }

  return notification.targets.some((target) => target.targetType === 'all')
}

export function notificationTargetsCampus(notification: Notification, campusId: number) {
  if (isGlobalNotification(notification)) {
    return true
  }

  if (notification.targets.length > 0) {
    return notification.targets.some((target) => targetBelongsToCampus(target, campusId))
  }

  if (notification.targetScope === 'campus') {
    return Number(notification.targetCampusId) === campusId
  }

  if (notification.targetScope === 'totems') {
    return notification.targetTotems.some((totem) => Number(totem.campusId) === campusId)
  }

  return false
}

export function notificationFullyBelongsToCampus(notification: Notification, campusId: number) {
  if (isGlobalNotification(notification)) {
    return false
  }

  if (notification.targets.length > 0) {
    let hasCampusTarget = false

    for (const target of notification.targets) {
      if (!targetBelongsToCampus(target, campusId)) {
        return false
      }

      hasCampusTarget = true
    }

    return hasCampusTarget
  }

  if (notification.targetScope === 'campus') {
    return Number(notification.targetCampusId) === campusId
  }

  if (notification.targetScope === 'totems' && notification.targetTotems.length > 0) {
    return notification.targetTotems.every((totem) => Number(totem.campusId) === campusId)
  }

  return false
}

export function canManageNotification(
  notification: Notification,
  isSuperAdmin: boolean,
  campusId: number | null
) {
  if (isSuperAdmin) {
    return true
  }

  if (!campusId || !Number.isInteger(campusId) || campusId <= 0) {
    return false
  }

  return notificationFullyBelongsToCampus(notification, campusId)
}

export function getNotificationReadOnlyReason(
  notification: Notification,
  isSuperAdmin: boolean,
  campusId: number | null
) {
  if (canManageNotification(notification, isSuperAdmin, campusId)) {
    return ''
  }

  if (isSuperAdmin) {
    return ''
  }

  if (!campusId || !Number.isInteger(campusId) || campusId <= 0) {
    return 'Solo lectura: no se pudo determinar el campus de tu cuenta.'
  }

  if (isGlobalNotification(notification)) {
    return 'Solo lectura: las notificaciones globales solo pueden gestionarse por SuperAdmin.'
  }

  if (notificationTargetsCampus(notification, campusId)) {
    return 'Solo lectura: esta notificación afecta a múltiples campus y solo SuperAdmin puede gestionarla.'
  }

  return 'Solo lectura: no tienes permisos para gestionar esta notificación.'
}
