import { Op } from 'sequelize'
import { Campus, Totem, TotemDeviceSession } from '../../database/models/index.js'

const SESSION_ATTRIBUTES = [
  'id',
  'totemId',
  'accessTokenHash',
  'refreshTokenHash',
  'accessTokenExpiresAt',
  'refreshTokenExpiresAt',
  'linkedAt',
  'lastAccessAt',
  'lastRefreshedAt',
  'revokedAt',
  'revokedReason',
  'createdAt',
  'updatedAt',
]

const TOTEM_AUTH_ATTRIBUTES = [
  'id',
  'code',
  'name',
  'campusId',
  'state',
  'connectionStatus',
  'lastSeenAt',
  'deviceToken',
]

function buildTotemInclude() {
  return [
    {
      model: Totem.unscoped(),
      as: 'totem',
      attributes: TOTEM_AUTH_ATTRIBUTES,
      include: [
        {
          model: Campus,
          as: 'campus',
          attributes: ['id', 'name'],
          required: false,
        },
      ],
      required: false,
    },
  ]
}

class TotemDeviceSessionRepository {
  async create(data, options = {}) {
    return TotemDeviceSession.create(data, options)
  }

  async findByAccessTokenHash(accessTokenHash, options = {}) {
    return TotemDeviceSession.findOne({
      where: { accessTokenHash },
      attributes: SESSION_ATTRIBUTES,
      include: buildTotemInclude(),
      ...options,
    })
  }

  async findByRefreshTokenHash(refreshTokenHash, options = {}) {
    return TotemDeviceSession.findOne({
      where: { refreshTokenHash },
      attributes: SESSION_ATTRIBUTES,
      include: buildTotemInclude(),
      ...options,
    })
  }

  async findActiveByTotemId(totemId, options = {}) {
    return TotemDeviceSession.findOne({
      where: {
        totemId,
        revokedAt: null,
      },
      attributes: SESSION_ATTRIBUTES,
      include: buildTotemInclude(),
      order: [['id', 'DESC']],
      ...options,
    })
  }

  async update(session, data, options = {}) {
    return session.update(data, options)
  }

  async revokeByTotemId(totemId, revokedAt, revokedReason, options = {}) {
    return TotemDeviceSession.update(
      {
        revokedAt,
        revokedReason,
      },
      {
        where: {
          totemId,
          revokedAt: {
            [Op.is]: null,
          },
        },
        ...options,
      }
    )
  }
}

export default new TotemDeviceSessionRepository()
