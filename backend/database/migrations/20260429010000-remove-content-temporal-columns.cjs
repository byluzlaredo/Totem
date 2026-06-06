'use strict';

async function findIndexNamesByField(queryInterface, tableName, fieldName) {
  const indexes = await queryInterface.showIndex(tableName);

  return indexes
    .filter((index) =>
      index.fields?.some((field) => field.attribute === fieldName)
    )
    .map((index) => index.name)
    .filter(Boolean);
}

async function removeIndexesByField(queryInterface, tableName, fieldName) {
  const indexNames = await findIndexNamesByField(queryInterface, tableName, fieldName);

  for (const indexName of indexNames) {
    await queryInterface.removeIndex(tableName, indexName);
  }
}

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const tableName = 'contents';

    await queryInterface.sequelize.query(`
      ALTER TABLE ${tableName}
      DROP CONSTRAINT IF EXISTS contents_dates_range_check;
    `);

    const tableDefinition = await queryInterface.describeTable(tableName);

    if (tableDefinition.start_at) {
      await removeIndexesByField(queryInterface, tableName, 'start_at');
      await queryInterface.removeColumn(tableName, 'start_at');
    }

    if (tableDefinition.end_at) {
      await removeIndexesByField(queryInterface, tableName, 'end_at');
      await queryInterface.removeColumn(tableName, 'end_at');
    }
  },

  async down(queryInterface, Sequelize) {
    const tableName = 'contents';
    const tableDefinition = await queryInterface.describeTable(tableName);

    if (!tableDefinition.start_at) {
      await queryInterface.addColumn(tableName, 'start_at', {
        type: Sequelize.DATE,
        allowNull: true,
      });
    }

    if (!tableDefinition.end_at) {
      await queryInterface.addColumn(tableName, 'end_at', {
        type: Sequelize.DATE,
        allowNull: true,
      });
    }

    const startAtIndexes = await findIndexNamesByField(queryInterface, tableName, 'start_at');
    if (startAtIndexes.length === 0) {
      await queryInterface.addIndex(tableName, ['start_at']);
    }

    const endAtIndexes = await findIndexNamesByField(queryInterface, tableName, 'end_at');
    if (endAtIndexes.length === 0) {
      await queryInterface.addIndex(tableName, ['end_at']);
    }

    await queryInterface.sequelize.query(`
      ALTER TABLE ${tableName}
      DROP CONSTRAINT IF EXISTS contents_dates_range_check;
    `);

    await queryInterface.sequelize.query(`
      ALTER TABLE ${tableName}
      ADD CONSTRAINT contents_dates_range_check
      CHECK (
        start_at IS NULL OR end_at IS NULL OR start_at <= end_at
      );
    `);
  },
};
