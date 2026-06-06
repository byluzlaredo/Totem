import { Op, QueryTypes, col, fn } from 'sequelize'
import { sequelize } from '../config/db.js'
import {
  AppUser,
  Campus,
  Content,
  Totem,
  TotemContent,
} from '../../database/models/index.js'
import {
  buildTemporalComputedStatusWhere,
  resolveAssignmentExpiringSoonHours,
} from '../utils/assignmentAvailability.js'
import { requireCampusScopeId } from '../utils/campusAccess.js'
import { USER_STATUS } from '../utils/userStatus.js'
import {
  countActiveContentsWithUnavailableFile,
} from '../utils/contentOperationalFilters.js'

const CONTENT_TYPES = ['image', 'video', 'news', 'advertisement', 'pdf']
const MAX_PROBLEMATIC_TOTEMS = 5
const PROBLEMATIC_TOTEMS_SCAN_LIMIT = 60
const DEFAULT_DASHBOARD_SUMMARY_CACHE_TTL_MS = 30_000
const MAX_DASHBOARD_SUMMARY_CACHE_TTL_MS = 5 * 60 * 1000

function resolveDashboardSummaryCacheTtlMs(rawValue) {
  const parsedValue = Number(rawValue)

  if (!Number.isInteger(parsedValue)) {
    return DEFAULT_DASHBOARD_SUMMARY_CACHE_TTL_MS
  }

  return Math.max(0, Math.min(parsedValue, MAX_DASHBOARD_SUMMARY_CACHE_TTL_MS))
}

function buildDashboardSummaryCacheKey({
  scopedCampusId,
  includeUsersMetrics,
}) {
  const scopeKey = scopedCampusId === null ? 'all' : String(scopedCampusId)
  const usersKey = includeUsersMetrics ? 'with-users' : 'without-users'
  return `${scopeKey}:${usersKey}`
}

function cloneDashboardSummarySnapshot(snapshot) {
  return JSON.parse(JSON.stringify(snapshot))
}

function toIsoOrNull(value) {
  if (!value) {
    return null
  }

  const parsedDate = value instanceof Date ? value : new Date(value)

  if (Number.isNaN(parsedDate.getTime())) {
    return null
  }

  return parsedDate.toISOString()
}

function buildScopedTotemContentInclude(scopedCampusId) {
  if (scopedCampusId === null) {
    return undefined
  }

  return [
    {
      model: Totem,
      as: 'totem',
      attributes: [],
      required: true,
      where: {
        campusId: scopedCampusId,
      },
    },
  ]
}

function buildTotemIssueDescriptor(totem) {
  const lastSeenAt = toIsoOrNull(totem.lastSeenAt)

  if (!lastSeenAt) {
    return {
      issueType: 'no_connection_record',
      issueLabel: 'Sin registro de conexión',
      issueSeverity: 'critical',
      priority: 1,
    }
  }

  if (totem.connectionStatus === 'offline') {
    return {
      issueType: 'active_offline',
      issueLabel: 'Activo fuera de línea',
      issueSeverity: 'critical',
      priority: 2,
    }
  }

  return null
}

async function getNotificationMetrics(scopedCampusId, nowIso) {
  const isScoped = scopedCampusId !== null
  const replacements = {
    now: nowIso,
    ...(isScoped ? { campusId: scopedCampusId } : {}),
  }

  const visibilityClause = isScoped
    ? `
      AND EXISTS (
        SELECT 1
        FROM notification_target nt
        LEFT JOIN totems tt
          ON tt.id = nt.totem_id
         AND tt.deleted_at IS NULL
        WHERE nt.notification_id = n.id
          AND (
            (nt.target_type = 'all' AND nt.totem_id IS NULL AND nt.campus_id IS NULL)
            OR (nt.target_type = 'campus' AND nt.campus_id = :campusId)
            OR (nt.target_type = 'totem' AND tt.campus_id = :campusId)
          )
      )
    `
    : ''

  const [row] = await sequelize.query(
    `
      SELECT
        COUNT(*) FILTER (
          WHERE
            n.status = 'active'
            AND n.start_at <= :now
            AND n.end_at >= :now
        )::int AS active_now,
        COUNT(*) FILTER (
          WHERE
            n.status = 'active'
            AND n.type = 'urgent'
            AND n.start_at <= :now
            AND n.end_at >= :now
        )::int AS urgent_active,
        COUNT(*) FILTER (
          WHERE
            n.status = 'active'
            AND n.start_at > :now
        )::int AS scheduled,
        COUNT(*) FILTER (
          WHERE
            n.status = 'inactive'
            OR (n.status = 'active' AND n.end_at < :now)
        )::int AS finished_or_expired
      FROM notification n
      WHERE n.deleted_at IS NULL
      ${visibilityClause}
    `,
    {
      replacements,
      type: QueryTypes.SELECT,
    }
  )

  return {
    active: Number(row?.active_now ?? 0),
    urgentActive: Number(row?.urgent_active ?? 0),
    scheduled: Number(row?.scheduled ?? 0),
    finishedOrExpired: Number(row?.finished_or_expired ?? 0),
  }
}

