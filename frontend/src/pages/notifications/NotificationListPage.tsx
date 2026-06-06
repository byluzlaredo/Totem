import { useEffect, useMemo, useRef, useState } from 'react'
import { Plus } from 'lucide-react'
import { useLocation, useNavigate } from 'react-router-dom'
import ConfirmDialog from '../../components/ConfirmDialog'
import EmptyState from '../../components/EmptyState'
import FeedbackMessage from '../../components/FeedbackMessage'
import FormModal from '../../components/FormModal'
import LoadingState from '../../components/LoadingState'
import Pagination from '../../components/Pagination'
import {
  LIST_FILTER_DEBOUNCE_MS,
  LIST_SEARCH_MIN_CHARS,
} from '../../constants/search'
import NotificationForm from '../../features/notifications/components/NotificationForm'
import {
  EMPTY_NOTIFICATION_FORM,
  DEFAULT_NOTIFICATION_PAGE_SIZE,
  NOTIFICATION_SCOPE_FILTER_OPTIONS,
} from '../../constants/notification'
import NotificationFilters from '../../features/notifications/components/NotificationFilters'
import NotificationDetailPanel from '../../features/notifications/components/NotificationDetailPanel'
import NotificationTable from '../../features/notifications/components/NotificationTable'
import {
  canManageNotification,
  getNotificationReadOnlyReason,
} from '../../features/notifications/utils/notificationPermissions'
import { resolveNotificationRemainingInfo } from '../../features/notifications/utils/notificationTime'
import {
  getNotificationFieldErrors,
  notificationService,
} from '../../features/notifications/services/notification.service'
import { useAuth } from '../../context/AuthContext'
import type {
  NotificationDispatchMode,
  Notification,
  NotificationCampusOption,
  NotificationFormErrors,
  NotificationDurationUnit,
  NotificationLifecycleStatus,
  NotificationTotemOption,
  NotificationListParams,
  NotificationScope,
  NotificationStatus,
  NotificationType,
  NotificationFormValues,
} from '../../types/notification'
import type { PaginationMeta } from '../../types/totem'
import { getErrorMessage } from '../../utils/getErrorMessage'
import {
  normalizeSearchInputForQuery,
  normalizeTextForSearch,
} from '../../utils/textSearch'

const DEFAULT_META: PaginationMeta = {
  totalItems: 0,
  totalPages: 0,
  currentPage: 1,
  pageSize: DEFAULT_NOTIFICATION_PAGE_SIZE,
}

type NotificationFilterState = {
  search: string
  type: NotificationType | ''
  scope: NotificationScope | ''
  campusId: number | ''
  status: NotificationStatus
}

type ConfirmState =
  | null
  | {
    type: 'delete'
    notification: Notification
  }
  | {
    type: 'status'
    notification: Notification
    nextStatus: NotificationLifecycleStatus
  }

const NOTIFICATION_TIME_SYNC_INTERVAL_MS = 1000

function resolveScopedCampusIdForAdmin(userCampusId: number | null) {
  return typeof userCampusId === "number" && userCampusId > 0 ? userCampusId : null
}

function buildDefaultNotificationFilters(): NotificationFilterState {
  return {
    search: "",
    type: "",
    scope: "",
    campusId: "",
    status: "all",
  }
}

function buildEmptyNotificationFormValues(
  isSuperAdmin: boolean,
  scopedCampusId: number | null
): NotificationFormValues {
  return {
    ...EMPTY_NOTIFICATION_FORM,
    targetCampusId: !isSuperAdmin && scopedCampusId !== null ? scopedCampusId : "",
  }
}

function mapNotificationScopeLabel(scope: NotificationScope) {
  return (
    NOTIFICATION_SCOPE_FILTER_OPTIONS.find((option) => option.value === scope)?.label
    ?? scope
  )
}

function mapNotificationTypeLabel(type: NotificationType) {
  if (type === 'urgent') return 'Urgente'
  if (type === 'normal') return 'Normal'
  return type
}

function buildNotificationQueryFromFilters(
  filters: NotificationFilterState,
  limit: number,
  {
    isSuperAdmin,
  }: {
    isSuperAdmin: boolean
  }
): NotificationListParams {
  const normalizedScope = (filters.scope as NotificationScope | '') || undefined
  const normalizedCampusId =
    isSuperAdmin && normalizedScope === 'campus'
      ? (filters.campusId === '' ? undefined : filters.campusId)
      : undefined

  return {
    search: normalizeSearchInputForQuery(
      filters.search,
      LIST_SEARCH_MIN_CHARS
    ),
    type: (filters.type as NotificationType | '') || undefined,
    scope: normalizedScope,
    campusId: normalizedCampusId,
    status: (filters.status as NotificationStatus) || 'all',
    page: 1,
    limit,
  }
}

