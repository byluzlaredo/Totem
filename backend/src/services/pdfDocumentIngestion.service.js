import pdfParse from 'pdf-parse'
import { sequelize } from '../config/db.js'
import pdfChunkRepository from '../repositories/pdfChunk.repository.js'
import pdfDocumentRepository from '../repositories/pdfDocument.repository.js'
import pdfQuestionImageRepository from '../repositories/pdfQuestionImage.repository.js'
import { buildStableQuestionKeysFromPairs } from '../utils/pdfQuestionKey.js'
import pdfQuestionExtractionService from './pdfQuestionExtraction.service.js'
import storageService from './storage.service.js'

function buildNowDate() {
  return new Date()
}

function trimErrorMessage(error) {
  if (error && typeof error === 'object' && error.code === 'ENOENT') {
    return 'No se encontró el archivo PDF en el servidor. Vuelve a cargar el PDF para reindexar las preguntas.'
  }

  const message =
    error instanceof Error ? error.message : 'No se pudo procesar el contenido del PDF'

  return message.slice(0, 500)
}

async function readPdfTextFromStorage({ fileProvider, filePath, fileUrl }) {
  const { buffer: fileBuffer } = await storageService.readFileBuffer({
    fileProvider,
    filePath,
    fileUrl,
  })
  const parsed = await pdfParse(fileBuffer)
  return parsed.text ?? ''
}

class PdfDocumentIngestionService {
  async listQuestionImageFileReferencesByChunkIds(chunkIds, options = {}) {
    if (!Array.isArray(chunkIds) || chunkIds.length === 0) {
      return []
    }

    const images = await pdfQuestionImageRepository.findByChunkIds(chunkIds, {
      includeDeleted: true,
      ...options,
    })

    const references = []
    const uniqueKeys = new Set()

    for (const image of images) {
      const fileUrl = typeof image.fileUrl === 'string' ? image.fileUrl : null
      const filePath = typeof image.filePath === 'string' ? image.filePath : null
      const fileProvider = typeof image.fileProvider === 'string' ? image.fileProvider : null
      const uniqueKey = `${fileProvider ?? ''}::${filePath ?? ''}::${fileUrl ?? ''}`

      if (uniqueKeys.has(uniqueKey)) {
        continue
      }

      if (!fileUrl && !filePath) {
        continue
      }

      uniqueKeys.add(uniqueKey)
      references.push({
        fileUrl,
        filePath,
        fileProvider,
      })
    }

    return references
  }

  async removeQuestionImageFilesByReferences(fileReferences) {
    for (const fileReference of fileReferences) {
      await storageService.deleteFile(fileReference)
    }
  }

  async removeDocumentByContentId(contentId) {
    const existingDocument = await pdfDocumentRepository.findByContentId(contentId)

    if (!existingDocument) {
      return
    }

    const existingChunks = await pdfChunkRepository.findByDocumentId(existingDocument.id)
    const existingChunkIds = existingChunks.map((chunk) => chunk.id)
    const questionImageFileReferences = await this.listQuestionImageFileReferencesByChunkIds(
      existingChunkIds
    )

    await sequelize.transaction(async (transaction) => {
      await pdfChunkRepository.deleteByDocumentId(existingDocument.id, { transaction })
      await pdfDocumentRepository.softDelete(existingDocument, { transaction })
    })

    await this.removeQuestionImageFilesByReferences(questionImageFileReferences)
  }

  async ensureDocumentRecord(contentId, fileUrl, transaction) {
    const existingDocument = await pdfDocumentRepository.findByContentId(contentId, {
      transaction,
    })

    if (existingDocument) {
      await pdfDocumentRepository.update(
        existingDocument,
        {
          fileUrl,
          extractionStatus: 'processing',
          extractionError: null,
          processedAt: null,
          parsedPairsCount: 0,
        },
        { transaction }
      )

      return existingDocument
    }

    const deletedDocument = await pdfDocumentRepository.findDeletedByContentId(contentId, {
      transaction,
    })

    if (deletedDocument) {
      await pdfDocumentRepository.restore(deletedDocument, { transaction })
      await pdfDocumentRepository.update(
        deletedDocument,
        {
          fileUrl,
          extractionStatus: 'processing',
          extractionError: null,
          processedAt: null,
          parsedPairsCount: 0,
        },
        { transaction }
      )

      return deletedDocument
    }

    return pdfDocumentRepository.create(
      {
        contentId,
        fileUrl,
        extractionStatus: 'processing',
        extractionError: null,
        processedAt: null,
        parsedPairsCount: 0,
      },
      { transaction }
    )
  }

