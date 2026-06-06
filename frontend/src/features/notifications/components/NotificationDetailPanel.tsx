import {
  AlarmClock,
  Building2,
  CalendarClock,
  CalendarDays,
  CirclePower,
  Clock3,
  MapPin,
  MonitorSmartphone,
  Pencil,
  Send,
  ShieldAlert,
  Tags,
  Text,
} from 'lucide-react'
import SafeText from '../../../components/SafeText'
import SideDrawer from '../../../components/SideDrawer'
import type { Notification } from '../../../types/notification'
import { resolveNotificationRemainingInfo } from '../utils/notificationTime'

interface NotificationDetailPanelProps {
  isOpen: boolean
  notification: Notification | null
  nowMs: number
  onClose: () => void
  onEdit?: (notification: Notification) => void
  readOnlyMessage?: string
}

const DETAIL_ITEM_CLASS =
  'flex items-start gap-3 rounded-2xl border border-[var(--color-border)] bg-white p-4 py-2 [&>div]:min-w-0'

function formatDateTime(value: string | null, fallback = 'Sin registro') {
  if (!value) return fallback

  const parsedDate = new Date(value)

  if (Number.isNaN(parsedDate.getTime())) {
    return value
  }

  return parsedDate.toLocaleString('es-BO', {
    dateStyle: 'short',
    timeStyle: 'short',
  })
}

function formatDuration(durationMinutes: number) {
  const normalized = Math.max(1, Math.floor(durationMinutes))

  if (normalized % (24 * 60) === 0) {
    const days = normalized / (24 * 60)
    return `${days} ${days === 1 ? 'día' : 'días'}`
  }

  if (normalized % 60 === 0) {
    const hours = normalized / 60
    return `${hours} hora${hours === 1 ? '' : 's'}`
  }

  return `${normalized} minuto${normalized === 1 ? '' : 's'}`
}

function mapTypeLabel(type: Notification['type']) {
  if (type === 'urgent') return 'Urgente'
  return 'Normal'
}

function mapStatusLabel(status: Notification['status']) {
  if (status === 'active') return 'Activa'
  return 'Inactiva'
}

function getStatusBadgeClass(status: Notification['status']) {
  if (status === 'active') return 'bg-[#c9eed8] text-[#0f7a3a]'
  return 'bg-[#ececef] text-[#5e6470]'
}

function mapScopeLabel(scope: Notification['targetScope']) {
  if (scope === 'all') return 'Todos los tótems'
  if (scope === 'campus') return 'Por campus'
  return 'Tótems específicos'
}

function getTargetTotemsCount(notification: Notification) {
  if (notification.targetScope !== 'totems') {
    return 0
  }

  if (notification.targetTotems.length > 0) {
    return notification.targetTotems.length
  }

  return notification.targetTotemIds.length
}

function renderTargetTotems(notification: Notification) {
  if (notification.targetScope === 'all') {
    return (
      <p className="text-xs font-medium text-(--color-text-main)">
        Se muestra en todos los tótems activos.
      </p>
    )
  }

  if (notification.targetScope === 'campus') {
    return (
      <p className="text-xs font-medium text-(--color-text-main)">
        Se muestra en los tótems del campus seleccionado.
      </p>
    )
  }

  if (notification.targetTotems.length > 0) {
    return (
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {notification.targetTotems.map((totem) => (
          <article
            key={totem.id}
            className="min-w-0 rounded-xl border border-(--color-border) bg-[#f8f9fb] px-3 py-2.5"
          >
            <div className="flex min-w-0 items-start gap-1.5 text-sm font-semibold text-(--color-text-main)">
              <MonitorSmartphone className="h-4 w-4 shrink-0 text-(--color-text-secondary)" />
              <SafeText
                as="p"
                value={`${totem.code} - ${totem.name}`}
                className="min-w-0 text-xs"
              />
            </div>
            <div className="mt-1.5 flex min-w-0 items-start gap-1.5 text-xs text-(--color-text-secondary)">
              <Building2 className="h-4 w-4 shrink-0 text-(--color-text-secondary)" />
              <SafeText
                as="p"
                value={totem.campusName?.trim() || 'Departamento no disponible'}
                className="min-w-0"
              />
            </div>
          </article>
        ))}
      </div>
    )
  }

  if (notification.targetTotemIds.length > 0) {
    return (
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {notification.targetTotemIds.map((totemId) => (
          <article
            key={totemId}
            className="min-w-0 rounded-xl border border-(--color-border) bg-[#f8f9fb] px-3 py-2.5"
          >
            <div className="flex min-w-0 items-start gap-1.5 text-xs font-semibold text-(--color-text-main)">
              <MonitorSmartphone className="h-4 w-4 shrink-0 text-(--color-text-secondary)" />
              <SafeText as="p" value={`Tótem #${totemId} - N/D`} className="min-w-0" />
            </div>
            <div className="mt-1.5 flex min-w-0 items-start gap-1.5 text-xs text-(--color-text-secondary)">
              <Building2 className="h-4 w-4 shrink-0 text-(--color-text-secondary)" />
              <SafeText as="p" value="Departamento no disponible" className="min-w-0" />
            </div>
          </article>
        ))}
      </div>
    )
  }

  return <p className="text-xs font-medium text-(--color-text-main)">Sin tótems definidos.</p>
}

