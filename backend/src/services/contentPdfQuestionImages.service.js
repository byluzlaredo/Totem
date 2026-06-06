import { sequelize } from '../config/db.js'
import {
  NotFoundError,
  RequestValidationError,
} from '../errors/AppError.js'
import pdfChunkRepository from '../repositories/pdfChunk.repository.js'
import pdfDocumentRepository from '../repositories/pdfDocument.repository.js'
import pdfQuestionImageRepository from '../repositories/pdfQuestionImage.repository.js'
import {
  persistPdfQuestionImageFromTemp,
} from '../utils/contentFile.storage.js'
import contentService from './content.service.js'
import storageService from './storage.service.js'

const MAX_PDF_QUESTION_IMAGES_PER_CHUNK = 4

function mapPdfDocument(document) {
  if (!document) {
    return null
  }

  return {
    id: document.id,
    contentId: document.contentId,
    fileUrl: document.fileUrl,
    extractionStatus: document.extractionStatus,
    parsedPairsCount: document.parsedPairsCount,
    extractionError: document.extractionError,
    processedAt: document.processedAt,
    createdAt: document.createdAt,
    updatedAt: document.updatedAt,
  }
}

function mapQuestionImage(image) {
  return {
    id: image.id,
    pdfChunkId: image.pdfChunkId,
    fileUrl: image.fileUrl,
    sortOrder: image.sortOrder,
    status: image.status,
    createdAt: image.createdAt,
    updatedAt: image.updatedAt,
    deletedAt: image.deletedAt ?? null,
  }
}

function parseChunkImageCountRows(rows) {
  const imageCountByChunkId = new Map()

  for (const row of rows) {
    const chunkId = Number(row.pdfChunkId)

    if (!Number.isInteger(chunkId) || chunkId <= 0) {
      continue
    }

    const imageCount = Number(row.imageCount ?? 0)
    imageCountByChunkId.set(chunkId, Number.isFinite(imageCount) ? imageCount : 0)
  }

  return imageCountByChunkId
}

function buildPdfQuestionImageLimitReachedMessage() {
  return `Esta pregunta ya tiene el límite máximo de ${MAX_PDF_QUESTION_IMAGES_PER_CHUNK} imágenes.`
}

