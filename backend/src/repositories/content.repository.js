import { Op } from "sequelize";
import { Campus, Content, Totem, TotemContent } from "../../database/models/index.js";
import { buildTemporalActiveWhere } from "../utils/assignmentAvailability.js";
import { buildAccentInsensitiveContainsCondition } from '../utils/textSearch.js'

const CAMPUS_INCLUDE = {
    model: Campus,
    as: 'campus',
    attributes: ['id', 'name'],
    required: false,
}

const CONTENT_ATTRIBUTES = [
    'id',
    'title',
    'description',
    'contentType',
    'fileUrl',
    'filePath',
    'fileProvider',
    'fileMimeType',
    'fileSize',
    'status',
    'campusId',
    'createdAt',
    'updatedAt',
    'deletedAt',
]

function withCampusInclude(options = {}) {
    if (options.include) {
        return options
    }

    return {
        ...options,
        include: [CAMPUS_INCLUDE],
    }
}

class ContentRepository {
    async create(data) {
        const created = await Content.create(data)
        return this.findById(created.id)
    }

    async findById(id, options = {}) {
        return Content.findByPk(id, withCampusInclude({
            attributes: CONTENT_ATTRIBUTES,
            ...options,
        }))
    }

    async findIdsByIds(ids, options = {}) {
        if (!Array.isArray(ids) || ids.length === 0) {
            return []
        }

        const rows = await Content.findAll({
            where: {
                id: {
                    [Op.in]: ids,
                },
            },
            attributes: ['id'],
            ...options,
        })

        return rows.map((item) => item.id)
    }

    async findActiveSummariesByIds(ids, options = {}) {
        if (!Array.isArray(ids) || ids.length === 0) {
            return []
        }

        return Content.findAll({
            where: {
                id: {
                    [Op.in]: ids,
                },
                status: 'active',
            },
            attributes: ['id', 'title', 'contentType', 'status', 'campusId'],
            ...options,
        })
    }

    async findAllWithPagination({
        title,
        contentType,
        status,
        campusId,
        operationalStatus,
        contentIds,
        page,
        limit,
    }) {
        if (Array.isArray(contentIds) && contentIds.length === 0) {
            return {
                count: 0,
                rows: [],
            }
        }

        const where = {}
        const filterInclude = []

        if (title) {
            const titleCondition = buildAccentInsensitiveContainsCondition('Content.title', title)

            if (titleCondition) {
                where[Op.and] = [...(where[Op.and] ?? []), titleCondition]
            }
        }

        if (contentType) {
            where.contentType = contentType
        }

        if (status) {
            where.status = status
        }

        if (campusId) {
            where.campusId = campusId
        }

        if (Array.isArray(contentIds)) {
            where.id = {
                [Op.in]: contentIds,
            }
        }

        if (operationalStatus === 'activeWithoutAssignment') {
            where.status = 'active'
            where[Op.and] = [
                ...(where[Op.and] ?? []),
                {
                    '$totemAssignments.id$': {
                        [Op.is]: null,
                    },
                },
            ]

            filterInclude.push({
                model: TotemContent,
                as: 'totemAssignments',
                attributes: [],
                required: false,
                where: buildTemporalActiveWhere(new Date()),
                include: [
                    {
                        model: Totem,
                        as: 'totem',
                        attributes: [],
                        required: true,
                        ...(campusId
                            ? {
                                where: {
                                    campusId,
                                },
                            }
                            : {}),
                    },
                ],
            })
        }

        const count = await Content.count({
            where,
            ...(filterInclude.length > 0
                ? {
                    include: filterInclude,
                    distinct: true,
                    col: 'id',
                }
                : {}),
        })

        if (count === 0) {
            return {
                count,
                rows: [],
            }
        }

        const pagedContentIds = await Content.findAll({
            where,
            attributes: ['id'],
            ...(filterInclude.length > 0
                ? {
                    include: filterInclude,
                    distinct: true,
                    subQuery: false,
                }
                : {}),
            limit,
            offset: (page - 1) * limit,
            order: [['createdAt', 'ASC'], ['id', 'ASC']],
        })

        const contentIdsPage = pagedContentIds.map((content) => Number(content.id))

        if (contentIdsPage.length === 0) {
            return {
                count,
                rows: [],
            }
        }

        const rows = await Content.findAll({
            where: {
                id: {
                    [Op.in]: contentIdsPage,
                },
            },
            attributes: CONTENT_ATTRIBUTES,
            include: [CAMPUS_INCLUDE],
        })

        const orderById = new Map(contentIdsPage.map((id, index) => [id, index]))
        rows.sort(
            (left, right) =>
                (orderById.get(Number(left.id)) ?? Number.MAX_SAFE_INTEGER)
                - (orderById.get(Number(right.id)) ?? Number.MAX_SAFE_INTEGER)
        )

        return {
            count,
            rows,
        }
    }

    async update(content, data) {
        await content.update(data)
        return this.findById(content.id)
    }

    async softDelete(content) {
        return content.destroy()
    }
}

export default new ContentRepository()
