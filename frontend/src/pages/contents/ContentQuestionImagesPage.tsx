import { ArrowLeft, ImagePlus, Save, Search, Trash2, Upload, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import ConfirmDialog from "../../components/ConfirmDialog";
import EmptyState from "../../components/EmptyState";
import FeedbackMessage from "../../components/FeedbackMessage";
import FilterAutocompleteInput, {
  type FilterAutocompleteOption,
} from "../../components/FilterAutocompleteInput";
import LoadingState from "../../components/LoadingState";
import RowActionsMenu from "../../components/RowActionsMenu";
import TruncatedText from "../../components/TruncatedText";
import {
  MAX_PDF_QUESTION_IMAGE_FILES_PER_REQUEST,
  MAX_PDF_QUESTION_IMAGES_PER_CHUNK,
  MAX_PDF_QUESTION_IMAGE_SIZE_BYTES,
} from "../../constants/content";
import { LIST_SEARCH_MIN_CHARS } from "../../constants/search";
import { contentService } from "../../features/contents/services/content.service";
import ContentPreviewMedia from "../../features/contents/components/ContentPreviewMedia";
import { isFileCompatibleWithContentType } from "../../features/contents/utils/contentFileRules";
import type {
  ContentPdfQuestionChunksData,
  PdfQuestionImage,
  PdfQuestionImageStatus,
} from "../../types/content";
import { getErrorMessage } from "../../utils/getErrorMessage";
import { resolveAssetUrl } from "../../utils/assetUrl";
import { includesNormalizedText } from "../../utils/textSearch";

type ImageDraft = {
  sortOrder: number;
  status: PdfQuestionImageStatus;
};

type PendingUploadItem = {
  id: string;
  file: File;
  previewUrl: string;
};

type PendingReplacement = {
  imageId: number;
  file: File;
  previewUrl: string;
};

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

const IMAGE_ACTION_TRIGGER_CLASSNAME =
  "inline-flex h-9 w-9 items-center justify-center rounded-xl border border-transparent text-(--color-text-secondary) transition hover:border-(--color-border) hover:bg-white hover:text-(--color-text-main) focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--color-red-main)/25";
const MAX_PDF_QUESTION_IMAGE_SIZE_MB = Math.round(
  MAX_PDF_QUESTION_IMAGE_SIZE_BYTES / (1024 * 1024),
);

function buildPdfQuestionImageTypeMessage(fileName: string) {
  return `El archivo "${fileName}" no es válido. Formatos permitidos: JPG, PNG, WEBP, GIF, BMP y SVG.`;
}

function buildPdfQuestionImageSizeMessage(fileName: string) {
  return `El archivo "${fileName}" supera el tamaño máximo permitido (${MAX_PDF_QUESTION_IMAGE_SIZE_MB} MB).`;
}

function buildPdfQuestionImageQuestionLimitMessage() {
  return `Esta pregunta ya tiene el límite máximo de ${MAX_PDF_QUESTION_IMAGES_PER_CHUNK} imágenes.`;
}

function buildPdfQuestionImageRemainingSlotsMessage(remainingSlots: number) {
  return `Esta pregunta solo permite ${remainingSlots} imagen${remainingSlots === 1 ? "" : "es"} más.`;
}

function validatePdfQuestionImageFile(file: File) {
  const normalizedName = file.name.trim() || "archivo";

  if (!isFileCompatibleWithContentType(file, "image")) {
    return buildPdfQuestionImageTypeMessage(normalizedName);
  }

  if (file.size > MAX_PDF_QUESTION_IMAGE_SIZE_BYTES) {
    return buildPdfQuestionImageSizeMessage(normalizedName);
  }

  return null;
}

export default function ContentQuestionImagesPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const contentId = Number(id);
  const uploadInputRef = useRef<HTMLInputElement | null>(null);

  const [data, setData] = useState<ContentPdfQuestionChunksData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [searchQuestion, setSearchQuestion] = useState("");
  const [selectedChunkId, setSelectedChunkId] = useState<number | null>(null);
  const [images, setImages] = useState<PdfQuestionImage[]>([]);
  const [imagesLoading, setImagesLoading] = useState(false);
  const [imagesError, setImagesError] = useState("");
  const [uploadingImages, setUploadingImages] = useState(false);
  const [pendingUploadItems, setPendingUploadItems] = useState<PendingUploadItem[]>([]);
  const [savingImageId, setSavingImageId] = useState<number | null>(null);
  const [replacingImageId, setReplacingImageId] = useState<number | null>(null);
  const [pendingReplacement, setPendingReplacement] = useState<PendingReplacement | null>(
    null,
  );
  const [deletingImageId, setDeletingImageId] = useState<number | null>(null);
  const [confirmDeleteImageId, setConfirmDeleteImageId] = useState<number | null>(null);
  const [draftsByImageId, setDraftsByImageId] = useState<Record<number, ImageDraft>>({});
  const pendingUploadItemsRef = useRef<PendingUploadItem[]>([]);
  const pendingReplacementRef = useRef<PendingReplacement | null>(null);

  const clearPendingUploadItems = useCallback(() => {
    setPendingUploadItems((previous) => {
      previous.forEach((item) => {
        URL.revokeObjectURL(item.previewUrl);
      });
      return [];
    });
  }, []);

  const removePendingUploadItem = useCallback((pendingItemId: string) => {
    setPendingUploadItems((previous) => {
      const nextItems: PendingUploadItem[] = [];

      previous.forEach((item) => {
        if (item.id === pendingItemId) {
          URL.revokeObjectURL(item.previewUrl);
          return;
        }

        nextItems.push(item);
      });

      return nextItems;
    });
  }, []);

  const clearPendingReplacement = useCallback(() => {
    setPendingReplacement((previous) => {
      if (previous) {
        URL.revokeObjectURL(previous.previewUrl);
      }

      return null;
    });
  }, []);

  const loadChunkData = useCallback(
    async (preserveSelection = true) => {
      if (!Number.isInteger(contentId) || contentId <= 0) {
        setError("El identificador del contenido no es válido.");
        setLoading(false);
        return;
      }

      setLoading(true);
      setError("");

      try {
        const response = await contentService.getPdfQuestionChunks(contentId);
        const nextData = response.data;
        setData(nextData);

        if (!preserveSelection) {
          setSelectedChunkId(nextData.chunks[0]?.id ?? null);
          return;
        }

        setSelectedChunkId((previousChunkId) => {
          if (!previousChunkId) {
            return nextData.chunks[0]?.id ?? null;
          }

          const chunkStillExists = nextData.chunks.some(
            (chunk) => chunk.id === previousChunkId,
          );

          return chunkStillExists ? previousChunkId : (nextData.chunks[0]?.id ?? null);
        });
      } catch (err) {
        setData(null);
        setError(
          getErrorMessage(
            err,
            "No se pudo cargar la información de preguntas del contenido PDF.",
          ),
        );
      } finally {
        setLoading(false);
      }
    },
    [contentId],
  );

  const loadImagesByChunk = useCallback(
    async (chunkId: number) => {
      if (!Number.isInteger(chunkId) || chunkId <= 0) {
        setImages([]);
        setDraftsByImageId({});
        setImagesError("");
        return;
      }

      setImagesLoading(true);
      setImagesError("");

      try {
        const response = await contentService.getPdfChunkImages(contentId, chunkId);
        const nextImages = response.data.images;
        setImages(nextImages);
        setDraftsByImageId(
          Object.fromEntries(
            nextImages.map((image) => [
              image.id,
              {
                sortOrder: image.sortOrder,
                status: image.status,
              },
            ]),
          ),
        );
      } catch (err) {
        setImages([]);
        setDraftsByImageId({});
        setImagesError(
          getErrorMessage(err, "No se pudieron cargar las imágenes de la pregunta."),
        );
      } finally {
        setImagesLoading(false);
      }
    },
    [contentId],
  );

  useEffect(() => {
    void loadChunkData(true);
  }, [loadChunkData]);

  useEffect(() => {
    if (!selectedChunkId) {
      setImages([]);
      setDraftsByImageId({});
      setImagesError("");
      return;
    }

    void loadImagesByChunk(selectedChunkId);
  }, [loadImagesByChunk, selectedChunkId]);

  useEffect(() => {
    pendingUploadItemsRef.current = pendingUploadItems;
  }, [pendingUploadItems]);

  useEffect(() => {
    pendingReplacementRef.current = pendingReplacement;
  }, [pendingReplacement]);

  useEffect(() => {
    return () => {
      pendingUploadItemsRef.current.forEach((item) => {
        URL.revokeObjectURL(item.previewUrl);
      });

      if (pendingReplacementRef.current) {
        URL.revokeObjectURL(pendingReplacementRef.current.previewUrl);
      }
    };
  }, []);

  useEffect(() => {
    clearPendingUploadItems();
    clearPendingReplacement();

    if (uploadInputRef.current) {
      uploadInputRef.current.value = "";
    }
  }, [clearPendingReplacement, clearPendingUploadItems, selectedChunkId]);

  const filteredChunks = useMemo(() => {
    if (!data) {
      return [];
    }

    const normalizedQuery = searchQuestion.trim();
    if (normalizedQuery.length < LIST_SEARCH_MIN_CHARS) {
      return data.chunks;
    }

    return data.chunks.filter((chunk) =>
      includesNormalizedText(
        `${chunk.questionText} ${chunk.answerText}`,
        normalizedQuery,
      ),
    );
  }, [data, searchQuestion]);

  const selectedChunk = useMemo(() => {
    if (!data || !selectedChunkId) {
      return null;
    }

    return data.chunks.find((chunk) => chunk.id === selectedChunkId) ?? null;
  }, [data, selectedChunkId]);

  const pendingReplacementImage = useMemo(() => {
    if (!pendingReplacement) {
      return null;
    }

    return images.find((image) => image.id === pendingReplacement.imageId) ?? null;
  }, [images, pendingReplacement]);

  const currentChunkImageCount = images.length;
  const remainingChunkImageSlots = Math.max(
    0,
    MAX_PDF_QUESTION_IMAGES_PER_CHUNK - currentChunkImageCount,
  );
  const remainingChunkImageSlotsWithPending = Math.max(
    0,
    remainingChunkImageSlots - pendingUploadItems.length,
  );
  const isChunkImageLimitReached = remainingChunkImageSlots === 0;

  const searchOptions = useMemo<FilterAutocompleteOption[]>(
    () =>
      (data?.chunks ?? []).map((chunk) => ({
        value: chunk.questionText,
        label: chunk.questionText,
        description: `Imágenes asociadas: ${chunk.imageCount}`,
      })),
    [data?.chunks],
  );

  const pageTitle = useMemo(
    () => `Gestionar imágenes de preguntas - ${data?.content.title ?? "Contenido PDF"}`,
    [data?.content.title],
  );

  function handleStageUploadFiles(fileList: FileList | null) {
    if (!fileList || fileList.length === 0 || !selectedChunkId) {
      return;
    }

    if (imagesLoading) {
      setError("Espera a que termine la carga de imágenes de la pregunta seleccionada.");
      return;
    }

    setError("");
    setSuccess("");

    if (isChunkImageLimitReached) {
      setError(buildPdfQuestionImageQuestionLimitMessage());
      return;
    }

    const selectedFiles = Array.from(fileList);
    const acceptedFiles: File[] = [];
    const rejectedMessages: string[] = [];

    for (const file of selectedFiles) {
      const validationMessage = validatePdfQuestionImageFile(file);

      if (validationMessage) {
        rejectedMessages.push(validationMessage);
        continue;
      }

      acceptedFiles.push(file);
    }

    const remainingSlotsByRequest =
      MAX_PDF_QUESTION_IMAGE_FILES_PER_REQUEST - pendingUploadItems.length;
    const remainingSlotsByQuestion =
      MAX_PDF_QUESTION_IMAGES_PER_CHUNK -
      currentChunkImageCount -
      pendingUploadItems.length;
    const remainingSlots = Math.min(remainingSlotsByRequest, remainingSlotsByQuestion);
    const filesToStage =
      remainingSlots > 0 ? acceptedFiles.slice(0, remainingSlots) : [];
    const omittedCount = acceptedFiles.length - filesToStage.length;

    if (remainingSlotsByQuestion <= 0) {
      rejectedMessages.unshift(buildPdfQuestionImageQuestionLimitMessage());
    } else if (remainingSlotsByRequest <= 0) {
      rejectedMessages.unshift(
        `Solo puedes preparar hasta ${MAX_PDF_QUESTION_IMAGE_FILES_PER_REQUEST} imágenes por carga.`,
      );
    } else if (omittedCount > 0) {
      if (remainingSlotsByQuestion < remainingSlotsByRequest) {
        rejectedMessages.push(
          `${buildPdfQuestionImageRemainingSlotsMessage(
            remainingSlotsByQuestion,
          )} Se omitieron ${omittedCount} archivo${omittedCount === 1 ? "" : "s"}.`,
        );
      } else {
        rejectedMessages.push(
          `Solo puedes cargar ${MAX_PDF_QUESTION_IMAGE_FILES_PER_REQUEST} imágenes por solicitud. Se omitieron ${omittedCount} archivo${omittedCount === 1 ? "" : "s"}.`,
        );
      }
    }

    if (filesToStage.length > 0) {
      const nextItems: PendingUploadItem[] = filesToStage.map((file, index) => ({
        id: `${Date.now()}-${index}-${file.name}-${file.size}-${file.lastModified}`,
        file,
        previewUrl: URL.createObjectURL(file),
      }));

      setPendingUploadItems((previous) => [...previous, ...nextItems]);
    }

    if (rejectedMessages.length > 0) {
      setError(rejectedMessages.join("\n"));
    }

    if (uploadInputRef.current) {
      uploadInputRef.current.value = "";
    }
  }

  async function handleConfirmUploadSelectedFiles() {
    if (pendingUploadItems.length === 0 || !selectedChunkId) {
      return;
    }

    if (imagesLoading) {
      setError("Espera a que termine la carga de imágenes de la pregunta seleccionada.");
      return;
    }

    if (pendingUploadItems.length > MAX_PDF_QUESTION_IMAGE_FILES_PER_REQUEST) {
      setError(
        `Solo puedes cargar ${MAX_PDF_QUESTION_IMAGE_FILES_PER_REQUEST} imágenes por solicitud.`,
      );
      return;
    }

    if (isChunkImageLimitReached) {
      setError(buildPdfQuestionImageQuestionLimitMessage());
      return;
    }

    if (pendingUploadItems.length > remainingChunkImageSlots) {
      setError(buildPdfQuestionImageRemainingSlotsMessage(remainingChunkImageSlots));
      return;
    }

    const chunkId = selectedChunkId;
    const filesToUpload = pendingUploadItems.map((item) => item.file);

    for (const file of filesToUpload) {
      const validationMessage = validatePdfQuestionImageFile(file);

      if (validationMessage) {
        setError(validationMessage);
        return;
      }
    }

    setUploadingImages(true);
    setError("");
    setSuccess("");

    try {
      await contentService.uploadPdfChunkImages(
        contentId,
        chunkId,
        filesToUpload,
      );
      setSuccess("Imágenes registradas correctamente.");
      clearPendingUploadItems();
      await Promise.all([loadChunkData(true), loadImagesByChunk(chunkId)]);
    } catch (err) {
      setError(getErrorMessage(err, "No se pudieron subir las imágenes."));
    } finally {
      setUploadingImages(false);
    }
  }

  function handleDraftChange(
    imageId: number,
    field: keyof ImageDraft,
    value: number | PdfQuestionImageStatus,
  ) {
    setDraftsByImageId((previous) => ({
      ...previous,
      [imageId]: {
        ...previous[imageId],
        [field]: value,
      },
    }));
  }

  async function handleSaveImageMetadata(imageId: number) {
    const draft = draftsByImageId[imageId];
    if (!draft) {
      return;
    }

    setSavingImageId(imageId);
    setError("");
    setSuccess("");

    try {
      const response = await contentService.updatePdfQuestionImageMetadata(contentId, imageId, {
        sortOrder: draft.sortOrder,
        status: draft.status,
      });
      const updatedImage = response.data;
      setImages((previous) =>
        previous
          .map((image) => (image.id === imageId ? updatedImage : image))
          .sort((left, right) =>
            left.sortOrder === right.sortOrder
              ? left.id - right.id
              : left.sortOrder - right.sortOrder,
          ),
      );
      setSuccess("Metadatos de la imagen actualizados.");
      await loadChunkData(true);
    } catch (err) {
      setError(getErrorMessage(err, "No se pudieron actualizar los datos de la imagen."));
    } finally {
      setSavingImageId(null);
    }
  }

  function handleStageReplacementFile(imageId: number, file: File | null) {
    if (!file) {
      return;
    }

    const validationMessage = validatePdfQuestionImageFile(file);

    if (validationMessage) {
      setError(validationMessage);
      return;
    }

    setError("");
    setSuccess("");
    setPendingReplacement((previous) => {
      if (previous) {
        URL.revokeObjectURL(previous.previewUrl);
      }

      return {
        imageId,
        file,
        previewUrl: URL.createObjectURL(file),
      };
    });
  }

  async function handleReplaceImageFile(imageId: number, file: File | null) {
    if (!file) {
      return false;
    }

    const validationMessage = validatePdfQuestionImageFile(file);

    if (validationMessage) {
      setError(validationMessage);
      return false;
    }

    setReplacingImageId(imageId);
    setError("");
    setSuccess("");

    try {
      const response = await contentService.replacePdfQuestionImageFile(contentId, imageId, file);
      const updatedImage = response.data;
      setImages((previous) =>
        previous.map((image) => (image.id === imageId ? updatedImage : image)),
      );
      setSuccess("Imagen reemplazada correctamente.");
      return true;
    } catch (err) {
      setError(getErrorMessage(err, "No se pudo reemplazar la imagen."));
      return false;
    } finally {
      setReplacingImageId(null);
    }
  }

  async function handleConfirmPendingReplacement() {
    if (!pendingReplacement) {
      return;
    }

    const { imageId, file } = pendingReplacement;
    const replaced = await handleReplaceImageFile(imageId, file);

    if (replaced) {
      clearPendingReplacement();
    }
  }

  useEffect(() => {
    if (!pendingReplacement) {
      return;
    }

    if (!pendingReplacementImage) {
      clearPendingReplacement();
    }
  }, [clearPendingReplacement, pendingReplacement, pendingReplacementImage]);

  async function handleConfirmDeleteImage() {
    if (!confirmDeleteImageId) {
      return;
    }

    const imageId = confirmDeleteImageId;
    setDeletingImageId(imageId);
    setError("");
    setSuccess("");

    try {
      await contentService.deletePdfQuestionImage(contentId, imageId);
      setImages((previous) => previous.filter((image) => image.id !== imageId));
      setDraftsByImageId((previous) => {
        const next = { ...previous };
        delete next[imageId];
        return next;
      });
      setSuccess("Imagen eliminada correctamente.");
      await loadChunkData(true);
    } catch (err) {
      setError(getErrorMessage(err, "No se pudo eliminar la imagen."));
    } finally {
      setDeletingImageId(null);
      setConfirmDeleteImageId(null);
    }
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-(--color-bg) px-4 py-6 sm:px-6 lg:px-10">
        <LoadingState message="Cargando gestión de imágenes de preguntas..." />
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-(--color-bg) px-4 py-6 sm:px-6 lg:px-10">
      <div className="mx-auto flex w-full max-w-none flex-col gap-4">
        {success ? (
          <FeedbackMessage
            type="success"
            message={success}
            onClose={() => setSuccess("")}
          />
        ) : null}

        {error ? (
          <FeedbackMessage type="error" message={error} onClose={() => setError("")} />
        ) : null}

        <section className="space-y-4">
          <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0 flex-1 space-y-1">
              <p className="text-xs font-semibold tracking-[0.08em] text-(--color-red-main)">
                Gestión de contenidos PDF
              </p>
              <TruncatedText
                as="p"
                value={pageTitle}
                title={pageTitle}
                className="text-2xl font-bold tracking-tight text-(--color-text-main)"
              />
              <p className="text-xs text-(--color-text-secondary)">
                Administra las imágenes asociadas a cada pregunta extraída del PDF.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <span
                className={`inline-flex items-center rounded-full px-3 py-0.5 text-xs font-semibold ${getExtractionStatusBadgeClass(
                  data?.pdfDocument?.extractionStatus ?? null,
                )}`}
              >
                {getExtractionStatusLabel(data?.pdfDocument?.extractionStatus ?? null)}
              </span>

              <button
                type="button"
                onClick={() => navigate("/admin/contents")}
                className="inline-flex shrink-0 items-center gap-2 rounded-xl border border-(--color-border) bg-white px-4 py-2 text-xs font-semibold text-(--color-text-main) transition hover:bg-[#f7f7f7]"
              >
                <ArrowLeft className="h-4 w-4" />
                Volver al listado
              </button>
            </div>
          </header>
        </section>

        {!data?.pdfDocument ? (
          <EmptyState
            title="Sin preguntas extraídas"
            description="Este PDF aún no tiene preguntas indexadas. Verifica que el archivo siga el formato pregunta/respuesta."
          />
        ) : null}

        {data?.pdfDocument?.extractionStatus === "failed" ? (
          <FeedbackMessage
            type="error"
            message={
              data.pdfDocument.extractionError
              || "La extracción del PDF falló. Revisa el contenido y vuelve a subir el archivo."
            }
          />
        ) : null}

        {data?.pdfDocument ? (
          <section className="grid gap-4 lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)]">
            <article className="rounded-2xl border border-(--color-border) bg-white p-4 shadow-sm lg:sticky lg:top-20 lg:self-start">
              <h2 className="text-sm font-bold text-(--color-text-main)">Preguntas extraídas: {data.chunks.length}</h2>

              <div className="mt-4">
                <FilterAutocompleteInput
                  id="pdf-question-search"
                  label="Buscar pregunta"
                  value={searchQuestion}
                  icon={Search}
                  hideLabel
                  placeholder="Buscar por pregunta"
                  options={searchOptions}
                  onValueChange={(value) => setSearchQuestion(value)}
                />
              </div>

              <div className="mt-4 max-h-[56vh] space-y-2 overflow-y-auto pr-1 lg:max-h-[calc(100vh-14rem)]">
                {filteredChunks.length === 0 ? (
                  <EmptyState
                    title="Sin coincidencias"
                    description="No hay preguntas que coincidan con la búsqueda."
                  />
                ) : (
                  filteredChunks.map((chunk) => {
                    const isSelected = selectedChunkId === chunk.id;

                    return (
                      <button
                        key={chunk.id}
                        type="button"
                        onClick={() => setSelectedChunkId(chunk.id)}
                        className={`w-full rounded-2xl border px-3 py-3 text-left transition ${isSelected
                          ? "border-(--color-red-main) bg-[#fff3f6]"
                          : "border-(--color-border) bg-[#f8f9fb] hover:border-(--color-red-main)/30"
                          }`}
                      >
                        <p className="text-xs font-semibold tracking-[0.06em] text-(--color-text-secondary)">
                          Pregunta #{chunk.chunkOrder}
                        </p>
                        <p className="mt-1 whitespace-normal wrap-break-word text-xs font-semibold leading-relaxed text-(--color-text-main)">
                          {chunk.questionText}
                        </p>
                        <p className="mt-2 text-[11px] text-(--color-text-secondary)">
                          Imágenes: {chunk.imageCount}
                        </p>
                      </button>
                    );
                  })
                )}
              </div>
            </article>

            <article className="rounded-3xl border border-(--color-border) bg-white p-4 shadow-sm">
              {!selectedChunk ? (
                <EmptyState
                  title="Selecciona una pregunta"
                  description="Selecciona una pregunta para gestionar sus imágenes asociadas."
                />
              ) : (
                <div className="space-y-4">
                  <header className="space-y-2 rounded-2xl border border-(--color-border) bg-[#f8f9fb] p-4">
                    <p className="text-xs font-semibold tracking-[0.06em] text-(--color-text-secondary)">
                      Pregunta #{selectedChunk.chunkOrder}
                    </p>
                    <p className="text-xs font-semibold text-(--color-text-main)">
                      {selectedChunk.questionText}
                    </p>
                    <p className="text-xs text-(--color-text-secondary)">
                      {selectedChunk.answerText}
                    </p>
                  </header>

                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h3 className="text-sm font-bold text-(--color-text-main)">
                      Imágenes asociadas
                    </h3>

                    <div className="flex items-center gap-2">
                      <input
                        ref={uploadInputRef}
                        type="file"
                        multiple
                        accept="image/*"
                        className="hidden"
                        onChange={(event) => {
                          handleStageUploadFiles(event.target.files);
                        }}
                      />

                      <button
                        type="button"
                        onClick={() => uploadInputRef.current?.click()}
                        disabled={uploadingImages || imagesLoading || isChunkImageLimitReached}
                        className="inline-flex items-center gap-2 rounded-xl bg-(--color-red-button) px-4 py-2 text-xs font-semibold text-white transition hover:bg-(--color-red-dark) disabled:cursor-not-allowed disabled:opacity-70"
                      >
                        <ImagePlus className="h-4 w-4" />
                        {pendingUploadItems.length > 0 ? "Agregar imágenes" : "Subir imágenes"}
                      </button>
                    </div>
                  </div>

                  <p className="text-[11px] text-(--color-text-secondary)">
                    Esta pregunta tiene {currentChunkImageCount}/
                    {MAX_PDF_QUESTION_IMAGES_PER_CHUNK} imágenes registradas (no eliminadas).{" "}
                    Cupos disponibles para agregar: {remainingChunkImageSlotsWithPending}.{" "}
                    Máximo {MAX_PDF_QUESTION_IMAGE_FILES_PER_REQUEST} imágenes por
                    solicitud, hasta {MAX_PDF_QUESTION_IMAGE_SIZE_MB} MB por archivo.
                    Formatos: JPG, PNG, WEBP, GIF, BMP y SVG.
                  </p>

                  {isChunkImageLimitReached ? (
                    <p className="text-xs font-medium text-(--color-red-main)">
                      {buildPdfQuestionImageQuestionLimitMessage()}
                    </p>
                  ) : null}

                  {pendingUploadItems.length > 0 ? (
                    <section className="space-y-3 rounded-2xl border border-(--color-border) bg-[#f8f9fb] p-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="text-xs font-semibold text-(--color-text-main)">
                          Archivos listos para subir: {pendingUploadItems.length}
                        </p>

                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              void handleConfirmUploadSelectedFiles();
                            }}
                            disabled={
                              uploadingImages ||
                              imagesLoading ||
                              pendingUploadItems.length > remainingChunkImageSlots
                            }
                            className="inline-flex items-center gap-2 rounded-xl bg-(--color-red-button) px-3 py-1.5 text-[11px] font-semibold text-white transition hover:bg-(--color-red-dark) disabled:cursor-not-allowed disabled:opacity-70"
                          >
                            <Upload className="h-3.5 w-3.5" />
                            {uploadingImages ? "Subiendo..." : "Confirmar subida"}
                          </button>

                          <button
                            type="button"
                            onClick={clearPendingUploadItems}
                            disabled={uploadingImages}
                            className="inline-flex items-center gap-2 rounded-xl border border-(--color-border) bg-white px-3 py-1.5 text-[11px] font-semibold text-(--color-text-main) transition hover:bg-[#f7f7f7] disabled:cursor-not-allowed disabled:opacity-70"
                          >
                            Cancelar
                          </button>
                        </div>
                      </div>

                      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                        {pendingUploadItems.map((pendingItem) => (
                          <article
                            key={pendingItem.id}
                            className="rounded-xl border border-(--color-border) bg-white p-2"
                          >
                            <div className="overflow-hidden rounded-lg border border-(--color-border) bg-[#f8f9fb]">
                              <div className="h-20 w-full sm:h-24">
                                <ContentPreviewMedia
                                  kind="image"
                                  sourceUrl={pendingItem.previewUrl}
                                  title={pendingItem.file.name}
                                  imageClassName="h-full w-full bg-[#f8f9fb] object-contain"
                                  videoClassName="h-full w-full bg-[#f8f9fb] object-contain"
                                  pdfClassName="h-full w-full bg-[#f8f9fb]"
                                  fallbackClassName="h-full"
                                  placeholderTone="light"
                                  unknownTitle="Vista no disponible"
                                  unknownMessage="No se puede previsualizar esta imagen."
                                  missingTitle="Imagen no disponible"
                                  missingMessage="No se pudo cargar la imagen."
                                />
                              </div>
                            </div>

                            <div className="mt-2 flex items-start justify-between gap-2">
                              <p className="line-clamp-2 text-[11px] text-(--color-text-secondary)">
                                {pendingItem.file.name}
                              </p>
                              <button
                                type="button"
                                onClick={() => removePendingUploadItem(pendingItem.id)}
                                className="inline-flex h-6 w-6 items-center justify-center rounded-lg border border-(--color-border) bg-white text-(--color-text-secondary) transition hover:bg-[#f7f7f7] hover:text-(--color-text-main)"
                                aria-label={`Quitar ${pendingItem.file.name}`}
                              >
                                <X className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          </article>
                        ))}
                      </div>
                    </section>
                  ) : null}

                  {pendingReplacement ? (
                    <section className="space-y-3 rounded-2xl border border-(--color-border) bg-[#f8f9fb] p-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <p className="text-xs font-semibold text-(--color-text-main)">
                            Reemplazo pendiente
                          </p>
                          <p className="text-[11px] text-(--color-text-secondary)">
                            Archivo seleccionado: {pendingReplacement.file.name}
                          </p>
                        </div>

                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              void handleConfirmPendingReplacement();
                            }}
                            disabled={replacingImageId === pendingReplacement.imageId}
                            className="inline-flex items-center gap-2 rounded-xl bg-(--color-red-button) px-3 py-1.5 text-[11px] font-semibold text-white transition hover:bg-(--color-red-dark) disabled:cursor-not-allowed disabled:opacity-70"
                          >
                            <Upload className="h-3.5 w-3.5" />
                            {replacingImageId === pendingReplacement.imageId
                              ? "Reemplazando..."
                              : "Confirmar reemplazo"}
                          </button>

                          <button
                            type="button"
                            onClick={clearPendingReplacement}
                            disabled={replacingImageId === pendingReplacement.imageId}
                            className="inline-flex items-center gap-2 rounded-xl border border-(--color-border) bg-white px-3 py-1.5 text-[11px] font-semibold text-(--color-text-main) transition hover:bg-[#f7f7f7] disabled:cursor-not-allowed disabled:opacity-70"
                          >
                            Cancelar
                          </button>
                        </div>
                      </div>

                      <div className="grid gap-2 sm:grid-cols-2">
                        <article className="rounded-xl border border-(--color-border) bg-white p-2">
                          <p className="mb-1 text-[11px] font-semibold tracking-[0.05em] text-(--color-text-secondary)">
                            Imagen actual
                          </p>
                          <div className="overflow-hidden rounded-lg border border-(--color-border) bg-[#f8f9fb]">
                            <div className="h-20 w-full sm:h-24">
                              <ContentPreviewMedia
                                kind="image"
                                sourceUrl={
                                  resolveAssetUrl(pendingReplacementImage?.fileUrl ?? null) ?? ""
                                }
                                title={`Imagen ${pendingReplacement.imageId}`}
                                imageClassName="h-full w-full bg-[#f8f9fb] object-contain"
                                videoClassName="h-full w-full bg-[#f8f9fb] object-contain"
                                pdfClassName="h-full w-full bg-[#f8f9fb]"
                                fallbackClassName="h-full"
                                placeholderTone="light"
                                unknownTitle="Vista no disponible"
                                unknownMessage="No se puede previsualizar esta imagen."
                                missingTitle="Imagen no disponible"
                                missingMessage="No se pudo cargar la imagen."
                              />
                            </div>
                          </div>
                        </article>

                        <article className="rounded-xl border border-(--color-border) bg-white p-2">
                          <p className="mb-1 text-[11px] font-semibold tracking-[0.05em] text-(--color-text-secondary)">
                            Nueva imagen
                          </p>
                          <div className="overflow-hidden rounded-lg border border-(--color-border) bg-[#f8f9fb]">
                            <div className="h-20 w-full sm:h-24">
                              <ContentPreviewMedia
                                kind="image"
                                sourceUrl={pendingReplacement.previewUrl}
                                title={pendingReplacement.file.name}
                                imageClassName="h-full w-full bg-[#f8f9fb] object-contain"
                                videoClassName="h-full w-full bg-[#f8f9fb] object-contain"
                                pdfClassName="h-full w-full bg-[#f8f9fb]"
                                fallbackClassName="h-full"
                                placeholderTone="light"
                                unknownTitle="Vista no disponible"
                                unknownMessage="No se puede previsualizar esta imagen."
                                missingTitle="Imagen no disponible"
                                missingMessage="No se pudo cargar la imagen."
                              />
                            </div>
                          </div>
                        </article>
                      </div>
                    </section>
                  ) : null}

                  {imagesError ? (
                    <FeedbackMessage type="error" message={imagesError} />
                  ) : null}

                  {imagesLoading ? (
                    <LoadingState message="Cargando imágenes asociadas..." />
                  ) : images.length === 0 ? (
                    <EmptyState
                      title="Sin imágenes asociadas"
                      description="Esta pregunta aún no tiene imágenes asociadas."
                    />
                  ) : (
                    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                      {images.map((image) => {
                        const draft = draftsByImageId[image.id] ?? {
                          sortOrder: image.sortOrder,
                          status: image.status,
                        };
                        const imageUrl = resolveAssetUrl(image.fileUrl);
                        const isSaving = savingImageId === image.id;
                        const isReplacing = replacingImageId === image.id;
                        const isDeleting = deletingImageId === image.id;

                        return (
                          <article
                            key={image.id}
                            className="rounded-2xl border border-(--color-border) bg-[#f8f9fb] p-3"
                          >
                            <div className="relative mb-3 overflow-hidden rounded-xl border border-(--color-border) bg-black">
                              <div className="h-32 w-full sm:h-36">
                                <ContentPreviewMedia
                                  kind="image"
                                  sourceUrl={imageUrl}
                                  title={`Imagen ${image.id}`}
                                  imageClassName="h-full w-full bg-[#f8f9fb] object-contain"
                                  videoClassName="h-full w-full bg-[#f8f9fb] object-contain"
                                  pdfClassName="h-full w-full bg-[#f8f9fb]"
                                  fallbackClassName="h-full"
                                  placeholderTone="light"
                                  unknownTitle="Vista no disponible"
                                  unknownMessage="No se puede previsualizar esta imagen."
                                  missingTitle="Imagen no disponible"
                                  missingMessage="No se pudo cargar la imagen."
                                />
                              </div>
                            </div>

                            <div className="grid gap-2 sm:grid-cols-2">
                              <label className="space-y-1">
                                <span className="text-[11px] font-semibold tracking-[0.06em] text-(--color-text-secondary)">
                                  Orden
                                </span>
                                <input
                                  type="number"
                                  min={0}
                                  value={draft.sortOrder}
                                  onChange={(event) =>
                                    handleDraftChange(
                                      image.id,
                                      "sortOrder",
                                      Number(event.target.value || 0),
                                    )
                                  }
                                  className="w-full rounded-xl border border-(--color-border) bg-white px-3 py-1.5 text-xs text-(--color-text-main) outline-none focus:border-(--color-red-main) focus:ring-2 focus:ring-(--color-red-main)/20"
                                />
                              </label>

                              <label className="space-y-1">
                                <span className="text-[11px] font-semibold tracking-[0.06em] text-(--color-text-secondary)">
                                  Estado
                                </span>
                                <select
                                  value={draft.status}
                                  onChange={(event) =>
                                    handleDraftChange(
                                      image.id,
                                      "status",
                                      event.target.value as PdfQuestionImageStatus,
                                    )
                                  }
                                  className="w-full rounded-xl border border-(--color-border) bg-white px-3 py-1.5 text-xs text-(--color-text-main) outline-none focus:border-(--color-red-main) focus:ring-2 focus:ring-(--color-red-main)/20"
                                >
                                  <option value="active">Activo</option>
                                  <option value="inactive">Inactivo</option>
                                </select>
                              </label>
                            </div>

                            <div className="mt-3 flex items-center justify-end">
                              <input
                                id={`replace-image-file-${image.id}`}
                                type="file"
                                accept="image/*"
                                className="hidden"
                                disabled={isReplacing || isSaving || isDeleting}
                                onChange={(event) => {
                                  const selectedFile = event.target.files?.[0] ?? null;
                                  handleStageReplacementFile(image.id, selectedFile);
                                  event.currentTarget.value = "";
                                }}
                              />

                              <RowActionsMenu
                                triggerLabel="Opciones de imagen"
                                triggerClassName={IMAGE_ACTION_TRIGGER_CLASSNAME}
                                actions={[
                                  {
                                    key: "save-image-metadata",
                                    label: isSaving ? "Guardando..." : "Guardar cambios",
                                    icon: <Save className="h-4 w-4" />,
                                    disabled: isSaving || isReplacing || isDeleting,
                                    onSelect: () => {
                                      void handleSaveImageMetadata(image.id);
                                    },
                                  },
                                  {
                                    key: "replace-image-file",
                                    label:
                                      pendingReplacement?.imageId === image.id
                                        ? "Cambiar archivo"
                                        : (isReplacing ? "Reemplazando..." : "Reemplazar"),
                                    icon: <Upload className="h-4 w-4" />,
                                    disabled: isReplacing || isSaving || isDeleting,
                                    onSelect: () => {
                                      const fileInput = document.getElementById(
                                        `replace-image-file-${image.id}`,
                                      );

                                      if (fileInput instanceof HTMLInputElement) {
                                        fileInput.click();
                                      }
                                    },
                                  },
                                  {
                                    key: "delete-image",
                                    label: isDeleting ? "Eliminando..." : "Eliminar",
                                    icon: <Trash2 className="h-4 w-4" />,
                                    tone: "danger",
                                    disabled: isDeleting || isSaving || isReplacing,
                                    onSelect: () => setConfirmDeleteImageId(image.id),
                                  },
                                ]}
                              />
                            </div>
                          </article>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </article>
          </section>
        ) : null}
      </div>

      <ConfirmDialog
        isOpen={Boolean(confirmDeleteImageId)}
        title="Eliminar imagen"
        message="La imagen será eliminada y el archivo también se eliminará del servidor. ¿Deseas continuar?"
        confirmLabel="Sí, eliminar"
        loading={deletingImageId !== null}
        onConfirm={() => {
          void handleConfirmDeleteImage();
        }}
        onCancel={() => {
          if (deletingImageId) {
            return;
          }

          setConfirmDeleteImageId(null);
        }}
      />
    </main>
  );
}
