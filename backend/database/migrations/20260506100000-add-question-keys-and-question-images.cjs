'use strict'

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const chunkTable = 'pdf_chunks'
    const imageTable = 'pdf_question_images'

    const chunkDefinition = await queryInterface.describeTable(chunkTable)

    if (!chunkDefinition.question_key) {
      await queryInterface.addColumn(chunkTable, 'question_key', {
        type: Sequelize.STRING(80),
        allowNull: true,
      })
    }

    await queryInterface.sequelize.query(`
      WITH ranked_chunks AS (
        SELECT
          pc.id,
          md5(
            regexp_replace(
              regexp_replace(
                lower(
                  trim(
                    translate(
                      COALESCE(pc.question_text, ''),
                      'áàäâãéèëêíìïîóòöôõúùüûñÁÀÄÂÃÉÈËÊÍÌÏÎÓÒÖÔÕÚÙÜÛÑ',
                      'aaaaaeeeeiiiiooooouuuunAAAAAEEEEIIIIOOOOOUUUUN'
                    )
                  )
                ),
                '[^a-z0-9\\s]+',
                ' ',
                'g'
              ),
              '\\s+',
              ' ',
              'g'
            )
          ) AS base_key,
          ROW_NUMBER() OVER (
            PARTITION BY
              pc.pdf_document_id,
              md5(
                regexp_replace(
                  regexp_replace(
                    lower(
                      trim(
                        translate(
                          COALESCE(pc.question_text, ''),
                          'áàäâãéèëêíìïîóòöôõúùüûñÁÀÄÂÃÉÈËÊÍÌÏÎÓÒÖÔÕÚÙÜÛÑ',
                          'aaaaaeeeeiiiiooooouuuunAAAAAEEEEIIIIOOOOOUUUUN'
                        )
                      )
                    ),
                    '[^a-z0-9\\s]+',
                    ' ',
                    'g'
                  ),
                  '\\s+',
                  ' ',
                  'g'
                )
              )
            ORDER BY pc.chunk_order ASC, pc.id ASC
          ) AS duplicate_rank
        FROM pdf_chunks pc
      )
      UPDATE pdf_chunks pc
      SET question_key = CASE
        WHEN rc.duplicate_rank = 1 THEN rc.base_key
        ELSE rc.base_key || '-' || rc.duplicate_rank::text
      END
      FROM ranked_chunks rc
      WHERE rc.id = pc.id
        AND (pc.question_key IS NULL OR trim(pc.question_key) = '');
    `)

    await queryInterface.sequelize.query(`
      UPDATE pdf_chunks
      SET question_key = md5(id::text || '-' || pdf_document_id::text)
      WHERE question_key IS NULL OR trim(question_key) = '';
    `)

    await queryInterface.changeColumn(chunkTable, 'question_key', {
      type: Sequelize.STRING(80),
      allowNull: false,
    })

    await queryInterface.sequelize.query(`
      DROP INDEX IF EXISTS pdf_chunks_document_chunk_order_unique;
    `)

    await queryInterface.sequelize.query(`
      CREATE INDEX IF NOT EXISTS pdf_chunks_document_chunk_order_idx
      ON pdf_chunks (pdf_document_id, chunk_order);
    `)

    await queryInterface.addIndex(chunkTable, ['pdf_document_id', 'question_key'], {
      name: 'pdf_chunks_document_question_key_unique',
      unique: true,
    })

    await queryInterface.addIndex(chunkTable, ['question_key'], {
      name: 'pdf_chunks_question_key_idx',
    })

    await queryInterface.createTable(imageTable, {
      id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
      },
      pdf_chunk_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'pdf_chunks',
          key: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      file_url: {
        type: Sequelize.TEXT,
        allowNull: false,
      },
      sort_order: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 1,
      },
      status: {
        type: Sequelize.ENUM('active', 'inactive'),
        allowNull: false,
        defaultValue: 'active',
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
    })

    await queryInterface.sequelize.query(`
      ALTER TABLE pdf_question_images
      ADD CONSTRAINT pdf_question_images_sort_order_non_negative_check
      CHECK (sort_order >= 0);
    `)

    await queryInterface.addIndex(imageTable, ['pdf_chunk_id'], {
      name: 'pdf_question_images_chunk_id_idx',
    })

    await queryInterface.addIndex(imageTable, ['status'], {
      name: 'pdf_question_images_status_idx',
    })

    await queryInterface.addIndex(imageTable, ['deleted_at'], {
      name: 'pdf_question_images_deleted_at_idx',
    })

    await queryInterface.addIndex(imageTable, ['pdf_chunk_id', 'status', 'deleted_at'], {
      name: 'pdf_question_images_chunk_active_idx',
    })
  },

  async down(queryInterface) {
    await queryInterface.removeIndex(
      'pdf_question_images',
      'pdf_question_images_chunk_active_idx'
    )
    await queryInterface.removeIndex(
      'pdf_question_images',
      'pdf_question_images_deleted_at_idx'
    )
    await queryInterface.removeIndex('pdf_question_images', 'pdf_question_images_status_idx')
    await queryInterface.removeIndex('pdf_question_images', 'pdf_question_images_chunk_id_idx')

    await queryInterface.sequelize.query(`
      ALTER TABLE pdf_question_images
      DROP CONSTRAINT IF EXISTS pdf_question_images_sort_order_non_negative_check;
    `)

    await queryInterface.dropTable('pdf_question_images')

    await queryInterface.sequelize.query(`
      DROP TYPE IF EXISTS "enum_pdf_question_images_status";
    `)

    await queryInterface.removeIndex('pdf_chunks', 'pdf_chunks_question_key_idx')
    await queryInterface.removeIndex('pdf_chunks', 'pdf_chunks_document_question_key_unique')
    await queryInterface.removeIndex('pdf_chunks', 'pdf_chunks_document_chunk_order_idx')

    await queryInterface.addIndex('pdf_chunks', ['pdf_document_id', 'chunk_order'], {
      name: 'pdf_chunks_document_chunk_order_unique',
      unique: true,
    })

    await queryInterface.removeColumn('pdf_chunks', 'question_key')
  },
}
