import {
    ConflictError,
    NotFoundError,
    RequestValidationError,
} from "../errors/AppError.js";
import contentRepository from "../repositories/content.repository.js";
import totemContentRepository from "../repositories/totemContent.repository.js";
import {
    isContentFileUrlCompatibleWithType,
    isFileRequiredForContentType,
    persistContentFileFromTemp,
} from "../utils/contentFile.storage.js";
import pdfDocumentIngestionService from "./pdfDocumentIngestion.service.js";
import campusService from "./campus.service.js";
import storageService from "./storage.service.js";
import {
    applyCampusScopeToQuery,
    normalizeScopedCampusIdInput,
    requireCampusScopeId,
} from "../utils/campusAccess.js";
import {
    listActiveContentsWithUnavailableFileIds,
} from "../utils/contentOperationalFilters.js";

const NEWS_DESCRIPTION_MIN_LENGTH = 5
const DESCRIPTION_MAX_LENGTH = 500
const CONTENT_TYPE_LABELS = {
    image: 'imagen',
    video: 'video',
    news: 'noticia',
    advertisement: 'publicidad',
    pdf: 'PDF',
}

function getContentTypeLabel(contentType) {
    return CONTENT_TYPE_LABELS[contentType] ?? String(contentType)
}

function validateDescriptionMaxLength(description) {
    if (description === null || description === undefined) {
        return
    }

    if (String(description).length > DESCRIPTION_MAX_LENGTH) {
        throw new RequestValidationError(
            `La descripción debe tener máximo ${DESCRIPTION_MAX_LENGTH} caracteres`
        )
    }
}

function validateDescriptionRequiredForNews(contentType, description) {
    if (contentType !== 'news') {
        return
    }

    if (description === null || description === undefined) {
        throw new RequestValidationError(
            `La descripción es obligatoria para contenidos de tipo noticia y debe tener mínimo ${NEWS_DESCRIPTION_MIN_LENGTH} caracteres`
        )
    }

    if (String(description).trim().length < NEWS_DESCRIPTION_MIN_LENGTH) {
        throw new RequestValidationError(
            `La descripción debe tener mínimo ${NEWS_DESCRIPTION_MIN_LENGTH} caracteres para contenidos de tipo noticia`
        )
    }
}

async function syncPdfIndexSafely(content) {
    try {
        await pdfDocumentIngestionService.syncFromContentEntity(content)
    } catch (error) {
        console.error('No se pudo sincronizar la indexación PDF del contenido', {
            contentId: content?.id,
            error,
        })
    }
}

async function removePdfIndexSafely(contentId) {
    try {
        await pdfDocumentIngestionService.removeDocumentByContentId(contentId)
    } catch (error) {
        console.error('No se pudo eliminar la indexación PDF del contenido', {
            contentId,
            error,
        })
    }
}

function resolvePdfIndexActionOnUpdate({
    previousContentType,
    nextContentType,
    hasNewUploadedFile,
}) {
    const wasPdf = previousContentType === 'pdf'
    const willBePdf = nextContentType === 'pdf'

    if (wasPdf && !willBePdf) {
        return 'remove'
    }

    if (!willBePdf) {
        return 'skip'
    }

    if (!wasPdf && willBePdf) {
        return 'sync'
    }

    return hasNewUploadedFile ? 'sync' : 'skip'
}

async function removeStoredFileSafely(fileReference) {
    if (!fileReference) {
        return
    }

    await storageService.deleteFile({
        fileProvider: fileReference.fileProvider,
        filePath: fileReference.filePath,
        fileUrl: fileReference.fileUrl,
    })
}

class ContentService {
    assertCampusAccessOrNotFound(content, authUser = null) {
        const scopedCampusId = requireCampusScopeId(authUser)

        if (scopedCampusId === null) {
            return
        }

        if (Number(content?.campusId) !== scopedCampusId) {
            throw new NotFoundError('El contenido no existe')
        }
    }

    async createContent(data, uploadedFile, authUser = null) {
        const campusId = normalizeScopedCampusIdInput(data.campusId, authUser)
        await campusService.assertCampusIdExists(campusId)

        if (!uploadedFile && isFileRequiredForContentType(data.contentType)) {
            throw new RequestValidationError(
                `Debes adjuntar un archivo para el tipo de contenido ${getContentTypeLabel(data.contentType)}`
            )
        }

        validateDescriptionMaxLength(data.description)
        validateDescriptionRequiredForNews(data.contentType, data.description)

        let storedFile = null

        if (uploadedFile) {
            storedFile = await persistContentFileFromTemp(uploadedFile, data.contentType)
        }

        try {
            const createdContent = await contentRepository.create({
                ...data,
                campusId,
                fileUrl: storedFile?.fileUrl ?? null,
                filePath: storedFile?.filePath ?? null,
                fileProvider: storedFile?.fileProvider ?? null,
                fileMimeType: storedFile?.fileMimeType ?? null,
                fileSize: storedFile?.fileSize ?? null,
                status: data.status ?? 'active',
            })

            await syncPdfIndexSafely(createdContent)
            return createdContent
        } catch (error) {
            await removeStoredFileSafely(storedFile)

            throw error
        }
    }

