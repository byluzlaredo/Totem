'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('totems', {
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
      headquarters: {
        type: Sequelize.STRING(150),
        allowNull: false,
      },
      state: {
        type: Sequelize.ENUM('active', 'inactive'),
        allowNull: false,
        defaultValue: 'active',
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
      deleted_at: {
        type: Sequelize.DATE,
        allowNull: true,
      },
    })

    await queryInterface.addIndex('totems', ['headquarters']);
    await queryInterface.addIndex('totems', ['state']);
    await queryInterface.sequelize.query(`
      CREATE UNIQUE INDEX totems_name_unique_not_deleted
      ON totems (name)
      WHERE deleted_at IS NULL;
      `);
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.sequelize.query(`
      DROP INDEX IF EXISTS totems_name_unique_not_deleted;
      `);
    await queryInterface.dropTable('totems');
    await queryInterface.sequelize.query(`
      DROP TYPE IF EXISTS "enum_totems_state";
      `);
  }
};
