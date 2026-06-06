'use strict'

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.query(`
      CREATE EXTENSION IF NOT EXISTS unaccent;
    `)

    await queryInterface.sequelize.query(`
      CREATE EXTENSION IF NOT EXISTS pg_trgm;
    `)

    await queryInterface.sequelize.query(`
      CREATE OR REPLACE FUNCTION public.immutable_unaccent(input text)
      RETURNS text
      LANGUAGE sql
      IMMUTABLE
      PARALLEL SAFE
      STRICT
      AS $$
        SELECT public.unaccent('public.unaccent', input);
      $$;
    `)

    await queryInterface.sequelize.query(`
      CREATE INDEX IF NOT EXISTS app_user_name_search_trgm_idx
      ON app_user
      USING gin (lower(public.immutable_unaccent(coalesce(name, ''))) gin_trgm_ops)
      WHERE deleted_at IS NULL;
    `)

    await queryInterface.sequelize.query(`
      CREATE INDEX IF NOT EXISTS app_user_email_search_trgm_idx
      ON app_user
      USING gin (lower(public.immutable_unaccent(coalesce(email, ''))) gin_trgm_ops)
      WHERE deleted_at IS NULL;
    `)

    await queryInterface.sequelize.query(`
      CREATE INDEX IF NOT EXISTS totems_name_search_trgm_idx
      ON totems
      USING gin (lower(public.immutable_unaccent(coalesce(name, ''))) gin_trgm_ops)
      WHERE deleted_at IS NULL;
    `)

    await queryInterface.sequelize.query(`
      CREATE INDEX IF NOT EXISTS totems_code_search_trgm_idx
      ON totems
      USING gin (lower(public.immutable_unaccent(coalesce(code, ''))) gin_trgm_ops)
      WHERE deleted_at IS NULL;
    `)

    await queryInterface.sequelize.query(`
      CREATE INDEX IF NOT EXISTS contents_title_search_trgm_idx
      ON contents
      USING gin (lower(public.immutable_unaccent(coalesce(title, ''))) gin_trgm_ops)
      WHERE deleted_at IS NULL;
    `)

    await queryInterface.sequelize.query(`
      CREATE INDEX IF NOT EXISTS notification_title_search_trgm_idx
      ON notification
      USING gin (lower(public.immutable_unaccent(coalesce(title, ''))) gin_trgm_ops)
      WHERE deleted_at IS NULL;
    `)

    await queryInterface.sequelize.query(`
      CREATE INDEX IF NOT EXISTS notification_target_notification_type_campus_idx
      ON notification_target (notification_id, target_type, campus_id);
    `)

    await queryInterface.sequelize.query(`
      CREATE INDEX IF NOT EXISTS totem_contents_status_not_deleted_idx
      ON totem_contents (status)
      WHERE deleted_at IS NULL;
    `)

    await queryInterface.sequelize.query(`
      CREATE INDEX IF NOT EXISTS totem_contents_priority_sort_created_not_deleted_idx
      ON totem_contents (priority, sort_order, created_at)
      WHERE deleted_at IS NULL;
    `)
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query(`
      DROP INDEX IF EXISTS totem_contents_priority_sort_created_not_deleted_idx;
    `)

    await queryInterface.sequelize.query(`
      DROP INDEX IF EXISTS totem_contents_status_not_deleted_idx;
    `)

    await queryInterface.sequelize.query(`
      DROP INDEX IF EXISTS notification_target_notification_type_campus_idx;
    `)

    await queryInterface.sequelize.query(`
      DROP INDEX IF EXISTS notification_title_search_trgm_idx;
    `)

    await queryInterface.sequelize.query(`
      DROP INDEX IF EXISTS contents_title_search_trgm_idx;
    `)

    await queryInterface.sequelize.query(`
      DROP INDEX IF EXISTS totems_code_search_trgm_idx;
    `)

    await queryInterface.sequelize.query(`
      DROP INDEX IF EXISTS totems_name_search_trgm_idx;
    `)

    await queryInterface.sequelize.query(`
      DROP INDEX IF EXISTS app_user_email_search_trgm_idx;
    `)

    await queryInterface.sequelize.query(`
      DROP INDEX IF EXISTS app_user_name_search_trgm_idx;
    `)

    await queryInterface.sequelize.query(`
      DROP FUNCTION IF EXISTS public.immutable_unaccent(text);
    `)
  },
}
