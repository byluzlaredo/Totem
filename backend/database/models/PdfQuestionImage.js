import { DataTypes, Model } from 'sequelize'
import { sequelize } from '../../src/config/db.js'

class PdfQuestionImage extends Model { }

PdfQuestionImage.init(
  {
    id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      autoIncrement: true,
      primaryKey: true,
    },
    pdfChunkId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: 'pdf_chunk_id',
      validate: {
        min: {
          args: [1],
          msg: 'El pdfChunkId debe ser un entero positivo',
        },
      },
    },
    fileUrl: {
      type: DataTypes.TEXT,
      allowNull: false,
      field: 'file_url',
      validate: {
        notEmpty: {
          msg: 'La URL de la imagen no puede estar vacia',
        },
      },
    },
    filePath: {
      type: DataTypes.STRING(500),
      allowNull: true,
      field: 'file_path',
    },
    fileProvider: {
      type: DataTypes.STRING(40),
      allowNull: true,
      field: 'file_provider',
    },
    fileMimeType: {
      type: DataTypes.STRING(200),
      allowNull: true,
      field: 'file_mime_type',
    },
    fileSize: {
      type: DataTypes.BIGINT,
      allowNull: true,
      field: 'file_size',
    },
    sortOrder: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 1,
      field: 'sort_order',
      validate: {
        min: {
          args: [0],
          msg: 'El sortOrder no puede ser negativo',
        },
      },
    },
    status: {
      type: DataTypes.ENUM('active', 'inactive'),
      allowNull: false,
      defaultValue: 'active',
      validate: {
        isIn: {
          args: [['active', 'inactive']],
          msg: 'El estado de la imagen es invalido',
        },
      },
    },
  },
  {
    sequelize,
    modelName: 'PdfQuestionImage',
    tableName: 'pdf_question_images',
    timestamps: true,
    paranoid: true,
    underscored: true,
  }
)

export default PdfQuestionImage

