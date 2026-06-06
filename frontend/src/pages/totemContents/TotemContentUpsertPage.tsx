import {
  ArrowLeft,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import FeedbackMessage from "../../components/FeedbackMessage";
import LoadingState from "../../components/LoadingState";
import TruncatedText from "../../components/TruncatedText";
import TotemContentForm from "../../features/totemContents/components/TotemContentForm";
import {
  getTotemContentFieldErrors,
  totemContentService,
} from "../../features/totemContents/services/totemContent.service";
import { contentService } from "../../features/contents/services/content.service";
import { totemService } from "../../features/totems/services/totem.service";
import type { Content } from "../../types/content";
import type { ApiItemResponse, Totem } from "../../types/totem";
import type {
  TotemContent,
  TotemContentBatchCreateResult,
  TotemContentFormErrors,
  TotemContentFormValues,
} from "../../types/totemContent";
import { getErrorMessage } from "../../utils/getErrorMessage";

interface TotemContentUpsertPageProps {
  mode: "create" | "edit";
}

type AssignmentFlashMessageState = {
  message: string;
  messageType: "success" | "neutral";
};

function toDateTimeLocalValue(value: string | null) {
  if (!value) return "";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  const timezoneOffset = date.getTimezoneOffset() * 60_000;
  const localDate = new Date(date.getTime() - timezoneOffset);

  return localDate.toISOString().slice(0, 16);
}

function buildEditInitialValues(assignment: TotemContent): TotemContentFormValues {
  return {
    assignmentMode: "single",
    totemId: String(assignment.totemId),
    totemIds: [],
    contentAssignmentMode: "single",
    contentId: String(assignment.contentId),
    contentIds: [],
    status: assignment.status,
    startAt: toDateTimeLocalValue(assignment.startAt),
    endAt: toDateTimeLocalValue(assignment.endAt),
    priority: String(assignment.priority),
    sortOrder: String(assignment.sortOrder),
  };
}

function prependIfMissingById<T extends { id: number }>(
  items: T[],
  nextItem: T | null,
) {
  if (!nextItem) {
    return items;
  }

  if (items.some((item) => item.id === nextItem.id)) {
    return items;
  }

  return [nextItem, ...items];
}

function resolveCreateFeedback(
  response: ApiItemResponse<TotemContent | TotemContentBatchCreateResult>,
): AssignmentFlashMessageState {
  const summaryCandidate =
    response.data &&
      typeof response.data === "object" &&
      "summary" in response.data
      ? (response.data as { summary?: TotemContentBatchCreateResult["summary"] })
        .summary
      : undefined;

  const hasSummary = Boolean(summaryCandidate);
  const summary = hasSummary ? summaryCandidate : undefined;
  const hasSummaryNumbers =
    summary &&
    typeof summary.created === "number" &&
    typeof summary.skippedExisting === "number" &&
    typeof summary.skippedLimit === "number";

  const message =
    typeof response.message === "string" && response.message.trim().length > 0
      ? response.message
      : hasSummaryNumbers
        ? `Se crearon ${summary.created} asignaciones.\nSe omitieron ${summary.skippedExisting} por conflicto de fechas con asignaciones vigentes o futuras.\nSe omitieron ${summary.skippedLimit} porque superaban el límite permitido.`
        : "Asignación registrada correctamente";

  const messageType: AssignmentFlashMessageState["messageType"] =
    hasSummaryNumbers && summary.created === 0 ? "neutral" : "success";

  return {
    message,
    messageType,
  };
}

export default function TotemContentUpsertPage({
  mode,
}: TotemContentUpsertPageProps) {
  const { id } = useParams();
  const navigate = useNavigate();
  const isEditMode = mode === "edit";
  const assignmentId = id ? Number(id) : null;
  const hasValidAssignmentId =
    assignmentId !== null && Number.isInteger(assignmentId) && assignmentId > 0;

  const [formTotems, setFormTotems] = useState<Totem[]>([]);
  const [formContents, setFormContents] = useState<Content[]>([]);
  const [editingAssignment, setEditingAssignment] = useState<TotemContent | null>(
    null,
  );
  const [loading, setLoading] = useState(isEditMode);
  const [submitLoading, setSubmitLoading] = useState(false);
  const [error, setError] = useState("");
  const [serverErrors, setServerErrors] = useState<TotemContentFormErrors>({});

  const includesInactiveLinkedEntities = useMemo(
    () => {
      if (!isEditMode) {
        return false;
      }

      const linkedTotem = formTotems[0] ?? null;
      const linkedContent = formContents[0] ?? null;

      return (
        (linkedTotem ? linkedTotem.state !== "active" : false) ||
        (linkedContent ? linkedContent.status !== "active" : false)
      );
    },
    [formContents, formTotems, isEditMode],
  );

  useEffect(() => {
    let isMounted = true;

    async function loadFormData() {
      if (!isEditMode) {
        setLoading(false);
        return;
      }

      if (isEditMode && !hasValidAssignmentId) {
        setError("El identificador de la asignación no es válido.");
        setLoading(false);
        return;
      }

      setLoading(true);
      setError("");
      setServerErrors({});

      try {
        let nextFormTotems: Totem[] = [];
        let nextFormContents: Content[] = [];
        let nextEditingAssignment: TotemContent | null = null;

        if (isEditMode && hasValidAssignmentId && assignmentId !== null) {
          const assignmentResponse = await totemContentService.getAssignmentById(
            assignmentId,
          );
          const loadedAssignment = assignmentResponse.data;
          nextEditingAssignment = loadedAssignment;

          const [linkedTotem, linkedContent] = await Promise.all([
            totemService
              .getTotemById(loadedAssignment.totemId)
              .then((response) => response.data)
              .catch(() => null),
            contentService
              .getContentById(loadedAssignment.contentId)
              .then((response) => response.data)
              .catch(() => null),
          ]);

          nextFormTotems = prependIfMissingById(nextFormTotems, linkedTotem);
          nextFormContents = prependIfMissingById(nextFormContents, linkedContent);
        }

        if (!isMounted) return;

        setFormTotems(nextFormTotems);
        setFormContents(nextFormContents);
        setEditingAssignment(nextEditingAssignment);
      } catch (err) {
        if (!isMounted) return;

        setError(
          getErrorMessage(
            err,
            isEditMode
              ? "No se pudo cargar la asignación para editar."
              : "No se pudo cargar la información para crear la asignación.",
          ),
        );
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    void loadFormData();

    return () => {
      isMounted = false;
    };
  }, [assignmentId, hasValidAssignmentId, isEditMode]);

  async function handleSubmit(values: TotemContentFormValues) {
    if (isEditMode && !editingAssignment) {
      setError("No se encontró la asignación que deseas editar.");
      return;
    }

    setSubmitLoading(true);
    setError("");
    setServerErrors({});

    try {
      if (isEditMode && editingAssignment) {
        await totemContentService.updateAssignment(editingAssignment.id, values);
        const messageState: AssignmentFlashMessageState = {
          message: "Asignación actualizada correctamente",
          messageType: "success",
        };
        navigate("/admin/assignments", { state: messageState });
        return;
      }

      const response = await totemContentService.createAssignment(values);
      navigate("/admin/assignments", { state: resolveCreateFeedback(response) });
    } catch (err) {
      const nextFieldErrors = getTotemContentFieldErrors(err);
      setServerErrors(nextFieldErrors);

      if (Object.keys(nextFieldErrors).length === 0) {
        setError(getErrorMessage(err, "No se pudo guardar la asignación"));
      }
    } finally {
      setSubmitLoading(false);
    }
  }

  function handleCancel() {
    if (submitLoading) return;
    navigate("/admin/assignments");
  }

  const pageTitle = isEditMode
    ? `Editar Asignación${editingAssignment ? ` - ${editingAssignment.totem?.name}` : ""}`
    : "Crear Asignación Tótem-Contenido";

  if (loading) {
    return (
      <main className="min-h-screen bg-(--color-bg) px-4 py-6 sm:px-6 lg:px-10">
        <div className="mx-auto flex w-full max-w-none flex-col gap-4">
          <LoadingState
            message={
              isEditMode
                ? "Cargando asignación para edición..."
                : "Cargando formulario de asignación..."
            }
          />
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-(--color-bg) px-4 py-6 sm:px-6 lg:px-10">
      <div className="mx-auto flex w-full max-w-none flex-col gap-4">
        {error && (
          <FeedbackMessage
            type="error"
            message={error}
            onClose={() => setError("")}
          />
        )}

        <section className="space-y-4">
          <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0 flex-1 space-y-1">
              <p className="text-xs font-semibold tracking-[0.08em] text-(--color-red-main)">
                {isEditMode ? "Edición de asignación" : "Nueva asignación"}
              </p>
              <TruncatedText
                as="p"
                value={pageTitle}
                className="text-2xl font-bold tracking-tight text-(--color-text-main) sm:text-2xl"
                title={pageTitle}
              />
              <p className="text-xs text-(--color-text-secondary) sm:text-xs">
                {isEditMode
                  ? "Actualiza el contenido, prioridad, fechas y estado de la asignación."
                  : "Define a qué tótems y contenidos se aplicará la nueva asignación."}
              </p>
            </div>

            <Link
              to="/admin/assignments"
              className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl border border-(--color-border) bg-white px-4 py-2 text-xs font-semibold text-(--color-text-main) transition hover:bg-[#f7f7f7]"
            >
              <ArrowLeft className="h-4 w-4" />
              Volver al listado
            </Link>
          </header>

          {isEditMode && !editingAssignment ? (
            <div className="rounded-2xl border border-(--color-border) bg-white p-5 sm:p-6">
              <p className="text-xs text-(--color-text-secondary)">
                No fue posible cargar la asignación solicitada para su edición.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {includesInactiveLinkedEntities && (
                <div className="rounded-2xl border border-[#f1d7a6] bg-[#fff8ed] p-2.5 text-xs text-[#8a5a12]">
                  Esta asignación incluye un tótem o contenido no activo. Se muestra
                  para que puedas editarlo, pero las reglas de negocio del backend se
                  mantienen al guardar.
                </div>
              )}

              <div
                className={`rounded-2xl border border-(--color-border) bg-[#f8f9fb] p-2.5 text-xs text-(--color-text-secondary) ${includesInactiveLinkedEntities ? "mt-4" : ""}`}
              >
                <p>
                  Revisa tótems, contenidos, fechas y prioridad antes de guardar.
                  Puedes cancelar en cualquier momento para volver al listado.
                </p>
              </div>

              <TotemContentForm
                key={
                  isEditMode && editingAssignment
                    ? `assignment-edit-${editingAssignment.id}`
                    : "assignment-create"
                }
                mode={isEditMode ? "edit" : "create"}
                initialValues={
                  isEditMode && editingAssignment
                    ? buildEditInitialValues(editingAssignment)
                    : undefined
                }
                totems={formTotems}
                contents={formContents}
                submitLabel={isEditMode ? "Guardar cambios" : "Crear Asignación"}
                cancelLabel="Cancelar"
                onCancel={handleCancel}
                modeEnabled={!isEditMode}
                submitting={submitLoading}
                serverErrors={serverErrors}
                onSubmit={handleSubmit}
              />
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
