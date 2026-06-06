import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
  RequestValidationError,
} from '../errors/AppError.js'
import { sequelize } from '../config/db.js'
import notificationRepository from '../repositories/notification.repository.js'
import { emitTotemEmergencyBroadcast, emitTotemNotificationsUpdated } from './totemClientRealtime.service.js'
import { requireCampusScopeId } from '../utils/campusAccess.js'

function mapNotificationStatus(statusValue) {
  const normalized = String(statusValue ?? '').trim().toLowerCase()

  if (normalized === 'active' || normalized === '1') {
    return 'active'
  }

  return 'inactive'
}

function mapTargets(rawTargets) {
  if (!Array.isArray(rawTargets) || rawTargets.length === 0) {
    return []
  }

  return rawTargets.map((target) => ({
    id: target.id,
    notificationId: target.notificationId,
    targetType: target.targetType,
    totemId: target.totemId,
    campusId: target.campusId,
    campus: target.campus ?? null,
    totem: target.totem ?? null,
    createdAt: target.createdAt,
    updatedAt: target.updatedAt,
  }))
}

function resolveTargetScope(rawNotification, targets) {
  const explicitScope = String(rawNotification?.targetScope ?? '').trim().toLowerCase()

  if (['all', 'campus', 'totems'].includes(explicitScope)) {
    return explicitScope
  }

  if (targets.some((target) => target.targetType === 'totem' || target.totemId !== null)) {
    return 'totems'
  }

  if (targets.some((target) => target.targetType === 'campus' || target.campusId !== null)) {
    return 'campus'
  }

  return 'all'
}

function toIsoOrNull(value) {
  if (!value) {
    return null
  }

  const parsed = value instanceof Date ? value : new Date(value)

  if (Number.isNaN(parsed.getTime())) {
    return null
  }

  return parsed.toISOString()
}

function extractDerivedTargetFields(targets) {
  const campusMap = new Map()
  const totemIdSet = new Set()
  const totemMap = new Map()

  for (const target of targets) {
    if (target.campus?.id && !campusMap.has(target.campus.id)) {
      campusMap.set(target.campus.id, target.campus)
    }

    if (target.campusId !== null && target.campusId !== undefined && !campusMap.has(target.campusId)) {
      campusMap.set(target.campusId, {
        id: target.campusId,
        name: null,
      })
    }

    if (target.totemId !== null && target.totemId !== undefined) {
      totemIdSet.add(target.totemId)
    }

    if (target.totem?.id && !totemMap.has(target.totem.id)) {
      totemMap.set(target.totem.id, target.totem)
    }
  }

  const campuses = [...campusMap.values()]
  const targetTotemIds = [...totemIdSet]
  const targetTotems = [...totemMap.values()]

  return {
    campuses,
    targetCampusId: campuses.length > 0 ? campuses[0].id : null,
    targetCampus: campuses.length > 0 ? campuses[0] : null,
    targetTotemIds,
    targetTotems,
  }
}

function withTiming(notification, totemMap = new Map()) {
  const raw = typeof notification.toJSON === 'function' ? notification.toJSON() : notification
  const targets = mapTargets(raw.targets).map((target) => {
    if (target.totemId === null || target.totemId === undefined) {
      return target
    }

    return {
      ...target,
      totem: totemMap.get(target.totemId) ?? target.totem ?? null,
    }
  })

  const startAt = toIsoOrNull(raw.startAt ?? raw.createdAt)
  const endAt = toIsoOrNull(raw.endAt)
  const deletedAt = toIsoOrNull(raw.deletedAt)

  let remainingSeconds = 0
  const nowMs = Date.now()
  const startAtMs = startAt ? Date.parse(startAt) : Number.NaN
  const endAtMs = endAt ? Date.parse(endAt) : Number.NaN

  if (
    Number.isFinite(startAtMs) &&
    Number.isFinite(endAtMs) &&
    nowMs >= startAtMs
  ) {
    remainingSeconds = Math.max(0, Math.floor((endAtMs - nowMs) / 1000))
  }

  return {
    ...raw,
    durationMinutes: Number(raw.durationMinutes ?? 0),
    status: mapNotificationStatus(raw.status),
    targetScope: resolveTargetScope(raw, targets),
    targets,
    startAt,
    endAt,
    deletedAt,
    remainingSeconds,
    ...extractDerivedTargetFields(targets),
  }
}

