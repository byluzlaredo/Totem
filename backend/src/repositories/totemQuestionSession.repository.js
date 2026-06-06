import { TotemQuestionSession } from '../../database/models/index.js'

const SESSION_ATTRIBUTES = [
  'id',
  'totemId',
  'status',
  'startedAt',
  'lastActivityAt',
  'inactivityTimeoutSeconds',
  'inactivityDeadlineAt',
  'endedAt',
  'endReason',
  'createdAt',
  'updatedAt',
  'deletedAt',
]

class TotemQuestionSessionRepository {
  async create(data, options = {}) {
    return TotemQuestionSession.create(data, options)
  }

  async findById(id, options = {}) {
    return TotemQuestionSession.findByPk(id, {
      attributes: SESSION_ATTRIBUTES,
      ...options,
    })
  }

  async findByIdAndTotem(sessionId, totemId, options = {}) {
    return TotemQuestionSession.findOne({
      where: {
        id: sessionId,
        totemId,
      },
      attributes: SESSION_ATTRIBUTES,
      ...options,
    })
  }

  async findActiveByTotemId(totemId, options = {}) {
    return TotemQuestionSession.findOne({
      where: {
        totemId,
        status: 'active',
      },
      attributes: SESSION_ATTRIBUTES,
      order: [['startedAt', 'DESC']],
      ...options,
    })
  }

  async update(session, data, options = {}) {
    return session.update(data, options)
  }
}

export default new TotemQuestionSessionRepository()