    async listContents(query, authUser = null) {
        const scopedQuery = applyCampusScopeToQuery(query, authUser)
        const effectiveQuery = {
            ...scopedQuery,
        }

        if (
            effectiveQuery.operationalStatus === 'activeWithoutAssignment'
            || effectiveQuery.operationalStatus === 'activeWithUnavailableFile'
        ) {
            effectiveQuery.status = 'active'
        }

        if (effectiveQuery.operationalStatus === 'activeWithUnavailableFile') {
            effectiveQuery.contentIds = await listActiveContentsWithUnavailableFileIds(
                effectiveQuery.campusId ?? null
            )
        }

        const { count, rows } = await contentRepository.findAllWithPagination(
            effectiveQuery
        )

        return {
            items: rows,
            meta: {
                totalItems: count,
                totalPages: count === 0 ? 0 : Math.ceil(count / effectiveQuery.limit),
                currentPage: effectiveQuery.page,
                pageSize: effectiveQuery.limit,
            },
        }
    }

    async getContentById(id, authUser = null) {
        const content = await contentRepository.findById(id)

        if (!content) {
            throw new NotFoundError('El contenido no existe')
        }

        this.assertCampusAccessOrNotFound(content, authUser)
        return content
    }

    async updateContent(id, data, uploadedFile, authUser = null) {
        const content = await this.getContentById(id, authUser)

        const nextContentType = data.contentType ?? content.contentType
        const nextDescription =
            data.description !== undefined ? data.description : content.description
        const contentTypeChanged = data.contentType !== undefined && data.contentType !== content.contentType

        const scopedCampusId = requireCampusScopeId(authUser)
        let nextCampusId = data.campusId

        if (scopedCampusId !== null) {
            nextCampusId = normalizeScopedCampusIdInput(data.campusId, authUser)
        }

        if (
            nextCampusId !== undefined &&
            Number(nextCampusId) !== Number(content.campusId)
        ) {
            await campusService.assertCampusIdExists(nextCampusId)
        }

        if (
            contentTypeChanged &&
            !uploadedFile &&
            content.fileUrl &&
            !isContentFileUrlCompatibleWithType(content.fileUrl, nextContentType)
        ) {
            throw new RequestValidationError(
                'El archivo actual no es válido para el tipo de contenido seleccionado. Debes adjuntar un archivo compatible.'
            )
        }

        validateDescriptionMaxLength(nextDescription)
        validateDescriptionRequiredForNews(nextContentType, nextDescription)

        let storedFile = null

        if (uploadedFile) {
            storedFile = await persistContentFileFromTemp(uploadedFile, nextContentType)
        }

        const nextFileUrl = storedFile?.fileUrl ?? content.fileUrl

        if (!nextFileUrl && isFileRequiredForContentType(nextContentType)) {
            await removeStoredFileSafely(storedFile)

            throw new RequestValidationError(
                `Debes adjuntar un archivo para el tipo de contenido ${getContentTypeLabel(nextContentType)}`
            )
        }

        const previousFileUrl = content.fileUrl
        const previousFilePath = content.filePath ?? null
        const previousFileProvider = content.fileProvider ?? null
        const pdfIndexAction = resolvePdfIndexActionOnUpdate({
            previousContentType: content.contentType,
            nextContentType,
            hasNewUploadedFile: Boolean(storedFile),
        })

        try {
            const updatedContent = await contentRepository.update(content, {
                ...data,
                ...(nextCampusId !== undefined ? { campusId: nextCampusId } : {}),
                ...(storedFile
                    ? {
                        fileUrl: storedFile.fileUrl,
                        filePath: storedFile.filePath,
                        fileProvider: storedFile.fileProvider,
                        fileMimeType: storedFile.fileMimeType,
                        fileSize: storedFile.fileSize,
                    }
                    : {}),
            })

            if (pdfIndexAction === 'sync') {
                await syncPdfIndexSafely(updatedContent)
            } else if (pdfIndexAction === 'remove') {
                await removePdfIndexSafely(updatedContent.id)
            }

            if (storedFile) {
                const hasPreviousFile = Boolean(previousFileUrl || previousFilePath)
                const fileReferenceChanged = previousFilePath
                    ? (
                        previousFilePath !== storedFile.filePath
                        || previousFileProvider !== storedFile.fileProvider
                    )
                    : previousFileUrl !== storedFile.fileUrl

                if (hasPreviousFile && fileReferenceChanged) {
                    await removeStoredFileSafely({
                        fileProvider: previousFileProvider,
                        filePath: previousFilePath,
                        fileUrl: previousFileUrl,
                    })
                }
            }

            return updatedContent
        } catch (error) {
            await removeStoredFileSafely(storedFile)

            throw error
        }
    }

    async deleteContent(id, authUser = null) {
        const content = await this.getContentById(id, authUser)

        const activeAssignmentsCount =
            await totemContentRepository.countActiveAssignmentsByContentId(content.id)

        if (activeAssignmentsCount > 0) {
            throw new ConflictError(
                'Este contenido no se puede eliminar porque actualmente está asignado a uno o más tótems.'
            )
        }

        await contentRepository.softDelete(content)
        await removeStoredFileSafely({
            fileProvider: content.fileProvider,
            filePath: content.filePath,
            fileUrl: content.fileUrl,
        })
        await removePdfIndexSafely(content.id)
    }
}

export default new ContentService()

