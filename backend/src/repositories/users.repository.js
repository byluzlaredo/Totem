import { Op, col, fn, where as sequelizeWhere } from "sequelize";
import { AppUser, Campus } from "../../database/models/index.js";
import { normalizeUserStatus, statusToInteger } from '../utils/userStatus.js'
import { buildAccentInsensitiveContainsCondition } from '../utils/textSearch.js'

const CAMPUS_INCLUDE = {
  model: Campus,
  as: 'campus',
  attributes: ['id', 'name'],
  required: false,
}

const PUBLIC_ATTRIBUTES = [
  'id',
  'name',
  'email',
  'role',
  'status',
  'campusId',
  'lastLoginAt',
  'createdAt',
  'updatedAt',
];

function normalizeRole(role) {
  if (typeof role !== 'string') {
    return 'Admin';
  }

  return role.trim().toLowerCase() === 'superadmin' ? 'SuperAdmin' : 'Admin';
}

function mapUser(user) {
  const data = user.get({ plain: true });

  return {
    id: data.id,
    name: data.name,
    email: data.email,
    role: normalizeRole(data.role),
    status: normalizeUserStatus(data.status),
    campusId: data.campusId,
    campus: data.campus
      ? {
        id: data.campus.id,
        name: data.campus.name,
      }
      : null,
    lastLoginAt: data.lastLoginAt ?? null,
    createdAt: data.createdAt,
    updatedAt: data.updatedAt,
  };
}

function normalizeEmail(email) {
  return String(email ?? '').trim().toLowerCase();
}

class UsersRepository {
  async findById(id, options = {}) {
    const user = await AppUser.findByPk(id, {
      attributes: PUBLIC_ATTRIBUTES,
      include: [CAMPUS_INCLUDE],
      ...options,
    });

    return user ? mapUser(user) : null;
  }

  async findByIdWithPasswordHash(id, options = {}) {
    return AppUser.scope('withPasswordHash').findByPk(id, {
      include: [CAMPUS_INCLUDE],
      ...options,
    });
  }

  async findByEmail(
    email,
    { excludeId = null, includeDeleted = false, withPasswordHash = false } = {}
  ) {
    const normalizedEmail = normalizeEmail(email);

    const where = {
      [Op.and]: [sequelizeWhere(fn('lower', col('email')), normalizedEmail)],
    };

    if (excludeId !== null) {
      where.id = {
        [Op.ne]: excludeId,
      };
    }

    const scopedModel = withPasswordHash
      ? AppUser.scope('withPasswordHash')
      : AppUser;

    return scopedModel.findOne({
      where,
      paranoid: !includeDeleted,
      include: [CAMPUS_INCLUDE],
    });
  }

  async findAllWithPagination({ search, role, status, campusId, page, limit }) {
    const where = {};

    if (role) {
      where.role = role;
    }

    if (campusId) {
      where.campusId = campusId;
    }

    if (status) {
      where.status = statusToInteger(status);
    }

    if (search) {
      const searchConditions = [
        buildAccentInsensitiveContainsCondition('AppUser.name', search),
        buildAccentInsensitiveContainsCondition('AppUser.email', search),
      ].filter(Boolean)

      if (searchConditions.length > 0) {
        where[Op.or] = searchConditions
      }
    }

    const count = await AppUser.count({ where })

    if (count === 0) {
      return {
        count,
        rows: [],
      }
    }

    const pagedUserIds = await AppUser.findAll({
      where,
      attributes: ['id'],
      limit,
      offset: (page - 1) * limit,
      order: [['createdAt', 'ASC'], ['id', 'ASC']],
    })

    const userIds = pagedUserIds.map((user) => Number(user.id))

    if (userIds.length === 0) {
      return {
        count,
        rows: [],
      }
    }

    const rows = await AppUser.findAll({
      where: {
        id: {
          [Op.in]: userIds,
        },
      },
      attributes: PUBLIC_ATTRIBUTES,
      include: [CAMPUS_INCLUDE],
    })

    const orderById = new Map(userIds.map((id, index) => [id, index]))
    rows.sort(
      (left, right) =>
        (orderById.get(Number(left.id)) ?? Number.MAX_SAFE_INTEGER)
        - (orderById.get(Number(right.id)) ?? Number.MAX_SAFE_INTEGER)
    )

    return {
      count,
      rows: rows.map(mapUser),
    }
  }

  async create(data) {
    const createdUser = await AppUser.create(data);
    return this.findById(createdUser.id);
  }

  async update(user, data) {
    await user.update(data);
    return this.findById(user.id);
  }

  async softDelete(user) {
    return user.destroy();
  }
}

export default new UsersRepository();
