import {
  AlignLeft,
  Building2,
  FileText,
  Link2,
  LoaderCircle,
  Tags,
  Upload,
  CirclePower,
} from "lucide-react";
import { useEffect, useMemo, useRef } from "react";
import { useContentForm } from "../hooks/useContentForm";
import FileActionButton from "../../../components/FileActionButton";
import {
  CONTENT_DESCRIPTION_MAX_LENGTH,
  CONTENT_STATUS_OPTIONS,
  CONTENT_TITLE_MAX_LENGTH,
  CONTENT_TYPE_OPTIONS,
  EMPTY_CONTENT_FORM,
  isFileRequiredForContentType,
} from "../../../constants/content";
import type { ContentFormValues } from "../../../types/content";
import { resolveAssetUrl } from "../../../utils/assetUrl";
import ContentPreviewMedia from "./ContentPreviewMedia";
import {
  inferPreviewKindFromName,
  inferPreviewKindFromUrl,
  type PreviewKind,
} from "../utils/contentPreview";
import {
  getAcceptedMimeTypesForContentType,
  isStoredFileUrlCompatibleWithContentType,
} from "../utils/contentFileRules";
import { useModalErrorScrollToTop } from "../../../hooks/useModalErrorScrollToTop";
import type { ContentFormErrors } from "../../../types/content";
import type { CampusOption } from "../../../types/campus";

interface ContentFormProps {
  initialValues?: ContentFormValues;
  submitLabel: string;
  campusOptions: CampusOption[];
  isSuperAdmin: boolean;
  lockedCampusName?: string | null;
  submitting?: boolean;
  existingFileUrl?: string | null;
  requireFile?: boolean;
  serverErrors?: ContentFormErrors;
  onSubmit: (values: ContentFormValues) => Promise<void>;
}

function inferPreviewKindFromFile(file: File): PreviewKind {
  const mimeType = file.type.toLowerCase();

  if (mimeType.startsWith("image/")) return "image";
  if (mimeType.startsWith("video/")) return "video";
  if (mimeType === "application/pdf") return "pdf";

  return inferPreviewKindFromName(file.name);
}

