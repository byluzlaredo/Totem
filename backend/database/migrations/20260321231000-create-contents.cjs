'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('contents', {
      id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
      },
      title: {
        type: Sequelize.STRING(180),
        allowNull: false,
      },
      description: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      content_type: {
        type: Sequelize.ENUM('image', 'video', 'news', 'advertisement', 'pdf'),
        allowNull: false,
      },
      file_url: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      status: {
        type: Sequelize.ENUM('active', 'inactive'),
        allowNull: false,
        defaultValue: 'active',
      },
      start_at: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      end_at: {
        type: Sequelize.DATE,
        allowNull: true,
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
    });

    await queryInterface.addIndex('contents', ['title']);
    await queryInterface.addIndex('contents', ['content_type']);
    await queryInterface.addIndex('contents', ['status']);
    await queryInterface.addIndex('contents', ['start_at']);
    await queryInterface.addIndex('contents', ['end_at']);

    await queryInterface.sequelize.query(`
      ALTER TABLE contents
      ADD CONSTRAINT contents_dates_range_check
      CHECK (
        start_at IS NULL OR end_at IS NULL OR start_at <= end_at
      );
    `);
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.sequelize.query(`
      ALTER TABLE contents DROP CONSTRAINT IF EXISTS contents_dates_range_check;
    `);

    await queryInterface.dropTable('contents');

    await queryInterface.sequelize.query(`
      DROP TYPE IF EXISTS "enum_contents_content_type";
    `);

    await queryInterface.sequelize.query(`
      DROP TYPE IF EXISTS "enum_contents_status";
    `);
  },
};
