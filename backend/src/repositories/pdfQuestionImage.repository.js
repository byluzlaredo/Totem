import { Op, fn, col } from 'sequelize'
import { PdfQuestionImage } from '../../database/models/index.js'

const PDF_QUESTION_IMAGE_ATTRIBUTES = [
  'id',
  'pdfChunkId',
  'fileUrl',
  'filePath',
  'fileProvider',
  'fileMimeType',
  'fileSize',
  'sortOrder',
  'status',
  'createdAt',
  'updatedAt',
  'deletedAt',
]

class PdfQuestionImageRepository {
  async create(data, options = {}) {
    return PdfQuestionImage.create(data, options)
  }

  async bulkCreate(data, options = {}) {
    return PdfQuestionImage.bulkCreate(data, options)
  }

  async findById(id, options = {}) {
    return PdfQuestionImage.findByPk(id, {
      attributes: PDF_QUESTION_IMAGE_ATTRIBUTES,
      ...options,
    })
  }

  async findByChunkId(pdfChunkId, options = {}) {
    const { includeDeleted = false, onlyActive = false, ...queryOptions } = options
    const where = {
      pdfChunkId,
      ...(onlyActive ? { status: 'active' } : {}),
    }

    return PdfQuestionImage.findAll({
      where,
      attributes: PDF_QUESTION_IMAGE_ATTRIBUTES,
      order: [['sortOrder', 'ASC'], ['id', 'ASC']],
      paranoid: !includeDeleted,
      ...queryOptions,
    })
  }

  async findByChunkIds(pdfChunkIds, options = {}) {
    if (!Array.isArray(pdfChunkIds) || pdfChunkIds.length === 0) {
      return []
    }

    const { includeDeleted = false, onlyActive = false, ...queryOptions } = options

    return PdfQuestionImage.findAll({
      where: {
        pdfChunkId: {
          [Op.in]: pdfChunkIds,
        },
        ...(onlyActive ? { status: 'active' } : {}),
      },
      attributes: PDF_QUESTION_IMAGE_ATTRIBUTES,
      order: [['sortOrder', 'ASC'], ['id', 'ASC']],
      paranoid: !includeDeleted,
      ...queryOptions,
    })
  }

  async findActiveByChunkId(pdfChunkId, options = {}) {
    return this.findByChunkId(pdfChunkId, {
      ...options,
      onlyActive: true,
      includeDeleted: false,
    })
  }

  async countByChunkIds(pdfChunkIds, options = {}) {
    if (!Array.isArray(pdfChunkIds) || pdfChunkIds.length === 0) {
      return []
    }

    return PdfQuestionImage.findAll({
      where: {
        pdfChunkId: {
          [Op.in]: pdfChunkIds,
        },
      },
      attributes: ['pdfChunkId', [fn('COUNT', col('id')), 'imageCount']],
      group: ['pdfChunkId'],
      raw: true,
      ...options,
    })
  }

  async countByChunkId(pdfChunkId, options = {}) {
    return PdfQuestionImage.count({
      where: {
        pdfChunkId,
      },
      ...options,
    })
  }

  async findMaxSortOrderByChunkId(pdfChunkId, options = {}) {
    const value = await PdfQuestionImage.max('sortOrder', {
      where: {
        pdfChunkId,
      },
      ...options,
    })

    return Number.isFinite(Number(value)) ? Number(value) : 0
  }

  async update(image, data, options = {}) {
    return image.update(data, options)
  }

  async softDelete(image, options = {}) {
    return image.destroy(options)
  }
}

export default new PdfQuestionImageRepository()
