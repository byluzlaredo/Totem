'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const tableName = 'app_user'

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
        name: {
          type: Sequelize.STRING(100),
          allowNull: false,
        },
        email: {
          type: Sequelize.STRING(150),
          allowNull: false,
        },
        password_hash: {
          type: Sequelize.STRING(255),
          allowNull: false,
        },
        role: {
          type: Sequelize.STRING(20),
          allowNull: false,
          defaultValue: 'admin',
        },
        status: {
          type: Sequelize.INTEGER,
          allowNull: false,
          defaultValue: 1,
        },
        campus: {
          type: Sequelize.STRING(100),
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
    const hasEmailUnique = indexes.some((index) =>
      index.unique && index.fields.some((field) => field.attribute === 'email')
    )
    const hasRoleIndex = indexes.some((index) =>
      index.fields.some((field) => field.attribute === 'role')
    )

    if (!hasEmailUnique) {
      await queryInterface.addIndex(tableName, ['email'], {
        unique: true,
        name: 'app_user_email_unique',
      })
    }

    if (!hasRoleIndex) {
      await queryInterface.addIndex(tableName, ['role'], {
        name: 'app_user_role_idx',
      })
    }
  },

  async down() {
    // No-op for safety: app_user can be pre-existing in some environments.
  },
};
