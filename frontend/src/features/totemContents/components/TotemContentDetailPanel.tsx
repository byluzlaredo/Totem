import {
  Building2,
  Cable,
  CalendarDays,
  Clock3,
  Layers,
  Link2,
  ListOrdered,
  LoaderCircle,
  Monitor,
  Newspaper,
  Pencil,
  ShieldCheck,
  Tags,
} from "lucide-react";
import SideDrawer from "../../../components/SideDrawer";
import SafeText from "../../../components/SafeText";
import TruncatedText from "../../../components/TruncatedText";
import type { Content } from "../../../types/content";
import type { TotemContent } from "../../../types/totemContent";
import { resolveAssetUrl } from "../../../utils/assetUrl";
import FileActionButton from "../../../components/FileActionButton";
import ContentPreviewMedia from "../../contents/components/ContentPreviewMedia";
import {
  formatDateTime,
  resolveComputedTemporalStatus,
  resolveRemainingValiditySummary,
  type RemainingValidityTone,
  type TemporalStatus,
} from "../utils/assignmentAvailability";
import {
  inferPreviewKindFromContent,
  resolveMissingPreviewCopy,
} from "../../contents/utils/contentPreview";

interface TotemContentDetailPanelProps {
  isOpen: boolean;
  assignment: TotemContent | null;
  content: Content | null;
  loadingContent?: boolean;
  error?: string;
  onClose: () => void;
  onEdit?: (assignment: TotemContent) => void;
}

const DETAIL_ITEM_CLASS =
  "flex items-start gap-3 rounded-2xl border border-[var(--color-border)] bg-white p-4 py-2 [&>div]:min-w-0";

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

function getContentTypeLabel(type: Content["contentType"] | undefined) {
  if (!type) return "Sin tipo";
  if (type === "image") return "Imagen";
  if (type === "video") return "Video";
  if (type === "news") return "Noticia";
  if (type === "advertisement") return "Publicidad";
  return "PDF";
}

function getRemainingValidityBadgeClass(tone: RemainingValidityTone) {
  if (tone === "positive") return "bg-[#dff3e7] text-[#0f7a3a]";
  if (tone === "warning") return "bg-[#fff4e4] text-[#ad6700]";
  if (tone === "expired") return "bg-[#fdebef] text-(--color-red-main)";
  return "bg-[#ececef] text-[#5e6470]";
}

