'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const notificationTable = 'notification'
    const targetTable = 'notification_target'

    let notificationDefinition
    try {
      notificationDefinition = await queryInterface.describeTable(notificationTable)
    } catch {
      return
    }

    let targetDefinition
    try {
      targetDefinition = await queryInterface.describeTable(targetTable)
    } catch {
      targetDefinition = null
    }

    if (!targetDefinition) {
      let totemTableName = 'totems'
      try {
        await queryInterface.describeTable('totems')
      } catch {
        totemTableName = 'totem'
      }

      await queryInterface.createTable(targetTable, {
        id: {
          type: Sequelize.INTEGER,
          allowNull: false,
          autoIncrement: true,
          primaryKey: true,
        },
        notification_id: {
          type: Sequelize.INTEGER,
          allowNull: false,
          references: {
            model: notificationTable,
            key: 'id',
          },
          onUpdate: 'CASCADE',
          onDelete: 'CASCADE',
        },
        target_type: {
          type: Sequelize.STRING(20),
          allowNull: false,
          defaultValue: 'all',
        },
        totem_id: {
          type: Sequelize.INTEGER,
          allowNull: true,
          references: {
            model: totemTableName,
            key: 'id',
          },
          onUpdate: 'CASCADE',
          onDelete: 'SET NULL',
        },
        campus_id: {
          type: Sequelize.INTEGER,
          allowNull: true,
          references: {
            model: 'campuses',
            key: 'id',
          },
          onUpdate: 'CASCADE',
          onDelete: 'SET NULL',
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
      })

      targetDefinition = await queryInterface.describeTable(targetTable)
    }

    if (!notificationDefinition.duration_minutes) {
      await queryInterface.addColumn(notificationTable, 'duration_minutes', {
        type: Sequelize.INTEGER,
        allowNull: true,
      })
    }

    if (!notificationDefinition.target_scope) {
      await queryInterface.addColumn(notificationTable, 'target_scope', {
        type: Sequelize.STRING(20),
        allowNull: true,
      })
    }

    if (!notificationDefinition.end_at) {
      await queryInterface.addColumn(notificationTable, 'end_at', {
        type: Sequelize.DATE,
        allowNull: true,
      })
    }

    if (!notificationDefinition.updated_at) {
      await queryInterface.addColumn(notificationTable, 'updated_at', {
        type: Sequelize.DATE,
        allowNull: true,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
      })
    }

    if (!notificationDefinition.status) {
      await queryInterface.addColumn(notificationTable, 'status', {
        type: Sequelize.STRING(20),
        allowNull: true,
      })
    } else {
      await queryInterface.sequelize.query(`
        ALTER TABLE public.notification
        ADD COLUMN IF NOT EXISTS status_tmp VARCHAR(20)
      `)

      await queryInterface.sequelize.query(`
        UPDATE public.notification
        SET status_tmp = CASE
          WHEN lower(trim(status::text)) IN ('1', 'active') THEN 'active'
          WHEN lower(trim(status::text)) IN ('0', 'deleted', 'inactive') THEN 'inactive'
          ELSE 'inactive'
        END
      `)

      await queryInterface.removeColumn(notificationTable, 'status')
      await queryInterface.renameColumn(notificationTable, 'status_tmp', 'status')
    }

    if (notificationDefinition.duration_hours) {
      await queryInterface.sequelize.query(`
        UPDATE public.notification
        SET duration_minutes = COALESCE(
          duration_minutes,
          GREATEST(COALESCE(duration_hours, 1), 1) * 60
        )
      `)
    } else {
      await queryInterface.sequelize.query(`
        UPDATE public.notification
        SET duration_minutes = COALESCE(duration_minutes, 60)
      `)
    }

    if (notificationDefinition.duration_hours) {
      await queryInterface.removeColumn(notificationTable, 'duration_hours')
    }

    if (targetDefinition) {
      if (!targetDefinition.campus_id) {
        await queryInterface.addColumn(targetTable, 'campus_id', {
          type: Sequelize.INTEGER,
          allowNull: true,
          references: {
            model: 'campuses',
            key: 'id',
          },
          onUpdate: 'CASCADE',
          onDelete: 'SET NULL',
        })
      }

      if (!targetDefinition.target_type) {
        await queryInterface.addColumn(targetTable, 'target_type', {
          type: Sequelize.STRING(20),
          allowNull: true,
        })
      }

      if (!targetDefinition.created_at) {
        await queryInterface.addColumn(targetTable, 'created_at', {
          type: Sequelize.DATE,
          allowNull: true,
          defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
        })
      }

      if (!targetDefinition.updated_at) {
        await queryInterface.addColumn(targetTable, 'updated_at', {
          type: Sequelize.DATE,
          allowNull: true,
          defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
        })
      }

      if (targetDefinition.campus) {
        await queryInterface.sequelize.query(`
          INSERT INTO public.campuses (name)
          SELECT DISTINCT
            CASE
              WHEN lower(replace(trim(campus), '_', ' ')) = 'cochabamba' THEN 'Cochabamba'
              WHEN lower(replace(trim(campus), '_', ' ')) = 'la paz' THEN 'La Paz'
              WHEN lower(replace(trim(campus), '_', ' ')) = 'sucre' THEN 'Sucre'
              WHEN lower(replace(trim(campus), '_', ' ')) = 'trinidad' THEN 'Trinidad'
              WHEN lower(replace(trim(campus), '_', ' ')) = 'santa cruz' THEN 'Santa Cruz'
              ELSE INITCAP(trim(replace(campus, '_', ' ')))
            END AS normalized_name
          FROM public.notification_target
          WHERE campus IS NOT NULL
            AND trim(campus) <> ''
          ON CONFLICT (name) DO NOTHING
        `)

        await queryInterface.sequelize.query(`
          UPDATE public.notification_target nt
          SET campus_id = c.id
          FROM public.campuses c
          WHERE nt.campus IS NOT NULL
            AND trim(nt.campus) <> ''
            AND lower(c.name) = lower(
              CASE
                WHEN lower(replace(trim(nt.campus), '_', ' ')) = 'cochabamba' THEN 'Cochabamba'
                WHEN lower(replace(trim(nt.campus), '_', ' ')) = 'la paz' THEN 'La Paz'
                WHEN lower(replace(trim(nt.campus), '_', ' ')) = 'sucre' THEN 'Sucre'
                WHEN lower(replace(trim(nt.campus), '_', ' ')) = 'trinidad' THEN 'Trinidad'
                WHEN lower(replace(trim(nt.campus), '_', ' ')) = 'santa cruz' THEN 'Santa Cruz'
                ELSE INITCAP(trim(replace(nt.campus, '_', ' ')))
              END
            )
            AND nt.campus_id IS NULL
        `)
      }

      await queryInterface.sequelize.query(`
        UPDATE public.notification_target
        SET target_type = CASE
          WHEN totem_id IS NOT NULL THEN 'totem'
          WHEN campus_id IS NOT NULL THEN 'campus'
          ELSE 'all'
        END
        WHERE target_type IS NULL
           OR trim(target_type) = ''
      `)

      await queryInterface.sequelize.query(`
        UPDATE public.notification_target
        SET totem_id = NULL,
            campus_id = NULL
        WHERE target_type = 'all'
      `)

      await queryInterface.sequelize.query(`
        UPDATE public.notification_target
        SET totem_id = NULL
        WHERE target_type = 'campus'
      `)

      await queryInterface.sequelize.query(`
        UPDATE public.notification_target
        SET campus_id = NULL
        WHERE target_type = 'totem'
      `)

      await queryInterface.sequelize.query(`
        UPDATE public.notification_target
        SET created_at = COALESCE(created_at, NOW()),
            updated_at = COALESCE(updated_at, created_at, NOW())
      `)

      if (targetDefinition.campus) {
        await queryInterface.removeColumn(targetTable, 'campus')
      }

      await queryInterface.sequelize.query(`
        DELETE FROM public.notification_target duplicated
        USING public.notification_target preserved
        WHERE duplicated.id > preserved.id
          AND duplicated.notification_id = preserved.notification_id
          AND COALESCE(duplicated.target_type, '') = COALESCE(preserved.target_type, '')
          AND COALESCE(duplicated.totem_id, -1) = COALESCE(preserved.totem_id, -1)
          AND COALESCE(duplicated.campus_id, -1) = COALESCE(preserved.campus_id, -1)
      `)
    }

    if (targetDefinition) {
      await queryInterface.sequelize.query(`
        UPDATE public.notification n
        SET target_scope = CASE
          WHEN EXISTS (
            SELECT 1
            FROM public.notification_target nt
            WHERE nt.notification_id = n.id
              AND (
                nt.target_type = 'totem'
                OR nt.totem_id IS NOT NULL
              )
          ) THEN 'totems'
          WHEN EXISTS (
            SELECT 1
            FROM public.notification_target nt
            WHERE nt.notification_id = n.id
              AND (
                nt.target_type = 'campus'
                OR nt.campus_id IS NOT NULL
              )
          ) THEN 'campus'
          ELSE 'all'
        END
      `)
    } else {
      await queryInterface.sequelize.query(`
        UPDATE public.notification
        SET target_scope = COALESCE(target_scope, 'all')
      `)
    }

    await queryInterface.sequelize.query(`
      UPDATE public.notification
      SET created_at = COALESCE(created_at, NOW()),
          start_at = COALESCE(start_at, created_at, NOW()),
          duration_minutes = GREATEST(COALESCE(duration_minutes, 60), 1),
          status = CASE
            WHEN lower(trim(status)) = 'active' THEN 'active'
            ELSE 'inactive'
          END,
          type = CASE
            WHEN lower(trim(type)) = 'urgent' THEN 'urgent'
            ELSE 'normal'
          END,
          target_scope = CASE
            WHEN lower(trim(target_scope)) = 'campus' THEN 'campus'
            WHEN lower(trim(target_scope)) = 'totems' THEN 'totems'
            ELSE 'all'
          END
    `)

    await queryInterface.sequelize.query(`
      UPDATE public.notification
      SET end_at = start_at + make_interval(mins => duration_minutes)
    `)

    await queryInterface.sequelize.query(`
      UPDATE public.notification
      SET updated_at = COALESCE(updated_at, created_at, NOW())
    `)

    await queryInterface.changeColumn(notificationTable, 'duration_minutes', {
      type: Sequelize.INTEGER,
      allowNull: false,
    })

    await queryInterface.changeColumn(notificationTable, 'status', {
      type: Sequelize.STRING(20),
      allowNull: false,
      defaultValue: 'active',
    })

    await queryInterface.changeColumn(notificationTable, 'type', {
      type: Sequelize.STRING(20),
      allowNull: false,
      defaultValue: 'normal',
    })

    await queryInterface.changeColumn(notificationTable, 'target_scope', {
      type: Sequelize.STRING(20),
      allowNull: false,
      defaultValue: 'all',
    })

    await queryInterface.changeColumn(notificationTable, 'start_at', {
      type: Sequelize.DATE,
      allowNull: false,
      defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
    })

    await queryInterface.changeColumn(notificationTable, 'end_at', {
      type: Sequelize.DATE,
      allowNull: false,
    })

    await queryInterface.changeColumn(notificationTable, 'updated_at', {
      type: Sequelize.DATE,
      allowNull: false,
      defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
    })

    await queryInterface.sequelize.query(`
      ALTER TABLE public.notification
      DROP CONSTRAINT IF EXISTS notification_type_chk
    `)
    await queryInterface.sequelize.query(`
      ALTER TABLE public.notification
      ADD CONSTRAINT notification_type_chk
      CHECK (type IN ('normal', 'urgent'))
    `)
    await queryInterface.sequelize.query(`
      ALTER TABLE public.notification
      DROP CONSTRAINT IF EXISTS notification_status_chk
    `)
    await queryInterface.sequelize.query(`
      ALTER TABLE public.notification
      ADD CONSTRAINT notification_status_chk
      CHECK (status IN ('active', 'inactive'))
    `)
    await queryInterface.sequelize.query(`
      ALTER TABLE public.notification
      DROP CONSTRAINT IF EXISTS notification_target_scope_chk
    `)
    await queryInterface.sequelize.query(`
      ALTER TABLE public.notification
      ADD CONSTRAINT notification_target_scope_chk
      CHECK (target_scope IN ('all', 'campus', 'totems'))
    `)
    await queryInterface.sequelize.query(`
      ALTER TABLE public.notification
      DROP CONSTRAINT IF EXISTS notification_duration_minutes_chk
    `)
    await queryInterface.sequelize.query(`
      ALTER TABLE public.notification
      ADD CONSTRAINT notification_duration_minutes_chk
      CHECK (duration_minutes > 0)
    `)
    await queryInterface.sequelize.query(`
      ALTER TABLE public.notification
      DROP CONSTRAINT IF EXISTS notification_start_end_chk
    `)
    await queryInterface.sequelize.query(`
      ALTER TABLE public.notification
      ADD CONSTRAINT notification_start_end_chk
      CHECK (end_at >= start_at)
    `)

    if (targetDefinition) {
      await queryInterface.changeColumn(targetTable, 'target_type', {
        type: Sequelize.STRING(20),
        allowNull: false,
      })

      await queryInterface.changeColumn(targetTable, 'created_at', {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
      })

      await queryInterface.changeColumn(targetTable, 'updated_at', {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
      })

      await queryInterface.sequelize.query(`
        ALTER TABLE public.notification_target
        DROP CONSTRAINT IF EXISTS notification_target_type_chk
      `)
      await queryInterface.sequelize.query(`
        ALTER TABLE public.notification_target
        ADD CONSTRAINT notification_target_type_chk
        CHECK (target_type IN ('all', 'campus', 'totem'))
      `)
      await queryInterface.sequelize.query(`
        ALTER TABLE public.notification_target
        DROP CONSTRAINT IF EXISTS notification_target_columns_chk
      `)
      await queryInterface.sequelize.query(`
        ALTER TABLE public.notification_target
        ADD CONSTRAINT notification_target_columns_chk
        CHECK (
          (target_type = 'all' AND totem_id IS NULL AND campus_id IS NULL)
          OR
          (target_type = 'campus' AND campus_id IS NOT NULL AND totem_id IS NULL)
          OR
          (target_type = 'totem' AND totem_id IS NOT NULL AND campus_id IS NULL)
        )
      `)
    }

    const notificationIndexes = await queryInterface.showIndex(notificationTable)

    const hasStatusIndex = notificationIndexes.some((index) => index.name === 'notification_status_idx')
    const hasTypeIndex = notificationIndexes.some((index) => index.name === 'notification_type_idx')
    const hasTargetScopeIndex = notificationIndexes.some((index) => index.name === 'notification_target_scope_idx')
    const hasStartAtIndex = notificationIndexes.some((index) => index.name === 'notification_start_at_idx')
    const hasEndAtIndex = notificationIndexes.some((index) => index.name === 'notification_end_at_idx')

    if (!hasStatusIndex) {
      await queryInterface.addIndex(notificationTable, ['status'], {
        name: 'notification_status_idx',
      })
    }

    if (!hasTypeIndex) {
      await queryInterface.addIndex(notificationTable, ['type'], {
        name: 'notification_type_idx',
      })
    }

    if (!hasTargetScopeIndex) {
      await queryInterface.addIndex(notificationTable, ['target_scope'], {
        name: 'notification_target_scope_idx',
      })
    }

    if (!hasStartAtIndex) {
      await queryInterface.addIndex(notificationTable, ['start_at'], {
        name: 'notification_start_at_idx',
      })
    }

    if (!hasEndAtIndex) {
      await queryInterface.addIndex(notificationTable, ['end_at'], {
        name: 'notification_end_at_idx',
      })
    }

    if (targetDefinition) {
      const targetIndexes = await queryInterface.showIndex(targetTable)

      const hasNotificationIdIndex = targetIndexes.some(
        (index) => index.name === 'notification_target_notification_id_idx'
      )
      const hasTargetTypeIndex = targetIndexes.some(
        (index) => index.name === 'notification_target_target_type_idx'
      )
      const hasTotemIdIndex = targetIndexes.some(
        (index) => index.name === 'notification_target_totem_id_idx'
      )
      const hasCampusIdIndex = targetIndexes.some(
        (index) => index.name === 'notification_target_campus_id_idx'
      )

      if (!hasNotificationIdIndex) {
        await queryInterface.addIndex(targetTable, ['notification_id'], {
          name: 'notification_target_notification_id_idx',
        })
      }

      if (!hasTargetTypeIndex) {
        await queryInterface.addIndex(targetTable, ['target_type'], {
          name: 'notification_target_target_type_idx',
        })
      }

      if (!hasTotemIdIndex) {
        await queryInterface.addIndex(targetTable, ['totem_id'], {
          name: 'notification_target_totem_id_idx',
        })
      }

      if (!hasCampusIdIndex) {
        await queryInterface.addIndex(targetTable, ['campus_id'], {
          name: 'notification_target_campus_id_idx',
        })
      }

      await queryInterface.sequelize.query(`
        CREATE UNIQUE INDEX IF NOT EXISTS notification_target_notification_target_unique_idx
        ON public.notification_target (
          notification_id,
          target_type,
          COALESCE(totem_id, -1),
          COALESCE(campus_id, -1)
        )
      `)
    }
  },

  async down() {
    // No-op for safety in shared environments.
  },
}
