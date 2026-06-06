'use strict'

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.sequelize.query('CREATE EXTENSION IF NOT EXISTS pg_trgm;')

    await queryInterface.createTable('totem_question_sessions', {
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
      status: {
        type: Sequelize.ENUM('active', 'ended', 'expired'),
        allowNull: false,
        defaultValue: 'active',
      },
      started_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
      },
      last_activity_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
      },
      inactivity_timeout_seconds: {
        type: Sequelize.INTEGER,
        allowNull: false,
      },
      inactivity_deadline_at: {
        type: Sequelize.DATE,
        allowNull: false,
      },
      ended_at: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      end_reason: {
        type: Sequelize.ENUM('manual', 'timeout', 'error'),
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
    })

    await queryInterface.addIndex('totem_question_sessions', ['totem_id'])
    await queryInterface.addIndex('totem_question_sessions', ['status'])
    await queryInterface.addIndex('totem_question_sessions', ['last_activity_at'])
    await queryInterface.addIndex('totem_question_sessions', ['inactivity_deadline_at'])

    await queryInterface.addIndex(
      'totem_question_sessions',
      ['totem_id', 'status'],
      {
        name: 'totem_question_sessions_active_by_totem_unique',
        unique: true,
        where: {
          status: 'active',
          deleted_at: null,
        },
      }
    )

    await queryInterface.sequelize.query(`
      ALTER TABLE totem_question_sessions
      ADD CONSTRAINT totem_question_sessions_timeout_positive_check
      CHECK (inactivity_timeout_seconds > 0);
    `)

    await queryInterface.createTable('pdf_documents', {
      id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
      },
      content_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'contents',
          key: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      file_url: {
        type: Sequelize.TEXT,
        allowNull: false,
      },
      extraction_status: {
        type: Sequelize.ENUM('processing', 'processed', 'failed'),
        allowNull: false,
        defaultValue: 'processing',
      },
      extracted_text: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      parsed_pairs_count: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
      extraction_error: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      processed_at: {
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
    })

    await queryInterface.addIndex('pdf_documents', ['content_id'])
    await queryInterface.addIndex('pdf_documents', ['extraction_status'])

    await queryInterface.addIndex('pdf_documents', ['content_id'], {
      name: 'pdf_documents_content_unique_not_deleted',
      unique: true,
      where: {
        deleted_at: null,
      },
    })

    await queryInterface.sequelize.query(`
      ALTER TABLE pdf_documents
      ADD CONSTRAINT pdf_documents_pairs_non_negative_check
      CHECK (parsed_pairs_count >= 0);
    `)

    await queryInterface.createTable('pdf_chunks', {
      id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
      },
      pdf_document_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'pdf_documents',
          key: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      chunk_order: {
        type: Sequelize.INTEGER,
        allowNull: false,
      },
      question_text: {
        type: Sequelize.TEXT,
        allowNull: false,
      },
      answer_text: {
        type: Sequelize.TEXT,
        allowNull: false,
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

    await queryInterface.addIndex('pdf_chunks', ['pdf_document_id'])

    await queryInterface.addIndex('pdf_chunks', ['pdf_document_id', 'chunk_order'], {
      name: 'pdf_chunks_document_chunk_order_unique',
      unique: true,
    })

    await queryInterface.sequelize.query(`
      ALTER TABLE pdf_chunks
      ADD CONSTRAINT pdf_chunks_order_positive_check
      CHECK (chunk_order > 0);
    `)

    await queryInterface.sequelize.query(`
      CREATE INDEX pdf_chunks_fts_idx
      ON pdf_chunks
      USING GIN (
        to_tsvector(
          'spanish',
          COALESCE(question_text, '') || ' ' || COALESCE(answer_text, '')
        )
      );
    `)

    await queryInterface.sequelize.query(`
      CREATE INDEX pdf_chunks_question_trgm_idx
      ON pdf_chunks
      USING GIN (question_text gin_trgm_ops);
    `)

    await queryInterface.sequelize.query(`
      CREATE INDEX pdf_chunks_answer_trgm_idx
      ON pdf_chunks
      USING GIN (answer_text gin_trgm_ops);
    `)
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.sequelize.query(`
      DROP INDEX IF EXISTS pdf_chunks_answer_trgm_idx;
    `)
    await queryInterface.sequelize.query(`
      DROP INDEX IF EXISTS pdf_chunks_question_trgm_idx;
    `)
    await queryInterface.sequelize.query(`
      DROP INDEX IF EXISTS pdf_chunks_fts_idx;
    `)

    await queryInterface.sequelize.query(`
      ALTER TABLE pdf_chunks
      DROP CONSTRAINT IF EXISTS pdf_chunks_order_positive_check;
    `)

    await queryInterface.removeIndex('pdf_chunks', 'pdf_chunks_document_chunk_order_unique')
    await queryInterface.dropTable('pdf_chunks')

    await queryInterface.sequelize.query(`
      ALTER TABLE pdf_documents
      DROP CONSTRAINT IF EXISTS pdf_documents_pairs_non_negative_check;
    `)

    await queryInterface.removeIndex(
      'pdf_documents',
      'pdf_documents_content_unique_not_deleted'
    )
    await queryInterface.dropTable('pdf_documents')

    await queryInterface.sequelize.query(`
      ALTER TABLE totem_question_sessions
      DROP CONSTRAINT IF EXISTS totem_question_sessions_timeout_positive_check;
    `)

    await queryInterface.removeIndex(
      'totem_question_sessions',
      'totem_question_sessions_active_by_totem_unique'
    )
    await queryInterface.dropTable('totem_question_sessions')

    await queryInterface.sequelize.query(`
      DROP TYPE IF EXISTS "enum_pdf_documents_extraction_status";
    `)
    await queryInterface.sequelize.query(`
      DROP TYPE IF EXISTS "enum_totem_question_sessions_end_reason";
    `)
    await queryInterface.sequelize.query(`
      DROP TYPE IF EXISTS "enum_totem_question_sessions_status";
    `)
  },
}
