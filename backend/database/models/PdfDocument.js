import { DataTypes, Model } from 'sequelize'
import { sequelize } from '../../src/config/db.js'

class PdfDocument extends Model {}

PdfDocument.init(
  {
    id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      autoIncrement: true,
      primaryKey: true,
    },
    contentId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: 'content_id',
      validate: {
        min: {
          args: [1],
          msg: 'El contentId debe ser un entero positivo',
        },
      },
    },
    fileUrl: {
      type: DataTypes.TEXT,
      allowNull: false,
      field: 'file_url',
    },
    extractionStatus: {
      type: DataTypes.ENUM('processing', 'processed', 'failed'),
      allowNull: false,
      defaultValue: 'processing',
      field: 'extraction_status',
      validate: {
        isIn: {
          args: [['processing', 'processed', 'failed']],
          msg: 'El estado de extraccion del PDF es invalido',
        },
      },
    },
    extractedText: {
      type: DataTypes.TEXT,
      allowNull: true,
      field: 'extracted_text',
    },
    parsedPairsCount: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      field: 'parsed_pairs_count',
      validate: {
        min: {
          args: [0],
          msg: 'El conteo de pares no puede ser negativo',
        },
      },
    },
    extractionError: {
      type: DataTypes.TEXT,
      allowNull: true,
      field: 'extraction_error',
    },
    processedAt: {
      type: DataTypes.DATE,
      allowNull: true,
      field: 'processed_at',
    },
  },
  {
    sequelize,
    modelName: 'PdfDocument',
    tableName: 'pdf_documents',
    timestamps: true,
    paranoid: true,
    underscored: true,
  }
)

export default PdfDocument
