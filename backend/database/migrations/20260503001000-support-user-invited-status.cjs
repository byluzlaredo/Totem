'use strict'

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
      return
    }

    if (tableDefinition.password_hash) {
      await queryInterface.changeColumn(tableName, 'password_hash', {
        type: Sequelize.STRING(255),
        allowNull: true,
      })
    }

    if (tableDefinition.status) {
      await queryInterface.changeColumn(tableName, 'status', {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 2,
      })
    }

    await queryInterface.sequelize.query(`
      ALTER TABLE public.app_user
      DROP CONSTRAINT IF EXISTS app_user_status_check;
    `)

    await queryInterface.sequelize.query(`
      ALTER TABLE public.app_user
      ADD CONSTRAINT app_user_status_check
      CHECK (status IN (0, 1, 2));
    `)
  },

  async down(queryInterface, Sequelize) {
    const tableName = 'app_user'

    await queryInterface.sequelize.query(`
      ALTER TABLE public.app_user
      DROP CONSTRAINT IF EXISTS app_user_status_check;
    `)

    await queryInterface.sequelize.query(`
      ALTER TABLE public.app_user
      ADD CONSTRAINT app_user_status_check
      CHECK (status IN (0, 1));
    `)

    await queryInterface.changeColumn(tableName, 'status', {
      type: Sequelize.INTEGER,
      allowNull: false,
      defaultValue: 1,
    })
  },
}
