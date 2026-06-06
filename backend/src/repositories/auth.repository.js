import { Op, col, fn, where as sequelizeWhere } from "sequelize";
import { sequelize } from "../config/db.js";
import {
  AppUser,
  Campus,
  PasswordResetToken,
  UserInvitation,
} from "../../database/models/index.js";
import { USER_STATUS } from '../utils/userStatus.js'

const CAMPUS_INCLUDE = {
  model: Campus,
  as: 'campus',
  attributes: ['id', 'name'],
  required: false,
}

function normalizeEmail(email) {
  return String(email ?? '').trim().toLowerCase();
}

function resolveSessionTableName() {
  const configuredName = String(process.env.SESSION_TABLE_NAME ?? 'user_sessions').trim();

  if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(configuredName)) {
    return 'user_sessions';
  }

  return configuredName;
}

const SESSION_TABLE_NAME = resolveSessionTableName();

async function deleteSessionsForUser({
  userId,
  keepSessionId = null,
  transaction,
}) {
  const replacements = {
    userId: String(userId),
  };
  let sessionFilter = `sess -> 'authUser' ->> 'id' = :userId`;

  if (typeof keepSessionId === 'string' && keepSessionId.trim().length > 0) {
    replacements.keepSessionId = keepSessionId.trim();
    sessionFilter += ' AND sid <> :keepSessionId';
  }

  const [deletedRows] = await sequelize.query(
    `DELETE FROM "${SESSION_TABLE_NAME}" WHERE ${sessionFilter} RETURNING sid`,
    {
      replacements,
      transaction,
    }
  );

  return Array.isArray(deletedRows) ? deletedRows.length : 0;
}

class AuthRepository {
  async findByEmailWithPassword(email) {
    const normalizedEmail = normalizeEmail(email);
    const scopedModel = AppUser.scope('withPasswordHash')
    const where = sequelizeWhere(fn('lower', col('email')), normalizedEmail)

    const activeUser = await scopedModel.findOne({
      where,
      include: [CAMPUS_INCLUDE],
    })

    if (activeUser) {
      return activeUser
    }

    return scopedModel.findOne({
      where,
      paranoid: false,
      include: [CAMPUS_INCLUDE],
      order: [['deletedAt', 'DESC'], ['id', 'DESC']],
    });
  }

  async findById(id, options = {}) {
    return AppUser.findByPk(id, {
      include: [CAMPUS_INCLUDE],
      ...options,
    });
  }

  async findByIdWithPasswordHash(id, options = {}) {
    return AppUser.scope('withPasswordHash').findByPk(id, {
      include: [CAMPUS_INCLUDE],
      ...options,
    });
  }

  async touchLastLoginAtById(id) {
    const user = await AppUser.findByPk(id, { paranoid: false });

    if (!user) {
      return null;
    }

    await user.update({
      lastLoginAt: new Date().toISOString(),
    });

    return this.findById(id, { paranoid: false });
  }

  async updatePasswordAndInvalidateOtherSessions({
    userId,
    newPasswordHash,
    keepSessionId = null,
  }) {
    return sequelize.transaction(async (transaction) => {
      const user = await AppUser.scope('withPasswordHash').findByPk(userId, {
        transaction,
      });

      if (!user) {
        return null;
      }

      await user.update(
        {
          passwordHash: newPasswordHash,
        },
        {
          transaction,
        }
      );

      return deleteSessionsForUser({
        userId: user.id,
        keepSessionId,
        transaction,
      });
    });
  }

  async createPasswordResetToken({ userId, tokenHash, expiresAt }) {
    return sequelize.transaction(async (transaction) => {
      const now = new Date();

      await PasswordResetToken.update(
        {
          usedAt: now,
        },
        {
          where: {
            userId,
            usedAt: null,
          },
          transaction,
        }
      );

      return PasswordResetToken.create(
        {
          userId,
          tokenHash,
          expiresAt,
        },
        {
          transaction,
        }
      );
    });
  }

  async createUserInvitation({ userId, tokenHash, expiresAt }) {
    return sequelize.transaction(async (transaction) => {
      const now = new Date()

      await UserInvitation.update(
        {
          usedAt: now,
        },
        {
          where: {
            userId,
            usedAt: null,
          },
          transaction,
        }
      )

      return UserInvitation.create(
        {
          userId,
          tokenHash,
          expiresAt,
        },
        {
          transaction,
        }
      )
    })
  }

