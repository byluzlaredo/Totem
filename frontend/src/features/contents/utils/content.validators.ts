import type { ContentFormErrors, ContentFormValues } from "../../../types/content";
import {
  CONTENT_DESCRIPTION_MAX_LENGTH,
  CONTENT_TITLE_MAX_LENGTH,
  CONTENT_TITLE_MIN_LENGTH,
  getMaxFileSizeBytesForContentType,
  isFileRequiredForContentType,
  NEWS_DESCRIPTION_MIN_LENGTH,
} from "../../../constants/content";
import {
  isFileCompatibleWithContentType,
  isStoredFileUrlCompatibleWithContentType,
} from "./contentFileRules";
import { normalizeTextInputForSubmit } from "../../../utils/inputNormalization";

interface ContentValidationOptions {
  requireFile?: boolean;
  existingFileUrl?: string;
  validateExistingFileCompatibility?: boolean;
}

const CONTENT_TYPE_LABELS: Record<string, string> = {
  image: "imagen",
  video: "video",
  news: "noticia",
  advertisement: "publicidad",
  pdf: "PDF",
};

function getContentTypeLabel(contentType: string) {
  return CONTENT_TYPE_LABELS[contentType] ?? contentType;
}

export function normalizeContentFormValues(values: ContentFormValues): ContentFormValues {
  return {
    ...values,
    title: normalizeTextInputForSubmit(values.title),
    description: normalizeTextInputForSubmit(values.description),
    campusId: values.campusId,
  };
}

export function validateContentForm(
  values: ContentFormValues,
  options: ContentValidationOptions = {},
): ContentFormErrors {
  const errors: ContentFormErrors = {};
  const requireFile =
    Boolean(options.requireFile) &&
    isFileRequiredForContentType(values.contentType);

  if (!values.title) {
    errors.title = "El título es obligatorio";
  } else if (values.title.length < CONTENT_TITLE_MIN_LENGTH) {
    errors.title = `El título debe tener mínimo ${CONTENT_TITLE_MIN_LENGTH} caracteres`;
  } else if (values.title.length > CONTENT_TITLE_MAX_LENGTH) {
    errors.title = `El título debe tener máximo ${CONTENT_TITLE_MAX_LENGTH} caracteres`;
  }

  if (!["image", "video", "news", "advertisement", "pdf"].includes(values.contentType)) {
    errors.contentType = "El tipo de contenido es inválido";
  }

  if (values.description.length > CONTENT_DESCRIPTION_MAX_LENGTH) {
    errors.description = `La descripción debe tener máximo ${CONTENT_DESCRIPTION_MAX_LENGTH} caracteres`;
  }

  if (values.contentType === "news") {
    if (!values.description) {
      errors.description = "La descripción es obligatoria para noticias";
    } else if (values.description.length < NEWS_DESCRIPTION_MIN_LENGTH) {
      errors.description = `La descripción de noticias debe tener mínimo ${NEWS_DESCRIPTION_MIN_LENGTH} caracteres`;
    }
  }

  if (!["active", "inactive"].includes(values.status)) {
    errors.status = "El estado debe ser activo o inactivo";
  }

  if (!values.campusId) {
    errors.campusId = "Debes seleccionar un campus";
  } else {
    const parsedCampusId = Number(values.campusId);

    if (!Number.isInteger(parsedCampusId) || parsedCampusId <= 0) {
      errors.campusId = "Debes seleccionar un campus válido";
    }
  }

  if (values.file) {
    if (!isFileCompatibleWithContentType(values.file, values.contentType)) {
      errors.file = "El archivo seleccionado no es válido para el tipo de contenido indicado";
    }

    const maxFileSizeBytes = getMaxFileSizeBytesForContentType(values.contentType);

    if (values.file.size > maxFileSizeBytes) {
      const maxSizeMb = Math.round(maxFileSizeBytes / (1024 * 1024));
      errors.file = `El archivo excede el tamaño máximo permitido para ${getContentTypeLabel(values.contentType)} (${maxSizeMb} MB)`;
    }
  } else if (
    options.validateExistingFileCompatibility &&
    options.existingFileUrl &&
    !isStoredFileUrlCompatibleWithContentType(
      options.existingFileUrl,
      values.contentType,
    )
  ) {
    errors.file = "El archivo actual no es válido para el tipo de contenido seleccionado. Adjunta un archivo compatible.";
  }

  if (requireFile && !values.file && !errors.file) {
    errors.file = "Debes seleccionar un archivo";
  }

  return errors;
}
