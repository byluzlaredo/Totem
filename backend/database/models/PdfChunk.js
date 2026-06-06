import { DataTypes, Model } from 'sequelize'
import { sequelize } from '../../src/config/db.js'

class PdfChunk extends Model {}

PdfChunk.init(
  {
    id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      autoIncrement: true,
      primaryKey: true,
    },
    pdfDocumentId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: 'pdf_document_id',
      validate: {
        min: {
          args: [1],
          msg: 'El pdfDocumentId debe ser un entero positivo',
        },
      },
    },
    chunkOrder: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: 'chunk_order',
      validate: {
        min: {
          args: [1],
          msg: 'El chunkOrder debe ser un entero positivo',
        },
      },
    },
    questionText: {
      type: DataTypes.TEXT,
      allowNull: false,
      field: 'question_text',
      validate: {
        notEmpty: {
          msg: 'La pregunta del fragmento no puede estar vacia',
        },
      },
    },
    answerText: {
      type: DataTypes.TEXT,
      allowNull: false,
      field: 'answer_text',
      validate: {
        notEmpty: {
          msg: 'La respuesta del fragmento no puede estar vacia',
        },
      },
    },
    questionKey: {
      type: DataTypes.STRING(80),
      allowNull: false,
      field: 'question_key',
      validate: {
        notEmpty: {
          msg: 'La clave estable de la pregunta no puede estar vacia',
        },
        len: {
          args: [1, 80],
          msg: 'La clave estable de la pregunta es invalida',
        },
      },
    },
  },
  {
    sequelize,
    modelName: 'PdfChunk',
    tableName: 'pdf_chunks',
    timestamps: true,
    underscored: true,
  }
)

export default PdfChunk
