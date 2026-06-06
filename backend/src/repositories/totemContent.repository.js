import { Op } from "sequelize";
import { Campus, Content, Totem, TotemContent } from "../../database/models/index.js";
import {
    buildTemporalActiveWhere,
    buildTemporalComputedStatusWhere,
    parseValidDate,
    resolveAssignmentExpiringSoonHours,
} from "../utils/assignmentAvailability.js";
import { buildAccentInsensitiveContainsCondition } from '../utils/textSearch.js'

const TOTEM_CONTENT_ATTRIBUTES = [
    'id',
    'totemId',
    'contentId',
    'status',
    'startAt',
    'endAt',
    'priority',
    'sortOrder',
    'createdAt',
    'updatedAt',
    'deletedAt',
]

const TOTEM_CONTENT_INCLUDE = [
    {
        model: Totem,
        as: 'totem',
        attributes: ['id', 'code', 'name', 'campusId', 'state', 'connectionStatus'],
        include: [
            {
                model: Campus,
                as: 'campus',
                attributes: ['id', 'name'],
                required: false,
            },
        ],
    },
    {
        model: Content,
        as: 'content',
        attributes: ['id', 'title', 'contentType', 'status', 'fileUrl', 'filePath', 'fileProvider'],
    },
]

function buildTotemContentInclude({
    contentType = undefined,
    totemSearch = undefined,
    contentSearch = undefined,
    campusId = undefined,
} = {}) {
    const totemInclude = {
        ...TOTEM_CONTENT_INCLUDE[0],
        required: true,
    }
    const contentInclude = {
        model: Content,
        as: 'content',
        attributes: ['id', 'title', 'contentType', 'status', 'fileUrl', 'filePath', 'fileProvider'],
    }

    const totemWhere = {}

    if (campusId) {
        totemWhere.campusId = campusId
    }

    if (totemSearch) {
        const totemSearchConditions = [
            buildAccentInsensitiveContainsCondition('totem.code', totemSearch),
            buildAccentInsensitiveContainsCondition('totem.name', totemSearch),
        ].filter(Boolean)

        if (totemSearchConditions.length > 0) {
            totemWhere[Op.or] = totemSearchConditions
            totemInclude.required = true
        }
    }

    if (Reflect.ownKeys(totemWhere).length > 0) {
        totemInclude.where = totemWhere
    }

    if (contentType || contentSearch) {
        const contentSearchCondition = contentSearch
            ? buildAccentInsensitiveContainsCondition('content.title', contentSearch)
            : null
        const contentWhere = {
            ...(contentType ? { contentType } : {}),
            ...(contentSearchCondition
                ? {
                    [Op.and]: [contentSearchCondition],
                }
                : {}),
        }

        contentInclude.where = contentWhere
        contentInclude.required = true
    }

    return [totemInclude, contentInclude]
}

const DISPLAY_CONTENT_TYPES = ['image', 'video', 'news', 'advertisement']

function normalizeNow(now = new Date()) {
    return parseValidDate(now) ?? new Date()
}

function buildNotExpiredWhere(fieldName, now) {
    return {
        [Op.or]: [
            { [fieldName]: null },
            { [fieldName]: { [Op.gte]: now } },
        ],
    }
}

function buildActiveOrScheduledWhere(now) {
    return {
        status: 'active',
        [Op.and]: [
            buildNotExpiredWhere('endAt', now),
        ],
    }
}

function buildDateOverlapWhere(startAt = null, endAt = null) {
    const parsedStartAt = parseValidDate(startAt)
    const parsedEndAt = parseValidDate(endAt)
    const overlapConditions = []

    if (parsedEndAt) {
        overlapConditions.push({
            [Op.or]: [
                { startAt: null },
                { startAt: { [Op.lte]: parsedEndAt } },
            ],
        })
    }

    if (parsedStartAt) {
        overlapConditions.push({
            [Op.or]: [
                { endAt: null },
                { endAt: { [Op.gte]: parsedStartAt } },
            ],
        })
    }

    if (overlapConditions.length === 0) {
        return null
    }

    return {
        [Op.and]: overlapConditions,
    }
}

class TotemContentRepository {
    constructor() {
        this.assignmentExpiringSoonHours = resolveAssignmentExpiringSoonHours(
            process.env.DASHBOARD_ASSIGNMENT_EXPIRING_SOON_HOURS
        )
    }

    async create(data, options = {}) {
        const assignment = await TotemContent.create(data, options)
        return this.findById(assignment.id, options)
    }

