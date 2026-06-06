import { Eye, KeyRound, Pencil, Power, Trash2 } from "lucide-react";
import RowActionsMenu from "../../../components/RowActionsMenu";
import TruncatedText from "../../../components/TruncatedText";
import type { Totem } from "../../../types/totem";

interface TotemTableProps {
  items: Totem[];
  onView: (totem: Totem) => void;
  onEdit: (totem: Totem) => void;
  onDelete: (totem: Totem) => void;
  onToggleState: (totem: Totem) => void;
  onGenerateLinkingCode: (totem: Totem) => void;
  linkingCodeLoadingTotemId?: number | null;
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

function getConnectionBadgeClass(connectionStatus: Totem["connectionStatus"]) {
  if (connectionStatus === "online") return "bg-[#c9eed8] text-[#0f7a3a]";

  return "bg-[#ececef] text-[#5e6470]";
}

function getConnectionBadgeLabel(connectionStatus: Totem["connectionStatus"]) {
  if (connectionStatus === "online") return "En línea";

  return "Fuera de línea";
}

export default function TotemTable({
  items,
  onView,
  onEdit,
  onDelete,
  onToggleState,
  onGenerateLinkingCode,
  linkingCodeLoadingTotemId = null,
}: TotemTableProps) {
  return (
    <div className="overflow-hidden rounded-2xl border border-(--color-border)">
      <div className="overflow-x-auto">
        <table className="min-w-265 w-full table-fixed border-separate border-spacing-0 bg-white">
          <thead className="bg-[#f6f6f7]">
            <tr>
              <th className={`${HEADER_CELL_CLASS} w-[15%]`}>Código</th>
              <th className={`${HEADER_CELL_CLASS} w-[20%]`}>Nombre</th>
              <th className={`${HEADER_CELL_CLASS} w-[10%]`}>Campus</th>
              <th className={HEADER_CELL_CLASS}>Conexión</th>
              <th className={HEADER_CELL_CLASS}>Última Conexión</th>
              <th className={HEADER_CELL_CLASS}>Estado</th>
              <th className={`${HEADER_CELL_CLASS} w-28`}>Acciones</th>
            </tr>
          </thead>

          <tbody>
            {items.map((totem) => (
              <tr
                key={totem.id}
                onClick={() => onView(totem)}
                className="cursor-pointer transition hover:bg-[#fcfcfc] [&:not(:last-child)>td]:border-b [&:not(:last-child)>td]:border-(--color-border)"
              >
                <td className={`${BODY_CELL_CLASS} w-[20%]`}>
                  <TruncatedText
                    as="p"
                    value={totem.code}
                    className="font-medium text-(--color-text-main)"
                  />
                </td>
                <td className={`${BODY_CELL_CLASS} w-[24%]`}>
                  <TruncatedText
                    as="p"
                    value={totem.name}
                    className="font-medium text-(--color-text-main)"
                  />
                </td>
                <td className={`${BODY_CELL_CLASS} text-(--color-text-secondary)`}>
                  {totem.campus?.name ?? "Sin campus"}
                </td>
                <td className={BODY_CELL_CLASS}>
                  <span
                    className={`inline-flex min-w-24 items-center justify-center rounded-full px-3 py-1 text-xs font-semibold ${getConnectionBadgeClass(
                      totem.connectionStatus,
                    )}`}
                  >
                    {getConnectionBadgeLabel(totem.connectionStatus)}
                  </span>
                </td>
                <td className={`${BODY_CELL_CLASS} text-(--color-text-secondary)`}>
                  {formatDateTime(totem.lastSeenAt)}
                </td>
                <td className={BODY_CELL_CLASS}>
                  <span
                    className={`inline-flex min-w-20 items-center justify-center rounded-full px-3 py-1 text-xs font-semibold ${totem.state === "active"
                      ? "bg-[#c9eed8] text-[#0f7a3a]"
                      : "bg-[#ececef] text-[#5e6470]"
                      }`}
                  >
                    {totem.state === "active" ? "Activo" : "Inactivo"}
                  </span>
                </td>
                <td className={BODY_CELL_CLASS}>
                  <div onClick={(event) => event.stopPropagation()}>
                    <RowActionsMenu
                      triggerLabel="Acciones"
                      actions={[
                        {
                          key: "view",
                          label: "Ver detalle",
                          title: `Ver detalle de ${totem.name}`,
                          icon: <Eye className="h-4 w-4" />,
                          onSelect: () => onView(totem),
                        },
                        {
                          key: "edit",
                          label: "Editar",
                          title: "Editar",
                          icon: <Pencil className="h-4 w-4" />,
                          onSelect: () => onEdit(totem),
                        },
                        {
                          key: "generate-link",
                          label: "Generar código de vinculación",
                          title: totem.state === "active"
                            ? "Generar código de vinculación"
                            : "Solo disponible para tótems activos",
                          icon: <KeyRound className="h-4 w-4" />,
                          tone: "accent",
                          disabled:
                            totem.state !== "active"
                            || linkingCodeLoadingTotemId === totem.id,
                          onSelect: () => onGenerateLinkingCode(totem),
                        },
                        {
                          key: "toggle-state",
                          label: totem.state === "active" ? "Desactivar" : "Activar",
                          title: totem.state === "active" ? "Desactivar" : "Activar",
                          icon: <Power className="h-4 w-4" />,
                          tone: totem.state === "active" ? "warning" : "success",
                          onSelect: () => onToggleState(totem),
                        },
                        {
                          key: "delete",
                          label: "Eliminar",
                          title: "Eliminar",
                          icon: <Trash2 className="h-4 w-4" />,
                          tone: "danger",
                          onSelect: () => onDelete(totem),
                        },
                      ]}
                    />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
