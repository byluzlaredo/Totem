import { Op, QueryTypes, literal } from 'sequelize'
import { sequelize } from '../config/db.js'
import { Campus, Notification, NotificationTarget } from '../../database/models/index.js'
import { buildAccentInsensitiveContainsCondition } from '../utils/textSearch.js'

const NOTIFICATION_ATTRIBUTES = [
  'id',
  'title',
  'message',
  'createdBy',
  'targetScope',
  'durationMinutes',
  'startAt',
  'endAt',
  'deletedAt',
  'createdAt',
  'updatedAt',
  'status',
  'type',
]

const NOTIFICATION_INCLUDE = [
  {
    model: NotificationTarget,
    as: 'targets',
    attributes: [
      'id',
      'notificationId',
      'targetType',
      'totemId',
      'campusId',
      'createdAt',
      'updatedAt',
    ],
    required: false,
    include: [
      {
        model: Campus,
        as: 'campus',
        attributes: ['id', 'name'],
        required: false,
      },
    ],
  },
]

function normalizeCampusName(rawValue) {
  if (typeof rawValue !== 'string') {
    return ''
  }

  return rawValue.trim().replace(/[_\s]+/g, ' ')
}

function cloneNotificationInclude() {
  return NOTIFICATION_INCLUDE.map((item) => ({
    ...item,
    include: item.include?.map((subItem) => ({ ...subItem })) ?? [],
  }))
}

function buildTargetExistsCondition({
  scope,
  campusId,
} = {}) {
  const clauses = []

  if (scope === 'all') {
    clauses.push(`nt.target_type = ${sequelize.escape('all')}`)
  }

  if (scope === 'campus') {
    clauses.push(`nt.target_type = ${sequelize.escape('campus')}`)
  }

  if (scope === 'totems') {
    clauses.push(`nt.target_type = ${sequelize.escape('totem')}`)
  }

  if (campusId) {
    clauses.push(`nt.campus_id = ${sequelize.escape(Number(campusId))}`)
  }

  if (clauses.length === 0) {
    return null
  }

  return literal(`
    EXISTS (
      SELECT 1
      FROM notification_target nt
      WHERE nt.notification_id = "Notification"."id"
        AND ${clauses.join(' AND ')}
    )
  `)
}

class NotificationRepository {
  constructor() {
    this.cachedTotemSourceTable = null
  }

  async buildScopedCampusTargetExistsCondition({
    campusId,
    scope,
  }) {
    const normalizedCampusId = Number(campusId)

    if (!Number.isInteger(normalizedCampusId) || normalizedCampusId <= 0) {
      return null
    }

    const tableName = await this.resolveTotemSourceTable()
    const escapedCampusId = sequelize.escape(normalizedCampusId)
    const escapedAllScope = sequelize.escape('all')
    const escapedCampusScope = sequelize.escape('campus')
    const escapedTotemScope = sequelize.escape('totem')

    const totemCampusMatchClause =
      tableName === 'totems'
        ? `
          EXISTS (
            SELECT 1
            FROM public.totems t
            WHERE t.id = nt.totem_id
              AND t.campus_id = ${escapedCampusId}
          )
        `
        : `
          EXISTS (
            SELECT 1
            FROM public.totem t
            LEFT JOIN public.campuses c
              ON lower(c.name) = lower(t.campus)
            WHERE t.id = nt.totem_id
              AND c.id = ${escapedCampusId}
          )
        `

    let scopeClause = `
      nt.target_type = ${escapedAllScope}
      OR (
        nt.target_type = ${escapedCampusScope}
        AND nt.campus_id = ${escapedCampusId}
      )
      OR (
        nt.target_type = ${escapedTotemScope}
        AND ${totemCampusMatchClause}
      )
    `

    if (scope === 'all') {
      scopeClause = `nt.target_type = ${escapedAllScope}`
    } else if (scope === 'campus') {
      scopeClause = `
        nt.target_type = ${escapedCampusScope}
        AND nt.campus_id = ${escapedCampusId}
      `
    } else if (scope === 'totems') {
      scopeClause = `
        nt.target_type = ${escapedTotemScope}
        AND ${totemCampusMatchClause}
      `
    }

    return literal(`
      EXISTS (
        SELECT 1
        FROM notification_target nt
        WHERE nt.notification_id = "Notification"."id"
          AND (${scopeClause})
      )
    `)
  }

