import { ApiError } from "../services/api";

type FieldErrorMap = Record<string, string>;

const KNOWN_FIELD_KEYS = [
  "name",
  "email",
  "token",
  "currentPassword",
  "newPassword",
  "confirmNewPassword",
  "password",
  "role",
  "status",
  "campus",
  "code",
  "linkCode",
  "link_code",
  "ttlMinutes",
  "ttl_minutes",
  "headquarters",
  "title",
  "description",
  "contentType",
  "content_type",
  "file",
  "startAt",
  "start_at",
  "endAt",
  "end_at",
  "type",
  "durationHours",
  "duration_hours",
  "durationMinutes",
  "duration_minutes",
  "targetScope",
  "target_scope",
  "targetCampus",
  "target_campus",
  "targetCampusId",
  "target_campus_id",
  "campusId",
  "campus_id",
  "targetTotemIds",
  "target_totem_ids",
  "assignmentMode",
  "assignment_mode",
  "totemId",
  "totem_id",
  "totemIds",
  "totem_ids",
  "contentId",
  "content_id",
  "contentIds",
  "content_ids",
  "contentAssignmentMode",
  "content_assignment_mode",
  "priority",
  "sortOrder",
  "sort_order",
] as const;

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function normalizeFieldKey(field: string) {
  const trimmed = field.trim();

  if (trimmed.length === 0) {
    return "";
  }

  return trimmed.replace(/[_-\s]+([a-zA-Z0-9])/g, (_, char: string) =>
    char.toUpperCase()
  );
}

function setFieldError(
  target: FieldErrorMap,
  field: string,
  message: string
) {
  const normalizedField = normalizeFieldKey(field);
  const normalizedMessage = message.trim();

  if (!normalizedField || !normalizedMessage) {
    return;
  }

  if (!target[normalizedField]) {
    target[normalizedField] = normalizedMessage;
  }
}