export default function TotemContentDetailPanel({
  isOpen,
  assignment,
  content,
  loadingContent = false,
  error = "",
  onClose,
  onEdit,
}: TotemContentDetailPanelProps) {
  if (!isOpen || !assignment) {
    return null;
  }

  const assignmentComputedStatus = resolveComputedTemporalStatus(
    assignment.status,
    assignment.startAt,
    assignment.endAt,
  );
  const assignmentRemainingValidity = resolveRemainingValiditySummary(
    assignment.endAt,
  );
  const totemName = assignment.totem?.name ?? "Tótem eliminado";
  const totemCode = assignment.totem?.code ?? "Sin código";
  const contentTitle =
    content?.title ?? assignment.content?.title ?? `Contenido #${assignment.contentId}`;
  const contentType = content?.contentType ?? assignment.content?.contentType;
  const contentStatus = content?.status ?? assignment.content?.status ?? "inactive";
  const fileHref = resolveAssetUrl(content?.fileUrl ?? null);
  const previewKind = inferPreviewKindFromContent(contentType ?? "news", content?.fileUrl);
  const missingPreviewCopy = resolveMissingPreviewCopy(contentType, content?.fileUrl);

  return (
    <SideDrawer
      isOpen={isOpen}
      title="Detalle de Asignación"
      description="Revisa toda la información de la asignación seleccionada."
      onClose={onClose}
      widthClassName="max-w-4xl"
    >
      <div className="space-y-4">
        <div className="space-y-5">
          <div className="flex flex-wrap items-center gap-2">
            <div className="rounded-full bg-[#f8dbe3] px-4 py-0.5 text-xs font-bold tracking-[0.08em] text-(--color-red-main)">
              Asignación
            </div>
            <TruncatedText
              as="h3"
              value={`Asignación - ${totemName}`}
              className="max-w-full text-lg font-bold text-(--color-text-main)"
            />
            <span
              className={`inline-flex rounded-full px-3 py-0.5 text-xs font-semibold ${getStatusBadgeClass(
                assignmentComputedStatus,
              )}`}
            >
              {getStatusLabel(assignmentComputedStatus)}
            </span>
            {onEdit && (
              <button
                type="button"
                onClick={() => onEdit(assignment)}
                className="ml-auto inline-flex items-center gap-2 rounded-xl bg-(--color-red-button) px-4 py-2 text-xs font-semibold text-white shadow-md shadow-(--color-red-button)/30 transition hover:bg-(--color-red-dark)"
              >
                <Pencil className="h-4 w-4" />
                Editar
              </button>
            )}
          </div>

          <section className="rounded-2xl border border-(--color-border) bg-white p-4">
            <h4 className="text-sm font-bold text-(--color-text-main)">
              Datos de la asignación
            </h4>

            <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <article className={DETAIL_ITEM_CLASS}>
                <CalendarDays className="mt-0.5 h-5 w-5 text-(--color-text-secondary)" />
                <div>
                  <p className="text-xs font-semibold tracking-[0.08em] text-(--color-text-secondary)">
                    Inicio
                  </p>
                  <p className="text-xs font-medium text-(--color-text-main)">
                    {formatDateTime(assignment.startAt, "Sin fecha")}
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
                    {formatDateTime(assignment.endAt, "Sin fecha")}
                  </p>
                </div>
              </article>
              <article className={`${DETAIL_ITEM_CLASS} sm:col-span-2`}>
                <Clock3 className="mt-0.5 h-5 w-5 text-(--color-text-secondary)" />
                <div>
                  <p className="text-xs font-semibold tracking-[0.08em] text-(--color-text-secondary)">
                    Vigencia restante
                  </p>
                  <span
                    className={`mt-1 inline-flex rounded-full px-3 py-0.5 text-xs font-semibold ${getRemainingValidityBadgeClass(
                      assignmentRemainingValidity.tone,
                    )}`}
                  >
                    {assignmentRemainingValidity.label}
                  </span>
                </div>
              </article>

              <article className={DETAIL_ITEM_CLASS}>
                <CalendarDays className="mt-0.5 h-5 w-5 text-(--color-text-secondary)" />
                <div>
                  <p className="text-xs font-semibold tracking-[0.08em] text-(--color-text-secondary)">
                    Creado en
                  </p>
                  <p className="text-xs font-medium text-(--color-text-main)">
                    {formatDateTime(assignment.createdAt)}
                  </p>
                </div>
              </article>

              <article className={DETAIL_ITEM_CLASS}>
                <CalendarDays className="mt-0.5 h-5 w-5 text-(--color-text-secondary)" />
                <div>
                  <p className="text-xs font-semibold tracking-[0.08em] text-(--color-text-secondary)">
                    Actualizado en
                  </p>
                  <p className="text-xs font-medium text-(--color-text-main)">
                    {formatDateTime(assignment.updatedAt)}
                  </p>
                </div>
              </article>

              <article className={DETAIL_ITEM_CLASS}>
                <Layers className="mt-0.5 h-5 w-5 text-(--color-text-secondary)" />
                <div>
                  <p className="text-xs font-semibold tracking-[0.08em] text-(--color-text-secondary)">
                    Prioridad
                  </p>
                  <p className="text-xs font-medium text-(--color-text-main)">
                    {assignment.priority}
                  </p>
                </div>
              </article>

              <article className={DETAIL_ITEM_CLASS}>
                <ListOrdered className="mt-0.5 h-5 w-5 text-(--color-text-secondary)" />
                <div>
                  <p className="text-xs font-semibold tracking-[0.08em] text-(--color-text-secondary)">
                    Orden
                  </p>
                  <p className="text-xs font-medium text-(--color-text-main)">
                    {assignment.sortOrder}
                  </p>
                </div>
              </article>
            </div>
          </section>

          <section className="rounded-2xl border border-(--color-border) bg-white p-4">
            <h4 className="text-sm font-bold text-(--color-text-main)">
              Tótem relacionado
            </h4>

            <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <article className={`${DETAIL_ITEM_CLASS} sm:col-span-2`}>
                <Monitor className="mt-0.5 h-5 w-5 text-(--color-text-secondary)" />
                <div>
                  <p className="text-xs font-semibold tracking-[0.08em] text-(--color-text-secondary)">
                    Tótem
                  </p>
                  <SafeText
                    value={totemName}
                    className="text-xs font-semibold text-(--color-text-main)"
                  />
                </div>
              </article>

              <article className={`${DETAIL_ITEM_CLASS} sm:col-span-2`}>
                <Cable className="mt-0.5 h-5 w-5 text-(--color-text-secondary)" />
                <div>
                  <p className="text-xs font-semibold tracking-[0.08em] text-(--color-text-secondary)">
                    Código
                  </p>
                  <SafeText
                    value={totemCode}
                    className="text-xs font-medium text-(--color-text-main)"
                  />
                </div>
              </article>

              <article className={`${DETAIL_ITEM_CLASS} sm:col-span-2`}>
                <Building2 className="mt-0.5 h-5 w-5 text-(--color-text-secondary)" />
                <div>
                  <p className="text-xs font-semibold tracking-[0.08em] text-(--color-text-secondary)">
                    Campus
                  </p>
                  <p className="text-xs font-medium text-(--color-text-main)">
                    {assignment.totem?.campus?.name ?? "Sin registro"}
                  </p>
                </div>
              </article>
            </div>
          </section>

          <section className="rounded-2xl border border-(--color-border) bg-white p-4">
            <h4 className="text-sm font-bold text-(--color-text-main)">
              Contenido relacionado
            </h4>

            <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <article className={`${DETAIL_ITEM_CLASS} sm:col-span-2`}>
                <Newspaper className="shrink-0 mt-0.5 h-5 w-5 text-(--color-text-secondary)" />
                <div>
                  <p className="text-xs font-semibold tracking-[0.08em] text-(--color-text-secondary)">
                    Título
                  </p>
                  <SafeText
                    value={contentTitle}
                    className="text-xs font-semibold text-(--color-text-main)"
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
                    {getContentTypeLabel(contentType)}
                  </p>
                </div>
              </article>

              <article className={DETAIL_ITEM_CLASS}>
                <ShieldCheck className="mt-0.5 h-5 w-5 text-(--color-text-secondary)" />
                <div>
                  <p className="text-xs font-semibold tracking-[0.08em] text-(--color-text-secondary)">
                    Estado
                  </p>
                  <span
                    className={`mt-1 inline-flex rounded-full px-3 py-0.5 text-xs font-semibold ${getStatusBadgeClass(
                      contentStatus,
                    )}`}
                  >
                    {getStatusLabel(contentStatus)}
                  </span>
                </div>
              </article>

              <article className={`${DETAIL_ITEM_CLASS} sm:col-span-2`}>
                <Link2 className="mt-0.5 h-5 w-5 text-(--color-text-secondary)" />
                <div className="space-y-1">
                  <p className="text-xs font-semibold tracking-[0.08em] text-(--color-text-secondary)">
                    Archivo
                  </p>
                  <SafeText
                    value={content?.fileUrl ?? "Sin archivo"}
                    className="text-xs text-(--color-text-main)"
                  />
                  <FileActionButton
                    fileUrl={content?.fileUrl}
                    label="Abrir archivo"
                    className="inline-flex items-center gap-2 text-xs font-semibold text-(--color-red-main) hover:underline"
                    disabledClassName="inline-flex items-center gap-2 text-xs font-semibold text-(--color-text-secondary) disabled:cursor-not-allowed"
                    icon={<Link2 className="h-4 w-4" />}
                  />
                </div>
              </article>
            </div>
          </section>

          <section className="rounded-2xl border border-(--color-border) bg-white p-4">
            <h4 className="text-sm font-bold text-(--color-text-main)">
              Previsualización del archivo relacionado
            </h4>

            {loadingContent ? (
              <div className="mt-4 flex h-72 items-center justify-center gap-2 rounded-xl border border-(--color-border) bg-[#f8f9fb] text-xs text-(--color-text-secondary)">
                <LoaderCircle className="h-4 w-4 animate-spin" />
                Cargando detalle del contenido...
              </div>
            ) : (
              <div className="mt-4 overflow-hidden rounded-xl border border-(--color-border) bg-[#f8f9fb]">
                <ContentPreviewMedia
                  kind={previewKind}
                  sourceUrl={fileHref}
                  title={`Vista previa de ${contentTitle}`}
                  imageClassName="h-80 w-full bg-[#f8f9fb] object-contain"
                  videoClassName="h-80 w-full bg-[#f8f9fb] object-contain"
                  pdfClassName="h-[30rem] w-full bg-[#f8f9fb]"
                  fallbackClassName={previewKind === "pdf" ? "h-[30rem]" : "h-80"}
                  placeholderTone="dark"
                  unknownTitle={getContentTypeLabel(contentType)}
                  unknownMessage="No se puede mostrar una vista previa para este tipo de contenido."
                  missingTitle={missingPreviewCopy.title}
                  missingMessage={missingPreviewCopy.message}
                />
              </div>
            )}
          </section>
        </div>

        {error && (
          <p className="rounded-xl border border-[#f3c2cb] bg-[#fdebef] px-3 py-2 text-xs text-(--color-red-main)">
            {error}
          </p>
        )}
      </div>
    </SideDrawer>
  );
}