function resolveTimeline({ startAt, durationMinutes }, referenceNow = new Date()) {
  const normalizedDurationMinutes = Math.max(1, Number(durationMinutes) || 1)
  const parsedStart =
    startAt === null || startAt === undefined ? null : new Date(startAt)

  const effectiveStart =
    parsedStart && !Number.isNaN(parsedStart.getTime())
      ? parsedStart
      : referenceNow

  const effectiveEnd = new Date(effectiveStart.getTime() + normalizedDurationMinutes * 60 * 1000)

  return {
    startAt: effectiveStart.toISOString(),
    endAt: effectiveEnd.toISOString(),
    durationMinutes: normalizedDurationMinutes,
  }
}

function assertStartAtNotPast(startAt, referenceNow = new Date()) {
  const parsedStartAt = startAt ? new Date(startAt) : null

  if (!parsedStartAt || Number.isNaN(parsedStartAt.getTime())) {
    return
  }

  if (parsedStartAt.getTime() < referenceNow.getTime()) {
    throw new RequestValidationError(
      'La fecha de inicio debe ser mayor o igual a la fecha y hora actual',
      { startAt: 'La fecha de inicio debe ser mayor o igual a la fecha y hora actual' }
    )
  }
}

function areSameInstants(leftValue, rightValue, options = {}) {
  const { precision = 'exact' } = options

  if (!leftValue || !rightValue) {
    return false
  }

  const leftDate = new Date(leftValue)
  const rightDate = new Date(rightValue)

  if (Number.isNaN(leftDate.getTime()) || Number.isNaN(rightDate.getTime())) {
    return false
  }

  if (precision === 'minute') {
    return Math.floor(leftDate.getTime() / 60000) === Math.floor(rightDate.getTime() / 60000)
  }

  return leftDate.getTime() === rightDate.getTime()
}

function assertStartAtNotPastForUpdate(nextStartAt, existingStartAt, referenceNow = new Date()) {
  const parsedNextStartAt = nextStartAt ? new Date(nextStartAt) : null

  if (!parsedNextStartAt || Number.isNaN(parsedNextStartAt.getTime())) {
    return
  }

  if (parsedNextStartAt.getTime() >= referenceNow.getTime()) {
    return
  }

  if (areSameInstants(nextStartAt, existingStartAt, { precision: 'minute' })) {
    return
  }

  throw new RequestValidationError(
    'La fecha de inicio debe ser mayor o igual a la fecha y hora actual',
    { startAt: 'La fecha de inicio debe ser mayor o igual a la fecha y hora actual' }
  )
}

function isVisibleNow(notificationView, nowMs = Date.now()) {
  if (notificationView.status !== 'active') {
    return false
  }

  const startAtMs = Date.parse(notificationView.startAt ?? '')
  const endAtMs = Date.parse(notificationView.endAt ?? '')

  if (Number.isNaN(startAtMs) || Number.isNaN(endAtMs)) {
    return false
  }

  return nowMs >= startAtMs && nowMs <= endAtMs
}

function normalizeCampusId(value) {
  const parsedValue = Number(value)

  if (!Number.isInteger(parsedValue) || parsedValue <= 0) {
    return null
  }

  return parsedValue
}

function targetBelongsToCampus(target, campusId) {
  if (!target) {
    return false
  }

  if (target.targetType === 'campus') {
    return Number(target.campusId) === campusId
  }

  if (target.targetType === 'totem') {
    return Number(target.totem?.campusId) === campusId
  }

  return false
}

function notificationBelongsToCampus(notificationView, campusId) {
  if (!notificationView || !Array.isArray(notificationView.targets) || notificationView.targets.length === 0) {
    return false
  }

  return notificationView.targets.some((target) => {
    if (target.targetType === 'all') {
      return true
    }

    return targetBelongsToCampus(target, campusId)
  })
}

function isGlobalNotification(notificationView) {
  if (!notificationView) {
    return false
  }

  if (notificationView.targetScope === 'all') {
    return true
  }

  if (!Array.isArray(notificationView.targets)) {
    return false
  }

  return notificationView.targets.some((target) => target.targetType === 'all')
}

function notificationFullyBelongsToCampus(notificationView, campusId) {
  if (!notificationView || !Array.isArray(notificationView.targets) || notificationView.targets.length === 0) {
    return false
  }

  let hasCampusScopedTarget = false

  for (const target of notificationView.targets) {
    if (target.targetType === 'all') {
      return false
    }

    if (!targetBelongsToCampus(target, campusId)) {
      return false
    }

    hasCampusScopedTarget = true
  }

  return hasCampusScopedTarget
}

