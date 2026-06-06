import {
  AlignLeft,
  Building2,
  CalendarDays,
  FileText,
  Link2,
  Images,
  Pencil,
  Tags,
} from "lucide-react";
import { useEffect, useState } from "react";
import type { Content } from "../../../types/content";
import { resolveAssetUrl } from "../../../utils/assetUrl";
import FileActionButton from "../../../components/FileActionButton";
import SafeText from "../../../components/SafeText";
import {
  inferPreviewKindFromContent,
  resolveMissingPreviewCopy,
} from "../utils/contentPreview";
import ContentPreviewMedia from "./ContentPreviewMedia";
import EmptyState from "../../../components/EmptyState";
import LoadingState from "../../../components/LoadingState";
import FeedbackMessage from "../../../components/FeedbackMessage";
import { contentService } from "../services/content.service";
import type { ContentPdfQuestionChunksData } from "../../../types/content";
import { getErrorMessage } from "../../../utils/getErrorMessage";

interface ContentDetailPanelProps {
  content: Content;
  onEdit?: () => void;
  onManageQuestionImages?: () => void;
  canEdit?: boolean;
  editDisabledReason?: string;
}

const DETAIL_ITEM_CLASS =
  "flex items-start gap-3 rounded-2xl border border-[var(--color-border)] bg-white p-4 py-2 [&>div]:min-w-0";