function normalizeMessageForMatching(message: string) {
  return message
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function extractFromObject(raw: Record<string, unknown>): FieldErrorMap {
  const fieldErrors: FieldErrorMap = {};

  for (const [rawKey, rawValue] of Object.entries(raw)) {
    if (
      rawKey === "message" ||
      rawKey === "ok" ||
      rawKey === "status"
    ) {
      continue;
    }

    if (typeof rawValue === "string") {
      setFieldError(fieldErrors, rawKey, rawValue);
    }
  }

  return fieldErrors;
}

function extractFromArray(raw: unknown[]): FieldErrorMap {
  const fieldErrors: FieldErrorMap = {};

  for (const item of raw) {
    if (!isPlainObject(item)) {
      continue;
    }

    const fieldCandidate =
      typeof item.field === "string"
        ? item.field
        : typeof item.path === "string"
          ? item.path
          : null;
    const messageCandidate =
      typeof item.message === "string" ? item.message : null;

    if (fieldCandidate && messageCandidate) {
      setFieldError(fieldErrors, fieldCandidate, messageCandidate);
    }
  }

  return fieldErrors;
}

function extractFieldErrors(raw: unknown): FieldErrorMap {
  if (Array.isArray(raw)) {
    return extractFromArray(raw);
  }

  if (isPlainObject(raw)) {
    return extractFromObject(raw);
  }

  return {};
}

function inferFromMessage(message: string): FieldErrorMap {
  const fieldErrors: FieldErrorMap = {};
  const normalizedMessage = message.trim();
  const searchableMessage = normalizeMessageForMatching(normalizedMessage);

  if (!normalizedMessage) {
    return fieldErrors;
  }

  if (
    searchableMessage.match(/la fecha startAt no puede ser mayor a endAt/i) ||
    searchableMessage.match(/la fecha de inicio no puede ser mayor a la fecha de fin/i)
  ) {
    setFieldError(fieldErrors, "endAt", normalizedMessage);
    return fieldErrors;
  }

  const sortedFieldKeys = [...KNOWN_FIELD_KEYS].sort(
    (left, right) => right.length - left.length
  );

  for (const fieldKey of sortedFieldKeys) {
    const expression = new RegExp(`\\b${escapeRegExp(fieldKey)}\\b`, "i");

    if (expression.test(searchableMessage)) {
      setFieldError(fieldErrors, fieldKey, normalizedMessage);
    }
  }

  if (searchableMessage.match(/duracion del codigo temporal/i)) {
    setFieldError(fieldErrors, "ttlMinutes", normalizedMessage);
  }

  if (
    searchableMessage.match(/codigo temporal/i) &&
    !searchableMessage.match(/duracion del codigo temporal/i)
  ) {
    setFieldError(fieldErrors, "linkCode", normalizedMessage);
  }

  if (searchableMessage.match(/token de dispositivo/i)) {
    setFieldError(fieldErrors, "deviceToken", normalizedMessage);
  }

  if (searchableMessage.match(/token de actualizacion/i)) {
    setFieldError(fieldErrors, "refreshToken", normalizedMessage);
  }

  if (searchableMessage.match(/estado del totem/i)) {
    setFieldError(fieldErrors, "state", normalizedMessage);
  }

  if (
    searchableMessage.match(/\bcodigo\b/i) &&
    !searchableMessage.match(/codigo temporal/i)
  ) {
    setFieldError(fieldErrors, "code", normalizedMessage);
  }

  if (searchableMessage.match(/\bnombre\b/i)) {
    setFieldError(fieldErrors, "name", normalizedMessage);
  }

  if (searchableMessage.match(/\bcorreo\b/i)) {
    setFieldError(fieldErrors, "email", normalizedMessage);
  }

  if (searchableMessage.match(/\brol\b/i)) {
    setFieldError(fieldErrors, "role", normalizedMessage);
  }

  if (
    searchableMessage.match(/\bestado\b/i) &&
    !searchableMessage.match(/estado del totem/i)
  ) {
    setFieldError(fieldErrors, "status", normalizedMessage);
  }

  if (searchableMessage.match(/\btitulo\b/i)) {
    setFieldError(fieldErrors, "title", normalizedMessage);
  }

  if (searchableMessage.match(/\bdescripcion\b/i)) {
    setFieldError(fieldErrors, "description", normalizedMessage);
  }

  if (searchableMessage.match(/tipo de contenido/i)) {
    setFieldError(fieldErrors, "contentType", normalizedMessage);
  }

  if (searchableMessage.match(/\barchivo\b/i)) {
    setFieldError(fieldErrors, "file", normalizedMessage);
  }

  if (searchableMessage.match(/fecha de inicio/i)) {
    setFieldError(fieldErrors, "startAt", normalizedMessage);
  }

  if (searchableMessage.match(/fecha de fin/i)) {
    setFieldError(fieldErrors, "endAt", normalizedMessage);
  }

  if (searchableMessage.match(/tipo de notificacion|filtro de tipo/i)) {
    setFieldError(fieldErrors, "type", normalizedMessage);
  }

  if (searchableMessage.match(/totems de destino|totems especificos/i)) {
    setFieldError(fieldErrors, "targetTotemIds", normalizedMessage);
  }

  if (searchableMessage.match(/campus de destino/i)) {
    setFieldError(fieldErrors, "targetCampusId", normalizedMessage);
  }

  if (
    searchableMessage.match(/\bdestino\b/i) &&
    !searchableMessage.match(/cuando el destino|campus de destino|totems de destino|totems especificos/i)
  ) {
    setFieldError(fieldErrors, "targetScope", normalizedMessage);
  }

  if (
    searchableMessage.match(/\bcampus\b/i) &&
    !searchableMessage.match(/campus de destino/i)
  ) {
    setFieldError(fieldErrors, "campusId", normalizedMessage);
  }

  if (searchableMessage.match(/modo de asignacion/i)) {
    setFieldError(fieldErrors, "assignmentMode", normalizedMessage);
  }

  if (searchableMessage.match(/varios totems|al menos un totem/i)) {
    setFieldError(fieldErrors, "totemIds", normalizedMessage);
  }

  if (searchableMessage.match(/un totem unico|un totem para/i)) {
    setFieldError(fieldErrors, "totemId", normalizedMessage);
  }

  if (searchableMessage.match(/varios contenidos|al menos un contenido|uno o varios contenidos/i)) {
    setFieldError(fieldErrors, "contentIds", normalizedMessage);
  }

  if (searchableMessage.match(/un contenido/i)) {
    setFieldError(fieldErrors, "contentId", normalizedMessage);
  }

  if (searchableMessage.match(/\borden\b/i)) {
    setFieldError(fieldErrors, "sortOrder", normalizedMessage);
  }

  if (searchableMessage.match(/\bprioridad\b/i)) {
    setFieldError(fieldErrors, "priority", normalizedMessage);
  }

  if (searchableMessage.match(/\bpregunta\b/i)) {
    setFieldError(fieldErrors, "questionText", normalizedMessage);
  }

  if (searchableMessage.match(/\bmensaje\b/i)) {
    setFieldError(fieldErrors, "message", normalizedMessage);
  }

  if (searchableMessage.match(/ya existe un totem con (ese|este) nombre/i)) {
    setFieldError(fieldErrors, "name", normalizedMessage);
  }

  if (searchableMessage.match(/ya existe un totem con (ese|este) codigo/i)) {
    setFieldError(fieldErrors, "code", normalizedMessage);
  }

  if (searchableMessage.match(/ya existe un usuario con ese correo/i)) {
    setFieldError(fieldErrors, "email", normalizedMessage);
  }

  if (searchableMessage.match(/debes seleccionar un totem/i)) {
    setFieldError(fieldErrors, "totemId", normalizedMessage);
  }

  if (searchableMessage.match(/debes seleccionar un contenido/i)) {
    setFieldError(fieldErrors, "contentId", normalizedMessage);
  }

  if (searchableMessage.match(/debes adjuntar un archivo/i)) {
    setFieldError(fieldErrors, "file", normalizedMessage);
  }

  if (searchableMessage.match(/uno o mas totems seleccionados no existen/i)) {
    setFieldError(fieldErrors, "targetTotemIds", normalizedMessage);
  }

  if (searchableMessage.match(/la referencia de totem no existe/i)) {
    setFieldError(fieldErrors, "targetTotemIds", normalizedMessage);
  }

  if (searchableMessage.match(/uno o mas campus seleccionados no existen/i)) {
    setFieldError(fieldErrors, "targetCampusId", normalizedMessage);
  }

  if (searchableMessage.match(/la referencia de.*campus/i)) {
    setFieldError(fieldErrors, "targetCampusId", normalizedMessage);
  }

  if (searchableMessage.match(/solo puedes asignar totems activos/i)) {
    setFieldError(fieldErrors, "totemIds", normalizedMessage);
  }

  if (searchableMessage.match(/solo puedes asignar contenidos activos/i)) {
    setFieldError(fieldErrors, "contentIds", normalizedMessage);
  }

  if (searchableMessage.match(/el contenido ya esta asignado al totem indicado/i)) {
    setFieldError(fieldErrors, "contentId", normalizedMessage);
  }

  if (searchableMessage.match(/asignacion vigente o futura.*fechas solapadas/i)) {
    setFieldError(fieldErrors, "contentId", normalizedMessage);
  }

  return fieldErrors;
}

export function getApiFieldErrors(error: unknown): FieldErrorMap {
  if (!(error instanceof ApiError)) {
    return {};
  }

  const explicitFieldErrors = extractFieldErrors(
    error.fieldErrors ?? error.details
  );

  if (Object.keys(explicitFieldErrors).length > 0) {
    return explicitFieldErrors;
  }

  return inferFromMessage(error.message);
}

export function pickFieldErrors<TField extends string>(
  error: unknown,
  allowedFields: readonly TField[]
): Partial<Record<TField, string>> {
  const apiFieldErrors = getApiFieldErrors(error);
  const picked: Partial<Record<TField, string>> = {};

  for (const allowedField of allowedFields) {
    const message = apiFieldErrors[allowedField];

    if (typeof message === "string" && message.trim().length > 0) {
      picked[allowedField] = message;
    }
  }

  return picked;
}
