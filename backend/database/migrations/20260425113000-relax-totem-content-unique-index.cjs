'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.sequelize.query(`
      DROP INDEX IF EXISTS totem_contents_totem_content_unique_not_deleted;
    `);

    await queryInterface.sequelize.query(`
      CREATE INDEX IF NOT EXISTS totem_contents_totem_content_not_deleted_idx
      ON totem_contents (totem_id, content_id)
      WHERE deleted_at IS NULL;
    `);
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.sequelize.query(`
      DROP INDEX IF EXISTS totem_contents_totem_content_not_deleted_idx;
    `);

    await queryInterface.sequelize.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS totem_contents_totem_content_unique_not_deleted
      ON totem_contents (totem_id, content_id)
      WHERE deleted_at IS NULL;
    `);
  },
};
