'use strict'

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const tableName = 'user_invitations'
    let tableDefinition

    try {
      tableDefinition = await queryInterface.describeTable(tableName)
    } catch {
      tableDefinition = null
    }

    if (!tableDefinition) {
      await queryInterface.createTable(tableName, {
        id: {
          type: Sequelize.INTEGER,
          allowNull: false,
          autoIncrement: true,
          primaryKey: true,
        },
        user_id: {
          type: Sequelize.INTEGER,
          allowNull: false,
          references: {
            model: 'app_user',
            key: 'id',
          },
          onUpdate: 'CASCADE',
          onDelete: 'CASCADE',
        },
        token_hash: {
          type: Sequelize.STRING(128),
          allowNull: false,
        },
        expires_at: {
          type: Sequelize.DATE,
          allowNull: false,
        },
        used_at: {
          type: Sequelize.DATE,
          allowNull: true,
        },
        created_at: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
        },
        updated_at: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
        },
      })
    }

    const indexes = await queryInterface.showIndex(tableName)
    const hasTokenHashUniqueIndex = indexes.some(
      (index) => index.name === 'user_invitations_token_hash_unique_idx'
    )
    const hasUserIdIndex = indexes.some(
      (index) => index.name === 'user_invitations_user_id_idx'
    )
    const hasExpiresAtIndex = indexes.some(
      (index) => index.name === 'user_invitations_expires_at_idx'
    )
    const hasUsedAtIndex = indexes.some(
      (index) => index.name === 'user_invitations_used_at_idx'
    )
    const hasUserActiveInvitationIndex = indexes.some(
      (index) => index.name === 'user_invitations_user_active_idx'
    )

    if (!hasTokenHashUniqueIndex) {
      await queryInterface.addIndex(tableName, ['token_hash'], {
        unique: true,
        name: 'user_invitations_token_hash_unique_idx',
      })
    }

    if (!hasUserIdIndex) {
      await queryInterface.addIndex(tableName, ['user_id'], {
        name: 'user_invitations_user_id_idx',
      })
    }

    if (!hasExpiresAtIndex) {
      await queryInterface.addIndex(tableName, ['expires_at'], {
        name: 'user_invitations_expires_at_idx',
      })
    }

    if (!hasUsedAtIndex) {
      await queryInterface.addIndex(tableName, ['used_at'], {
        name: 'user_invitations_used_at_idx',
      })
    }

    if (!hasUserActiveInvitationIndex) {
      await queryInterface.sequelize.query(`
        CREATE INDEX IF NOT EXISTS user_invitations_user_active_idx
        ON public.user_invitations (user_id)
        WHERE used_at IS NULL
      `)
    }
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query(`
      DROP INDEX IF EXISTS user_invitations_user_active_idx;
      DROP INDEX IF EXISTS user_invitations_used_at_idx;
      DROP INDEX IF EXISTS user_invitations_expires_at_idx;
      DROP INDEX IF EXISTS user_invitations_user_id_idx;
      DROP INDEX IF EXISTS user_invitations_token_hash_unique_idx;
    `)

    try {
      await queryInterface.describeTable('user_invitations')
      await queryInterface.dropTable('user_invitations')
    } catch {
      // no-op
    }
  },
}