function areNotificationQueriesEqual(
  left: NotificationListParams,
  right: NotificationListParams
) {
  return (
    left.search === right.search
    && left.type === right.type
    && left.scope === right.scope
    && left.campusId === right.campusId
    && left.status === right.status
    && left.page === right.page
    && left.limit === right.limit
  )
}

export default function NotificationListPage() {
  const location = useLocation()
  const navigate = useNavigate()
  const { user } = useAuth()
  const isSuperAdmin = user?.role === "SuperAdmin"
  const scopedCampusId = resolveScopedCampusIdForAdmin(user?.campusId ?? null)
  const defaultFilters = useMemo(
    () => buildDefaultNotificationFilters(),
    []
  )
  const defaultCreateFormValues = useMemo(
    () => buildEmptyNotificationFormValues(isSuperAdmin, scopedCampusId),
    [isSuperAdmin, scopedCampusId]
  )

  const [items, setItems] = useState<Notification[]>([])
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState(false)
  const [submitLoading, setSubmitLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [serverErrors, setServerErrors] = useState<NotificationFormErrors>({})
  const [meta, setMeta] = useState<PaginationMeta>(DEFAULT_META)
  const [campusOptions, setCampusOptions] = useState<NotificationCampusOption[]>([])

  const [filtersForm, setFiltersForm] = useState<NotificationFilterState>(defaultFilters)
  const [query, setQuery] = useState<NotificationListParams>(() =>
    buildNotificationQueryFromFilters(defaultFilters, DEFAULT_NOTIFICATION_PAGE_SIZE, {
      isSuperAdmin,
    })
  )

  const [confirmState, setConfirmState] = useState<ConfirmState>(null)
  const [modalMode, setModalMode] = useState<'create' | 'edit' | null>(null)
  const [editingNotification, setEditingNotification] = useState<Notification | null>(null)
  const [viewingNotification, setViewingNotification] = useState<Notification | null>(null)
  const [nowMs, setNowMs] = useState(() => Date.now())
  const filterApplyTimeoutRef = useRef<number | null>(null)
  const listRequestIdRef = useRef(0)
  const listAbortControllerRef = useRef<AbortController | null>(null)

  const searchSuggestions = useMemo(() => {
    const suggestions: Array<{ value: string; label: string; description: string }> = []
    const seenValues = new Set<string>()

    for (const notification of items) {
      const normalizedTitle = normalizeTextForSearch(notification.title)
      if (!normalizedTitle || seenValues.has(normalizedTitle)) {
        continue
      }

      seenValues.add(normalizedTitle)
      suggestions.push({
        value: notification.title,
        label: notification.title,
        description: `Tipo: ${mapNotificationTypeLabel(notification.type)} - Destino: ${mapNotificationScopeLabel(notification.targetScope)}`,
      })
    }

    return suggestions
  }, [items])

  function toDateTimeLocal(value: string | null) {
    if (!value) return ''

    const parsed = new Date(value)

    if (Number.isNaN(parsed.getTime())) {
      return ''
    }

    const localDate = new Date(parsed.getTime() - parsed.getTimezoneOffset() * 60000)
    return localDate.toISOString().slice(0, 16)
  }

  function splitDurationForForm(durationMinutes: number): {
    durationValue: string
    durationUnit: NotificationDurationUnit
  } {
    const normalizedDuration = Math.max(1, Math.floor(durationMinutes))

    if (normalizedDuration % (24 * 60) === 0) {
      return {
        durationValue: String(normalizedDuration / (24 * 60)),
        durationUnit: 'days',
      }
    }

    if (normalizedDuration % 60 === 0) {
      return {
        durationValue: String(normalizedDuration / 60),
        durationUnit: 'hours',
      }
    }

    return {
      durationValue: String(normalizedDuration),
      durationUnit: 'minutes',
    }
  }

  function mapNotificationToFormValues(notification: Notification): NotificationFormValues {
    const durationForForm = splitDurationForForm(notification.durationMinutes)
    const inferredCampusIdFromTotems = (() => {
      const campusIds = [...new Set(
        notification.targetTotems
          .map((totem) => totem.campusId)
          .filter((campusId): campusId is number => typeof campusId === "number" && campusId > 0)
      )]

      if (campusIds.length === 1) {
        return campusIds[0]
      }

      return ""
    })()
    const targetScope: NotificationDispatchMode =
      notification.targetScope === "totems" ? "totems" : "all"
    const targetCampusId = isSuperAdmin
      ? (
        notification.targetScope === "campus"
          ? (notification.targetCampusId ?? "")
          : inferredCampusIdFromTotems
      )
      : (scopedCampusId ?? "")

    return {
      title: notification.title,
      message: notification.message,
      type: notification.type,
      status: notification.status,
      durationValue: durationForForm.durationValue,
      durationUnit: durationForForm.durationUnit,
      startAt: toDateTimeLocal(notification.startAt),
      targetScope,
      targetCampusId,
      targetTotemIds: notification.targetTotemIds,
    }
  }

  async function loadNotifications(currentQuery: NotificationListParams) {
    const requestId = listRequestIdRef.current + 1
    listRequestIdRef.current = requestId
    listAbortControllerRef.current?.abort()
    const requestAbortController = new AbortController()
    listAbortControllerRef.current = requestAbortController

    setLoading(true)
    setError('')

    try {
      const response = await notificationService.getNotifications(currentQuery, {
        signal: requestAbortController.signal,
      })
      if (listRequestIdRef.current !== requestId) {
        return
      }
      setItems(response.data)
      setMeta(response.meta)
    } catch (err) {
      if (
        listRequestIdRef.current !== requestId
        || requestAbortController.signal.aborted
      ) {
        return
      }
      setError(getErrorMessage(err, 'No se pudo cargar la lista de notificaciones'))
    } finally {
      if (listAbortControllerRef.current === requestAbortController) {
        listAbortControllerRef.current = null
      }

      if (listRequestIdRef.current === requestId) {
        setLoading(false)
      }
    }
  }

  useEffect(() => {
    void loadNotifications(query)
  }, [query])

  useEffect(() => {
    setFiltersForm(defaultFilters)
    setQuery((previousQuery) => {
      const nextQuery = buildNotificationQueryFromFilters(
        defaultFilters,
        DEFAULT_NOTIFICATION_PAGE_SIZE,
        {
          isSuperAdmin,
        }
      )

      return areNotificationQueriesEqual(previousQuery, nextQuery)
        ? previousQuery
        : nextQuery
    })
  }, [defaultFilters, isSuperAdmin])

  useEffect(() => {
    const syncNow = () => {
      setNowMs(Date.now())
    }

    const timer = window.setInterval(syncNow, NOTIFICATION_TIME_SYNC_INTERVAL_MS)
    window.addEventListener('focus', syncNow)
    document.addEventListener('visibilitychange', syncNow)

    return () => {
      window.clearInterval(timer)
      window.removeEventListener('focus', syncNow)
      document.removeEventListener('visibilitychange', syncNow)
    }
  }, [])

  useEffect(() => {
    return () => {
      if (filterApplyTimeoutRef.current !== null) {
        window.clearTimeout(filterApplyTimeoutRef.current)
        filterApplyTimeoutRef.current = null
      }

      listAbortControllerRef.current?.abort()
      listAbortControllerRef.current = null
      listRequestIdRef.current += 1
    }
  }, [])

  useEffect(() => {
    async function loadFormOptions() {
      const [campusesResult] = await Promise.allSettled([
        notificationService.getCampusOptions(),
      ])

      if (campusesResult.status === 'fulfilled') {
        setCampusOptions(campusesResult.value)
      } else {
        setCampusOptions([])
      }
    }

    loadFormOptions()
  }, [])

  const editModeInitialTotemOptions = useMemo<NotificationTotemOption[]>(() => {
    if (!editingNotification) {
      return []
    }

    const uniqueTotems = new Map<number, NotificationTotemOption>()

    for (const totem of editingNotification.targetTotems) {
      if (totem.state !== 'active' || uniqueTotems.has(totem.id)) {
        continue
      }

      uniqueTotems.set(totem.id, {
        id: totem.id,
        code: totem.code,
        name: totem.name,
        campusId: totem.campusId,
        campusName: totem.campusName,
        state: totem.state,
      })
    }

    return [...uniqueTotems.values()]
  }, [editingNotification])

  useEffect(() => {
    const navigationState = location.state as {
      message?: string
      dashboardFilters?: Partial<NotificationFilterState>
    } | null

    if (navigationState?.dashboardFilters) {
      const nextFilters: NotificationFilterState = {
        ...defaultFilters,
        ...navigationState.dashboardFilters,
      }

      if (nextFilters.scope !== 'campus') {
        nextFilters.campusId = ''
      }

      setFiltersForm(nextFilters)
      setQuery((previousQuery) => {
        const nextQuery = buildNotificationQueryFromFilters(
          nextFilters,
          previousQuery.limit || DEFAULT_NOTIFICATION_PAGE_SIZE,
          {
            isSuperAdmin,
          }
        )

        return areNotificationQueriesEqual(previousQuery, nextQuery)
          ? previousQuery
          : nextQuery
      })
    }

    if (navigationState?.message) {
      setSuccess(navigationState.message)
    }

    if (navigationState?.message || navigationState?.dashboardFilters) {
      navigate(location.pathname, { replace: true, state: null })
    }
  }, [defaultFilters, isSuperAdmin, location.pathname, location.state, navigate])

  useEffect(() => {
    if (!viewingNotification) {
      return
    }

    const nextNotification = items.find((item) => item.id === viewingNotification.id)
    if (!nextNotification) {
      setViewingNotification(null)
      return
    }

    setViewingNotification(nextNotification)
  }, [items, viewingNotification])

  function clearPendingFilterApply() {
    if (filterApplyTimeoutRef.current === null) {
      return
    }

    window.clearTimeout(filterApplyTimeoutRef.current)
    filterApplyTimeoutRef.current = null
  }

  function scheduleFilterApply(
    nextFilters: NotificationFilterState,
    mode: 'debounced' | 'immediate'
  ) {
    const applyFilters = () => {
      setQuery((previousQuery) => {
        const nextQuery = buildNotificationQueryFromFilters(
          nextFilters,
          previousQuery.limit || DEFAULT_NOTIFICATION_PAGE_SIZE,
          {
            isSuperAdmin,
          }
        )

        return areNotificationQueriesEqual(previousQuery, nextQuery)
          ? previousQuery
          : nextQuery
      })
    }

    clearPendingFilterApply()

    if (mode === 'debounced') {
      filterApplyTimeoutRef.current = window.setTimeout(() => {
        applyFilters()
        filterApplyTimeoutRef.current = null
      }, LIST_FILTER_DEBOUNCE_MS)
      return
    }

    applyFilters()
  }

  function handleFilterFieldChange(
    name: keyof NotificationFilterState,
    value: string,
    mode: 'debounced' | 'immediate'
  ) {
    setFiltersForm((previousFilters) => {
      const parsedValue = (() => {
        if (name === 'campusId') {
          return value === '' ? '' : Number(value)
        }

        return value
      })()

      const nextFilters: NotificationFilterState = {
        ...previousFilters,
        [name]: parsedValue,
      }

      if (name === 'scope' && value !== 'campus') {
        nextFilters.campusId = ''
      }

      scheduleFilterApply(nextFilters, mode)
      return nextFilters
    })
  }

  function handleClearFilters() {
    clearPendingFilterApply()
    setFiltersForm(defaultFilters)
    setQuery((previousQuery) => {
      const nextQuery = buildNotificationQueryFromFilters(
        defaultFilters,
        previousQuery.limit || DEFAULT_NOTIFICATION_PAGE_SIZE,
        {
          isSuperAdmin,
        }
      )

      return areNotificationQueriesEqual(previousQuery, nextQuery)
        ? previousQuery
        : nextQuery
    })
  }

  function handlePageChange(page: number) {
    setQuery((prev) => ({
      ...prev,
      page,
    }))
  }

  function handlePageSizeChange(limit: number) {
    setQuery((prev) => ({
      ...prev,
      limit,
      page: 1,
    }))
  }

  function handleOpenCreateModal() {
    setError('')
    setSuccess('')
    setServerErrors({})
    setEditingNotification(null)
    setModalMode('create')
  }

  function handleOpenEditModal(notification: Notification) {
    if (!canManageNotification(notification, isSuperAdmin, scopedCampusId)) {
      setError(getNotificationReadOnlyReason(notification, isSuperAdmin, scopedCampusId))
      return
    }

    setError('')
    setSuccess('')
    setServerErrors({})
    setEditingNotification(notification)
    setModalMode('edit')
  }

  function handleOpenViewDrawer(notification: Notification) {
    setError('')
    setSuccess('')
    setViewingNotification(notification)
  }

  function handleCloseViewDrawer() {
    setViewingNotification(null)
  }

  function handleEditFromDrawer(notification: Notification) {
    setViewingNotification(null)
    handleOpenEditModal(notification)
  }

  function handleDeleteClick(notification: Notification) {
    if (!canManageNotification(notification, isSuperAdmin, scopedCampusId)) {
      setError(getNotificationReadOnlyReason(notification, isSuperAdmin, scopedCampusId))
      return
    }

    setConfirmState({
      type: 'delete',
      notification,
    })
  }

  function handleToggleStatusClick(notification: Notification) {
    if (!canManageNotification(notification, isSuperAdmin, scopedCampusId)) {
      setError(getNotificationReadOnlyReason(notification, isSuperAdmin, scopedCampusId))
      return
    }

    const nextStatus: NotificationLifecycleStatus =
      notification.status === 'active' ? 'inactive' : 'active'

    setConfirmState({
      type: 'status',
      notification,
      nextStatus,
    })
  }

  function handleCloseModal() {
    if (submitLoading) return

    setModalMode(null)
    setEditingNotification(null)
    setServerErrors({})
  }

  async function handleModalSubmit(values: NotificationFormValues) {
    if (
      modalMode === 'edit'
      && editingNotification
      && !canManageNotification(editingNotification, isSuperAdmin, scopedCampusId)
    ) {
      setError(getNotificationReadOnlyReason(editingNotification, isSuperAdmin, scopedCampusId))
      return
    }

    setSubmitLoading(true)
    setError('')
    setSuccess('')
    setServerErrors({})

    try {
      if (modalMode === 'edit' && editingNotification) {
        await notificationService.updateNotification(
          editingNotification.id,
          values,
          {
            role: user?.role ?? "Admin",
            campusId: user?.campusId ?? null,
          }
        )
        setSuccess('Notificación actualizada correctamente')
      } else {
        await notificationService.createNotification(
          values,
          user?.id ?? 1,
          {
            role: user?.role ?? "Admin",
            campusId: user?.campusId ?? null,
          }
        )
        setSuccess('Notificación registrada correctamente')
      }

      setModalMode(null)
      setEditingNotification(null)
      setServerErrors({})
      await loadNotifications(query)
    } catch (err) {
      const nextFieldErrors = getNotificationFieldErrors(err)
      setServerErrors(nextFieldErrors)

      if (Object.keys(nextFieldErrors).length === 0) {
        setError(getErrorMessage(err, 'No se pudo guardar la notificación'))
      }
    } finally {
      setSubmitLoading(false)
    }
  }

  async function handleConfirmAction() {
    if (!confirmState) return
    if (!canManageNotification(confirmState.notification, isSuperAdmin, scopedCampusId)) {
      setError(
        getNotificationReadOnlyReason(confirmState.notification, isSuperAdmin, scopedCampusId)
      )
      setConfirmState(null)
      return
    }

    setActionLoading(true)
    setError('')
    setSuccess('')

    try {
      if (confirmState.type === 'delete') {
        await notificationService.deleteNotification(confirmState.notification.id)
        setSuccess('Notificación eliminada correctamente')
      } else {
        await notificationService.changeNotificationStatus(
          confirmState.notification.id,
          confirmState.nextStatus
        )

        setSuccess(
          confirmState.nextStatus === 'active'
            ? 'Notificación activada correctamente'
            : 'Notificación desactivada correctamente'
        )
      }

      setConfirmState(null)
      await loadNotifications(query)
    } catch (err) {
      setError(getErrorMessage(err, 'No se pudo completar la acción'))
    } finally {
      setActionLoading(false)
    }
  }

  return (
    <main className="min-h-screen bg-(--color-bg) px-4 py-6 sm:px-6 lg:px-10">
      <div className="mx-auto flex w-full max-w-none flex-col gap-4">
        {success && (
          <FeedbackMessage
            type="success"
            message={success}
            onClose={() => setSuccess('')}
          />
        )}

        {error && (
          <FeedbackMessage
            type="error"
            message={error}
            onClose={() => setError('')}
          />
        )}

        <section className="space-y-4">
          <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-1">
              <h1 className="text-2xl font-bold tracking-tight text-(--color-text-main)">
                Gestión de Notificaciones
              </h1>
              <p className="text-xs text-(--color-text-secondary) sm:text-xs">
                Gestiona y programa notificaciones para los tótems
              </p>
            </div>

            <button
              type="button"
              onClick={handleOpenCreateModal}
              className="inline-flex items-center justify-center gap-2 rounded-full bg-(--color-red-button) px-6 py-2.5 text-xs font-semibold text-white shadow-md shadow-(--color-red-button)/30 transition hover:bg-(--color-red-dark) focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--color-red-main) focus-visible:ring-offset-2"
            >
              <Plus className="h-4 w-4" />
              Nueva Notificación
            </button>
          </header>

          <div>
            <NotificationFilters
              values={filtersForm}
              campusOptions={campusOptions}
              isSuperAdmin={isSuperAdmin}
              searchOptions={searchSuggestions}
              onFieldChange={handleFilterFieldChange}
              onClear={handleClearFilters}
            />
          </div>

          <div>
            {loading ? (
              <LoadingState message="Cargando notificaciones..." />
            ) : items.length === 0 ? (
              <EmptyState
                title="No hay notificaciones"
                description="No se encontraron registros con los filtros actuales."
              />
            ) : (
              <div className="space-y-4">
                <NotificationTable
                  items={items}
                  nowMs={nowMs}
                  isSuperAdmin={isSuperAdmin}
                  scopedCampusId={scopedCampusId}
                  onView={handleOpenViewDrawer}
                  onEdit={handleOpenEditModal}
                  onToggleStatus={handleToggleStatusClick}
                  onDelete={handleDeleteClick}
                />

                <Pagination
                  currentPage={meta.currentPage}
                  totalPages={meta.totalPages}
                  totalItems={meta.totalItems}
                  pageSize={meta.pageSize}
                  onPageChange={handlePageChange}
                  onPageSizeChange={handlePageSizeChange}
                />
              </div>
            )}
          </div>
        </section>

        <ConfirmDialog
          isOpen={Boolean(confirmState)}
          title={
            confirmState?.type === 'delete'
              ? 'Confirmar eliminación'
              : 'Confirmar cambio de estado'
          }
          message={
            confirmState?.type === 'delete'
              ? `¿Deseas eliminar la notificación "${confirmState.notification.title}"?`
              : `¿Deseas ${confirmState?.nextStatus === 'active' ? 'activar' : 'desactivar'} la notificación "${confirmState?.notification.title}"?`
          }
          confirmLabel={
            confirmState?.type === 'delete'
              ? 'Sí, eliminar'
              : confirmState?.nextStatus === 'active'
                ? 'Sí, activar'
                : 'Sí, desactivar'
          }
          loading={actionLoading}
          onCancel={() => setConfirmState(null)}
          onConfirm={handleConfirmAction}
        />

        <FormModal
          isOpen={modalMode === 'create' || modalMode === 'edit'}
          title={modalMode === 'edit' ? 'Editar Notificación' : 'Crear Notificación'}
          description="Completa la información para programar el mensaje."
          onClose={handleCloseModal}
          maxWidthClassName="max-w-5xl"
          disableClose={submitLoading}
        >
          <NotificationForm
            key={editingNotification?.id ?? 'create-notification'}
            mode={modalMode === 'edit' ? 'edit' : 'create'}
            initialValues={
              editingNotification
                ? mapNotificationToFormValues(editingNotification)
                : defaultCreateFormValues
            }
            submitLabel={modalMode === 'edit' ? 'Guardar Cambios' : 'Crear Notificación'}
            submitting={submitLoading}
            remainingTimeLabel={
              editingNotification
                ? resolveNotificationRemainingInfo(editingNotification, nowMs, 'list').label
                : undefined
            }
            isSuperAdmin={isSuperAdmin}
            lockedCampusId={scopedCampusId}
            lockedCampusName={user?.campus?.name ?? null}
            campusOptions={campusOptions}
            totemOptions={editModeInitialTotemOptions}
            serverErrors={serverErrors}
            onSubmit={handleModalSubmit}
          />
        </FormModal>

        <NotificationDetailPanel
          isOpen={Boolean(viewingNotification)}
          notification={viewingNotification}
          nowMs={nowMs}
          onClose={handleCloseViewDrawer}
          onEdit={
            viewingNotification
              && canManageNotification(viewingNotification, isSuperAdmin, scopedCampusId)
              ? handleEditFromDrawer
              : undefined
          }
          readOnlyMessage={
            viewingNotification
              ? getNotificationReadOnlyReason(viewingNotification, isSuperAdmin, scopedCampusId)
              : ''
          }
        />
      </div>
    </main>
  )
}
