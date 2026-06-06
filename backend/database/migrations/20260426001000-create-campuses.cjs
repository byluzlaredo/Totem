'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const tableName = 'campuses'

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
          unique: true,
        },
      })
    }

    await queryInterface.sequelize.query(`
      INSERT INTO public.campuses (name)
      VALUES
        ('Cochabamba'),
        ('La Paz'),
        ('Sucre'),
        ('Trinidad'),
        ('Santa Cruz')
      ON CONFLICT (name) DO NOTHING
    `)
  },

  async down() {
    // No-op for safety in shared environments.
  },
}
