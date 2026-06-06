import { Eye, Pencil, Power, Trash2 } from "lucide-react";
import RowActionsMenu from "../../../components/RowActionsMenu";
import TruncatedText from "../../../components/TruncatedText";
import type { ContentType } from "../../../types/content";
import type { TotemContent } from "../../../types/totemContent";
import {
  resolveComputedTemporalStatus,
  type TemporalStatus,
} from "../utils/assignmentAvailability";

interface TotemContentTableProps {
  items: TotemContent[];
  onPreview: (assignment: TotemContent) => void;
  onEdit: (assignment: TotemContent) => void;
  onDelete: (assignment: TotemContent) => void;
  onToggleStatus: (assignment: TotemContent) => void;
}

const HEADER_CELL_CLASS =
  "px-4 py-3 text-left text-xs font-bold tracking-[0.08em] text-[var(--color-text-secondary)] sm:px-6";
const BODY_CELL_CLASS =
  "px-4 py-1 text-xs text-[var(--color-text-main)] sm:px-6";

function getStatusBadgeClass(status: TemporalStatus) {
  if (status === "active") return "bg-[#c9eed8] text-[#0f7a3a]";
  if (status === "scheduled") return "bg-[#eaf2ff] text-[#1f5dbd]";
  if (status === "expired") return "bg-[#fff4e4] text-[#ad6700]";
  return "bg-[#ececef] text-[#5e6470]";
}

function getStatusLabel(status: TemporalStatus) {
  if (status === "active") return "Activo";
  if (status === "scheduled") return "Programado";
  if (status === "expired") return "Expirado";
  return "Inactivo";
}

function formatDateTime(value: string | null) {
  if (!value) return "Sin fecha";

  const parsedDate = new Date(value);
  if (Number.isNaN(parsedDate.getTime())) return value;

  return parsedDate.toLocaleString("es-BO", {
    dateStyle: "short",
    timeStyle: "short",
  });
}

function getContentTypeLabel(type: ContentType | undefined) {
  if (!type) return "Sin tipo";
  if (type === "image") return "Imagen";
  if (type === "video") return "Video";
  if (type === "news") return "Noticia";
  if (type === "advertisement") return "Publicidad";
  return "PDF";
}

export default function TotemContentTable({
  items,
  onPreview,
  onEdit,
  onDelete,
  onToggleStatus,
}: TotemContentTableProps) {
  return (
    <div className="overflow-hidden rounded-2xl border border-(--color-border)">
      <div className="overflow-x-auto">
        <table className="min-w-295 w-full table-fixed border-separate border-spacing-0 bg-white">
          <thead className="bg-[#f6f6f7]">
            <tr>
              <th className={`${HEADER_CELL_CLASS} w-[20%]`}>Tótem</th>
              <th className={`${HEADER_CELL_CLASS} w-[20%]`}>Contenido</th>
              <th className={`${HEADER_CELL_CLASS} w-[8%]`}>Tipo</th>
              <th className={HEADER_CELL_CLASS}>Inicio</th>
              <th className={HEADER_CELL_CLASS}>Fin</th>
              <th className={HEADER_CELL_CLASS}>Estado</th>
              <th className={`${HEADER_CELL_CLASS} w-28`}>Acciones</th>
            </tr>
          </thead>

          <tbody>
            {items.map((assignment) => {
              const totemLabel = assignment.totem?.name ?? "Tótem eliminado";
              const totemCode = assignment.totem?.code ?? "Sin código";
              const contentTitle =
                assignment.content?.title ?? `Contenido #${assignment.contentId}`;
              const computedStatus = resolveComputedTemporalStatus(
                assignment.status,
                assignment.startAt,
                assignment.endAt,
              );

              return (
                <tr
                  key={assignment.id}
                  onClick={() => onPreview(assignment)}
                  className="cursor-pointer transition hover:bg-[#fcfcfc] [&:not(:last-child)>td]:border-b [&:not(:last-child)>td]:border-(--color-border)"
                >
                  <td className={`${BODY_CELL_CLASS} w-[26%]`}>
                    <TruncatedText
                      as="p"
                      value={totemLabel}
                      className="font-medium text-(--color-text-main)"
                    />
                    <TruncatedText
                      as="p"
                      value={totemCode}
                      className="mt-1 text-(--color-text-secondary)"
                    />
                  </td>
                  <td className={`${BODY_CELL_CLASS} w-[26%]`}>
                    <TruncatedText
                      as="p"
                      value={contentTitle}
                      className="font-medium text-(--color-text-main)"
                    />
                  </td>
                  <td className={`${BODY_CELL_CLASS} text-(--color-text-secondary)`}>
                    {getContentTypeLabel(assignment.content?.contentType)}
                  </td>
                  <td className={`${BODY_CELL_CLASS} text-(--color-text-secondary)`}>
                    {formatDateTime(assignment.startAt)}
                  </td>
                  <td className={`${BODY_CELL_CLASS} text-(--color-text-secondary)`}>
                    {formatDateTime(assignment.endAt)}
                  </td>
                  <td className={BODY_CELL_CLASS}>
                    <span
                      className={`inline-flex min-w-20 items-center justify-center rounded-full px-3 py-1 text-xs font-semibold ${getStatusBadgeClass(
                        computedStatus,
                      )}`}
                    >
                      {getStatusLabel(computedStatus)}
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
                            title: `Ver detalle de la asignación ${assignment.id}`,
                            icon: <Eye className="h-4 w-4" />,
                            onSelect: () => onPreview(assignment),
                          },
                          {
                            key: "edit",
                            label: "Editar",
                            title: "Editar",
                            icon: <Pencil className="h-4 w-4" />,
                            onSelect: () => onEdit(assignment),
                          },
                          {
                            key: "toggle-status",
                            label: assignment.status === "active" ? "Desactivar" : "Activar",
                            title: assignment.status === "active" ? "Desactivar" : "Activar",
                            icon: <Power className="h-4 w-4" />,
                            tone: assignment.status === "active" ? "warning" : "success",
                            onSelect: () => onToggleStatus(assignment),
                          },
                          {
                            key: "delete",
                            label: "Eliminar",
                            title: "Eliminar",
                            icon: <Trash2 className="h-4 w-4" />,
                            tone: "danger",
                            onSelect: () => onDelete(assignment),
                          },
                        ]}
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
