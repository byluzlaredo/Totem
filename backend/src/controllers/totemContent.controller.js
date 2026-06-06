import totemContentService from "../services/totemContent.service.js";
import { emitTotemContentsUpdated } from "../services/totemClientRealtime.service.js";

const CONTENT_TYPE_DETAIL_LABELS = {
    image: "imágenes",
    video: "videos",
    advertisement: "publicidades",
    news: "noticias",
    pdf: "PDFs",
}

function buildBatchAssignmentSummaryMessage(summary) {
    const created = Number(summary?.created ?? 0)
    const skippedExisting = Number(summary?.skippedExisting ?? 0)
    const skippedLimit = Number(summary?.skippedLimit ?? 0)
    const lines = [
        `Se crearon ${created} asignaciones.`,
        `Se omitieron ${skippedExisting} por conflicto de fechas con asignaciones vigentes o futuras.`,
        `Se omitieron ${skippedLimit} porque superaban el límite permitido.`,
    ]

    if (skippedLimit > 0 && summary?.limitReachedByContentType) {
        for (const [contentType, totemNames] of Object.entries(summary.limitReachedByContentType)) {
            if (!Array.isArray(totemNames) || totemNames.length === 0) {
                continue
            }

            const contentTypeLabel =
                CONTENT_TYPE_DETAIL_LABELS[contentType] ?? contentType

            lines.push(
                `Tótems que alcanzaron el límite de ${contentTypeLabel}: ${totemNames.join(", ")}`
            )
        }
    }

    return lines.join("\n")
}

export async function createTotemContent(req, res) {
    const result = await totemContentService.createAssignment(req.validated.body, req.authUser)
    const isSingleAssignment =
        result.assignmentMode === "single" && result.assignments.length === 1

    const totemIds = [...new Set(result.assignments.map((assignment) => assignment.totemId))]
    if (totemIds.length > 0) {
        emitTotemContentsUpdated({
            action: "assigned",
            totemIds,
            emittedAt: new Date().toISOString(),
        })
    }

    res.status(201).json({
        ok: true,
        message: isSingleAssignment
            ? "Contenido asignado al tótem correctamente"
            : buildBatchAssignmentSummaryMessage(result.summary),
        data: isSingleAssignment ? result.assignments[0] : result,
    })
}

export async function listTotemContents(req, res) {
    const result = await totemContentService.listAssignments(req.validated.query, req.authUser)

    res.status(200).json({
        ok: true,
        data: result.items,
        meta: result.meta,
    })
}

export async function getTotemContentById(req, res) {
    const { id } = req.validated.params
    const assignment = await totemContentService.getAssignmentById(id, req.authUser)

    res.status(200).json({
        ok: true,
        data: assignment,
    })
}

export async function updateTotemContent(req, res) {
    const { id } = req.validated.params
    const assignment = await totemContentService.updateAssignment(
      id,
      req.validated.body,
      req.authUser
    )

    emitTotemContentsUpdated({
        action: "updated",
        totemIds: [assignment.totemId],
        emittedAt: new Date().toISOString(),
    })

    res.status(200).json({
        ok: true,
        message: "Asignación actualizada correctamente",
        data: assignment,
    })
}

export async function deleteTotemContent(req, res) {
    const { id } = req.validated.params

    const assignment = await totemContentService.getAssignmentById(id, req.authUser)
    await totemContentService.deleteAssignment(id, req.authUser)

    emitTotemContentsUpdated({
        action: "deleted",
        totemIds: [assignment.totemId],
        emittedAt: new Date().toISOString(),
    })

    res.status(200).json({
        ok: true,
        message: "Asignación eliminada lógicamente correctamente",
    })
}
