import { Eye, Images, Link2, Pencil, Power, Trash2 } from "lucide-react";
import RowActionsMenu from "../../../components/RowActionsMenu";
import type { Content } from "../../../types/content";
import { resolveAssetUrl } from "../../../utils/assetUrl";
import FileActionButton from "../../../components/FileActionButton";
import TruncatedText from "../../../components/TruncatedText";
import ContentPreviewMedia from "./ContentPreviewMedia";
import {
  inferPreviewKindFromContent,
  resolveMissingPreviewCopy,
} from "../utils/contentPreview";

interface ContentTableProps {
  items: Content[];
  onView: (content: Content) => void;
  onEdit: (content: Content) => void;
  onDelete: (content: Content) => void;
  onToggleStatus: (content: Content) => void;
  onManageQuestionImages?: (content: Content) => void;
}

const FIELD_LABEL_CLASS =
  "text-xs font-semibold tracking-[0.08em] text-[var(--color-text-secondary)]";
const FIELD_VALUE_CLASS = "mt-1 text-xs font-medium";
const CONTENT_ACTION_TRIGGER_CLASSNAME =
  "inline-flex h-9 w-9 items-center justify-center rounded-xl border border-transparent text-(--color-text-secondary) transition hover:border-(--color-border) hover:bg-white hover:text-(--color-text-main) focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--color-red-main)/25";

function getStatusBadgeClass(status: Content["status"]) {
  if (status === "active") {
    return "border border-[#bde3cc] bg-[#dff3e7] text-[#0f7a3a]";
  }

  return "border border-[#d9dbe0] bg-[#eceef1] text-[#5e6470]";
}

function getStatusLabel(status: Content["status"]) {
  if (status === "active") return "Activo";
  return "Inactivo";
}

function getContentTypeLabel(type: Content["contentType"]) {
  if (type === "image") return "Imagen";
  if (type === "video") return "Video";
  if (type === "news") return "Noticia";
  if (type === "advertisement") return "Publicidad";
  return "PDF";
}

function renderPreview(content: Content, fileHref: string | null) {
  const previewKind = inferPreviewKindFromContent(
    content.contentType,
    content.fileUrl,
  );
  const missingPreviewCopy = resolveMissingPreviewCopy(
    content.contentType,
    content.fileUrl,
  );

  return (
    <ContentPreviewMedia
      kind={previewKind}
      sourceUrl={fileHref}
      title={`Vista previa de ${content.title}`}
      imageClassName="h-full w-full bg-[#f8f9fb] object-contain p-2.5"
      videoClassName="h-full w-full bg-[#f8f9fb] object-contain"
      pdfClassName="h-full w-full bg-[#f8f9fb]"
      fallbackClassName="h-full"
      placeholderTone="dark"
      unknownTitle={getContentTypeLabel(content.contentType)}
      unknownMessage={content.description || "Sin vista previa disponible"}
      missingTitle={missingPreviewCopy.title}
      missingMessage={missingPreviewCopy.message}
    />
  );
}

