'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.query(`
      DROP INDEX IF EXISTS totems_name_unique_not_deleted;
    `);

    await queryInterface.sequelize.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS totems_name_campus_unique_not_deleted
      ON totems (name, campus_id)
      WHERE deleted_at IS NULL;
    `);
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query(`
      DROP INDEX IF EXISTS totems_name_campus_unique_not_deleted;
    `);

    await queryInterface.sequelize.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS totems_name_unique_not_deleted
      ON totems (name)
      WHERE deleted_at IS NULL;
    `);
  },
};