function getStatusBadgeClass(status: Content["status"]) {
  if (status === "active") return "bg-[#c9eed8] text-[#0f7a3a]";
  return "bg-[#ececef] text-[#5e6470]";
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

function formatDateTime(value: string | null, fallback = "Sin registro") {
  if (!value) {
    return fallback;
  }

  const parsedDate = new Date(value);
  if (Number.isNaN(parsedDate.getTime())) {
    return value;
  }

  return parsedDate.toLocaleString("es-BO", {
    dateStyle: "short",
    timeStyle: "short",
  });
}

function getExtractionStatusBadgeClass(status: string | null) {
  if (status === "processed") {
    return "border border-[#bde3cc] bg-[#dff3e7] text-[#0f7a3a]";
  }

  if (status === "processing") {
    return "border border-[#c8d8f6] bg-[#e9f1ff] text-[#1f5dbd]";
  }

  if (status === "failed") {
    return "border border-[#f7c7cf] bg-[#fdebef] text-[#c12753]";
  }

  return "border border-[#d9dbe0] bg-[#eceef1] text-[#5e6470]";
}

function getExtractionStatusLabel(status: string | null) {
  if (status === "processed") return "Procesado";
  if (status === "processing") return "Procesando";
  if (status === "failed") return "Fallido";
  return "Sin indexación";
}

export default function ContentDetailPanel({
  content,
  onEdit,
  onManageQuestionImages,
  canEdit = true,
  editDisabledReason = "No disponible",
}: ContentDetailPanelProps) {
  const isPdfContent = content.contentType === "pdf";
  const fileHref = resolveAssetUrl(content.fileUrl ?? null);
  const manualStatus = content.status;
  const previewKind = inferPreviewKindFromContent(content.contentType, content.fileUrl);
  const missingPreviewCopy = resolveMissingPreviewCopy(
    content.contentType,
    content.fileUrl,
  );
  const editButtonTitle = canEdit ? "Editar" : editDisabledReason;
  const [pdfQuestionsData, setPdfQuestionsData] = useState<ContentPdfQuestionChunksData | null>(
    null,
  );
  const [pdfQuestionsLoading, setPdfQuestionsLoading] = useState(false);
  const [pdfQuestionsError, setPdfQuestionsError] = useState("");

  useEffect(() => {
    if (!isPdfContent) {
      setPdfQuestionsData(null);
      setPdfQuestionsError("");
      setPdfQuestionsLoading(false);
      return;
    }

    let cancelled = false;
    setPdfQuestionsLoading(true);
    setPdfQuestionsError("");

    void contentService
      .getPdfQuestionChunks(content.id)
      .then((response) => {
        if (cancelled) {
          return;
        }

        setPdfQuestionsData(response.data);
      })
      .catch((error) => {
        if (cancelled) {
          return;
        }

        setPdfQuestionsError(
          getErrorMessage(error, "No se pudo cargar el estado de preguntas del PDF."),
        );
      })
      .finally(() => {
        if (cancelled) {
          return;
        }

        setPdfQuestionsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [content.id, isPdfContent]);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-2">
        <div className="rounded-full bg-[#f8dbe3] px-4 py-0.5 text-xs font-bold tracking-[0.08em] text-(--color-red-main)">
          Contenido
        </div>
        <h3
          className="max-w-full truncate text-lg font-bold text-(--color-text-main)"
          title={content.title}
        >
          {content.title}
        </h3>
        <span
          className={`inline-flex rounded-full px-3 py-0.5 text-xs font-semibold ${getStatusBadgeClass(
            manualStatus,
          )}`}
        >
          {getStatusLabel(manualStatus)}
        </span>

        <div className="ml-auto flex items-center gap-2">
          {isPdfContent && onManageQuestionImages ? (
            <button
              type="button"
              onClick={onManageQuestionImages}
              className="inline-flex items-center gap-2 rounded-xl border border-(--color-border) bg-white px-4 py-2 text-xs font-semibold text-(--color-text-main) transition hover:border-(--color-red-main)/35 hover:bg-[#fff9fa]"
              title="Gestionar imágenes de preguntas"
              aria-label="Gestionar imágenes de preguntas"
            >
              <Images className="h-4 w-4" />
              Gestionar imágenes de preguntas
            </button>
          ) : null}

          {onEdit && (
            <button
              type="button"
              onClick={canEdit ? onEdit : undefined}
              disabled={!canEdit}
              className={`ml-auto inline-flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-semibold transition ${canEdit
                ? "bg-(--color-red-button) text-white shadow-md shadow-(--color-red-button)/30 hover:bg-(--color-red-dark)"
                : "cursor-not-allowed border border-(--color-border) bg-[#f3f4f6] text-(--color-text-secondary)"
                }`}
              title={editButtonTitle}
              aria-label="Editar contenido"
            >
              <Pencil className="h-4 w-4" />
              Editar
            </button>
          )}
        </div>
      </div>

      <section className="rounded-2xl border border-(--color-border) bg-white p-4">
        <h4 className="text-sm font-bold text-(--color-text-main)">
          Información del contenido
        </h4>

        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <article className={`${DETAIL_ITEM_CLASS} sm:col-span-2`}>
            <FileText className="shrink-0 mt-0.5 h-5 w-5 text-(--color-text-secondary)" />
            <div>
              <p className="text-xs font-semibold tracking-[0.08em] text-(--color-text-secondary)">
                Título
              </p>
              <SafeText
                value={content.title}
                className="text-xs font-medium text-(--color-text-main)"
              />
            </div>
          </article>

          <article className={`${DETAIL_ITEM_CLASS} sm:col-span-2`}>
            <AlignLeft className="shrink-0 mt-0.5 h-5 w-5 text-(--color-text-secondary)" />
            <div className="min-w-0">
              <p className="text-xs font-semibold tracking-[0.08em] text-(--color-text-secondary)">
                Descripción
              </p>
              <SafeText
                value={content.description || "Sin descripción"}
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
                {getContentTypeLabel(content.contentType)}
              </p>
            </div>
          </article>

          <article className={DETAIL_ITEM_CLASS}>
            <Building2 className="mt-0.5 h-5 w-5 text-(--color-text-secondary)" />
            <div>
              <p className="text-xs font-semibold tracking-[0.08em] text-(--color-text-secondary)">
                Campus
              </p>
              <p className="text-xs font-medium text-(--color-text-main)">
                {content.campus?.name ?? "Sin campus"}
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
                {formatDateTime(content.createdAt)}
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
                {formatDateTime(content.updatedAt)}
              </p>
            </div>
          </article>

          <article className={`${DETAIL_ITEM_CLASS} sm:col-span-2`}>
            <Link2 className="mt-0.5 h-5 w-5 text-(--color-text-secondary)" />
            <div className="min-w-0 space-y-1">
              <p className="text-xs font-semibold tracking-[0.08em] text-(--color-text-secondary)">
                Archivo
              </p>
              <SafeText
                value={`Ruta guardada: ${content.fileUrl || "Sin archivo"}`}
                className="text-xs font-medium text-(--color-text-main)"
              />
              <FileActionButton
                fileUrl={content.fileUrl}
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
          Previsualización del archivo
        </h4>

        <div className="mt-4 overflow-hidden rounded-xl border border-(--color-border) bg-[#f8f9fb]">
          <ContentPreviewMedia
            kind={previewKind}
            sourceUrl={fileHref}
            title={`Vista previa de ${content.title}`}
            imageClassName="h-80 w-full bg-[#f8f9fb] object-contain"
            videoClassName="h-80 w-full bg-[#f8f9fb] object-contain"
            pdfClassName="h-[30rem] w-full bg-[#f8f9fb]"
            fallbackClassName={previewKind === "pdf" ? "h-[30rem]" : "h-80"}
            placeholderTone="dark"
            unknownTitle={getContentTypeLabel(content.contentType)}
            unknownMessage="No se puede mostrar una vista previa para este tipo de contenido."
            missingTitle={missingPreviewCopy.title}
            missingMessage={missingPreviewCopy.message}
          />
        </div>
      </section>

      {isPdfContent ? (
        <section className="rounded-2xl border border-(--color-border) bg-white p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h4 className="text-sm font-bold text-(--color-text-main)">
              Preguntas extraídas del PDF
            </h4>
            <span
              className={`inline-flex items-center rounded-full px-3 py-0.5 text-xs font-semibold ${getExtractionStatusBadgeClass(
                pdfQuestionsData?.pdfDocument?.extractionStatus ?? null,
              )}`}
            >
              {getExtractionStatusLabel(pdfQuestionsData?.pdfDocument?.extractionStatus ?? null)}
            </span>
          </div>

          {pdfQuestionsLoading ? (
            <div className="mt-4">
              <LoadingState message="Cargando preguntas extraídas..." />
            </div>
          ) : null}

          {!pdfQuestionsLoading && pdfQuestionsError ? (
            <div className="mt-4">
              <FeedbackMessage type="error" message={pdfQuestionsError} />
            </div>
          ) : null}

          {!pdfQuestionsLoading && !pdfQuestionsError ? (
            <div className="mt-4 space-y-3">
              {pdfQuestionsData?.pdfDocument?.extractionStatus === "failed" ? (
                <FeedbackMessage
                  type="error"
                  message={
                    pdfQuestionsData.pdfDocument.extractionError
                    || "La extracción de preguntas del PDF falló."
                  }
                />
              ) : null}

              {!pdfQuestionsData?.pdfDocument ? (
                <EmptyState
                  title="Sin indexación de PDF"
                  description="Este contenido PDF aún no tiene preguntas indexadas para consulta."
                />
              ) : pdfQuestionsData.chunks.length === 0 ? (
                <EmptyState
                  title="Sin preguntas disponibles"
                  description="No se detectaron pares pregunta/respuesta en este PDF."
                />
              ) : (
                <div className="space-y-2">
                  {pdfQuestionsData.chunks.map((chunk) => (
                    <article
                      key={chunk.id}
                      className="rounded-xl border border-(--color-border) bg-[#f8f9fb] px-4 py-2"
                    >
                      <p className="text-xs font-semibold text-(--color-text-secondary)">
                        Pregunta #{chunk.chunkOrder}
                      </p>
                      <p className="mt-1 text-xs font-semibold text-(--color-text-main)">
                        {chunk.questionText}
                      </p>
                      <p className="mt-2 text-xs text-(--color-text-secondary)">
                        {chunk.answerText}
                      </p>
                      <p className="mt-2 text-xs font-semibold tracking-[0.06em] text-(--color-text-secondary)">
                        Imágenes asociadas: {chunk.imageCount}
                      </p>
                    </article>
                  ))}
                </div>
              )}
            </div>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}
