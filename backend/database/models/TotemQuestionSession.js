import { DataTypes, Model } from 'sequelize'
import { sequelize } from '../../src/config/db.js'

class TotemQuestionSession extends Model {}

TotemQuestionSession.init(
  {
    id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      autoIncrement: true,
      primaryKey: true,
    },
    totemId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: 'totem_id',
      validate: {
        min: {
          args: [1],
          msg: 'El totemId debe ser un entero positivo',
        },
      },
    },
    status: {
      type: DataTypes.ENUM('active', 'ended', 'expired'),
      allowNull: false,
      defaultValue: 'active',
      validate: {
        isIn: {
          args: [['active', 'ended', 'expired']],
          msg: 'El estado de la sesion es invalido',
        },
      },
    },
    startedAt: {
      type: DataTypes.DATE,
      allowNull: false,
      field: 'started_at',
    },
    lastActivityAt: {
      type: DataTypes.DATE,
      allowNull: false,
      field: 'last_activity_at',
    },
    inactivityTimeoutSeconds: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: 'inactivity_timeout_seconds',
      validate: {
        min: {
          args: [1],
          msg: 'El timeout de inactividad debe ser mayor a cero',
        },
      },
    },
    inactivityDeadlineAt: {
      type: DataTypes.DATE,
      allowNull: false,
      field: 'inactivity_deadline_at',
    },
    endedAt: {
      type: DataTypes.DATE,
      allowNull: true,
      field: 'ended_at',
    },
    endReason: {
      type: DataTypes.ENUM('manual', 'timeout', 'error'),
      allowNull: true,
      field: 'end_reason',
      validate: {
        isIn: {
          args: [['manual', 'timeout', 'error']],
          msg: 'El motivo de cierre es invalido',
        },
      },
    },
  },
  {
    sequelize,
    modelName: 'TotemQuestionSession',
    tableName: 'totem_question_sessions',
    timestamps: true,
    paranoid: true,
    underscored: true,
  }
)

export default TotemQuestionSession
