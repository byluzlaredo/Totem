import { DataTypes, Model } from 'sequelize'
import { sequelize } from '../../src/config/db.js'

class Notification extends Model {}

Notification.init(
  {
    id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      autoIncrement: true,
      primaryKey: true,
    },
    title: {
      type: DataTypes.STRING(200),
      allowNull: false,
      validate: {
        notNull: { msg: 'El titulo es obligatorio' },
        notEmpty: { msg: 'El titulo no puede estar vacio' },
        len: {
          args: [3, 200],
          msg: 'El titulo debe tener entre 3 y 200 caracteres',
        },
      },
    },
    message: {
      type: DataTypes.TEXT,
      allowNull: false,
      validate: {
        notNull: { msg: 'El mensaje es obligatorio' },
        notEmpty: { msg: 'El mensaje no puede estar vacio' },
      },
    },
    createdBy: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: 'created_by',
      validate: {
        min: {
          args: [1],
          msg: 'El campo createdBy debe ser un entero positivo',
        },
      },
    },
    targetScope: {
      type: DataTypes.STRING(20),
      allowNull: false,
      field: 'target_scope',
      defaultValue: 'all',
      validate: {
        isIn: {
          args: [['all', 'campus', 'totems']],
          msg: 'El alcance de la notificacion es invalido',
        },
      },
    },
    durationMinutes: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: 'duration_minutes',
      validate: {
        min: {
          args: [1],
          msg: 'La duracion debe ser mayor o igual a 1 minuto',
        },
      },
    },
    startAt: {
      type: DataTypes.DATE,
      allowNull: false,
      field: 'start_at',
      defaultValue: DataTypes.NOW,
    },
    endAt: {
      type: DataTypes.DATE,
      allowNull: false,
      field: 'end_at',
    },
    deletedAt: {
      type: DataTypes.DATE,
      allowNull: true,
      field: 'deleted_at',
    },
    status: {
      type: DataTypes.STRING(20),
      allowNull: false,
      defaultValue: 'active',
      validate: {
        isIn: {
          args: [['active', 'inactive']],
          msg: 'El status solo puede ser active o inactive',
        },
      },
    },
    type: {
      type: DataTypes.STRING(20),
      allowNull: false,
      defaultValue: 'normal',
      validate: {
        isIn: {
          args: [['normal', 'urgent']],
          msg: 'El tipo de notificacion es invalido',
        },
      },
    },
  },
  {
    sequelize,
    modelName: 'Notification',
    tableName: 'notification',
    timestamps: true,
    underscored: true,
  }
)

export default Notification