  async markIngestionFailed(contentId, fileUrl, error) {
    const now = buildNowDate()
    const extractionError = trimErrorMessage(error)
    let questionImageFileReferences = []

    await sequelize.transaction(async (transaction) => {
      const document = await this.ensureDocumentRecord(contentId, fileUrl, transaction)
      const existingChunks = await pdfChunkRepository.findByDocumentId(document.id, {
        transaction,
      })
      const existingChunkIds = existingChunks.map((chunk) => chunk.id)
      questionImageFileReferences = await this.listQuestionImageFileReferencesByChunkIds(
        existingChunkIds,
        { transaction }
      )

      await pdfChunkRepository.deleteByDocumentId(document.id, { transaction })

      await pdfDocumentRepository.update(
        document,
        {
          extractionStatus: 'failed',
          extractedText: null,
          parsedPairsCount: 0,
          processedAt: now,
          extractionError,
        },
        { transaction }
      )
    })

    await this.removeQuestionImageFilesByReferences(questionImageFileReferences)
  }

  async syncPdfContent({ contentId, fileUrl, filePath, fileProvider }) {
    try {
      const rawText = await readPdfTextFromStorage({
        fileProvider,
        filePath,
        fileUrl,
      })
      const pairs = pdfQuestionExtractionService.extractPairs(rawText)
      const keyedPairs = buildStableQuestionKeysFromPairs(pairs)
      const now = buildNowDate()
      let removedQuestionImageFileReferences = []

      await sequelize.transaction(async (transaction) => {
        const document = await this.ensureDocumentRecord(contentId, fileUrl, transaction)
        const existingChunks = await pdfChunkRepository.findByDocumentId(document.id, {
          transaction,
        })
        const keyedQuestionSet = new Set(keyedPairs.map((pair) => pair.questionKey))
        const removedChunkIds = existingChunks
          .filter((chunk) => !keyedQuestionSet.has(chunk.questionKey))
          .map((chunk) => chunk.id)

        if (removedChunkIds.length > 0) {
          removedQuestionImageFileReferences = await this.listQuestionImageFileReferencesByChunkIds(
            removedChunkIds,
            { transaction }
          )
        }

        if (keyedPairs.length > 0) {
          const chunkRows = keyedPairs.map((pair, index) => ({
            pdfDocumentId: document.id,
            chunkOrder: index + 1,
            questionText: pair.questionText,
            answerText: pair.answerText,
            questionKey: pair.questionKey,
          }))

          await pdfChunkRepository.upsertByDocumentAndQuestionKey(chunkRows, {
            transaction,
          })

          const keptQuestionKeys = chunkRows.map((row) => row.questionKey)
          await pdfChunkRepository.deleteByDocumentIdExcludingQuestionKeys(
            document.id,
            keptQuestionKeys,
            { transaction }
          )
        } else {
          const allChunkIds = existingChunks.map((chunk) => chunk.id)

          if (allChunkIds.length > 0) {
            removedQuestionImageFileReferences = await this.listQuestionImageFileReferencesByChunkIds(
              allChunkIds,
              { transaction }
            )
          }

          await pdfChunkRepository.deleteByDocumentId(document.id, { transaction })
        }

        await pdfDocumentRepository.update(
          document,
          {
            extractionStatus: 'processed',
            extractedText: rawText.length > 0 ? rawText : null,
            parsedPairsCount: keyedPairs.length,
            processedAt: now,
            extractionError: null,
          },
          { transaction }
        )
      })

      await this.removeQuestionImageFilesByReferences(removedQuestionImageFileReferences)
    } catch (error) {
      await this.markIngestionFailed(contentId, fileUrl, error)
    }
  }

  async syncFromContentEntity(content) {
    if (!content?.id) {
      return
    }

    if (content.contentType !== 'pdf' || !content.fileUrl) {
      await this.removeDocumentByContentId(content.id)
      return
    }

    await this.syncPdfContent({
      contentId: content.id,
      fileUrl: content.fileUrl,
      filePath: content.filePath ?? null,
      fileProvider: content.fileProvider ?? null,
    })
  }
}

export default new PdfDocumentIngestionService()