function buildPdfQuestionImageRemainingSlotsMessage(remainingSlots) {
  return `Esta pregunta solo permite ${remainingSlots} imagen${remainingSlots === 1 ? '' : 'es'} más.`
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

class ContentPdfQuestionImagesService {
  async getPdfContentOrThrow(contentId, authUser) {
    const content = await contentService.getContentById(contentId, authUser)

    if (content.contentType !== 'pdf') {
      throw new RequestValidationError(
        'Solo los contenidos de tipo PDF permiten gestionar imágenes de preguntas'
      )
    }

    return content
  }

  async getDocumentByContentOrThrow(contentId) {
    const document = await pdfDocumentRepository.findByContentId(contentId)

    if (!document) {
      throw new NotFoundError(
        'El contenido PDF no tiene un documento indexado para preguntas'
      )
    }

    return document
  }

  async getChunkWithinContentOrThrow(contentId, chunkId, authUser) {
    await this.getPdfContentOrThrow(contentId, authUser)
    const document = await this.getDocumentByContentOrThrow(contentId)
    const chunk = await pdfChunkRepository.findById(chunkId)

    if (!chunk || Number(chunk.pdfDocumentId) !== Number(document.id)) {
      throw new NotFoundError('La pregunta del PDF no existe para este contenido')
    }

    return {
      document,
      chunk,
    }
  }

  async getImageWithinContentOrThrow(contentId, imageId, authUser) {
    await this.getPdfContentOrThrow(contentId, authUser)

    const image = await pdfQuestionImageRepository.findById(imageId, {
      include: [
        {
          association: 'pdfChunk',
          required: true,
          attributes: ['id', 'pdfDocumentId'],
          include: [
            {
              association: 'pdfDocument',
              required: true,
              attributes: ['id', 'contentId'],
            },
          ],
        },
      ],
    })

    if (!image) {
      throw new NotFoundError('La imagen de pregunta no existe')
    }

    const chunkDocumentContentId = Number(image.pdfChunk?.pdfDocument?.contentId)
    if (chunkDocumentContentId !== Number(contentId)) {
      throw new NotFoundError('La imagen de pregunta no pertenece al contenido indicado')
    }

    return image
  }

  async listPdfQuestionChunks(contentId, authUser) {
    const content = await this.getPdfContentOrThrow(contentId, authUser)
    const document = await pdfDocumentRepository.findByContentId(content.id)

    if (!document) {
      return {
        content,
        pdfDocument: null,
        chunks: [],
      }
    }

    const chunks = await pdfChunkRepository.findByDocumentId(document.id)
    const chunkIds = chunks.map((chunk) => chunk.id)
    const imageCountRows = await pdfQuestionImageRepository.countByChunkIds(chunkIds)
    const imageCountByChunkId = parseChunkImageCountRows(imageCountRows)

    return {
      content,
      pdfDocument: mapPdfDocument(document),
      chunks: chunks.map((chunk) => ({
        id: chunk.id,
        pdfDocumentId: chunk.pdfDocumentId,
        chunkOrder: chunk.chunkOrder,
        questionText: chunk.questionText,
        answerText: chunk.answerText,
        questionKey: chunk.questionKey,
        imageCount: imageCountByChunkId.get(chunk.id) ?? 0,
        createdAt: chunk.createdAt,
        updatedAt: chunk.updatedAt,
      })),
    }
  }

  async listChunkImages(contentId, chunkId, authUser) {
    const { chunk } = await this.getChunkWithinContentOrThrow(contentId, chunkId, authUser)
    const images = await pdfQuestionImageRepository.findByChunkId(chunk.id)

    return {
      chunk: {
        id: chunk.id,
        chunkOrder: chunk.chunkOrder,
        questionText: chunk.questionText,
        answerText: chunk.answerText,
        questionKey: chunk.questionKey,
      },
      images: images.map(mapQuestionImage),
    }
  }

  async uploadChunkImages(contentId, chunkId, files, authUser) {
    if (!Array.isArray(files) || files.length === 0) {
      throw new RequestValidationError('Debes adjuntar al menos una imagen')
    }

    const { chunk } = await this.getChunkWithinContentOrThrow(contentId, chunkId, authUser)
    const existingImageCount = await pdfQuestionImageRepository.countByChunkId(chunk.id)
    const initialRemainingSlots =
      MAX_PDF_QUESTION_IMAGES_PER_CHUNK - Number(existingImageCount || 0)

    if (initialRemainingSlots <= 0) {
      throw new RequestValidationError(buildPdfQuestionImageLimitReachedMessage())
    }

    if (files.length > initialRemainingSlots) {
      throw new RequestValidationError(
        buildPdfQuestionImageRemainingSlotsMessage(initialRemainingSlots)
      )
    }

    const persistedFiles = []

    try {
      for (const file of files) {
        const persisted = await persistPdfQuestionImageFromTemp(file)
        persistedFiles.push(persisted)
      }

      await sequelize.transaction(async (transaction) => {
        const currentImageCount = await pdfQuestionImageRepository.countByChunkId(chunk.id, {
          transaction,
        })
        const remainingSlots =
          MAX_PDF_QUESTION_IMAGES_PER_CHUNK - Number(currentImageCount || 0)

        if (remainingSlots <= 0) {
          throw new RequestValidationError(buildPdfQuestionImageLimitReachedMessage())
        }

        if (persistedFiles.length > remainingSlots) {
          throw new RequestValidationError(
            buildPdfQuestionImageRemainingSlotsMessage(remainingSlots)
          )
        }

        const nextSortOrderStart =
          (await pdfQuestionImageRepository.findMaxSortOrderByChunkId(chunk.id, {
            transaction,
          })) + 1

        await pdfQuestionImageRepository.bulkCreate(
          persistedFiles.map((storedFile, index) => ({
            pdfChunkId: chunk.id,
            fileUrl: storedFile.fileUrl,
            filePath: storedFile.filePath,
            fileProvider: storedFile.fileProvider,
            fileMimeType: storedFile.fileMimeType,
            fileSize: storedFile.fileSize,
            sortOrder: nextSortOrderStart + index,
            status: 'active',
          })),
          { transaction }
        )
      })

      const images = await pdfQuestionImageRepository.findByChunkId(chunk.id)
      return images.map(mapQuestionImage)
    } catch (error) {
      for (const storedFile of persistedFiles) {
        await removeStoredFileSafely(storedFile)
      }
      throw error
    }
  }

  async updateImageMetadata(contentId, imageId, updates, authUser) {
    const image = await this.getImageWithinContentOrThrow(contentId, imageId, authUser)

    if (image.deletedAt) {
      throw new NotFoundError('La imagen de pregunta ya fue eliminada')
    }

    await sequelize.transaction(async (transaction) => {
      await pdfQuestionImageRepository.update(image, updates, { transaction })
    })

    const updatedImage = await this.getImageWithinContentOrThrow(contentId, imageId, authUser)
    return mapQuestionImage(updatedImage)
  }

  async replaceImageFile(contentId, imageId, file, authUser) {
    if (!file) {
      throw new RequestValidationError('Debes adjuntar una imagen para reemplazar')
    }

    const image = await this.getImageWithinContentOrThrow(contentId, imageId, authUser)

    if (image.deletedAt) {
      throw new NotFoundError('La imagen de pregunta ya fue eliminada')
    }

    const previousFileUrl = image.fileUrl
    const previousFilePath = image.filePath
    const previousFileProvider = image.fileProvider
    const persistedFile = await persistPdfQuestionImageFromTemp(file)

    try {
      await sequelize.transaction(async (transaction) => {
        await pdfQuestionImageRepository.update(
          image,
          {
            fileUrl: persistedFile.fileUrl,
            filePath: persistedFile.filePath,
            fileProvider: persistedFile.fileProvider,
            fileMimeType: persistedFile.fileMimeType,
            fileSize: persistedFile.fileSize,
          },
          { transaction }
        )
      })

      const hasPreviousFile = Boolean(previousFileUrl || previousFilePath)
      const fileReferenceChanged = previousFilePath
        ? (
          previousFilePath !== persistedFile.filePath
          || previousFileProvider !== persistedFile.fileProvider
        )
        : previousFileUrl !== persistedFile.fileUrl

      if (hasPreviousFile && fileReferenceChanged) {
        await removeStoredFileSafely({
          fileProvider: previousFileProvider,
          filePath: previousFilePath,
          fileUrl: previousFileUrl,
        })
      }

      const updatedImage = await this.getImageWithinContentOrThrow(contentId, imageId, authUser)
      return mapQuestionImage(updatedImage)
    } catch (error) {
      await removeStoredFileSafely(persistedFile)
      throw error
    }
  }

  async deleteImage(contentId, imageId, authUser) {
    const image = await this.getImageWithinContentOrThrow(contentId, imageId, authUser)

    if (image.deletedAt) {
      throw new NotFoundError('La imagen de pregunta ya fue eliminada')
    }

    await sequelize.transaction(async (transaction) => {
      await pdfQuestionImageRepository.softDelete(image, { transaction })
    })

    await removeStoredFileSafely({
      fileProvider: image.fileProvider,
      filePath: image.filePath,
      fileUrl: image.fileUrl,
    })

    return {
      id: image.id,
      deletedAt: new Date().toISOString(),
    }
  }
}

export default new ContentPdfQuestionImagesService()

