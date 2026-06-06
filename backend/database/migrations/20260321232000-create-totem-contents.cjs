'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('totem_contents', {
      id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
      },
      totem_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'totems',
          key: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'RESTRICT',
      },
      content_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'contents',
          key: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'RESTRICT',
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
      priority: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 1,
      },
      sort_order: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 1,
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

    await queryInterface.addIndex('totem_contents', ['totem_id']);
    await queryInterface.addIndex('totem_contents', ['content_id']);
    await queryInterface.addIndex('totem_contents', ['status']);
    await queryInterface.addIndex('totem_contents', ['priority']);
    await queryInterface.addIndex('totem_contents', ['sort_order']);
    await queryInterface.addIndex('totem_contents', ['start_at']);
    await queryInterface.addIndex('totem_contents', ['end_at']);

    await queryInterface.addIndex('totem_contents', ['totem_id', 'content_id'], {
      name: 'totem_contents_totem_content_unique_not_deleted',
      unique: true,
      where: {
        deleted_at: null,
      },
    });

    await queryInterface.sequelize.query(`
      ALTER TABLE totem_contents
      ADD CONSTRAINT totem_contents_dates_range_check
      CHECK (
        start_at IS NULL OR end_at IS NULL OR start_at <= end_at
      );
    `);

    await queryInterface.sequelize.query(`
      ALTER TABLE totem_contents
      ADD CONSTRAINT totem_contents_priority_positive_check
      CHECK (
        priority > 0 AND sort_order > 0
      );
    `);
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.sequelize.query(`
      ALTER TABLE totem_contents DROP CONSTRAINT IF EXISTS totem_contents_priority_positive_check;
    `);

    await queryInterface.sequelize.query(`
      ALTER TABLE totem_contents DROP CONSTRAINT IF EXISTS totem_contents_dates_range_check;
    `);

    await queryInterface.removeIndex('totem_contents', 'totem_contents_totem_content_unique_not_deleted');
    await queryInterface.dropTable('totem_contents');

    await queryInterface.sequelize.query(`
      DROP TYPE IF EXISTS "enum_totem_contents_status";
    `);
  },
};