class NotificationService {
  getScopedCampusId(authUser = null) {
    return requireCampusScopeId(authUser)
  }

  async buildTotemMap(ids, options = {}) {
    if (!Array.isArray(ids) || ids.length === 0) {
      return new Map()
    }

    const totems = await notificationRepository.findTotemsByIds(ids, options)
    return new Map(totems.map((totem) => [Number(totem.id), totem]))
  }

  collectTotemIds(notifications) {
    const ids = new Set()

    for (const notification of notifications) {
      const raw = typeof notification.toJSON === 'function' ? notification.toJSON() : notification
      const targets = Array.isArray(raw.targets) ? raw.targets : []

      for (const target of targets) {
        if (target.totemId !== null && target.totemId !== undefined) {
          ids.add(Number(target.totemId))
        }
      }
    }

    return [...ids]
  }

  async assertTotemIdsExist(totemIds) {
    if (!Array.isArray(totemIds) || totemIds.length === 0) {
      return
    }

    const existingIds = await notificationRepository.findExistingTotemIds(totemIds)
    if (existingIds.length !== totemIds.length) {
      throw new RequestValidationError('Uno o más tótems seleccionados no existen')
    }
  }

  async assertCampusIdsExist(campusIds) {
    if (!Array.isArray(campusIds) || campusIds.length === 0) {
      return
    }

    const existingIds = await notificationRepository.findExistingCampusIds(campusIds)
    if (existingIds.length !== campusIds.length) {
      throw new RequestValidationError('Uno o más campus seleccionados no existen')
    }
  }

  async assertTotemTargetsAreAllowed(totemIds, authUser = null) {
    if (!Array.isArray(totemIds) || totemIds.length === 0) {
      return
    }

    const scopedCampusId = this.getScopedCampusId(authUser)

    if (scopedCampusId === null) {
      return
    }

    const totems = await notificationRepository.findTotemsByIds(totemIds)
    if (totems.length !== totemIds.length) {
      throw new RequestValidationError('Uno o más tótems seleccionados no existen')
    }

    const hasUnauthorizedTotem = totems.some(
      (totem) => normalizeCampusId(totem.campusId) !== scopedCampusId
    )

    if (hasUnauthorizedTotem) {
      throw new ForbiddenError('No puedes seleccionar tótems de otro campus')
    }
  }

  assertCampusTargetsAreAllowed(campusIds, authUser = null) {
    if (!Array.isArray(campusIds) || campusIds.length === 0) {
      return
    }

    const scopedCampusId = this.getScopedCampusId(authUser)

    if (scopedCampusId === null) {
      return
    }

    const hasUnauthorizedCampus = campusIds.some(
      (campusId) => Number(campusId) !== scopedCampusId
    )

    if (hasUnauthorizedCampus) {
      throw new ForbiddenError('No puedes seleccionar otro campus')
    }
  }

  assertAllowedScopeForCampusUser(data, authUser = null) {
    const scopedCampusId = this.getScopedCampusId(authUser)

    if (scopedCampusId === null) {
      return
    }

    if (data.targetScope === 'all') {
      throw new ForbiddenError('No puedes enviar notificaciones globales')
    }
  }

  assertNotificationAccess(notificationView, authUser = null) {
    const scopedCampusId = this.getScopedCampusId(authUser)

    if (scopedCampusId === null) {
      return
    }

    if (!notificationBelongsToCampus(notificationView, scopedCampusId)) {
      throw new NotFoundError('La notificación no existe')
    }
  }

  assertNotificationWriteAccess(notificationView, authUser = null) {
    const scopedCampusId = this.getScopedCampusId(authUser)

    if (scopedCampusId === null) {
      return
    }

    if (isGlobalNotification(notificationView)) {
      throw new ForbiddenError('Solo SuperAdmin puede modificar notificaciones globales')
    }

    if (!notificationFullyBelongsToCampus(notificationView, scopedCampusId)) {
      throw new ForbiddenError(
        'Solo SuperAdmin puede modificar notificaciones que afectan a múltiples campus'
      )
    }
  }

  emitRealtimeNotificationsUpdated(action, notificationId) {
    emitTotemNotificationsUpdated({
      action,
      notificationId,
      emittedAt: new Date().toISOString(),
    })
  }

  maybeEmitUrgentBroadcast(notificationView) {
    if (notificationView.type !== 'urgent') {
      return
    }

    if (!isVisibleNow(notificationView)) {
      return
    }

    if (notificationView.remainingSeconds <= 0) {
      return
    }

    emitTotemEmergencyBroadcast({
      notificationId: notificationView.id,
      title: notificationView.title,
      message: notificationView.message,
      durationSeconds: notificationView.remainingSeconds,
      emittedAt: new Date().toISOString(),
    })
  }

