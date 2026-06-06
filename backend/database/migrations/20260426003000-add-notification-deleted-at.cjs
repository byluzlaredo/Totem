'use strict'

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
      return
    }

    if (!tableDefinition.deleted_at) {
      await queryInterface.addColumn(tableName, 'deleted_at', {
        type: Sequelize.DATE,
        allowNull: true,
      })
    }

    const indexes = await queryInterface.showIndex(tableName)
    const hasDeletedAtIndex = indexes.some((index) => index.name === 'notification_deleted_at_idx')

    if (!hasDeletedAtIndex) {
      await queryInterface.addIndex(tableName, ['deleted_at'], {
        name: 'notification_deleted_at_idx',
      })
    }
  },

  async down() {
    // No-op for safety in shared environments.
  },
}
