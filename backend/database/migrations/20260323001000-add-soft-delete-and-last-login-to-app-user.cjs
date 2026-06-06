'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const tableName = 'app_user';

    let tableDefinition;
    try {
      tableDefinition = await queryInterface.describeTable(tableName);
    } catch {
      return;
    }

    if (!tableDefinition.deleted_at) {
      await queryInterface.addColumn(tableName, 'deleted_at', {
        type: Sequelize.DATE,
        allowNull: true,
      });
    }

    if (!tableDefinition.last_login_at) {
      await queryInterface.addColumn(tableName, 'last_login_at', {
        type: Sequelize.DATE,
        allowNull: true,
      });
    }

    await queryInterface.sequelize.query(`
      UPDATE public.app_user
      SET email = lower(trim(email))
      WHERE email IS NOT NULL;
    `);

    await queryInterface.sequelize.query(`
      UPDATE public.app_user
      SET role = CASE
        WHEN lower(trim(coalesce(role, ''))) = 'superadmin' THEN 'SuperAdmin'
        WHEN lower(trim(coalesce(role, ''))) = 'admin' THEN 'Admin'
        WHEN lower(trim(coalesce(role, ''))) = 'cliente' THEN 'Admin'
        WHEN role = 'SuperAdmin' THEN 'SuperAdmin'
        ELSE 'Admin'
      END;
    `);

    await queryInterface.sequelize.query(`
      UPDATE public.app_user
      SET status = CASE
        WHEN status = 1 THEN 1
        ELSE 0
      END;
    `);

    await queryInterface.changeColumn(tableName, 'role', {
      type: Sequelize.STRING(20),
      allowNull: false,
      defaultValue: 'Admin',
    });

    await queryInterface.changeColumn(tableName, 'status', {
      type: Sequelize.INTEGER,
      allowNull: false,
      defaultValue: 1,
    });

    await queryInterface.sequelize.query(`
      ALTER TABLE public.app_user
      DROP CONSTRAINT IF EXISTS app_user_role_check;
    `);

    await queryInterface.sequelize.query(`
      ALTER TABLE public.app_user
      ADD CONSTRAINT app_user_role_check
      CHECK (role IN ('Admin', 'SuperAdmin'));
    `);

    await queryInterface.sequelize.query(`
      ALTER TABLE public.app_user
      DROP CONSTRAINT IF EXISTS app_user_status_check;
    `);

    await queryInterface.sequelize.query(`
      ALTER TABLE public.app_user
      ADD CONSTRAINT app_user_status_check
      CHECK (status IN (0, 1));
    `);

    await queryInterface.sequelize.query(`
      WITH ranked_users AS (
        SELECT
          id,
          lower(email) AS normalized_email,
          ROW_NUMBER() OVER (
            PARTITION BY lower(email)
            ORDER BY id ASC
          ) AS row_number
        FROM public.app_user
        WHERE email IS NOT NULL
          AND trim(email) <> ''
          AND deleted_at IS NULL
      )
      UPDATE public.app_user AS users
      SET deleted_at = NOW(),
          updated_at = NOW()
      FROM ranked_users
      WHERE users.id = ranked_users.id
        AND ranked_users.row_number > 1;
    `);

    await queryInterface.sequelize.query(`
      DROP INDEX IF EXISTS app_user_email_unique;
      DROP INDEX IF EXISTS app_user_email_unique_not_deleted;
    `);

    await queryInterface.sequelize.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS app_user_email_unique_not_deleted
      ON public.app_user (lower(email))
      WHERE deleted_at IS NULL;
    `);

    await queryInterface.sequelize.query(`
      CREATE INDEX IF NOT EXISTS app_user_role_idx
      ON public.app_user (role);
    `);

    await queryInterface.sequelize.query(`
      CREATE INDEX IF NOT EXISTS app_user_status_idx
      ON public.app_user (status);
    `);

    await queryInterface.sequelize.query(`
      CREATE INDEX IF NOT EXISTS app_user_campus_idx
      ON public.app_user (campus);
    `);

    await queryInterface.sequelize.query(`
      CREATE INDEX IF NOT EXISTS app_user_last_login_at_idx
      ON public.app_user (last_login_at);
    `);
  },

  async down(queryInterface) {
    const tableName = 'app_user';

    let tableDefinition;
    try {
      tableDefinition = await queryInterface.describeTable(tableName);
    } catch {
      return;
    }

    await queryInterface.sequelize.query(`
      DROP INDEX IF EXISTS app_user_email_unique_not_deleted;
      DROP INDEX IF EXISTS app_user_last_login_at_idx;
      DROP INDEX IF EXISTS app_user_status_idx;
      DROP INDEX IF EXISTS app_user_campus_idx;
    `);

    await queryInterface.sequelize.query(`
      DROP INDEX IF EXISTS app_user_email_unique;
      CREATE UNIQUE INDEX app_user_email_unique
      ON public.app_user (email);
    `);

    await queryInterface.sequelize.query(`
      ALTER TABLE public.app_user
      DROP CONSTRAINT IF EXISTS app_user_role_check;
    `);

    await queryInterface.sequelize.query(`
      ALTER TABLE public.app_user
      DROP CONSTRAINT IF EXISTS app_user_status_check;
    `);

    if (tableDefinition.last_login_at) {
      await queryInterface.removeColumn(tableName, 'last_login_at');
    }

    if (tableDefinition.deleted_at) {
      await queryInterface.removeColumn(tableName, 'deleted_at');
    }
  },
};
