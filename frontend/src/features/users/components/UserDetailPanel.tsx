import {
  Building2,
  CalendarDays,
  Clock3,
  Mail,
  Pencil,
  ShieldCheck,
  UserRound,
  Send,
} from "lucide-react";
import SafeText from "../../../components/SafeText";
import type { User } from "../../../types/user";

interface UserDetailPanelProps {
  user: User;
  onEdit?: () => void;
  onResendInvitation?: () => void;
  canEdit?: boolean;
  editDisabledReason?: string;
  canResendInvitation?: boolean;
  resendDisabledReason?: string;
}

const DETAIL_ITEM_CLASS =
  "flex items-start gap-3 rounded-2xl border border-[var(--color-border)] bg-white p-4 py-2 [&>div]:min-w-0";

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

export default function UserDetailPanel({
  user,
  onEdit,
  onResendInvitation,
  canEdit = true,
  editDisabledReason = "No disponible",
  canResendInvitation = true,
  resendDisabledReason = "No disponible",
}: UserDetailPanelProps) {
  const editButtonTitle = canEdit ? "Editar" : editDisabledReason;
  const resendButtonTitle = canResendInvitation
    ? "Reenviar invitación"
    : resendDisabledReason;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-2">
        <div className="rounded-full bg-[#f8dbe3] px-4 py-0.5 text-xs font-bold tracking-[0.08em] text-(--color-red-main)">
          Usuario
        </div>
        <h3
          className="max-w-full truncate text-lg font-bold text-(--color-text-main)"
          title={user.name}
        >
          {user.name}
        </h3>
        <span
          className={`mt-1 inline-flex rounded-full px-3 py-0.5 text-xs font-semibold ${getStatusBadgeClass(
            user.status
          )}`}
        >
          {getStatusLabel(user.status)}
        </span>

        <div className="ml-auto flex items-center gap-2">
          {onResendInvitation && user.status === "invited" && (
            <button
              type="button"
              onClick={canResendInvitation ? onResendInvitation : undefined}
              disabled={!canResendInvitation}
              className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-semibold transition ${canResendInvitation
                ? "bg-[#3b82f6] text-white shadow-md shadow-[#3b82f6]/30 hover:bg-[#2563eb]"
                : "cursor-not-allowed border border-(--color-border) bg-[#f3f4f6] text-(--color-text-secondary)"
                }`}
              title={resendButtonTitle}
              aria-label="Reenviar invitación"
            >
              <Send className="h-4 w-4" />
              Reenviar invitación
            </button>
          )}

          {onEdit && (
            <button
              type="button"
              onClick={canEdit ? onEdit : undefined}
              disabled={!canEdit}
              className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-semibold transition ${canEdit
                ? "bg-(--color-red-button) text-white shadow-md shadow-(--color-red-button)/30 hover:bg-(--color-red-dark)"
                : "cursor-not-allowed border border-(--color-border) bg-[#f3f4f6] text-(--color-text-secondary)"
                }`}
              title={editButtonTitle}
              aria-label="Editar usuario"
            >
              <Pencil className="h-4 w-4" />
              Editar
            </button>
          )}
        </div>
      </div>

      <section className="rounded-2xl border border-(--color-border) bg-white p-4">
        <h4 className="text-sm font-bold text-(--color-text-main)">
          Información del usuario
        </h4>

        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <article className={`${DETAIL_ITEM_CLASS} sm:col-span-2`}>
            <UserRound className="mt-0.5 h-5 w-5 text-(--color-text-secondary)" />
            <div>
              <p className="text-xs font-semibold tracking-[0.08em] text-(--color-text-secondary)">
                Nombre
              </p>
              <SafeText
                value={user.name}
                className="text-xs font-medium text-(--color-text-main)"
              />
            </div>
          </article>

          <article className={`${DETAIL_ITEM_CLASS} sm:col-span-2`}>
            <Mail className="mt-0.5 h-5 w-5 text-(--color-text-secondary)" />
            <div>
              <p className="text-xs font-semibold tracking-[0.08em] text-(--color-text-secondary)">
                Correo
              </p>
              <SafeText
                value={user.email}
                className="text-xs font-medium text-(--color-text-main)"
              />
            </div>
          </article>

          <article className={DETAIL_ITEM_CLASS}>
            <ShieldCheck className="mt-0.5 h-5 w-5 text-(--color-text-secondary)" />
            <div>
              <p className="text-xs font-semibold tracking-[0.08em] text-(--color-text-secondary)">
                Rol
              </p>
              <span
                className={`mt-1 inline-flex rounded-full px-3 py-0.5 text-xs font-semibold ${getRoleBadgeClass(
                  user.role,
                )}`}
              >
                {getRoleLabel(user.role)}
              </span>
            </div>
          </article>

          <article className={DETAIL_ITEM_CLASS}>
            <Building2 className="mt-0.5 h-5 w-5 text-(--color-text-secondary)" />
            <div>
              <p className="text-xs font-semibold tracking-[0.08em] text-(--color-text-secondary)">
                Campus
              </p>
              <p className="text-xs font-medium text-(--color-text-main)">
                {user.campus?.name ?? "Sin campus"}
              </p>
            </div>
          </article>

          <article className={DETAIL_ITEM_CLASS}>
            <Clock3 className="mt-0.5 h-5 w-5 text-(--color-text-secondary)" />
            <div>
              <p className="text-xs font-semibold tracking-[0.08em] text-(--color-text-secondary)">
                Último acceso
              </p>
              <p className="text-xs font-medium text-(--color-text-main)">
                {formatDateTime(user.lastLoginAt)}
              </p>
            </div>
          </article>

          <article className={DETAIL_ITEM_CLASS}>
            <CalendarDays className="mt-0.5 h-5 w-5 text-(--color-text-secondary)" />
            <div>
              <p className="text-xs font-semibold tracking-[0.08em] text-(--color-text-secondary)">
                Creado en
              </p>
              <p className="text-xs font-medium text-(--color-text-main)">
                {formatDateTime(user.createdAt)}
              </p>
            </div>
          </article>

          <article className={`${DETAIL_ITEM_CLASS} sm:col-span-2`}>
            <CalendarDays className="mt-0.5 h-5 w-5 text-(--color-text-secondary)" />
            <div>
              <p className="text-xs font-semibold tracking-[0.08em] text-(--color-text-secondary)">
                Actualizado en
              </p>
              <p className="text-xs font-medium text-(--color-text-main)">
                {formatDateTime(user.updatedAt)}
              </p>
            </div>
          </article>
        </div>
      </section>
    </div>
  );
}