  async listCampusOptions(authUser = null) {
    const scopedCampusId = this.getScopedCampusId(authUser)
    const campuses = await notificationRepository.listCampuses(scopedCampusId)

    return campuses.map((campus) => ({
      id: campus.id,
      name: campus.name,
    }))
  }

  async listTotemOptions(authUser = null) {
    const scopedCampusId = this.getScopedCampusId(authUser)
    return notificationRepository.listActiveTotemOptions({
      campusId: scopedCampusId,
    })
  }

  async createNotification(data, authUser = null) {
    this.assertAllowedScopeForCampusUser(data, authUser)

    const totemIds = data.targets
      .filter((target) => target.totemId !== null)
      .map((target) => target.totemId)
    const campusIds = data.targets
      .filter((target) => target.campusId !== null)
      .map((target) => target.campusId)

    await this.assertTotemIdsExist(totemIds)
    await this.assertCampusIdsExist(campusIds)
    await this.assertTotemTargetsAreAllowed(totemIds, authUser)
    this.assertCampusTargetsAreAllowed(campusIds, authUser)

    const referenceNow = new Date()
    const timeline = resolveTimeline({
      startAt: data.startAt,
      durationMinutes: data.durationMinutes,
    }, referenceNow)
    assertStartAtNotPast(timeline.startAt, referenceNow)

    try {
      const created = await sequelize.transaction(async (transaction) => notificationRepository.create({
        notificationData: {
          title: data.title,
          message: data.message,
          createdBy: authUser?.id ?? data.createdBy,
          targetScope: data.targetScope,
          durationMinutes: timeline.durationMinutes,
          startAt: timeline.startAt,
          endAt: timeline.endAt,
          status: data.status,
          type: data.type,
        },
        targets: data.targets,
        transaction,
      }))

      const totemMap = await this.buildTotemMap(this.collectTotemIds([created]))
      const createdView = withTiming(created, totemMap)
      this.assertNotificationAccess(createdView, authUser)

      this.maybeEmitUrgentBroadcast(createdView)
      this.emitRealtimeNotificationsUpdated('created', created.id)

      return createdView
    } catch (error) {
      if (error?.code === '23503' || error?.name === 'SequelizeForeignKeyConstraintError') {
        throw new RequestValidationError('La referencia de usuario, campus o tótem no existe')
      }

      if (error?.code === '23505') {
        throw new ConflictError('Ya existe una notificación duplicada con los mismos datos')
      }

      throw error
    }
  }

  async listNotifications(query, authUser = null) {
    const scopedCampusId = this.getScopedCampusId(authUser)

    if (scopedCampusId === null) {
      const { count, rows } = await notificationRepository.findAllWithPagination(query)
      const totemMap = await this.buildTotemMap(this.collectTotemIds(rows))

      return {
        items: rows.map((row) => withTiming(row, totemMap)),
        meta: {
          totalItems: count,
          totalPages: count === 0 ? 0 : Math.ceil(count / query.limit),
          currentPage: query.page,
          pageSize: query.limit,
        },
      }
    }

    const { count, rows } = await notificationRepository.findAllWithPaginationForCampus({
      ...query,
      campusId: scopedCampusId,
    })
    const totemMap = await this.buildTotemMap(this.collectTotemIds(rows))

    return {
      items: rows.map((row) => withTiming(row, totemMap)),
      meta: {
        totalItems: count,
        totalPages: count === 0 ? 0 : Math.ceil(count / query.limit),
        currentPage: query.page,
        pageSize: query.limit,
      },
    }
  }

  async getNotificationById(id, authUser = null) {
    const notification = await notificationRepository.findById(id)

    if (!notification) {
      throw new NotFoundError('La notificación no existe')
    }

    const totemMap = await this.buildTotemMap(this.collectTotemIds([notification]))
    const notificationView = withTiming(notification, totemMap)
    this.assertNotificationAccess(notificationView, authUser)
    return notificationView
  }