    async findById(id, options = {}) {
        return TotemContent.findByPk(id, {
            attributes: TOTEM_CONTENT_ATTRIBUTES,
            include: TOTEM_CONTENT_INCLUDE,
            ...options,
        })
    }

    async findByTotemAndContent(
        totemId,
        contentId,
        options = {}
    ) {
        const { excludeId = null, ...queryOptions } = options
        const where = {
            totemId,
            contentId,
        }

        if (excludeId !== null) {
            where.id = { [Op.ne]: excludeId }
        }

        return TotemContent.findOne({
            where,
            ...queryOptions,
        })
    }

    async findDeletedByTotemAndContent(totemId, contentId, options = {}) {
        return TotemContent.findOne({
            where: {
                totemId,
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

    async findAllWithPagination({
        totemId,
        contentId,
        totemSearch,
        contentSearch,
        contentType,
        campusId,
        status,
        page,
        limit,
    }) {
        const where = {}

        if (totemId) {
            where.totemId = totemId
        }

        if (contentId) {
            where.contentId = contentId
        }

        if (status) {
            Object.assign(
                where,
                buildTemporalComputedStatusWhere(status, new Date(), {
                    expiringSoonHours: this.assignmentExpiringSoonHours,
                })
            )
        }
        const include = buildTotemContentInclude({
            contentType,
            totemSearch,
            contentSearch,
            campusId,
        })
        const count = await TotemContent.count({
            where,
            include,
            distinct: true,
            col: 'id',
        })

        if (count === 0) {
            return {
                count,
                rows: [],
            }
        }

        const pagedAssignmentIds = await TotemContent.findAll({
            where,
            attributes: ['id'],
            include,
            limit,
            offset: (page - 1) * limit,
            order: [
                ['priority', 'ASC'],
                ['sortOrder', 'ASC'],
                ['createdAt', 'ASC'],
            ],
            subQuery: false,
        })

        const assignmentIds = pagedAssignmentIds.map((assignment) => Number(assignment.id))

        if (assignmentIds.length === 0) {
            return {
                count,
                rows: [],
            }
        }

        const rows = await TotemContent.findAll({
            where: {
                id: {
                    [Op.in]: assignmentIds,
                },
            },
            attributes: TOTEM_CONTENT_ATTRIBUTES,
            include: buildTotemContentInclude({
                contentType,
                totemSearch,
                contentSearch,
                campusId,
            }),
            order: [
                ['priority', 'ASC'],
                ['sortOrder', 'ASC'],
                ['createdAt', 'ASC'],
            ],
        })

        return {
            count,
            rows,
        }
    }

    async findExistingPairsByTotemAndContentIds(
        totemIds,
        contentIds,
        options = {}
    ) {
        if (!Array.isArray(totemIds) || totemIds.length === 0) {
            return []
        }

        if (!Array.isArray(contentIds) || contentIds.length === 0) {
            return []
        }

        return TotemContent.findAll({
            where: {
                totemId: {
                    [Op.in]: totemIds,
                },
                contentId: {
                    [Op.in]: contentIds,
                },
            },
            attributes: ['totemId', 'contentId'],
            ...options,
        })
    }

    async findActiveAssignmentsByTotemIds(
        totemIds,
        now = new Date(),
        options = {}
    ) {
        if (!Array.isArray(totemIds) || totemIds.length === 0) {
            return []
        }

        const parsedNow = normalizeNow(now)

        return TotemContent.findAll({
            where: {
                totemId: {
                    [Op.in]: totemIds,
                },
                ...buildTemporalActiveWhere(parsedNow),
            },
            attributes: ['id', 'totemId', 'contentId', 'status', 'sortOrder'],
            include: [
                {
                    model: Content,
                    as: 'content',
                    required: true,
                    attributes: ['id', 'contentType', 'status'],
                    where: {
                        status: 'active',
                    },
                },
            ],
            ...options,
        })
    }

    async countActiveAssignmentsByContentId(contentId, options = {}) {
        return TotemContent.count({
            where: {
                contentId,
                status: 'active',
            },
            ...options,
        })
    }

    async countActiveAssignmentsByTotemAndContentType(
        totemId,
        contentType,
        now = new Date(),
        options = {}
    ) {
        const { excludeAssignmentId = null, ...queryOptions } = options
        const parsedNow = normalizeNow(now)
        const where = {
            totemId,
            ...buildTemporalActiveWhere(parsedNow),
        }

        if (excludeAssignmentId !== null) {
            where.id = {
                [Op.ne]: excludeAssignmentId,
            }
        }

        return TotemContent.count({
            where,
            include: [
                {
                    model: Content,
                    as: 'content',
                    required: true,
                    attributes: [],
                    where: {
                        status: 'active',
                        contentType,
                    },
                },
            ],
            ...queryOptions,
        })
    }

    async update(assignment, data, options = {}) {
        await assignment.update(data, options)
        return this.findById(assignment.id, options)
    }

    async restore(assignment, options = {}) {
        await assignment.restore(options)
        return this.findById(assignment.id, options)
    }

    async softDelete(assignment, options = {}) {
        return assignment.destroy(options)
    }

    async softDeleteByTotemId(totemId, options = {}) {
        return TotemContent.destroy({
            where: {
                totemId,
            },
            ...options,
        })
    }

    async findDisplayTimelineAssignmentsByTotemId(totemId, now = new Date()) {
        const parsedNow = normalizeNow(now)

        return TotemContent.findAll({
            where: {
                totemId,
                ...buildTemporalActiveWhere(parsedNow),
            },
            attributes: [
                'id',
                'totemId',
                'contentId',
                'status',
                'startAt',
                'endAt',
                'priority',
                'sortOrder',
            ],
            include: [
                {
                    model: Content,
                    as: 'content',
                    required: true,
                    attributes: [
                        'id',
                        'title',
                        'description',
                        'contentType',
                        'fileUrl',
                        'filePath',
                        'fileProvider',
                        'status',
                    ],
                    where: {
                        contentType: { [Op.in]: DISPLAY_CONTENT_TYPES },
                        status: 'active',
                    },
                },
            ],
            order: [
                ['priority', 'DESC'],
                ['sortOrder', 'ASC'],
                ['id', 'ASC'],
            ],
        })
    }

    async findActiveOrScheduledAssignmentsByTotemIdsAndContentTypes(
        totemIds,
        contentTypes,
        {
            excludeAssignmentId = null,
            now = new Date(),
        } = {},
        options = {}
    ) {
        if (!Array.isArray(totemIds) || totemIds.length === 0) {
            return []
        }

        if (!Array.isArray(contentTypes) || contentTypes.length === 0) {
            return []
        }

        const parsedNow = normalizeNow(now)
        const where = {
            totemId: {
                [Op.in]: totemIds,
            },
            ...buildActiveOrScheduledWhere(parsedNow),
        }

        if (excludeAssignmentId !== null) {
            where.id = {
                [Op.ne]: excludeAssignmentId,
            }
        }

        return TotemContent.findAll({
            where,
            attributes: ['id', 'totemId', 'contentId', 'startAt', 'endAt', 'createdAt'],
            include: [
                {
                    model: Content,
                    as: 'content',
                    required: true,
                    attributes: ['id', 'title', 'contentType'],
                    where: {
                        status: 'active',
                        contentType: {
                            [Op.in]: contentTypes,
                        },
                    },
                },
            ],
            ...options,
        })
    }

    async findActiveDisplayAssignmentsByTotemId(totemId, now = new Date()) {
        return this.findDisplayTimelineAssignmentsByTotemId(totemId, now)
    }

    async findOverlappingActiveOrFutureAssignments(
        totemIds,
        contentIds,
        {
            startAt = null,
            endAt = null,
            excludeAssignmentId = null,
            now = new Date(),
        } = {},
        options = {}
    ) {
        if (!Array.isArray(totemIds) || totemIds.length === 0) {
            return []
        }

        if (!Array.isArray(contentIds) || contentIds.length === 0) {
            return []
        }

        const parsedNow = normalizeNow(now)
        const where = {
            totemId: {
                [Op.in]: totemIds,
            },
            contentId: {
                [Op.in]: contentIds,
            },
            status: 'active',
        }
        const overlapWhere = buildDateOverlapWhere(startAt, endAt)
        const andConditions = [buildNotExpiredWhere('endAt', parsedNow)]

        if (overlapWhere) {
            andConditions.push(overlapWhere)
        }

        where[Op.and] = andConditions

        if (excludeAssignmentId !== null) {
            where.id = {
                [Op.ne]: excludeAssignmentId,
            }
        }

        return TotemContent.findAll({
            where,
            attributes: ['id', 'totemId', 'contentId', 'startAt', 'endAt'],
            include: [
                {
                    model: Content,
                    as: 'content',
                    required: true,
                    attributes: ['id'],
                    where: {
                        status: 'active',
                    },
                },
            ],
            ...options,
        })
    }
}

export default new TotemContentRepository()