async function getActiveContentsWithoutAssignmentsCount(scopedCampusId, nowIso) {
  const isScoped = scopedCampusId !== null
  const replacements = {
    now: nowIso,
    ...(isScoped ? { campusId: scopedCampusId } : {}),
  }
  const campusContentClause = isScoped ? 'AND c.campus_id = :campusId' : ''
  const campusTotemClause = isScoped ? 'AND t.campus_id = :campusId' : ''

  const [row] = await sequelize.query(
    `
      SELECT COUNT(*)::int AS total
      FROM contents c
      WHERE c.deleted_at IS NULL
        AND c.status = 'active'
        ${campusContentClause}
        AND NOT EXISTS (
          SELECT 1
          FROM totem_contents tc
          JOIN totems t
            ON t.id = tc.totem_id
           AND t.deleted_at IS NULL
           ${campusTotemClause}
          WHERE tc.content_id = c.id
            AND tc.deleted_at IS NULL
            AND tc.status = 'active'
            AND (tc.start_at IS NULL OR tc.start_at <= :now)
            AND (tc.end_at IS NULL OR tc.end_at >= :now)
        )
    `,
    {
      replacements,
      type: QueryTypes.SELECT,
    }
  )

  return Number(row?.total ?? 0)
}

class DashboardService {
  constructor() {
    this.assignmentExpiringSoonHours = resolveAssignmentExpiringSoonHours(
      process.env.DASHBOARD_ASSIGNMENT_EXPIRING_SOON_HOURS
    )
    this.dashboardSummaryCacheTtlMs = resolveDashboardSummaryCacheTtlMs(
      process.env.DASHBOARD_SUMMARY_CACHE_TTL_MS
    )
    this.dashboardSummaryCache = new Map()
    this.dashboardSummaryInFlight = new Map()
  }

  async countAssignmentsByTemporalStatus(status, scopedCampusId, now) {
    return TotemContent.count({
      where: buildTemporalComputedStatusWhere(status, now, {
        expiringSoonHours: this.assignmentExpiringSoonHours,
      }),
      include: buildScopedTotemContentInclude(scopedCampusId),
    })
  }

  async buildDashboardSummarySnapshot({ scopedCampusId, includeUsersMetrics }) {
    const now = new Date()
    const nowIso = now.toISOString()

    const totemWhere = scopedCampusId === null ? {} : { campusId: scopedCampusId }
    const contentWhere = {
      status: 'active',
      ...(scopedCampusId === null ? {} : { campusId: scopedCampusId }),
    }

    const usersMetricsPromise =
      includeUsersMetrics
        ? Promise.all([
          AppUser.count({ where: { status: USER_STATUS.ACTIVE } }),
          AppUser.count({ where: { status: USER_STATUS.INVITED } }),
        ]).then(([active, pendingInvited]) => ({
          active,
          pendingInvited,
        }))
        : Promise.resolve(null)

    const [
      totalTotems,
      activeTotems,
      inactiveTotems,
      onlineTotems,
      activeOfflineTotems,
      activeTotemsWithoutConnectionRecord,
      activeContents,
      groupedActiveContentRows,
      activeAssignments,
      scheduledAssignments,
      expiredAssignments,
      expiringSoonAssignments,
      activeContentsWithoutAssignments,
      activeContentsWithUnavailableFile,
      notificationMetrics,
      usersMetrics,
      problematicTotemsRows,
    ] = await Promise.all([
      Totem.count({ where: totemWhere }),
      Totem.count({ where: { ...totemWhere, state: 'active' } }),
      Totem.count({ where: { ...totemWhere, state: 'inactive' } }),
      Totem.count({
        where: { ...totemWhere, state: 'active', connectionStatus: 'online' },
      }),
      Totem.count({
        where: { ...totemWhere, state: 'active', connectionStatus: 'offline' },
      }),
      Totem.count({
        where: { ...totemWhere, state: 'active', lastSeenAt: { [Op.is]: null } },
      }),
      Content.count({ where: contentWhere }),
      Content.findAll({
        where: contentWhere,
        attributes: [
          'contentType',
          [fn('COUNT', col('Content.id')), 'total'],
        ],
        group: ['contentType'],
        raw: true,
      }),
      this.countAssignmentsByTemporalStatus('active', scopedCampusId, now),
      this.countAssignmentsByTemporalStatus('scheduled', scopedCampusId, now),
      this.countAssignmentsByTemporalStatus('expired', scopedCampusId, now),
      this.countAssignmentsByTemporalStatus('expiringSoon', scopedCampusId, now),
      getActiveContentsWithoutAssignmentsCount(scopedCampusId, nowIso),
      countActiveContentsWithUnavailableFile(scopedCampusId),
      getNotificationMetrics(scopedCampusId, nowIso),
      usersMetricsPromise,
      Totem.findAll({
        where: {
          ...totemWhere,
          state: 'active',
          [Op.or]: [
            { connectionStatus: 'offline' },
            { lastSeenAt: { [Op.is]: null } },
          ],
        },
        attributes: [
          'id',
          'code',
          'name',
          'campusId',
          'connectionStatus',
          'lastSeenAt',
          'state',
        ],
        include: [
          {
            model: Campus,
            as: 'campus',
            attributes: ['id', 'name'],
            required: false,
          },
        ],
        limit: PROBLEMATIC_TOTEMS_SCAN_LIMIT,
        order: [
          ['lastSeenAt', 'ASC'],
          ['createdAt', 'ASC'],
        ],
      }),
    ])

    const activeContentByType = CONTENT_TYPES.reduce((accumulator, contentType) => {
      accumulator[contentType] = 0
      return accumulator
    }, {})

    for (const row of groupedActiveContentRows) {
      const contentType = String(row.contentType ?? '')

      if (!CONTENT_TYPES.includes(contentType)) {
        continue
      }

      activeContentByType[contentType] = Number(row.total ?? 0)
    }

    const problematicTotems = problematicTotemsRows
      .map((totem) => {
        const issueDescriptor = buildTotemIssueDescriptor(totem)

        if (!issueDescriptor) {
          return null
        }

        return {
          id: totem.id,
          code: totem.code,
          name: totem.name,
          campus: totem.campus
            ? {
              id: totem.campus.id,
              name: totem.campus.name,
            }
            : null,
          connectionStatus: totem.connectionStatus,
          lastSeenAt: toIsoOrNull(totem.lastSeenAt),
          issueType: issueDescriptor.issueType,
          issueLabel: issueDescriptor.issueLabel,
          issueSeverity: issueDescriptor.issueSeverity,
          priority: issueDescriptor.priority,
        }
      })
      .filter(Boolean)
      .sort((left, right) => {
        if (left.priority !== right.priority) {
          return left.priority - right.priority
        }

        const leftLastSeenAt = left.lastSeenAt ? Date.parse(left.lastSeenAt) : 0
        const rightLastSeenAt = right.lastSeenAt ? Date.parse(right.lastSeenAt) : 0
        return leftLastSeenAt - rightLastSeenAt
      })
      .slice(0, MAX_PROBLEMATIC_TOTEMS)
      .map(({ priority, ...totem }) => totem)

    return {
      generatedAt: nowIso,
      thresholds: {
        assignmentExpiringSoonHours: this.assignmentExpiringSoonHours,
      },
      metrics: {
        totems: {
          total: totalTotems,
          active: activeTotems,
          inactive: inactiveTotems,
          online: onlineTotems,
          activeOffline: activeOfflineTotems,
          withoutConnectionRecord: activeTotemsWithoutConnectionRecord,
        },
        contents: {
          active: activeContents,
          activeByType: activeContentByType,
          activeWithoutAssignment: activeContentsWithoutAssignments,
          activeWithUnavailableFile: activeContentsWithUnavailableFile,
        },
        assignments: {
          active: activeAssignments,
          scheduled: scheduledAssignments,
          expired: expiredAssignments,
          expiringSoon: expiringSoonAssignments,
        },
        notifications: notificationMetrics,
        users: usersMetrics,
      },
      problematicTotems,
    }
  }