  async findAllByWhereWithPagination(where, { page, limit }) {
    const count = await Notification.count({
      where,
    })

    if (count === 0) {
      return {
        count,
        rows: [],
      }
    }

    const pagedNotificationIds = await Notification.findAll({
      where,
      attributes: ['id'],
      limit,
      offset: (page - 1) * limit,
      order: [
        ['createdAt', 'DESC'],
      ],
    })

    const notificationIds = pagedNotificationIds.map((notification) => Number(notification.id))

    if (notificationIds.length === 0) {
      return {
        count,
        rows: [],
      }
    }

    const rows = await Notification.findAll({
      where: {
        id: {
          [Op.in]: notificationIds,
        },
        deletedAt: {
          [Op.is]: null,
        },
      },
      attributes: NOTIFICATION_ATTRIBUTES,
      include: cloneNotificationInclude(),
      order: [
        ['createdAt', 'DESC'],
      ],
    })

    return {
      count,
      rows,
    }
  }

  async resolveTotemSourceTable() {
    if (this.cachedTotemSourceTable) {
      return this.cachedTotemSourceTable
    }

    const existingTables = await sequelize.query(
      `
        SELECT table_name
        FROM information_schema.tables
        WHERE table_schema = 'public'
          AND table_name IN ('totem', 'totems')
      `,
      { type: QueryTypes.SELECT }
    )

    const hasTotem = existingTables.some((table) => table.table_name === 'totem')
    const hasTotems = existingTables.some((table) => table.table_name === 'totems')

    if (hasTotem) {
      const [row] = await sequelize.query(
        'SELECT COUNT(*)::int AS total FROM public.totem',
        { type: QueryTypes.SELECT }
      )

      if ((row?.total ?? 0) > 0 || !hasTotems) {
        this.cachedTotemSourceTable = 'totem'
        return this.cachedTotemSourceTable
      }
    }

    if (hasTotems) {
      this.cachedTotemSourceTable = 'totems'
      return this.cachedTotemSourceTable
    }

    this.cachedTotemSourceTable = 'totem'
    return this.cachedTotemSourceTable
  }

  buildNotificationWhere({
    search,
    type,
    status,
  } = {}) {
    const where = {
      deletedAt: {
        [Op.is]: null,
      },
    }

    if (search) {
      const titleCondition = buildAccentInsensitiveContainsCondition(
        'Notification.title',
        search
      )

      if (titleCondition) {
        where[Op.and] = [...(where[Op.and] ?? []), titleCondition]
      }
    }

    if (type) {
      where.type = type
    }

    if (status !== 'all') {
      where.status = status ?? 'active'
    }

    return where
  }

  async listCampuses(campusId = null) {
    const where = campusId
      ? {
        id: campusId,
      }
      : undefined

    return Campus.findAll({
      attributes: ['id', 'name'],
      ...(where ? { where } : {}),
      order: [['name', 'ASC']],
    })
  }

  async findExistingCampusIds(ids) {
    if (!Array.isArray(ids) || ids.length === 0) {
      return []
    }

    const rows = await Campus.findAll({
      attributes: ['id'],
      where: {
        id: {
          [Op.in]: ids,
        },
      },
    })

    return rows.map((row) => Number(row.id))
  }

  async findCampusByName(name) {
    const normalized = normalizeCampusName(name)

    if (!normalized) {
      return null
    }

    const [row] = await sequelize.query(
      `
        SELECT id, name
        FROM public.campuses
        WHERE lower(name) = lower(:name)
        LIMIT 1
      `,
      {
        replacements: { name: normalized },
        type: QueryTypes.SELECT,
      }
    )

    return row ?? null
  }

  async findExistingTotemIds(ids) {
    if (!Array.isArray(ids) || ids.length === 0) {
      return []
    }

    const tableName = await this.resolveTotemSourceTable()

    const rows = await sequelize.query(
      `SELECT id FROM public.${tableName} WHERE id IN (:ids)`,
      {
        replacements: { ids },
        type: QueryTypes.SELECT,
      }
    )

    return rows.map((row) => Number(row.id))
  }

