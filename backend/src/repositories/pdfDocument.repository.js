import { Op } from 'sequelize'
import { Content, PdfDocument } from '../../database/models/index.js'

const PDF_DOCUMENT_ATTRIBUTES = [
  'id',
  'contentId',
  'fileUrl',
  'extractionStatus',
  'extractedText',
  'parsedPairsCount',
  'extractionError',
  'processedAt',
  'createdAt',
  'updatedAt',
  'deletedAt',
]

class PdfDocumentRepository {
  async create(data, options = {}) {
    return PdfDocument.create(data, options)
  }

  async findById(id, options = {}) {
    return PdfDocument.findByPk(id, {
      attributes: PDF_DOCUMENT_ATTRIBUTES,
      ...options,
    })
  }

  async findByContentId(contentId, options = {}) {
    return PdfDocument.findOne({
      where: { contentId },
      attributes: PDF_DOCUMENT_ATTRIBUTES,
      ...options,
    })
  }

  async findDeletedByContentId(contentId, options = {}) {
    return PdfDocument.findOne({
      where: {
        contentId,
        deletedAt: {
          [Op.ne]: null,
        },
      },
      paranoid: false,
      order: [['deletedAt', 'DESC']],
      ...options,
    })
  }

  async findProcessedByTotemId(totemId, now = new Date(), options = {}) {
    return PdfDocument.findAll({
      where: {
        extractionStatus: 'processed',
      },
      attributes: PDF_DOCUMENT_ATTRIBUTES,
      include: [
        {
          model: Content,
          as: 'content',
          required: true,
          attributes: ['id', 'title', 'contentType', 'status'],
          where: {
            status: 'active',
            contentType: 'pdf',
          },
          include: [
            {
              association: 'totemAssignments',
              required: true,
              attributes: [],
              where: {
                totemId,
                status: 'active',
                [Op.and]: [
                  {
                    [Op.or]: [{ startAt: null }, { startAt: { [Op.lte]: now } }],
                  },
                  {
                    [Op.or]: [{ endAt: null }, { endAt: { [Op.gte]: now } }],
                  },
                ],
              },
            },
          ],
        },
      ],
      ...options,
    })
  }

  async update(document, data, options = {}) {
    return document.update(data, options)
  }

  async restore(document, options = {}) {
    return document.restore(options)
  }

  async softDelete(document, options = {}) {
    return document.destroy(options)
  }
}

export default new PdfDocumentRepository()
