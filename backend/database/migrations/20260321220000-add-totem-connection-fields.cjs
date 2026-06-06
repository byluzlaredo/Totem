'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('totems', 'code', {
      type: Sequelize.STRING(50),
      allowNull: true,
    });

    await queryInterface.addColumn('totems', 'connection_status', {
      type: Sequelize.ENUM('online', 'offline'),
      allowNull: false,
      defaultValue: 'offline',
    });

    await queryInterface.addColumn('totems', 'last_seen_at', {
      type: Sequelize.DATE,
      allowNull: true,
    });

    await queryInterface.addColumn('totems', 'device_token', {
      type: Sequelize.STRING(128),
      allowNull: true,
    });

    await queryInterface.sequelize.query(`
      UPDATE totems
      SET code = CONCAT('TOTEM-', LPAD(id::text, 6, '0'))
      WHERE code IS NULL;
    `);

    await queryInterface.sequelize.query(`
      UPDATE totems
      SET device_token = md5(random()::text || clock_timestamp()::text || id::text)
      WHERE device_token IS NULL;
    `);

    await queryInterface.changeColumn('totems', 'code', {
      type: Sequelize.STRING(50),
      allowNull: false,
    });

    await queryInterface.changeColumn('totems', 'device_token', {
      type: Sequelize.STRING(128),
      allowNull: false,
    });

    await queryInterface.addIndex('totems', ['code'], {
      name: 'totems_code_unique_not_deleted',
      unique: true,
      where: {
        deleted_at: null,
      },
    });

    await queryInterface.addIndex('totems', ['device_token'], {
      name: 'totems_device_token_unique_not_deleted',
      unique: true,
      where: {
        deleted_at: null,
      },
    });

    await queryInterface.addIndex('totems', ['connection_status'], {
      name: 'totems_connection_status_idx',
    });

    await queryInterface.addIndex('totems', ['last_seen_at'], {
      name: 'totems_last_seen_at_idx',
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeIndex('totems', 'totems_last_seen_at_idx');
    await queryInterface.removeIndex('totems', 'totems_connection_status_idx');
    await queryInterface.removeIndex('totems', 'totems_device_token_unique_not_deleted');
    await queryInterface.removeIndex('totems', 'totems_code_unique_not_deleted');

    await queryInterface.removeColumn('totems', 'device_token');
    await queryInterface.removeColumn('totems', 'last_seen_at');
    await queryInterface.removeColumn('totems', 'connection_status');
    await queryInterface.removeColumn('totems', 'code');

    await queryInterface.sequelize.query(`
      DROP TYPE IF EXISTS "enum_totems_connection_status";
    `);
  },
};