  async findTotemsByIds(ids, options = {}) {
    if (!Array.isArray(ids) || ids.length === 0) {
      return []
    }

    const { campusId = null } = options

    const tableName = await this.resolveTotemSourceTable()
    const campusFilterClause = campusId ? ' AND c.id = :campusId' : ''
    const replacements = campusId ? { ids, campusId } : { ids }

    if (tableName === 'totem') {
      return sequelize.query(
        `
          SELECT
            t.id,
            t.code,
            t.name,
            c.id AS "campusId",
            COALESCE(c.name, t.campus) AS "campusName",
            t.campus AS headquarters,
            CASE
              WHEN t.condition IS NOT NULL THEN t.condition
              WHEN t.status = 1 THEN 'active'
              ELSE 'inactive'
            END AS state
          FROM public.totem t
          LEFT JOIN public.campuses c
            ON lower(c.name) = lower(t.campus)
          WHERE t.id IN (:ids)
          ${campusFilterClause}
          ORDER BY name ASC
        `,
        {
          replacements,
          type: QueryTypes.SELECT,
        }
      )
    }

    return sequelize.query(
      `
        SELECT
          t.id,
          t.code,
          t.name,
          t.campus_id AS "campusId",
          c.name AS "campusName",
          c.name AS headquarters,
          t.state
        FROM public.totems t
        LEFT JOIN public.campuses c
          ON c.id = t.campus_id
        WHERE t.id IN (:ids)
        ${campusFilterClause}
        ORDER BY t.name ASC
      `,
      {
        replacements,
        type: QueryTypes.SELECT,
      }
    )
  }

  async listActiveTotemOptions(options = {}) {
    const { campusId = null } = options
    const tableName = await this.resolveTotemSourceTable()
    const campusFilterClause = campusId ? ' AND c.id = :campusId' : ''
    const replacements = campusId ? { campusId } : undefined

    if (tableName === 'totem') {
      return sequelize.query(
        `
          SELECT
            t.id,
            t.code,
            t.name,
            c.id AS "campusId",
            COALESCE(c.name, t.campus) AS "campusName",
            t.campus AS headquarters,
            CASE
              WHEN t.condition IS NOT NULL THEN t.condition
              WHEN t.status = 1 THEN 'active'
              ELSE 'inactive'
            END AS state
          FROM public.totem t
          LEFT JOIN public.campuses c
            ON lower(c.name) = lower(t.campus)
          WHERE COALESCE(t.condition, CASE WHEN t.status = 1 THEN 'active' ELSE 'inactive' END) = 'active'
          ${campusFilterClause}
          ORDER BY t.name ASC
        `,
        {
          ...(replacements ? { replacements } : {}),
          type: QueryTypes.SELECT,
        }
      )
    }

    return sequelize.query(
      `
        SELECT
          t.id,
          t.code,
          t.name,
          t.campus_id AS "campusId",
          c.name AS "campusName",
          c.name AS headquarters,
          t.state
        FROM public.totems t
        LEFT JOIN public.campuses c
          ON c.id = t.campus_id
        WHERE t.state = 'active'
        ${campusFilterClause}
        ORDER BY t.name ASC
      `,
      {
        ...(replacements ? { replacements } : {}),
        type: QueryTypes.SELECT,
      }
    )
  }

  async create({ notificationData, targets, transaction }) {
    const notification = await Notification.create(notificationData, { transaction })

    await NotificationTarget.bulkCreate(
      targets.map((target) => ({
        notificationId: notification.id,
        targetType: target.targetType,
        totemId: target.totemId,
        campusId: target.campusId,
      })),
      { transaction }
    )

    return this.findById(notification.id, { transaction })
  }

  async findById(id, options = {}) {
    const { where: externalWhere = {}, ...restOptions } = options

    return Notification.findOne({
      where: {
        id,
        deletedAt: {
          [Op.is]: null,
        },
        ...externalWhere,
      },
      attributes: NOTIFICATION_ATTRIBUTES,
      include: NOTIFICATION_INCLUDE,
      ...restOptions,
    })
  }

  async findAllWithPagination({
    search,
    type,
    scope,
    campusId,
    status,
    page,
    limit,
  }) {
    const where = this.buildNotificationWhere({
      search,
      type,
      status,
    })
    const targetExistsCondition = buildTargetExistsCondition({
      scope,
      campusId,
    })

    if (targetExistsCondition) {
      where[Op.and] = [...(where[Op.and] ?? []), targetExistsCondition]
    }

    return this.findAllByWhereWithPagination(where, { page, limit })
  }

  async findAllWithPaginationForCampus({
    search,
    type,
    scope,
    campusId,
    status,
    page,
    limit,
  }) {
    const where = this.buildNotificationWhere({
      search,
      type,
      status,
    })
    const targetExistsCondition = await this.buildScopedCampusTargetExistsCondition({
      campusId,
      scope,
    })

    if (targetExistsCondition) {
      where[Op.and] = [...(where[Op.and] ?? []), targetExistsCondition]
    }

    return this.findAllByWhereWithPagination(where, { page, limit })
  }