export default function ContentForm({
  initialValues = EMPTY_CONTENT_FORM,
  submitLabel,
  campusOptions,
  isSuperAdmin,
  lockedCampusName = null,
  submitting = false,
  existingFileUrl = null,
  requireFile = false,
  serverErrors,
  onSubmit,
}: ContentFormProps) {
  const formRef = useRef<HTMLFormElement | null>(null);
  const { values, errors, submitAttempts, handleChange, handleSubmit, setFieldErrors } = useContentForm(
    initialValues,
    onSubmit,
    {
      requireFile,
      initialContentType: initialValues.contentType,
      existingFileUrl,
    },
  );

  useEffect(() => {
    if (!serverErrors) return;
    setFieldErrors(serverErrors);
  }, [serverErrors, setFieldErrors]);

  const currentFileHref = resolveAssetUrl(existingFileUrl);
  const selectedFilePreviewUrl = useMemo(() => {
    if (!values.file) return null;
    return URL.createObjectURL(values.file);
  }, [values.file]);

  useEffect(() => {
    return () => {
      if (selectedFilePreviewUrl) {
        URL.revokeObjectURL(selectedFilePreviewUrl);
      }
    };
  }, [selectedFilePreviewUrl]);

  const previewSourceUrl = values.file ? selectedFilePreviewUrl : currentFileHref;
  const previewKind = useMemo<PreviewKind>(() => {
    if (values.file) {
      return inferPreviewKindFromFile(values.file);
    }

    if (previewSourceUrl) {
      return inferPreviewKindFromUrl(previewSourceUrl);
    }

    return "unknown";
  }, [values.file, previewSourceUrl]);
  const previewLabel = values.file
    ? "Vista previa del archivo seleccionado"
    : "Vista previa del archivo actual";
  const hasIncompatibleExistingFileForCurrentType =
    !values.file &&
    Boolean(existingFileUrl?.trim()) &&
    !isStoredFileUrlCompatibleWithContentType(
      existingFileUrl?.trim() ?? "",
      values.contentType,
    );

  useModalErrorScrollToTop(
    formRef,
    submitAttempts,
    Boolean(errors.title || errors.description || errors.campusId),
  );

  return (
    <form ref={formRef} onSubmit={handleSubmit}>
      <fieldset disabled={submitting} className="space-y-4">
        <legend className="sr-only">Formulario de contenido</legend>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          <div className="space-y-2 md:col-span-2 lg:col-span-3">
            <label
              htmlFor="title"
              className="text-sm font-semibold text-(--color-text-main)"
            >
              Título
            </label>
            <div className="relative">
              <FileText className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-(--color-text-secondary)" />
              <input
                id="title"
                name="title"
                type="text"
                maxLength={CONTENT_TITLE_MAX_LENGTH}
                value={values.title}
                onChange={handleChange}
                placeholder="Ej: Promoción de temporada"
                className={`w-full rounded-2xl border bg-white py-2 pl-11 pr-4 text-xs text-(--color-text-main) outline-none transition focus:ring-2 ${errors.title
                  ? "border-(--color-red-main) focus:border-(--color-red-main) focus:ring-(--color-red-main)/20"
                  : "border-(--color-border) focus:border-(--color-red-main) focus:ring-(--color-red-main)/20"
                  }`}
              />
            </div>
            {errors.title && (
              <p className="text-xs font-medium text-(--color-red-main)">
                {errors.title}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <label
              htmlFor="contentType"
              className="text-sm font-semibold text-(--color-text-main)"
            >
              Tipo de contenido
            </label>
            <div className="relative">
              <Tags className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-(--color-text-secondary)" />
              <select
                id="contentType"
                name="contentType"
                value={values.contentType}
                onChange={handleChange}
                className={`w-full rounded-2xl border bg-white py-2 pl-11 pr-4 text-xs text-(--color-text-main) outline-none transition focus:ring-2 ${errors.contentType
                  ? "border-(--color-red-main) focus:border-(--color-red-main) focus:ring-(--color-red-main)/20"
                  : "border-(--color-border) focus:border-(--color-red-main) focus:ring-(--color-red-main)/20"
                  }`}
              >
                {CONTENT_TYPE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
            {errors.contentType && (
              <p className="text-xs font-medium text-(--color-red-main)">
                {errors.contentType}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <label
              htmlFor="status"
              className="text-sm font-semibold text-(--color-text-main)"
            >
              Estado
            </label>
            <div className="relative">
              <CirclePower className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-(--color-text-secondary)" />
              <select
                id="status"
                name="status"
                value={values.status}
                onChange={handleChange}
                className={`w-full rounded-2xl border bg-white py-2 pl-11 pr-4 text-xs text-(--color-text-main) outline-none transition focus:ring-2 ${errors.status
                  ? "border-(--color-red-main) focus:border-(--color-red-main) focus:ring-(--color-red-main)/20"
                  : "border-(--color-border) focus:border-(--color-red-main) focus:ring-(--color-red-main)/20"
                  }`}
              >
                {CONTENT_STATUS_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              {errors.status && (
                <p className="text-xs font-medium text-(--color-red-main)">
                  {errors.status}
                </p>
              )}
            </div>
          </div>

          {isSuperAdmin ? (
            <div className="space-y-2">
              <label
                htmlFor="campusId"
                className="text-sm font-semibold text-(--color-text-main)"
              >
                Campus
              </label>
              <div className="relative">
                <Building2 className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-(--color-text-secondary)" />
                <select
                  id="campusId"
                  name="campusId"
                  value={values.campusId}
                  onChange={handleChange}
                  className={`w-full rounded-2xl border bg-white py-2 pl-11 pr-4 text-xs text-(--color-text-main) outline-none transition focus:ring-2 ${errors.campusId
                    ? "border-(--color-red-main) focus:border-(--color-red-main) focus:ring-(--color-red-main)/20"
                    : "border-(--color-border) focus:border-(--color-red-main) focus:ring-(--color-red-main)/20"
                    }`}
                >
                  <option value="">Selecciona un campus</option>
                  {campusOptions.map((campus) => (
                    <option key={campus.id} value={campus.id}>
                      {campus.name}
                    </option>
                  ))}
                </select>
              </div>
              {errors.campusId && (
                <p className="text-xs font-medium text-(--color-red-main)">
                  {errors.campusId}
                </p>
              )}
            </div>
          ) : (
            <div className="space-y-2">
              <label
                htmlFor="campusReadOnly"
                className="text-sm font-semibold text-(--color-text-main)"
              >
                Campus
              </label>
              <div className="relative">
                <Building2 className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-(--color-text-secondary)" />
                <input
                  id="campusReadOnly"
                  type="text"
                  readOnly
                  value={lockedCampusName ?? "No disponible"}
                  className="w-full rounded-2xl border border-(--color-border) bg-[#f9f9f9] py-2 pl-11 pr-4 text-xs text-(--color-text-main)"
                />
              </div>
              {errors.campusId && (
                <p className="text-xs font-medium text-(--color-red-main)">
                  {errors.campusId}
                </p>
              )}
            </div>
          )}

          <div className="space-y-2 md:col-span-2 lg:col-span-3">
            <label
              htmlFor="description"
              className="text-sm font-semibold text-(--color-text-main)"
            >
              Descripción
            </label>
            <div className="relative">
              <AlignLeft className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-(--color-text-secondary)" />
              <textarea
                id="description"
                name="description"
                maxLength={CONTENT_DESCRIPTION_MAX_LENGTH}
                value={values.description}
                onChange={handleChange}
                rows={3}
                placeholder="Describe el contenido..."
                className={`w-full rounded-2xl border bg-white py-2 pl-11 pr-4 text-xs text-(--color-text-main) outline-none transition focus:ring-2 ${errors.description
                  ? "border-(--color-red-main) focus:border-(--color-red-main) focus:ring-(--color-red-main)/20"
                  : "border-(--color-border) focus:border-(--color-red-main) focus:ring-(--color-red-main)/20"
                  }`}
              />
            </div>
            <p className="text-xs text-(--color-text-secondary)">
              {values.description.length}/{CONTENT_DESCRIPTION_MAX_LENGTH}
            </p>
            {errors.description && (
              <p className="text-xs font-medium text-(--color-red-main)">
                {errors.description}
              </p>
            )}
          </div>

          <div className="space-y-2 md:col-span-2 lg:col-span-3">
            <label
              htmlFor="file"
              className="text-sm font-semibold text-(--color-text-main)"
            >
              Archivo
            </label>
            <div className="relative">
              <Upload className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-(--color-text-secondary)" />
              <input
                id="file"
                name="file"
                type="file"
                accept={getAcceptedMimeTypesForContentType(values.contentType)}
                onChange={handleChange}
                className={`w-full rounded-2xl border bg-white py-2 pl-11 pr-4 text-xs text-(--color-text-main) file:mr-3 file:rounded-lg file:border-0 file:bg-(--color-red-main)/10 file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-(--color-red-main) hover:file:bg-(--color-red-main)/15 ${errors.file
                  ? "border-(--color-red-main) focus:border-(--color-red-main)"
                  : "border-(--color-border) focus:border-(--color-red-main)"
                  }`}
              />
            </div>

            {values.file ? (
              <p className="text-xs text-(--color-text-secondary)">
                Archivo seleccionado: <span className="font-medium text-(--color-text-main)">{values.file.name}</span>
              </p>
            ) : currentFileHref ? (
              <p className="flex items-start gap-1 text-xs text-(--color-text-secondary)">
                Archivo actual:{" "}
                <FileActionButton
                  fileUrl={existingFileUrl}
                  label="Ver archivo"
                  className="inline-flex items-center gap-1 font-medium text-(--color-red-main) underline-offset-2 hover:underline"
                  disabledClassName="inline-flex items-center gap-1 font-medium text-(--color-text-secondary) disabled:cursor-not-allowed"
                  icon={<Link2 className="h-4 w-4" />}
                />
              </p>
            ) : (
              <p className="text-xs text-(--color-text-secondary)">
                {isFileRequiredForContentType(values.contentType)
                  ? "Debes adjuntar un archivo para guardar el contenido."
                  : "Puedes guardar la noticia sin archivo o adjuntar una imagen opcional."}
              </p>
            )}

            {errors.file && (
              <p className="text-xs font-medium text-(--color-red-main)">
                {errors.file}
              </p>
            )}
            {!errors.file && hasIncompatibleExistingFileForCurrentType && (
              <p className="text-xs font-medium text-(--color-red-main)">
                El archivo actual no es compatible con el tipo de contenido seleccionado. Adjunta un archivo compatible.
              </p>
            )}

            {previewSourceUrl && (
              <div className="space-y-3 rounded-2xl border border-(--color-border) bg-[#fcfcfd] p-4">
                <p className="text-xs font-semibold text-(--color-text-main)">
                  {previewLabel}
                </p>

                <div className="overflow-hidden rounded-xl border border-(--color-border) bg-white">
                  <ContentPreviewMedia
                    kind={previewKind}
                    sourceUrl={previewSourceUrl}
                    title={values.file?.name || previewLabel}
                    imageClassName="h-56 w-full object-contain"
                    videoClassName="h-56 w-full bg-black object-contain"
                    pdfClassName="h-72 w-full"
                    fallbackClassName={
                      previewKind === "pdf" ? "h-72" : "h-56"
                    }
                    placeholderTone="light"
                    unknownTitle="Vista previa no disponible"
                    unknownMessage="No se puede mostrar una vista previa para este tipo de archivo."
                    missingTitle="Contenido no encontrado"
                    missingMessage="No se encontró el archivo que se intenta previsualizar."
                  />
                </div>

                <FileActionButton
                  fileUrl={previewSourceUrl}
                  label="Abrir archivo en otra pestaña"
                  className="inline-flex items-center gap-2 text-xs font-semibold text-(--color-red-main) underline-offset-2 hover:underline"
                  disabledClassName="inline-flex items-center gap-2 text-xs font-semibold text-(--color-text-secondary) disabled:cursor-not-allowed"
                  icon={<Link2 className="h-4 w-4" />}
                />
              </div>
            )}
          </div>

        </div>

        <button
          type="submit"
          className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-(--color-red-button) px-5 py-2.5 text-xs font-semibold text-white shadow-md shadow-(--color-red-button)/30 transition hover:bg-(--color-red-dark) focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--color-red-main) focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-70"
        >
          {submitting && <LoaderCircle className="h-4 w-4 animate-spin" />}
          {submitting ? "Guardando..." : submitLabel}
        </button>
      </fieldset>
    </form>
  );
}
