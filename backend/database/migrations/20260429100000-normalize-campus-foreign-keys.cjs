'use strict'

async function describeTableSafe(queryInterface, tableName) {
  try {
    return await queryInterface.describeTable(tableName)
  } catch {
    return null
  }
}

async function findIndexNamesByField(queryInterface, tableName, fieldName) {
  const indexes = await queryInterface.showIndex(tableName)

  return indexes
    .filter((index) =>
      index.fields?.some((field) => field.attribute === fieldName)
    )
    .map((index) => index.name)
    .filter(Boolean)
}

async function removeIndexesByField(queryInterface, tableName, fieldName) {
  const indexNames = await findIndexNamesByField(queryInterface, tableName, fieldName)

  for (const indexName of indexNames) {
    await queryInterface.removeIndex(tableName, indexName)
  }
}

async function ensureCampusesTable(queryInterface, Sequelize) {
  const tableName = 'campuses'
  const definition = await describeTableSafe(queryInterface, tableName)

  if (!definition) {
    await queryInterface.createTable(tableName, {
      id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
      },
      name: {
        type: Sequelize.STRING(100),
        allowNull: false,
        unique: true,
      },
    })
  }

  await queryInterface.sequelize.query(`
    INSERT INTO public.campuses (name)
    VALUES
      ('Cochabamba'),
      ('La Paz'),
      ('Santa Cruz'),
      ('Sucre'),
      ('Trinidad')
    ON CONFLICT (name) DO NOTHING
  `)
}

async function ensureFallbackCampusId(queryInterface) {
  const [existing] = await queryInterface.sequelize.query(`
    SELECT id
    FROM public.campuses
    WHERE lower(name) = lower('Cochabamba')
    LIMIT 1
  `)

  if (Array.isArray(existing) && existing.length > 0) {
    return Number(existing[0].id)
  }

  const [inserted] = await queryInterface.sequelize.query(`
    INSERT INTO public.campuses (name)
    VALUES ('General')
    ON CONFLICT (name)
    DO UPDATE SET name = EXCLUDED.name
    RETURNING id
  `)

  if (Array.isArray(inserted) && inserted.length > 0) {
    return Number(inserted[0].id)
  }

  const [firstCampus] = await queryInterface.sequelize.query(`
    SELECT id
    FROM public.campuses
    ORDER BY id ASC
    LIMIT 1
  `)

  if (!Array.isArray(firstCampus) || firstCampus.length === 0) {
    throw new Error('No se pudo resolver un campus por defecto para la migracion')
  }

  return Number(firstCampus[0].id)
}

