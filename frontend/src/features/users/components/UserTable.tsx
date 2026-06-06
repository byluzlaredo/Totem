import { Eye, Pencil, Power, Send, Trash2 } from "lucide-react";
import RowActionsMenu, {
  type RowActionMenuItem,
} from "../../../components/RowActionsMenu";
import TruncatedText from "../../../components/TruncatedText";
import type { User } from "../../../types/user";

interface UserTableProps {
  items: User[];
  onView: (user: User) => void;
  onEdit: (user: User) => void;
  onDelete: (user: User) => void;
  onToggleStatus: (user: User) => void;
  onResendInvitation: (user: User) => void;
  currentUserId?: number | null;
  isCurrentUserSuperAdmin?: boolean;
}

const HEADER_CELL_CLASS =
  "px-4 py-3 text-left text-xs font-bold tracking-[0.08em] text-[var(--color-text-secondary)] sm:px-6";

const BODY_CELL_CLASS =
  "px-4 py-1 text-xs text-[var(--color-text-main)] sm:px-6";

function formatDateTime(value: string | null) {
  if (!value) return "Sin registro";

  const parsedDate = new Date(value);

  if (Number.isNaN(parsedDate.getTime())) {
    return value;
  }

  return parsedDate.toLocaleString("es-BO", {
    dateStyle: "short",
    timeStyle: "short",
  });
}

function getRoleBadgeClass(role: User["role"]) {
  if (role === "SuperAdmin") return "bg-[#fcebd7] text-[#a86418]";

  return "bg-[#d9e8ff] text-[#1f5dbd]";
}

function getRoleLabel(role: User["role"]) {
  return role === "SuperAdmin" ? "Super Admin" : "Admin";
}

function getStatusBadgeClass(status: User["status"]) {
  if (status === "active") return "bg-[#c9eed8] text-[#0f7a3a]";
  if (status === "invited") return "bg-[#fff1db] text-[#9b5d11]";
  return "bg-[#ececef] text-[#5e6470]";
}

function getStatusLabel(status: User["status"]) {
  if (status === "active") return "Activo";
  if (status === "invited") return "Invitado";
  return "Inactivo";
}

export default function UserTable({
  items,
  onView,
  onEdit,
  onDelete,
  onToggleStatus,
  onResendInvitation,
  currentUserId = null,
  isCurrentUserSuperAdmin = false,
}: UserTableProps) {
  return (
    <div className="overflow-hidden rounded-2xl border border-(--color-border)">
      <div className="overflow-x-auto">
        <table className="min-w-299 w-full table-fixed border-separate border-spacing-0 bg-white">
          <thead className="bg-[#f6f6f7]">
            <tr>
              <th className={`${HEADER_CELL_CLASS} w-[20%]`}>Nombre</th>
              <th className={`${HEADER_CELL_CLASS} w-[20%]`}>Correo</th>
              <th className={HEADER_CELL_CLASS}>Rol</th>
              <th className={HEADER_CELL_CLASS}>Estado</th>
              <th className={HEADER_CELL_CLASS}>Campus</th>
              <th className={HEADER_CELL_CLASS}>Último Acceso</th>
              <th className={`${HEADER_CELL_CLASS} w-28`}>Acciones</th>
            </tr>
          </thead>

          <tbody>
            {items.map((user) => {
              const isProtectedSuperAdminSelf =
                isCurrentUserSuperAdmin && currentUserId === user.id;

              return (
                <tr
                  key={user.id}
                  onClick={() => onView(user)}
                  className="cursor-pointer transition hover:bg-[#fcfcfc] [&:not(:last-child)>td]:border-b [&:not(:last-child)>td]:border-(--color-border)"
                >
                  <td className={`${BODY_CELL_CLASS} w-[22%]`}>
                    <TruncatedText
                      as="p"
                      value={user.name}
                      className="font-medium text-(--color-text-main)"
                    />
                  </td>
                  <td className={`${BODY_CELL_CLASS} w-[24%]`}>
                    <TruncatedText
                      as="p"
                      value={user.email}
                      className="text-(--color-text-secondary)"
                    />
                  </td>
                  <td className={BODY_CELL_CLASS}>
                    <span
                      className={`inline-flex min-w-24 items-center justify-center rounded-full px-3 py-1 text-xs font-semibold ${getRoleBadgeClass(
                        user.role,
                      )}`}
                    >
                      {getRoleLabel(user.role)}
                    </span>
                  </td>
                  <td className={BODY_CELL_CLASS}>
                    <span
                      className={`inline-flex min-w-20 items-center justify-center rounded-full px-3 py-1 text-xs font-semibold ${getStatusBadgeClass(
                        user.status
                      )}`}
                    >
                      {getStatusLabel(user.status)}
                    </span>
                  </td>
                  <td className={`${BODY_CELL_CLASS} text-(--color-text-secondary)`}>
                    {user.campus?.name ?? "Sin campus"}
                  </td>
                  <td className={`${BODY_CELL_CLASS} text-(--color-text-secondary)`}>
                    {formatDateTime(user.lastLoginAt)}
                  </td>
                  <td className={BODY_CELL_CLASS}>
                    <div onClick={(event) => event.stopPropagation()}>
                      <RowActionsMenu
                        triggerLabel="Acciones"
                        actions={(() => {
                          const toggleLabel = user.status === "active"
                            ? "Desactivar"
                            : user.status === "invited"
                              ? "Desactivar invitación"
                              : "Activar";
                          const toggleTone = user.status === "inactive"
                            ? "success"
                            : "warning";

                          const userActions: RowActionMenuItem[] = [
                            {
                              key: "view",
                              label: "Ver detalle",
                              title: `Ver detalle de ${user.name}`,
                              icon: <Eye className="h-4 w-4" />,
                              onSelect: () => onView(user),
                            },
                            {
                              key: "edit",
                              label: "Editar",
                              title: isProtectedSuperAdminSelf
                                ? "No puedes editar tu propio usuario superadmin"
                                : "Editar",
                              icon: <Pencil className="h-4 w-4" />,
                              disabled: isProtectedSuperAdminSelf,
                              onSelect: () => onEdit(user),
                            },
                          ];

                          if (user.status === "invited") {
                            userActions.push({
                              key: "resend",
                              label: "Reenviar invitación",
                              title: isProtectedSuperAdminSelf
                                ? "No puedes reenviarte invitaciones siendo superadmin"
                                : "Reenviar invitación",
                              icon: <Send className="h-4 w-4" />,
                              tone: "accent",
                              disabled: isProtectedSuperAdminSelf,
                              onSelect: () => onResendInvitation(user),
                            });
                          }

                          userActions.push(
                            {
                              key: "toggle-status",
                              label: toggleLabel,
                              title: isProtectedSuperAdminSelf
                                ? "No puedes cambiar tu propio estado siendo superadmin"
                                : toggleLabel,
                              icon: <Power className="h-4 w-4" />,
                              tone: toggleTone,
                              disabled: isProtectedSuperAdminSelf,
                              onSelect: () => onToggleStatus(user),
                            },
                            {
                              key: "delete",
                              label: "Eliminar",
                              title: isProtectedSuperAdminSelf
                                ? "No puedes eliminar tu propio usuario superadmin"
                                : "Eliminar",
                              icon: <Trash2 className="h-4 w-4" />,
                              tone: "danger",
                              disabled: isProtectedSuperAdminSelf,
                              onSelect: () => onDelete(user),
                            },
                          );

                          return userActions;
                        })()}
                      />
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