  async getDashboardSummarySnapshot({
    scopedCampusId,
    includeUsersMetrics,
  }) {
    const cacheKey = buildDashboardSummaryCacheKey({
      scopedCampusId,
      includeUsersMetrics,
    })
    const nowMs = Date.now()

    if (this.dashboardSummaryCacheTtlMs > 0) {
      const cachedEntry = this.dashboardSummaryCache.get(cacheKey)

      if (cachedEntry && cachedEntry.expiresAt > nowMs) {
        return cloneDashboardSummarySnapshot(cachedEntry.snapshot)
      }
    }

    const inFlightPromise = this.dashboardSummaryInFlight.get(cacheKey)

    if (inFlightPromise) {
      const inFlightSnapshot = await inFlightPromise
      return cloneDashboardSummarySnapshot(inFlightSnapshot)
    }

    const snapshotPromise = this.buildDashboardSummarySnapshot({
      scopedCampusId,
      includeUsersMetrics,
    })
      .then((snapshot) => {
        if (this.dashboardSummaryCacheTtlMs > 0) {
          this.dashboardSummaryCache.set(cacheKey, {
            snapshot,
            expiresAt: Date.now() + this.dashboardSummaryCacheTtlMs,
          })
        } else {
          this.dashboardSummaryCache.delete(cacheKey)
        }

        return snapshot
      })
      .finally(() => {
        this.dashboardSummaryInFlight.delete(cacheKey)
      })

    this.dashboardSummaryInFlight.set(cacheKey, snapshotPromise)

    const snapshot = await snapshotPromise
    return cloneDashboardSummarySnapshot(snapshot)
  }

  async getDashboardSummary(authUser = null) {
    const scopedCampusId = requireCampusScopeId(authUser)
    const includeUsersMetrics = authUser?.role === 'SuperAdmin'

    const snapshot = await this.getDashboardSummarySnapshot({
      scopedCampusId,
      includeUsersMetrics,
    })

    return {
      ...snapshot,
      scope: {
        role: authUser?.role ?? null,
        campusId: scopedCampusId,
        campusName: authUser?.campus?.name ?? null,
      },
    }
  }
}

export default new DashboardService()