  async updateNotification(id, data, authUser = null) {
    this.assertAllowedScopeForCampusUser(data, authUser)

    const notification = await notificationRepository.findById(id)

    if (!notification) {
      throw new NotFoundError('La notificación no existe')
    }

    const existingTotemMap = await this.buildTotemMap(
      this.collectTotemIds([notification])
    )
    const existingView = withTiming(notification, existingTotemMap)
    this.assertNotificationAccess(existingView, authUser)
    this.assertNotificationWriteAccess(existingView, authUser)

    if (data.targets !== undefined) {
      const nextTotemIds = data.targets
        .filter((target) => target.totemId !== null)
        .map((target) => target.totemId)
      const nextCampusIds = data.targets
        .filter((target) => target.campusId !== null)
        .map((target) => target.campusId)

      await this.assertTotemIdsExist(nextTotemIds)
      await this.assertCampusIdsExist(nextCampusIds)
      await this.assertTotemTargetsAreAllowed(nextTotemIds, authUser)
      this.assertCampusTargetsAreAllowed(nextCampusIds, authUser)
    }

    const currentStartAt = notification.startAt ?? notification.createdAt
    const currentDurationMinutes = Number(notification.durationMinutes ?? 1)
    const shouldRecalculateTimeline =
      data.startAt !== undefined || data.durationMinutes !== undefined || !notification.endAt

    const referenceNow = new Date()
    const timeline = shouldRecalculateTimeline
      ? resolveTimeline({
        startAt: data.startAt === undefined ? currentStartAt : data.startAt,
        durationMinutes:
            data.durationMinutes === undefined ? currentDurationMinutes : data.durationMinutes,
      }, referenceNow)
      : null
    const effectiveStartAt = timeline?.startAt ?? toIsoOrNull(notification.startAt)

    assertStartAtNotPastForUpdate(
      effectiveStartAt,
      toIsoOrNull(notification.startAt),
      referenceNow
    )

    const notificationData = {
      ...(data.title !== undefined ? { title: data.title } : {}),
      ...(data.message !== undefined ? { message: data.message } : {}),
      ...(data.type !== undefined ? { type: data.type } : {}),
      ...(data.status !== undefined ? { status: data.status } : {}),
      ...(data.targetScope !== undefined ? { targetScope: data.targetScope } : {}),
      ...(data.durationMinutes !== undefined ? { durationMinutes: data.durationMinutes } : {}),
      ...(timeline ? { startAt: timeline.startAt, endAt: timeline.endAt, durationMinutes: timeline.durationMinutes } : {}),
    }

    try {
      const updated = await sequelize.transaction(async (transaction) => notificationRepository.update(
        notification,
        {
          notificationData,
          targets: data.targets,
          transaction,
        }
      ))

      const totemMap = await this.buildTotemMap(this.collectTotemIds([updated]))
      const updatedView = withTiming(updated, totemMap)
      this.assertNotificationAccess(updatedView, authUser)

      this.maybeEmitUrgentBroadcast(updatedView)
      this.emitRealtimeNotificationsUpdated('updated', updated.id)

      return updatedView
    } catch (error) {
      if (error?.code === '23503' || error?.name === 'SequelizeForeignKeyConstraintError') {
        throw new RequestValidationError('La referencia de campus o tótem no existe o no es válida')
      }
      throw error
    }
  }

  async deleteNotification(id, authUser = null) {
    const notification = await notificationRepository.findById(id)

    if (!notification) {
      throw new NotFoundError('La notificación no existe')
    }

    const totemMap = await this.buildTotemMap(this.collectTotemIds([notification]))
    const notificationView = withTiming(notification, totemMap)
    this.assertNotificationAccess(notificationView, authUser)
    this.assertNotificationWriteAccess(notificationView, authUser)

    await notificationRepository.softDelete(notification)
    this.emitRealtimeNotificationsUpdated('deleted', notification.id)
  }

  async changeNotificationStatus(id, nextStatus, authUser = null) {
    const notification = await notificationRepository.findById(id)

    if (!notification) {
      throw new NotFoundError('La notificación no existe')
    }

    const existingTotemMap = await this.buildTotemMap(
      this.collectTotemIds([notification])
    )
    const existingView = withTiming(notification, existingTotemMap)
    this.assertNotificationAccess(existingView, authUser)
    this.assertNotificationWriteAccess(existingView, authUser)

    const normalizedStatus = mapNotificationStatus(nextStatus)
    const updated = await notificationRepository.updateStatus(notification, normalizedStatus)
    const totemMap = await this.buildTotemMap(this.collectTotemIds([updated]))
    const updatedView = withTiming(updated, totemMap)

    this.maybeEmitUrgentBroadcast(updatedView)
    this.emitRealtimeNotificationsUpdated('updated', updated.id)

    return updatedView
  }
}

export default new NotificationService()
