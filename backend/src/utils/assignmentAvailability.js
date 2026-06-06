import { Op } from "sequelize";

export const DEFAULT_ASSIGNMENT_EXPIRING_SOON_HOURS = 24
export const COMPUTED_TEMPORAL_STATUSES = [
    'active',
    'inactive',
    'scheduled',
    'expired',
    'expiringSoon',
]

function parsePositiveInteger(rawValue) {
    const parsed = Number(rawValue)

    if (!Number.isInteger(parsed) || parsed <= 0) {
        return null
    }

    return parsed
}

export function resolveAssignmentExpiringSoonHours(rawValue) {
    const parsed = parsePositiveInteger(rawValue)

    if (parsed === null) {
        return DEFAULT_ASSIGNMENT_EXPIRING_SOON_HOURS
    }

    return parsed
}

export function parseValidDate(value) {
    if (!value) {
        return null
    }

    const parsed = value instanceof Date ? value : new Date(value)

    if (Number.isNaN(parsed.getTime())) {
        return null
    }

    return parsed
}

export function isContentExpiredAt(endAt, now = new Date()) {
    const parsedEndAt = parseValidDate(endAt)
    const parsedNow = parseValidDate(now) ?? new Date()

    if (!parsedEndAt) {
        return false
    }

    return parsedNow.getTime() > parsedEndAt.getTime()
}

export function isContentScheduledAt(startAt, now = new Date()) {
    const parsedStartAt = parseValidDate(startAt)
    const parsedNow = parseValidDate(now) ?? new Date()

    if (!parsedStartAt) {
        return false
    }

    return parsedNow.getTime() < parsedStartAt.getTime()
}

export function buildTemporalActiveWhere(now = new Date()) {
    const parsedNow = parseValidDate(now) ?? new Date()

    return {
        status: 'active',
        [Op.and]: [
            {
                [Op.or]: [
                    { startAt: null },
                    { startAt: { [Op.lte]: parsedNow } },
                ],
            },
            {
                [Op.or]: [
                    { endAt: null },
                    { endAt: { [Op.gte]: parsedNow } },
                ],
            },
        ],
    }
}

export function buildTemporalExpiringSoonWhere(
    now = new Date(),
    expiringSoonHours = DEFAULT_ASSIGNMENT_EXPIRING_SOON_HOURS
) {
    const parsedNow = parseValidDate(now) ?? new Date()
    const safeHours = resolveAssignmentExpiringSoonHours(expiringSoonHours)
    const threshold = new Date(parsedNow.getTime() + safeHours * 60 * 60 * 1000)

    return {
        status: 'active',
        endAt: {
            [Op.gte]: parsedNow,
            [Op.lte]: threshold,
        },
        [Op.and]: [
            {
                [Op.or]: [
                    { startAt: null },
                    { startAt: { [Op.lte]: parsedNow } },
                ],
            },
        ],
    }
}

export function buildTemporalComputedStatusWhere(
    status,
    now = new Date(),
    options = {}
) {
    const parsedNow = parseValidDate(now) ?? new Date()
    const expiringSoonHours = resolveAssignmentExpiringSoonHours(
        options?.expiringSoonHours
    )

    if (status === 'inactive') {
        return { status: 'inactive' }
    }

    if (status === 'scheduled') {
        return {
            status: 'active',
            startAt: { [Op.gt]: parsedNow },
        }
    }

    if (status === 'expired') {
        return {
            status: 'active',
            endAt: { [Op.lt]: parsedNow },
        }
    }

    if (status === 'active') {
        return buildTemporalActiveWhere(parsedNow)
    }

    if (status === 'expiringSoon') {
        return buildTemporalExpiringSoonWhere(parsedNow, expiringSoonHours)
    }

    return {}
}
