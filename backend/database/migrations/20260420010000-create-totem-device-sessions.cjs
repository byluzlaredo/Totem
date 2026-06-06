'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('totem_device_sessions', {
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
        onDelete: 'CASCADE',
      },
      access_token_hash: {
        type: Sequelize.STRING(128),
        allowNull: false,
      },
      refresh_token_hash: {
        type: Sequelize.STRING(128),
        allowNull: false,
      },
      access_token_expires_at: {
        type: Sequelize.DATE,
        allowNull: false,
      },
      refresh_token_expires_at: {
        type: Sequelize.DATE,
        allowNull: false,
      },
      linked_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
      },
      last_access_at: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      last_refreshed_at: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      revoked_at: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      revoked_reason: {
        type: Sequelize.STRING(120),
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
    });

    await queryInterface.addIndex('totem_device_sessions', ['totem_id'], {
      name: 'totem_device_sessions_totem_id_idx',
    });

    await queryInterface.addIndex('totem_device_sessions', ['access_token_hash'], {
      name: 'totem_device_sessions_access_token_hash_unique',
      unique: true,
    });

    await queryInterface.addIndex('totem_device_sessions', ['refresh_token_hash'], {
      name: 'totem_device_sessions_refresh_token_hash_unique',
      unique: true,
    });

    await queryInterface.sequelize.query(`
      CREATE UNIQUE INDEX totem_device_sessions_totem_active_unique
      ON totem_device_sessions (totem_id)
      WHERE revoked_at IS NULL;
    `);
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query(`
      DROP INDEX IF EXISTS totem_device_sessions_totem_active_unique;
    `);

    await queryInterface.removeIndex(
      'totem_device_sessions',
      'totem_device_sessions_refresh_token_hash_unique'
    );
    await queryInterface.removeIndex(
      'totem_device_sessions',
      'totem_device_sessions_access_token_hash_unique'
    );
    await queryInterface.removeIndex(
      'totem_device_sessions',
      'totem_device_sessions_totem_id_idx'
    );

    await queryInterface.dropTable('totem_device_sessions');
  },
};