  async findVisibleOrScheduledForTotem({ totemId, campusId, now }) {
    const targetOr = [
      {
        targetType: 'all',
        totemId: { [Op.is]: null },
        campusId: { [Op.is]: null },
      },
    ]

    if (totemId) {
      targetOr.push({
        targetType: 'totem',
        totemId,
      })
    }

    if (campusId) {
      targetOr.push({
        targetType: 'campus',
        campusId,
      })
    }

    const include = NOTIFICATION_INCLUDE.map((item) => ({
      ...item,
      include: item.include?.map((subItem) => ({ ...subItem })) ?? [],
    }))

    include[0] = {
      ...include[0],
      required: true,
      where: {
        [Op.or]: targetOr,
      },
    }

    return Notification.findAll({
      where: {
        deletedAt: {
          [Op.is]: null,
        },
        status: 'active',
        [Op.or]: [
          {
            endAt: {
              [Op.gte]: now,
            },
          },
          {
            endAt: {
              [Op.is]: null,
            },
          },
        ],
      },
      attributes: NOTIFICATION_ATTRIBUTES,
      include,
      order: [
        [sequelize.literal(`CASE WHEN "Notification"."type" = 'urgent' THEN 0 ELSE 1 END`), 'ASC'],
        ['startAt', 'DESC'],
        ['createdAt', 'DESC'],
      ],
    })
  }

  async findAllForFiltering({
    search,
    type,
    status,
  }) {
    const where = this.buildNotificationWhere({
      search,
      type,
      status,
    })

    return Notification.findAll({
      where,
      attributes: NOTIFICATION_ATTRIBUTES,
      include: NOTIFICATION_INCLUDE,
      order: [
        ['createdAt', 'DESC'],
      ],
    })
  }

  async findActiveForTotem({ totemId, campusId, now }) {
    return Notification.findAll({
      where: {
        deletedAt: {
          [Op.is]: null,
        },
        status: 'active',
        startAt: {
          [Op.lte]: now,
        },
        [Op.or]: [
          {
            endAt: {
              [Op.gte]: now,
            },
          },
          {
            endAt: {
              [Op.is]: null,
            },
          },
        ],
      },
      attributes: NOTIFICATION_ATTRIBUTES,
      include: [
        {
          ...NOTIFICATION_INCLUDE[0],
          include: NOTIFICATION_INCLUDE[0].include?.map((subItem) => ({ ...subItem })) ?? [],
          required: true,
          where: {
            [Op.or]: [
              {
                targetType: 'all',
                totemId: { [Op.is]: null },
                campusId: { [Op.is]: null },
              },
              ...(totemId ? [{ targetType: 'totem', totemId }] : []),
              ...(campusId ? [{ targetType: 'campus', campusId }] : []),
            ],
          },
        },
      ],
      order: [
        [sequelize.literal(`CASE WHEN "Notification"."type" = 'urgent' THEN 0 ELSE 1 END`), 'ASC'],
        ['startAt', 'DESC'],
        ['createdAt', 'DESC'],
      ],
    })
  }

  async update(notification, { notificationData, targets, transaction }) {
    if (Object.keys(notificationData).length > 0) {
      await notification.update(notificationData, { transaction })
    }

    if (targets !== undefined) {
      await NotificationTarget.destroy({
        where: { notificationId: notification.id },
        transaction,
      })

      await NotificationTarget.bulkCreate(
        targets.map((target) => ({
          notificationId: notification.id,
          targetType: target.targetType,
          totemId: target.totemId,
          campusId: target.campusId,
        })),
        { transaction }
      )
    }

    return this.findById(notification.id, { transaction })
  }

  async softDelete(notification) {
    await notification.update({
      status: 'inactive',
      deletedAt: new Date(),
    })
    return notification
  }

  async updateStatus(notification, status, options = {}) {
    const normalizedStatus = String(status ?? '').trim().toLowerCase() === 'active'
      ? 'active'
      : 'inactive'

    await notification.update(
      {
        status: normalizedStatus,
        deletedAt: normalizedStatus === 'active' ? null : notification.deletedAt ?? null,
      },
      options
    )

    return this.findById(notification.id, options)
  }
}

export default new NotificationRepository()