function normalizeCampusExpression(columnName) {
  return `
    CASE
      WHEN ${columnName} IS NULL OR trim(${columnName}) = '' THEN NULL
      WHEN lower(replace(trim(${columnName}), '_', ' ')) = 'cochabamba' THEN 'Cochabamba'
      WHEN lower(replace(trim(${columnName}), '_', ' ')) = 'la paz' THEN 'La Paz'
      WHEN lower(replace(trim(${columnName}), '_', ' ')) = 'sucre' THEN 'Sucre'
      WHEN lower(replace(trim(${columnName}), '_', ' ')) = 'trinidad' THEN 'Trinidad'
      WHEN lower(replace(trim(${columnName}), '_', ' ')) = 'santa cruz' THEN 'Santa Cruz'
      ELSE INITCAP(trim(replace(${columnName}, '_', ' ')))
    END
  `
}

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await ensureCampusesTable(queryInterface, Sequelize)
    const fallbackCampusId = await ensureFallbackCampusId(queryInterface)

    const totemsDefinition = await describeTableSafe(queryInterface, 'totems')
    if (totemsDefinition) {
      if (!totemsDefinition.campus_id) {
        await queryInterface.addColumn('totems', 'campus_id', {
          type: Sequelize.INTEGER,
          allowNull: true,
          references: {
            model: 'campuses',
            key: 'id',
          },
          onUpdate: 'CASCADE',
          onDelete: 'RESTRICT',
        })
      }

      if (totemsDefinition.headquarters) {
        await queryInterface.sequelize.query(`
          INSERT INTO public.campuses (name)
          SELECT DISTINCT normalized_name
          FROM (
            SELECT ${normalizeCampusExpression('headquarters')} AS normalized_name
            FROM public.totems
          ) source
          WHERE normalized_name IS NOT NULL
          ON CONFLICT (name) DO NOTHING
        `)

        await queryInterface.sequelize.query(`
          UPDATE public.totems t
          SET campus_id = c.id
          FROM public.campuses c
          WHERE t.campus_id IS NULL
            AND lower(c.name) = lower(${normalizeCampusExpression('t.headquarters')})
        `)
      }

      await queryInterface.sequelize.query(`
        UPDATE public.totems
        SET campus_id = ${fallbackCampusId}
        WHERE campus_id IS NULL
      `)

      await queryInterface.changeColumn('totems', 'campus_id', {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'campuses',
          key: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'RESTRICT',
      })

      const totemsCampusIndex = await findIndexNamesByField(queryInterface, 'totems', 'campus_id')
      if (totemsCampusIndex.length === 0) {
        await queryInterface.addIndex('totems', ['campus_id'], {
          name: 'totems_campus_id_idx',
        })
      }

      if (totemsDefinition.headquarters) {
        await removeIndexesByField(queryInterface, 'totems', 'headquarters')
        await queryInterface.removeColumn('totems', 'headquarters')
      }
    }

    const usersDefinition = await describeTableSafe(queryInterface, 'app_user')
    if (usersDefinition) {
      if (!usersDefinition.campus_id) {
        await queryInterface.addColumn('app_user', 'campus_id', {
          type: Sequelize.INTEGER,
          allowNull: true,
          references: {
            model: 'campuses',
            key: 'id',
          },
          onUpdate: 'CASCADE',
          onDelete: 'RESTRICT',
        })
      }

      if (usersDefinition.campus) {
        await queryInterface.sequelize.query(`
          INSERT INTO public.campuses (name)
          SELECT DISTINCT normalized_name
          FROM (
            SELECT ${normalizeCampusExpression('campus')} AS normalized_name
            FROM public.app_user
          ) source
          WHERE normalized_name IS NOT NULL
          ON CONFLICT (name) DO NOTHING
        `)

        await queryInterface.sequelize.query(`
          UPDATE public.app_user u
          SET campus_id = c.id
          FROM public.campuses c
          WHERE u.campus_id IS NULL
            AND lower(c.name) = lower(${normalizeCampusExpression('u.campus')})
        `)
      }

      await queryInterface.sequelize.query(`
        UPDATE public.app_user
        SET campus_id = ${fallbackCampusId}
        WHERE campus_id IS NULL
      `)

      await queryInterface.changeColumn('app_user', 'campus_id', {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'campuses',
          key: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'RESTRICT',
      })

      const usersCampusIndex = await findIndexNamesByField(queryInterface, 'app_user', 'campus_id')
      if (usersCampusIndex.length === 0) {
        await queryInterface.addIndex('app_user', ['campus_id'], {
          name: 'app_user_campus_id_idx',
        })
      }

      if (usersDefinition.campus) {
        await removeIndexesByField(queryInterface, 'app_user', 'campus')
        await queryInterface.removeColumn('app_user', 'campus')
      }
    }

    const contentsDefinition = await describeTableSafe(queryInterface, 'contents')
    if (contentsDefinition) {
      if (!contentsDefinition.campus_id) {
        await queryInterface.addColumn('contents', 'campus_id', {
          type: Sequelize.INTEGER,
          allowNull: true,
          references: {
            model: 'campuses',
            key: 'id',
          },
          onUpdate: 'CASCADE',
          onDelete: 'RESTRICT',
        })
      }

      const totemContentsDefinition = await describeTableSafe(queryInterface, 'totem_contents')
      if (totemContentsDefinition) {
        await queryInterface.sequelize.query(`
          WITH content_campus AS (
            SELECT
              tc.content_id,
              MIN(t.campus_id) AS campus_id
            FROM public.totem_contents tc
            INNER JOIN public.totems t ON t.id = tc.totem_id
            WHERE tc.deleted_at IS NULL
              AND t.campus_id IS NOT NULL
            GROUP BY tc.content_id
          )
          UPDATE public.contents c
          SET campus_id = cc.campus_id
          FROM content_campus cc
          WHERE c.id = cc.content_id
            AND c.campus_id IS NULL
        `)
      }

      await queryInterface.sequelize.query(`
        UPDATE public.contents
        SET campus_id = ${fallbackCampusId}
        WHERE campus_id IS NULL
      `)

      await queryInterface.changeColumn('contents', 'campus_id', {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'campuses',
          key: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'RESTRICT',
      })

      const contentsCampusIndex = await findIndexNamesByField(queryInterface, 'contents', 'campus_id')
      if (contentsCampusIndex.length === 0) {
        await queryInterface.addIndex('contents', ['campus_id'], {
          name: 'contents_campus_id_idx',
        })
      }
    }
  },

  async down(queryInterface, Sequelize) {
    const totemsDefinition = await describeTableSafe(queryInterface, 'totems')
    if (totemsDefinition?.campus_id) {
      if (!totemsDefinition.headquarters) {
        await queryInterface.addColumn('totems', 'headquarters', {
          type: Sequelize.STRING(150),
          allowNull: true,
        })
      }

      await queryInterface.sequelize.query(`
        UPDATE public.totems t
        SET headquarters = COALESCE(c.name, 'Sin campus')
        FROM public.campuses c
        WHERE c.id = t.campus_id
      `)

      await queryInterface.changeColumn('totems', 'headquarters', {
        type: Sequelize.STRING(150),
        allowNull: false,
      })

      await removeIndexesByField(queryInterface, 'totems', 'campus_id')
      await queryInterface.removeColumn('totems', 'campus_id')
    }

    const usersDefinition = await describeTableSafe(queryInterface, 'app_user')
    if (usersDefinition?.campus_id) {
      if (!usersDefinition.campus) {
        await queryInterface.addColumn('app_user', 'campus', {
          type: Sequelize.STRING(100),
          allowNull: true,
        })
      }

      await queryInterface.sequelize.query(`
        UPDATE public.app_user u
        SET campus = COALESCE(c.name, 'Sin campus')
        FROM public.campuses c
        WHERE c.id = u.campus_id
      `)

      await removeIndexesByField(queryInterface, 'app_user', 'campus_id')
      await queryInterface.removeColumn('app_user', 'campus_id')
    }

    const contentsDefinition = await describeTableSafe(queryInterface, 'contents')
    if (contentsDefinition?.campus_id) {
      await removeIndexesByField(queryInterface, 'contents', 'campus_id')
      await queryInterface.removeColumn('contents', 'campus_id')
    }
  },
}
