'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('totems', 'linking_code', {
      type: Sequelize.STRING(24),
      allowNull: true,
    });

    await queryInterface.addColumn('totems', 'linking_code_generated_at', {
      type: Sequelize.DATE,
      allowNull: true,
    });

    await queryInterface.addColumn('totems', 'linking_code_expires_at', {
      type: Sequelize.DATE,
      allowNull: true,
    });

    await queryInterface.addColumn('totems', 'linking_code_used_at', {
      type: Sequelize.DATE,
      allowNull: true,
    });

    await queryInterface.addColumn('totems', 'linking_code_ttl_minutes', {
      type: Sequelize.INTEGER,
      allowNull: true,
    });

    await queryInterface.sequelize.query(`
      CREATE UNIQUE INDEX totems_linking_code_unique_not_deleted
      ON totems (linking_code)
      WHERE deleted_at IS NULL AND linking_code IS NOT NULL;
    `);
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query(`
      DROP INDEX IF EXISTS totems_linking_code_unique_not_deleted;
    `);

    await queryInterface.removeColumn('totems', 'linking_code_ttl_minutes');
    await queryInterface.removeColumn('totems', 'linking_code_used_at');
    await queryInterface.removeColumn('totems', 'linking_code_expires_at');
    await queryInterface.removeColumn('totems', 'linking_code_generated_at');
    await queryInterface.removeColumn('totems', 'linking_code');
  },
};
