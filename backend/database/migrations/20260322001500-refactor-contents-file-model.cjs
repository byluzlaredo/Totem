'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.sequelize.query(`
      ALTER TABLE contents DROP CONSTRAINT IF EXISTS contents_non_empty_payload_check;
    `);

    const contentsTable = await queryInterface.describeTable('contents');

    if (contentsTable.text_content) {
      await queryInterface.removeColumn('contents', 'text_content');
    }

    if (contentsTable.external_url) {
      await queryInterface.removeColumn('contents', 'external_url');
    }

    if (contentsTable.thumbnail_url) {
      await queryInterface.removeColumn('contents', 'thumbnail_url');
    }

    if (contentsTable.created_by) {
      await queryInterface.removeColumn('contents', 'created_by');
    }

    if (contentsTable.updated_by) {
      await queryInterface.removeColumn('contents', 'updated_by');
    }

    const totemContentsTable = await queryInterface.describeTable('totem_contents');

    if (totemContentsTable.assigned_by) {
      await queryInterface.removeColumn('totem_contents', 'assigned_by');
    }
  },

  async down(queryInterface, Sequelize) {
    const contentsTable = await queryInterface.describeTable('contents');

    if (!contentsTable.thumbnail_url) {
      await queryInterface.addColumn('contents', 'thumbnail_url', {
        type: Sequelize.TEXT,
        allowNull: true,
      });
    }

    if (!contentsTable.text_content) {
      await queryInterface.addColumn('contents', 'text_content', {
        type: Sequelize.TEXT,
        allowNull: true,
      });
    }

    if (!contentsTable.external_url) {
      await queryInterface.addColumn('contents', 'external_url', {
        type: Sequelize.TEXT,
        allowNull: true,
      });
    }

    if (!contentsTable.created_by) {
      await queryInterface.addColumn('contents', 'created_by', {
        type: Sequelize.INTEGER,
        allowNull: true,
      });
    }

    if (!contentsTable.updated_by) {
      await queryInterface.addColumn('contents', 'updated_by', {
        type: Sequelize.INTEGER,
        allowNull: true,
      });
    }

    await queryInterface.sequelize.query(`
      ALTER TABLE contents
      ADD CONSTRAINT contents_non_empty_payload_check
      CHECK (
        COALESCE(NULLIF(BTRIM(file_url), ''), NULLIF(BTRIM(text_content), ''), NULLIF(BTRIM(external_url), '')) IS NOT NULL
      );
    `);

    const totemContentsTable = await queryInterface.describeTable('totem_contents');

    if (!totemContentsTable.assigned_by) {
      await queryInterface.addColumn('totem_contents', 'assigned_by', {
        type: Sequelize.INTEGER,
        allowNull: true,
      });
    }
  },
};