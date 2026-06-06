'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const notificationTable = 'notification'
    const targetTable = 'notification_target'

    let totemTableName = 'totem'
    try {
      await queryInterface.describeTable('totem')
    } catch {
      totemTableName = 'totems'
    }

    let notificationDefinition
    try {
      notificationDefinition = await queryInterface.describeTable(notificationTable)
    } catch {
      return
    }

    const hasLegacyTotemId = Boolean(notificationDefinition.totem_id)
    const hasLegacyCampuses = Boolean(notificationDefinition.campuses)

    let legacyRows = []

    if (hasLegacyTotemId || hasLegacyCampuses) {
      legacyRows = await queryInterface.sequelize.query(
        'SELECT id, totem_id, campuses FROM notification',
        { type: Sequelize.QueryTypes.SELECT }
      )
    }

    let targetDefinition
    try {
      targetDefinition = await queryInterface.describeTable(targetTable)
    } catch {
      targetDefinition = null
    }

    if (!targetDefinition) {
      await queryInterface.createTable(targetTable, {
        id: {
          type: Sequelize.INTEGER,
          allowNull: false,
          autoIncrement: true,
          primaryKey: true,
        },
        notification_id: {
          type: Sequelize.INTEGER,
          allowNull: false,
          references: {
            model: notificationTable,
            key: 'id',
          },
          onUpdate: 'CASCADE',
          onDelete: 'CASCADE',
        },
        totem_id: {
          type: Sequelize.INTEGER,
          allowNull: true,
          references: {
            model: totemTableName,
            key: 'id',
          },
          onUpdate: 'CASCADE',
          onDelete: 'SET NULL',
        },
        campus: {
          type: Sequelize.STRING(50),
          allowNull: true,
        },
      })
    }

    const targetIndexes = await queryInterface.showIndex(targetTable)

    const hasNotificationIndex = targetIndexes.some((index) =>
      index.fields.some((field) => field.attribute === 'notification_id')
    )

    const hasTotemIndex = targetIndexes.some((index) =>
      index.fields.some((field) => field.attribute === 'totem_id')
    )

    const hasCampusIndex = targetIndexes.some((index) =>
      index.fields.some((field) => field.attribute === 'campus')
    )

    if (!hasNotificationIndex) {
      await queryInterface.addIndex(targetTable, ['notification_id'], {
        name: 'notification_target_notification_id_idx',
      })
    }

    if (!hasTotemIndex) {
      await queryInterface.addIndex(targetTable, ['totem_id'], {
        name: 'notification_target_totem_id_idx',
      })
    }

    if (!hasCampusIndex) {
      await queryInterface.addIndex(targetTable, ['campus'], {
        name: 'notification_target_campus_idx',
      })
    }

    for (const row of legacyRows) {
      const targets = []

      if (row.totem_id) {
        targets.push({
          notification_id: row.id,
          totem_id: row.totem_id,
          campus: null,
        })
      } else if (Array.isArray(row.campuses) && row.campuses.length > 0) {
        for (const campus of row.campuses) {
          targets.push({
            notification_id: row.id,
            totem_id: null,
            campus: campus,
          })
        }
      } else {
        targets.push({
          notification_id: row.id,
          totem_id: null,
          campus: null,
        })
      }

      for (const target of targets) {
        await queryInterface.sequelize.query(
          `
            INSERT INTO notification_target (notification_id, totem_id, campus)
            SELECT :notificationId, :totemId, :campus
            WHERE NOT EXISTS (
              SELECT 1
              FROM notification_target
              WHERE notification_id = :notificationId
                AND totem_id IS NOT DISTINCT FROM :totemId
                AND campus IS NOT DISTINCT FROM :campus
            )
          `,
          {
            replacements: {
              notificationId: target.notification_id,
              totemId: target.totem_id,
              campus: target.campus,
            },
          }
        )
      }
    }

    if (hasLegacyTotemId) {
      await queryInterface.removeColumn(notificationTable, 'totem_id')
    }

    if (hasLegacyCampuses) {
      await queryInterface.removeColumn(notificationTable, 'campuses')
    }
  },

  async down() {
    // No-op for safety in shared environments.
  },
};
