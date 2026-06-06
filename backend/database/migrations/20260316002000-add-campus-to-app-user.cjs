'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const tableName = 'app_user'

    let tableDefinition
    try {
      tableDefinition = await queryInterface.describeTable(tableName)
    } catch {
      return
    }

    if (!tableDefinition.campus) {
      await queryInterface.addColumn(tableName, 'campus', {
        type: Sequelize.STRING(100),
        allowNull: true,
      })
    }

    await queryInterface.sequelize.query(`
      UPDATE public.app_user
      SET campus = CASE
        WHEN lower(replace(coalesce(campus, ''), '_', ' ')) = 'cochabamba' THEN 'Cochabamba'
        WHEN lower(replace(coalesce(campus, ''), '_', ' ')) = 'santa cruz' THEN 'Santa Cruz'
        WHEN lower(replace(coalesce(campus, ''), '_', ' ')) = 'trinidad' THEN 'Trinidad'
        WHEN campus IS NULL OR trim(campus) = '' THEN NULL
        ELSE campus
      END
    `)

    const indexes = await queryInterface.showIndex(tableName)
    const hasCampusIndex = indexes.some((index) => index.name === 'app_user_campus')

    if (!hasCampusIndex) {
      await queryInterface.addIndex(tableName, ['campus'])
    }
  },

  async down(queryInterface) {
    const tableName = 'app_user'

    let tableDefinition
    try {
      tableDefinition = await queryInterface.describeTable(tableName)
    } catch {
      return
    }

    if (tableDefinition.campus) {
      const indexes = await queryInterface.showIndex(tableName)
      const hasCampusIndex = indexes.some((index) => index.name === 'app_user_campus')

      if (hasCampusIndex) {
        await queryInterface.removeIndex(tableName, ['campus'])
      }
      await queryInterface.removeColumn(tableName, 'campus')
    }
  },
};