export default function ContentTable({
  items,
  onView,
  onEdit,
  onDelete,
  onToggleStatus,
  onManageQuestionImages,
}: ContentTableProps) {
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {items.map((content) => {
        const fileHref = resolveAssetUrl(content.fileUrl);
        const manualStatus = content.status;

        return (
          <article
            key={content.id}
            onClick={() => onView(content)}
            className="cursor-pointer overflow-hidden rounded-3xl border border-(--color-border) bg-[#f6f6f7] shadow-sm transition duration-200 hover:-translate-y-0.5 hover:shadow-md"
          >
            <header className="flex items-start justify-between gap-4 border-b border-(--color-border) bg-(--color-card) px-5 py-4">
              <div className="min-w-0">
                <TruncatedText
                  as="h3"
                  value={content.title}
                  className="text-sm font-semibold text-(--color-text-main)"
                />
                {content.description ? (
                  <TruncatedText
                    as="p"
                    value={content.description}
                    className="mt-1 text-xs text-(--color-text-secondary)"
                  />
                ) : null}
              </div>

              <div className="flex shrink-0 flex-col items-end gap-2">
                <span
                  className={`inline-flex min-w-24 items-center justify-center rounded-full px-3 py-1 text-xs font-semibold ${getStatusBadgeClass(
                    manualStatus,
                  )}`}
                >
                  {getStatusLabel(manualStatus)}
                </span>
              </div>
            </header>

            <div className="space-y-4 px-5 py-4">
              <div className="overflow-hidden rounded-2xl border border-(--color-border) bg-[#1b1e39]">
                <div className="aspect-16/10 w-full">
                  {renderPreview(content, fileHref)}
                </div>
              </div>

              <div className="grid gap-x-4 gap-y-3 sm:grid-cols-3">
                <div>
                  <p className={FIELD_LABEL_CLASS}>Tipo</p>
                  <p className={FIELD_VALUE_CLASS}>
                    {getContentTypeLabel(content.contentType)}
                  </p>
                </div>

                <div>
                  <p className={FIELD_LABEL_CLASS}>Campus</p>
                  <p className={FIELD_VALUE_CLASS}>
                    {content.campus?.name ?? "Sin campus"}
                  </p>
                </div>

                <div>
                  <p className={FIELD_LABEL_CLASS}>Archivo</p>
                  <FileActionButton
                    fileUrl={content.fileUrl}
                    label="Ver archivo"
                    unavailableLabel="No disponible"
                    checkingLabel="Verificando..."
                    className={`${FIELD_VALUE_CLASS} inline-flex max-w-full min-w-0 items-center gap-1 text-(--color-red-main) hover:underline`}
                    disabledClassName={`${FIELD_VALUE_CLASS} inline-flex max-w-full min-w-0 items-center gap-1 text-left leading-5 whitespace-normal break-words text-(--color-text-secondary)`}
                    wrapperClassName="block max-w-full"
                    icon={<Link2 className="h-4 w-4 shrink-0" />}
                    preventParentClick
                  />
                </div>
              </div>

              <div
                className="flex items-center justify-end border-t border-(--color-border)"
                onClick={(event) => event.stopPropagation()}
              >
                <RowActionsMenu
                  triggerLabel="Acciones"
                  triggerClassName={CONTENT_ACTION_TRIGGER_CLASSNAME}
                  actions={[
                    {
                      key: "view",
                      label: "Ver detalle",
                      title: `Ver detalle de ${content.title}`,
                      icon: <Eye className="h-4 w-4" />,
                      onSelect: () => onView(content),
                    },
                    {
                      key: "edit",
                      label: "Editar",
                      title: "Editar",
                      icon: <Pencil className="h-4 w-4" />,
                      onSelect: () => onEdit(content),
                    },
                    {
                      key: "manage-question-images",
                      label: "Gestionar imágenes de preguntas",
                      title: "Gestionar imágenes de preguntas",
                      icon: <Images className="h-4 w-4" />,
                      hidden:
                        content.contentType !== "pdf"
                        || typeof onManageQuestionImages !== "function",
                      onSelect: () => onManageQuestionImages?.(content),
                    },
                    {
                      key: "toggle-status",
                      label: content.status === "active" ? "Desactivar" : "Activar",
                      title: content.status === "active" ? "Desactivar" : "Activar",
                      icon: <Power className="h-4 w-4" />,
                      tone: content.status === "active" ? "warning" : "success",
                      onSelect: () => onToggleStatus(content),
                    },
                    {
                      key: "delete",
                      label: "Eliminar",
                      title: "Eliminar",
                      icon: <Trash2 className="h-4 w-4" />,
                      tone: "danger",
                      onSelect: () => onDelete(content),
                    },
                  ]}
                />
              </div>
            </div>
          </article>
        );
      })}
    </div>
  );
}
