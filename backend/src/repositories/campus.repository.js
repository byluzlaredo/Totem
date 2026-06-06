import { Op } from 'sequelize'
import { Campus } from '../../database/models/index.js'

class CampusRepository {
  async listAll(options = {}) {
    return Campus.findAll({
      attributes: ['id', 'name'],
      order: [['name', 'ASC']],
      ...options,
    })
  }

  async findById(id, options = {}) {
    return Campus.findByPk(id, {
      attributes: ['id', 'name'],
      ...options,
    })
  }

  async findExistingIds(ids, options = {}) {
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
      ...options,
    })

    return rows.map((row) => Number(row.id))
  }
}

export default new CampusRepository()
