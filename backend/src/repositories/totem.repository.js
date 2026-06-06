import { Op } from "sequelize";
import { Campus, Totem } from "../../database/models/index.js";
import { buildAccentInsensitiveContainsCondition } from '../utils/textSearch.js'

const CAMPUS_INCLUDE = {
    model: Campus,
    as: 'campus',
    attributes: ['id', 'name'],
    required: false,
}

const PUBLIC_ATTRIBUTES = [
    'id',
    'code',
    'name',
    'campusId',
    'connectionStatus',
    'lastSeenAt',
    'state',
    'createdAt',
    'updatedAt',
    'deletedAt',
]

const LINKING_CODE_ATTRIBUTES = [
    'linkingCode',
    'linkingCodeGeneratedAt',
    'linkingCodeExpiresAt',
    'linkingCodeUsedAt',
    'linkingCodeTtlMinutes',
]

const DETAIL_ATTRIBUTES = [
    ...PUBLIC_ATTRIBUTES,
    ...LINKING_CODE_ATTRIBUTES,
]

const INTERNAL_DETAIL_ATTRIBUTES = [
    ...DETAIL_ATTRIBUTES,
    'deviceToken',
]

const CLIENT_ATTRIBUTES = [
    'id',
    'code',
    'name',
    'campusId',
    'connectionStatus',
    'lastSeenAt',
    'state',
]

const LINKING_AUTH_ATTRIBUTES = [
    ...CLIENT_ATTRIBUTES,
    'deviceToken',
    ...LINKING_CODE_ATTRIBUTES,
]

function withCampusInclude(options = {}) {
    const {
        include,
        skipCampusInclude = false,
        ...restOptions
    } = options

    if (include) {
        return {
            ...restOptions,
            include,
        }
    }

    if (skipCampusInclude || restOptions.lock) {
        return restOptions
    }

    return {
        ...restOptions,
        include: [CAMPUS_INCLUDE],
    }
}

class TotemRepository {
    async create(data) {
        const createdTotem = await Totem.create(data)

        return this.findById(createdTotem.id)
    }

    async findById(id, options = {}) {
        const queryOptions = withCampusInclude({
            attributes: PUBLIC_ATTRIBUTES,
            ...options,
        })

        return Totem.findByPk(id, queryOptions)
    }

    async findByIdWithDeviceToken(id, options = {}) {
        return Totem.unscoped().findByPk(id, withCampusInclude({
            attributes: INTERNAL_DETAIL_ATTRIBUTES,
            ...options,
        }))
    }

    async findByIdWithLinkingCode(id, options = {}) {
        return Totem.findByPk(id, withCampusInclude({
            attributes: DETAIL_ATTRIBUTES,
            ...options,
        }))
    }

    async findByName(name, excludeId = null) {
        const where = { name }

        if (excludeId !== null) {
            where.id = { [Op.ne]: excludeId }
        }

        return Totem.findOne({ where })
    }

    async findByNameInCampus(name, campusId, excludeId = null, options = {}) {
        const where = {
            name,
            campusId,
        }

        if (excludeId !== null) {
            where.id = { [Op.ne]: excludeId }
        }

        return Totem.findOne({
            where,
            ...options,
        })
    }

    async findByCode(code, excludeId = null) {
        const where = { code }

        if (excludeId !== null) {
            where.id = { [Op.ne]: excludeId }
        }

        return Totem.findOne({ where })
    }

    async findByDeviceToken(deviceToken, options = {}) {
        return Totem.unscoped().findOne(withCampusInclude({
            where: { deviceToken },
            attributes: CLIENT_ATTRIBUTES,
            ...options,
        }))
    }

    async findByLinkingCode(linkingCode, options = {}) {
        return Totem.unscoped().findOne(withCampusInclude({
            where: { linkingCode },
            attributes: LINKING_AUTH_ATTRIBUTES,
            ...options,
        }))
    }

    async findIdsByIds(ids, options = {}) {
        if (!Array.isArray(ids) || ids.length === 0) {
            return []
        }

        const rows = await Totem.findAll({
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

    async findActiveIdsByIds(ids, options = {}) {
        if (!Array.isArray(ids) || ids.length === 0) {
            return []
        }

        const rows = await Totem.findAll({
            where: {
                id: {
                    [Op.in]: ids,
                },
                state: 'active',
            },
            attributes: ['id'],
            ...options,
        })

        return rows.map((item) => item.id)
    }

    async findSummariesByIds(ids, options = {}) {
        if (!Array.isArray(ids) || ids.length === 0) {
            return []
        }

        return Totem.findAll({
            where: {
                id: {
                    [Op.in]: ids,
                },
            },
            attributes: ['id', 'name', 'state', 'campusId'],
            ...options,
        })
    }

    async findActiveIds(options = {}) {
        const rows = await Totem.findAll({
            where: {
                state: 'active',
            },
            attributes: ['id'],
            order: [['id', 'ASC']],
            ...options,
        })

        return rows.map((item) => item.id)
    }

    async findActiveIdsByCampusId(campusId, options = {}) {
        const rows = await Totem.findAll({
            where: {
                state: 'active',
                campusId,
            },
            attributes: ['id'],
            order: [['id', 'ASC']],
            ...options,
        })

        return rows.map((item) => item.id)
    }

    async findAllWithPagination({ search, state, campusId, connectionStatus, page, limit }) {
        const where = {}

        if (state) {
            where.state = state
        }

        if (connectionStatus) {
            where.connectionStatus = connectionStatus
        }

        if (campusId) {
            where.campusId = campusId
        }

        if (search) {
            const searchConditions = [
                buildAccentInsensitiveContainsCondition('Totem.name', search),
                buildAccentInsensitiveContainsCondition('Totem.code', search),
            ].filter(Boolean)

            if (searchConditions.length > 0) {
                where[Op.or] = searchConditions
            }
        }

        const count = await Totem.count({ where })

        if (count === 0) {
            return {
                count,
                rows: [],
            }
        }

        const pagedTotemIds = await Totem.findAll({
            where,
            attributes: ['id'],
            limit,
            offset: (page - 1) * limit,
            order: [['createdAt', 'ASC'], ['id', 'ASC']],
        })

        const totemIds = pagedTotemIds.map((totem) => Number(totem.id))

        if (totemIds.length === 0) {
            return {
                count,
                rows: [],
            }
        }

        const rows = await Totem.findAll({
            where: {
                id: {
                    [Op.in]: totemIds,
                },
            },
            attributes: PUBLIC_ATTRIBUTES,
            include: [CAMPUS_INCLUDE],
        })

        const orderById = new Map(totemIds.map((id, index) => [id, index]))
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

    async update(totem, data, options = {}) {
        return totem.update(data, options)
    }

    async softDelete(totem, options = {}) {
        return totem.destroy(options)
    }
}

export default new TotemRepository()