export default function NotificationDetailPanel({
  isOpen,
  notification,
  nowMs,
  onClose,
  onEdit,
  readOnlyMessage,
}: NotificationDetailPanelProps) {
  if (!isOpen || !notification) {
    return null
  }

  const remainingInfo = resolveNotificationRemainingInfo(
    notification,
    nowMs,
    'list'
  )

  return (
    <SideDrawer
      isOpen={isOpen}
      title="Detalle de Notificación"
      description="Revisa toda la información de la notificación seleccionada."
      onClose={onClose}
      widthClassName="max-w-4xl"
    >
      <div className="space-y-5">
        {readOnlyMessage && (
          <div className="rounded-2xl border border-[#f0d8b3] bg-[#fff8ea] px-4 py-2 text-xs font-medium text-[#8b5a0a]">
            {readOnlyMessage}
          </div>
        )}

        <div className="flex flex-wrap items-center gap-2">
          <div className="rounded-full bg-[#f8dbe3] px-4 py-0.5 text-xs font-bold tracking-[0.08em] text-(--color-red-main)">
            Notificación
          </div>
          <h3
            className="max-w-full truncate text-lg font-bold text-(--color-text-main)"
            title={notification.title}
          >
            {notification.title}
          </h3>
          <span
            className={`mt-1 inline-flex rounded-full px-3 py-0.5 text-xs font-semibold ${getStatusBadgeClass(
              notification.status
            )}`}
          >
            {mapStatusLabel(notification.status)}
          </span>

          {onEdit && (
            <button
              type="button"
              onClick={() => onEdit(notification)}
              className="ml-auto inline-flex items-center gap-2 rounded-xl bg-(--color-red-button) px-4 py-2 text-xs font-semibold text-white shadow-md shadow-(--color-red-button)/30 transition hover:bg-(--color-red-dark)"
            >
              <Pencil className="h-4 w-4" />
              Editar
            </button>
          )}
        </div>

        <section className="rounded-2xl border border-(--color-border) bg-white p-4">
          <h4 className="text-sm font-bold text-(--color-text-main)">Información de la notificación</h4>

          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <article className={`${DETAIL_ITEM_CLASS} sm:col-span-2`}>
              <Text className="shrink-0 mt-0.5 h-5 w-5 text-(--color-text-secondary)" />
              <div>
                <p className="text-xs font-semibold tracking-[0.08em] text-(--color-text-secondary)">
                  Título
                </p>
                <SafeText
                  value={notification.title}
                  className="text-xs font-medium text-(--color-text-main)"
                />
              </div>
            </article>

            <article className={`${DETAIL_ITEM_CLASS} sm:col-span-2`}>
              <Text className="shrink-0 mt-0.5 h-5 w-5 text-(--color-text-secondary)" />
              <div>
                <p className="text-xs font-semibold tracking-[0.08em] text-(--color-text-secondary)">
                  Mensaje
                </p>
                <SafeText
                  value={notification.message}
                  className="text-xs font-medium text-(--color-text-main)"
                />
              </div>
            </article>

            <article className={DETAIL_ITEM_CLASS}>
              <Tags className="mt-0.5 h-5 w-5 text-(--color-text-secondary)" />
              <div>
                <p className="text-xs font-semibold tracking-[0.08em] text-(--color-text-secondary)">
                  Tipo
                </p>
                <p className="text-xs font-medium text-(--color-text-main)">
                  {mapTypeLabel(notification.type)}
                </p>
              </div>
            </article>

            <article className={DETAIL_ITEM_CLASS}>
              <CirclePower className="mt-0.5 h-5 w-5 text-(--color-text-secondary)" />
              <div>
                <p className="text-xs font-semibold tracking-[0.08em] text-(--color-text-secondary)">
                  Estado
                </p>
                <p className="text-xs font-medium text-(--color-text-main)">
                  {mapStatusLabel(notification.status)}
                </p>
              </div>
            </article>

            <article className={DETAIL_ITEM_CLASS}>
              <Clock3 className="mt-0.5 h-5 w-5 text-(--color-text-secondary)" />
              <div>
                <p className="text-xs font-semibold tracking-[0.08em] text-(--color-text-secondary)">
                  Duración
                </p>
                <p className="text-xs font-medium text-(--color-text-main)">
                  {formatDuration(notification.durationMinutes)} ({notification.durationMinutes} min)
                </p>
              </div>
            </article>

            <article className={DETAIL_ITEM_CLASS}>
              <AlarmClock className="mt-0.5 h-5 w-5 text-(--color-text-secondary)" />
              <div>
                <p className="text-xs font-semibold tracking-[0.08em] text-(--color-text-secondary)">
                  Tiempo restante
                </p>
                <p className="text-xs font-medium text-(--color-text-main)">
                  {remainingInfo.label}
                </p>
              </div>
            </article>

            <article className={DETAIL_ITEM_CLASS}>
              <CalendarDays className="mt-0.5 h-5 w-5 text-(--color-text-secondary)" />
              <div>
                <p className="text-xs font-semibold tracking-[0.08em] text-(--color-text-secondary)">
                  Inicio
                </p>
                <p className="text-xs font-medium text-(--color-text-main)">
                  {formatDateTime(notification.startAt)}
                </p>
              </div>
            </article>

            <article className={DETAIL_ITEM_CLASS}>
              <CalendarDays className="mt-0.5 h-5 w-5 text-(--color-text-secondary)" />
              <div>
                <p className="text-xs font-semibold tracking-[0.08em] text-(--color-text-secondary)">
                  Fin
                </p>
                <p className="text-xs font-medium text-(--color-text-main)">
                  {formatDateTime(notification.endAt)}
                </p>
              </div>
            </article>

            <article className={DETAIL_ITEM_CLASS}>
              <CalendarClock className="mt-0.5 h-5 w-5 text-(--color-text-secondary)" />
              <div>
                <p className="text-xs font-semibold tracking-[0.08em] text-(--color-text-secondary)">
                  Creado en
                </p>
                <p className="text-xs font-medium text-(--color-text-main)">
                  {formatDateTime(notification.createdAt)}
                </p>
              </div>
            </article>

            <article className={DETAIL_ITEM_CLASS}>
              <CalendarClock className="mt-0.5 h-5 w-5 text-(--color-text-secondary)" />
              <div>
                <p className="text-xs font-semibold tracking-[0.08em] text-(--color-text-secondary)">
                  Actualizado en
                </p>
                <p className="text-xs font-medium text-(--color-text-main)">
                  {formatDateTime(notification.updatedAt)}
                </p>
              </div>
            </article>

            {notification.deletedAt && (
              <article className={`${DETAIL_ITEM_CLASS} sm:col-span-2`}>
                <ShieldAlert className="mt-0.5 h-5 w-5 text-(--color-red-main)" />
                <div>
                  <p className="text-xs font-semibold tracking-[0.08em] text-(--color-text-secondary)">
                    Eliminado en
                  </p>
                  <p className="text-xs font-medium text-(--color-text-main)">
                    {formatDateTime(notification.deletedAt)}
                  </p>
                </div>
              </article>
            )}
          </div>
        </section>

        <section className="rounded-2xl border border-(--color-border) bg-white p-4">
          <div className="flex items-center justify-between gap-3">
            <h4 className="text-sm font-bold text-(--color-text-main)">Destino</h4>
            {notification.targetScope === 'totems' && (
              <span className="inline-flex rounded-full bg-[#eaf2ff] px-3 py-1 text-xs font-semibold text-[#1f5dbd]">
                {getTargetTotemsCount(notification)} tótem(s)
              </span>
            )}
          </div>

          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <article className={DETAIL_ITEM_CLASS}>
              <Send className="mt-0.5 h-5 w-5 text-(--color-text-secondary)" />
              <div>
                <p className="text-xs font-semibold tracking-[0.08em] text-(--color-text-secondary)">
                  Alcance
                </p>
                <p className="text-xs font-medium text-(--color-text-main)">
                  {mapScopeLabel(notification.targetScope)}
                </p>
              </div>
            </article>

            <article className={DETAIL_ITEM_CLASS}>
              <MapPin className="mt-0.5 h-5 w-5 text-(--color-text-secondary)" />
              <div>
                <p className="text-xs font-semibold tracking-[0.08em] text-(--color-text-secondary)">
                  Campus
                </p>
                <p className="text-xs font-medium text-(--color-text-main)">
                  {notification.targetCampus?.name ?? 'No aplica'}
                </p>
              </div>
            </article>

            <article className={`${DETAIL_ITEM_CLASS} sm:col-span-2`}>
              <MonitorSmartphone className="shrink-0 mt-0.5 h-5 w-5 text-(--color-text-secondary)" />
              <div>
                <p className="text-xs font-semibold tracking-[0.08em] text-(--color-text-secondary)">
                  Tótems aplicados
                </p>
                <div className="mt-2">{renderTargetTotems(notification)}</div>
              </div>
            </article>
          </div>
        </section>
      </div>
    </SideDrawer>
  )
}
