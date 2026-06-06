'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const tableName = 'notification'

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
        title: {
          type: Sequelize.STRING(200),
          allowNull: false,
        },
        message: {
          type: Sequelize.TEXT,
          allowNull: false,
        },
        created_by: {
          type: Sequelize.INTEGER,
          allowNull: false,
          references: {
            model: 'app_user',
            key: 'id',
          },
          onUpdate: 'CASCADE',
          onDelete: 'RESTRICT',
        },
        duration_hours: {
          type: Sequelize.INTEGER,
          allowNull: false,
        },
        start_at: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
        },
        created_at: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
        },
        status: {
          type: Sequelize.SMALLINT,
          allowNull: false,
          defaultValue: 1,
        },
        totem_id: {
          type: Sequelize.INTEGER,
          allowNull: true,
          references: {
            model: 'totems',
            key: 'id',
          },
          onUpdate: 'CASCADE',
          onDelete: 'SET NULL',
        },
        campuses: {
          type: Sequelize.ARRAY(Sequelize.STRING(50)),
          allowNull: true,
        },
        type: {
          type: Sequelize.STRING(20),
          allowNull: false,
          defaultValue: 'normal',
        },
      })
    }

    const indexes = await queryInterface.showIndex(tableName)

    const hasCreatedByIndex = indexes.some((index) =>
      index.fields.some((field) => field.attribute === 'created_by')
    )

    const hasStatusIndex = indexes.some((index) =>
      index.fields.some((field) => field.attribute === 'status')
    )

    const hasTypeIndex = indexes.some((index) =>
      index.fields.some((field) => field.attribute === 'type')
    )

    const hasStartAtIndex = indexes.some((index) =>
      index.fields.some((field) => field.attribute === 'start_at')
    )

    if (!hasCreatedByIndex) {
      await queryInterface.addIndex(tableName, ['created_by'], {
        name: 'notification_created_by_idx',
      })
    }

    if (!hasStatusIndex) {
      await queryInterface.addIndex(tableName, ['status'], {
        name: 'notification_status_idx',
      })
    }

    if (!hasTypeIndex) {
      await queryInterface.addIndex(tableName, ['type'], {
        name: 'notification_type_idx',
      })
    }

    if (!hasStartAtIndex) {
      await queryInterface.addIndex(tableName, ['start_at'], {
        name: 'notification_start_at_idx',
      })
    }
  },

  async down() {
    // No-op for safety: this table can be shared across environments.
  },
};
