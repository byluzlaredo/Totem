import { PdfChunk } from '../../database/models/index.js'
import { Op } from 'sequelize'

const PDF_CHUNK_ATTRIBUTES = [
  'id',
  'pdfDocumentId',
  'chunkOrder',
  'questionText',
  'answerText',
  'questionKey',
  'createdAt',
  'updatedAt',
]

class PdfChunkRepository {
  async bulkCreate(data, options = {}) {
    return PdfChunk.bulkCreate(data, options)
  }

  async deleteByDocumentId(pdfDocumentId, options = {}) {
    return PdfChunk.destroy({
      where: { pdfDocumentId },
      ...options,
    })
  }

  async findByDocumentId(pdfDocumentId, options = {}) {
    return PdfChunk.findAll({
      where: { pdfDocumentId },
      attributes: PDF_CHUNK_ATTRIBUTES,
      order: [['chunkOrder', 'ASC'], ['id', 'ASC']],
      ...options,
    })
  }

  async findById(id, options = {}) {
    return PdfChunk.findByPk(id, {
      attributes: PDF_CHUNK_ATTRIBUTES,
      ...options,
    })
  }

  async upsertByDocumentAndQuestionKey(data, options = {}) {
    if (!Array.isArray(data) || data.length === 0) {
      return []
    }

    return PdfChunk.bulkCreate(data, {
      conflictAttributes: ['pdfDocumentId', 'questionKey'],
      updateOnDuplicate: ['chunkOrder', 'questionText', 'answerText', 'updatedAt'],
      ...options,
    })
  }

  async deleteByDocumentIdExcludingQuestionKeys(pdfDocumentId, questionKeys, options = {}) {
    if (!Array.isArray(questionKeys) || questionKeys.length === 0) {
      return this.deleteByDocumentId(pdfDocumentId, options)
    }

    return PdfChunk.destroy({
      where: {
        pdfDocumentId,
        questionKey: {
          [Op.notIn]: questionKeys,
        },
      },
      ...options,
    })
  }
}

export default new PdfChunkRepository()
