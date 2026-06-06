import { Eye, Pencil, Power, Trash2 } from 'lucide-react'
import RowActionsMenu from '../../../components/RowActionsMenu'
import TruncatedText from '../../../components/TruncatedText'
import type { Notification } from '../../../types/notification'
import { resolveNotificationRemainingInfo } from '../utils/notificationTime'
import {
  canManageNotification,
  getNotificationReadOnlyReason,
} from '../utils/notificationPermissions'

interface NotificationTableProps {
  items: Notification[]
  nowMs: number
  isSuperAdmin: boolean
  scopedCampusId: number | null
  onView: (notification: Notification) => void
  onEdit: (notification: Notification) => void
  onToggleStatus: (notification: Notification) => void
  onDelete: (notification: Notification) => void
}

const HEADER_CELL_CLASS =
  'px-4 py-3 text-left text-xs font-bold tracking-[0.08em] text-(--color-text-secondary) sm:px-6'

const BODY_CELL_CLASS =
  'px-4 py-1 text-xs text-(--color-text-main) sm:px-6'

function formatDateTime(value: string | null) {
  if (!value) return 'Sin registro'

  const parsedDate = new Date(value)
  if (Number.isNaN(parsedDate.getTime())) return value

  return parsedDate.toLocaleString('es-BO', {
    dateStyle: 'short',
    timeStyle: 'short',
  })
}

function mapTypeLabel(type: Notification['type']) {
  if (type === 'urgent') return 'Urgente'
  return 'Normal'
}

function mapScopeLabel(notification: Notification) {
  if (notification.targetScope === 'all') {
    return 'Todos los tótems'
  }

  if (notification.targetScope === 'campus') {
    return notification.targetCampus?.name ?? 'Campus no definido'
  }

  if (notification.targetTotems.length === 0) {
    return `${notification.targetTotemIds.length} tótems seleccionados`
  }

  if (notification.targetTotems.length <= 2) {
    return notification.targetTotems.map((totem) => totem.name).join(', ')
  }

  const firstTwo = notification.targetTotems.slice(0, 2).map((totem) => totem.name).join(', ')
  return `${firstTwo} +${notification.targetTotems.length - 2}`
}

function getStatusBadgeClass(status: Notification["status"]) {
  if (status === "active") return "bg-[#c9eed8] text-[#0f7a3a]"
  return "bg-[#ececef] text-[#5e6470]"
}

function getStatusBadgeLabel(status: Notification["status"]) {
  if (status === "active") return "Activo"
  return "Inactivo"
}

export default function NotificationTable({
  items,
  nowMs,
  isSuperAdmin,
  scopedCampusId,
  onView,
  onEdit,
  onToggleStatus,
  onDelete,
}: NotificationTableProps) {
  return (
    <div className="overflow-hidden rounded-2xl border border-(--color-border)">
      <div className="overflow-x-auto">
        <table className="min-w-299 w-full table-fixed border-separate border-spacing-0 bg-white">
          <thead className="bg-[#f6f6f7]">
            <tr>
              <th className={`${HEADER_CELL_CLASS} w-[25%]`}>Título</th>
              <th className={`${HEADER_CELL_CLASS} w-[8%]`}>Tipo</th>
              <th className={`${HEADER_CELL_CLASS} w-[10%]`}>Estado</th>
              <th className={`${HEADER_CELL_CLASS} w-[20%]`}>Destino</th>
              <th className={`${HEADER_CELL_CLASS} w-[15%]`}>Inicio</th>
              <th className={`${HEADER_CELL_CLASS} w-[15%]`}>Tiempo restante</th>
              <th className={`${HEADER_CELL_CLASS} w-28`}>Acciones</th>
            </tr>
          </thead>

          <tbody>
            {items.map((notification) => {
              const remainingInfo = resolveNotificationRemainingInfo(
                notification,
                nowMs,
                "list",
              )
              const canManage = canManageNotification(notification, isSuperAdmin, scopedCampusId)
              const readOnlyReason = getNotificationReadOnlyReason(
                notification,
                isSuperAdmin,
                scopedCampusId
              )

              return (
                <tr
                  key={notification.id}
                  onClick={() => onView(notification)}
                  className="cursor-pointer transition hover:bg-[#fcfcfc] [&:not(:last-child)>td]:border-b [&:not(:last-child)>td]:border-(--color-border)"
                >
                  <td className={`${BODY_CELL_CLASS} w-[30%]`}>
                    <TruncatedText
                      as="p"
                      value={notification.title}
                      className="font-semibold text-(--color-text-main)"
                    />
                    <TruncatedText
                      as="p"
                      value={notification.message}
                      className="mt-1 text-xs text-(--color-text-secondary)"
                    />
                  </td>

                  <td className={`${BODY_CELL_CLASS} text-(--color-text-secondary)`}>
                    {mapTypeLabel(notification.type)}
                  </td>

                  <td className={BODY_CELL_CLASS}>
                    <span
                      className={`inline-flex min-w-20 items-center justify-center rounded-full px-3 py-1 text-xs font-semibold ${getStatusBadgeClass(
                        notification.status,
                      )}`}
                    >
                      {getStatusBadgeLabel(notification.status)}
                    </span>
                  </td>

                  <td className={`${BODY_CELL_CLASS} w-[18%] text-(--color-text-secondary)`}>
                    <TruncatedText
                      as="p"
                      value={
                        notification.targetScope === 'all' && !isSuperAdmin
                          ? `${mapScopeLabel(notification)} (Global)`
                          : mapScopeLabel(notification)
                      }
                    />
                  </td>

                  <td className={`${BODY_CELL_CLASS} text-(--color-text-secondary)`}>
                    {formatDateTime(notification.startAt)}
                  </td>

                  <td className={`${BODY_CELL_CLASS} text-(--color-text-secondary)`}>
                    {remainingInfo.label}
                  </td>

                  <td className={BODY_CELL_CLASS}>
                    <div onClick={(event) => event.stopPropagation()}>
                      <RowActionsMenu
                        triggerLabel="Acciones"
                        actions={[
                          {
                            key: "view",
                            label: "Ver detalle",
                            title: "Ver detalle de notificación",
                            icon: <Eye className="h-4 w-4" />,
                            onSelect: () => onView(notification),
                          },
                          {
                            key: "edit",
                            label: "Editar",
                            title: canManage ? "Editar notificación" : readOnlyReason,
                            icon: <Pencil className="h-4 w-4" />,
                            disabled: !canManage,
                            onSelect: () => onEdit(notification),
                          },
                          {
                            key: "toggle-status",
                            label: notification.status === "active"
                              ? "Desactivar"
                              : "Activar",
                            title: canManage
                              ? (
                                notification.status === "active"
                                  ? "Desactivar notificación"
                                  : "Activar notificación"
                              )
                              : readOnlyReason,
                            icon: <Power className="h-4 w-4" />,
                            disabled: !canManage,
                            tone: notification.status === "active" ? "warning" : "success",
                            onSelect: () => onToggleStatus(notification),
                          },
                          {
                            key: "delete",
                            label: "Eliminar",
                            title: canManage ? "Eliminar notificación" : readOnlyReason,
                            icon: <Trash2 className="h-4 w-4" />,
                            disabled: !canManage,
                            tone: "danger",
                            onSelect: () => onDelete(notification),
                          },
                        ]}
                      />
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
