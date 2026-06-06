'use strict'

async function addColumnIfMissing(queryInterface, tableName, columnName, definition) {
  const table = await queryInterface.describeTable(tableName)

  if (!table[columnName]) {
    await queryInterface.addColumn(tableName, columnName, definition)
  }
}

async function removeColumnIfExists(queryInterface, tableName, columnName) {
  const table = await queryInterface.describeTable(tableName)

  if (table[columnName]) {
    await queryInterface.removeColumn(tableName, columnName)
  }
}

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await addColumnIfMissing(queryInterface, 'contents', 'file_path', {
      type: Sequelize.STRING(500),
      allowNull: true,
    })

    await addColumnIfMissing(queryInterface, 'contents', 'file_provider', {
      type: Sequelize.STRING(40),
      allowNull: true,
    })

    await addColumnIfMissing(queryInterface, 'contents', 'file_mime_type', {
      type: Sequelize.STRING(200),
      allowNull: true,
    })

    await addColumnIfMissing(queryInterface, 'contents', 'file_size', {
      type: Sequelize.BIGINT,
      allowNull: true,
    })

    await addColumnIfMissing(queryInterface, 'pdf_question_images', 'file_path', {
      type: Sequelize.STRING(500),
      allowNull: true,
    })

    await addColumnIfMissing(queryInterface, 'pdf_question_images', 'file_provider', {
      type: Sequelize.STRING(40),
      allowNull: true,
    })

    await addColumnIfMissing(queryInterface, 'pdf_question_images', 'file_mime_type', {
      type: Sequelize.STRING(200),
      allowNull: true,
    })

    await addColumnIfMissing(queryInterface, 'pdf_question_images', 'file_size', {
      type: Sequelize.BIGINT,
      allowNull: true,
    })

    await queryInterface.sequelize.query(`
      UPDATE contents
      SET
        file_provider = COALESCE(file_provider, 'local'),
        file_path = COALESCE(file_path, regexp_replace(file_url, '^/uploads/', ''))
      WHERE file_url LIKE '/uploads/%';
    `)

    await queryInterface.sequelize.query(`
      UPDATE contents
      SET
        file_provider = COALESCE(file_provider, 'local'),
        file_path = COALESCE(file_path, regexp_replace(file_url, '^https?://[^/]+/uploads/', ''))
      WHERE file_url ~ '^https?://[^/]+/uploads/';
    `)

    await queryInterface.sequelize.query(`
      UPDATE pdf_question_images
      SET
        file_provider = COALESCE(file_provider, 'local'),
        file_path = COALESCE(file_path, regexp_replace(file_url, '^/uploads/', ''))
      WHERE file_url LIKE '/uploads/%';
    `)

    await queryInterface.sequelize.query(`
      UPDATE pdf_question_images
      SET
        file_provider = COALESCE(file_provider, 'local'),
        file_path = COALESCE(file_path, regexp_replace(file_url, '^https?://[^/]+/uploads/', ''))
      WHERE file_url ~ '^https?://[^/]+/uploads/';
    `)
  },

  async down(queryInterface) {
    await removeColumnIfExists(queryInterface, 'pdf_question_images', 'file_size')
    await removeColumnIfExists(queryInterface, 'pdf_question_images', 'file_mime_type')
    await removeColumnIfExists(queryInterface, 'pdf_question_images', 'file_provider')
    await removeColumnIfExists(queryInterface, 'pdf_question_images', 'file_path')

    await removeColumnIfExists(queryInterface, 'contents', 'file_size')
    await removeColumnIfExists(queryInterface, 'contents', 'file_mime_type')
    await removeColumnIfExists(queryInterface, 'contents', 'file_provider')
    await removeColumnIfExists(queryInterface, 'contents', 'file_path')
  },
}