  async findValidPasswordResetTokenByHash(tokenHash) {
    return PasswordResetToken.findOne({
      where: {
        tokenHash,
        usedAt: null,
        expiresAt: {
          [Op.gt]: new Date(),
        },
      },
      include: [
        {
          model: AppUser.scope('withPasswordHash'),
          as: 'user',
          paranoid: false,
          include: [CAMPUS_INCLUDE],
          required: false,
        },
      ],
    });
  }

  async findValidUserInvitationByHash(tokenHash) {
    return UserInvitation.findOne({
      where: {
        tokenHash,
        usedAt: null,
        expiresAt: {
          [Op.gt]: new Date(),
        },
      },
      include: [
        {
          model: AppUser.scope('withPasswordHash'),
          as: 'user',
          paranoid: false,
          include: [CAMPUS_INCLUDE],
          required: false,
        },
      ],
    })
  }

  async consumePasswordResetTokenAndUpdatePassword({ tokenHash, newPasswordHash }) {
    return sequelize.transaction(async (transaction) => {
      const tokenRecord = await PasswordResetToken.findOne({
        where: {
          tokenHash,
        },
        transaction,
        lock: transaction.LOCK.UPDATE,
      });

      if (!tokenRecord) {
        return {
          outcome: 'invalid',
        };
      }

      if (tokenRecord.usedAt) {
        return {
          outcome: 'used',
        };
      }

      if (new Date(tokenRecord.expiresAt).getTime() <= Date.now()) {
        return {
          outcome: 'expired',
        };
      }

      const user = await AppUser.scope('withPasswordHash').findByPk(
        tokenRecord.userId,
        {
          paranoid: false,
          transaction,
          lock: transaction.LOCK.UPDATE,
        }
      );

      if (!user) {
        return {
          outcome: 'invalid',
        };
      }

      await user.update(
        {
          passwordHash: newPasswordHash,
        },
        {
          transaction,
        }
      );

      const usedAt = new Date();
      await PasswordResetToken.update(
        {
          usedAt,
        },
        {
          where: {
            userId: user.id,
            usedAt: null,
          },
          transaction,
        }
      );

      const invalidatedSessions = await deleteSessionsForUser({
        userId: user.id,
        keepSessionId: null,
        transaction,
      });

      return {
        outcome: 'success',
        invalidatedSessions,
        user: user.get({ plain: true }),
      };
    });
  }

  async consumeUserInvitationAndActivateUser({ tokenHash, newPasswordHash }) {
    return sequelize.transaction(async (transaction) => {
      const invitation = await UserInvitation.findOne({
        where: {
          tokenHash,
        },
        transaction,
        lock: transaction.LOCK.UPDATE,
      })

      if (!invitation) {
        return {
          outcome: 'invalid',
        }
      }

      if (invitation.usedAt) {
        return {
          outcome: 'used',
        }
      }

      if (new Date(invitation.expiresAt).getTime() <= Date.now()) {
        return {
          outcome: 'expired',
        }
      }

      const user = await AppUser.scope('withPasswordHash').findByPk(
        invitation.userId,
        {
          paranoid: false,
          transaction,
          lock: transaction.LOCK.UPDATE,
        }
      )

      if (!user) {
        return {
          outcome: 'invalid',
        }
      }

      if (user.status !== USER_STATUS.INVITED || user.deletedAt) {
        return {
          outcome: 'invalid',
        }
      }

      await user.update(
        {
          passwordHash: newPasswordHash,
          status: USER_STATUS.ACTIVE,
        },
        {
          transaction,
        }
      )

      const usedAt = new Date()

      await UserInvitation.update(
        {
          usedAt,
        },
        {
          where: {
            userId: user.id,
            usedAt: null,
          },
          transaction,
        }
      )

      const invalidatedSessions = await deleteSessionsForUser({
        userId: user.id,
        keepSessionId: null,
        transaction,
      })

      return {
        outcome: 'success',
        invalidatedSessions,
        user: user.get({ plain: true }),
      }
    })
  }
}

export default new AuthRepository();
