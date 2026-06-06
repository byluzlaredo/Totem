import { DataTypes, Model } from 'sequelize'
import { sequelize } from '../../src/config/db.js'

class PasswordResetToken extends Model {}

PasswordResetToken.init(
  {
    id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      autoIncrement: true,
      primaryKey: true,
    },
    userId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: 'user_id',
      validate: {
        notNull: { msg: 'El usuario es obligatorio' },
        isInt: { msg: 'El usuario debe ser un entero positivo' },
        min: {
          args: [1],
          msg: 'El usuario debe ser un entero positivo',
        },
      },
    },
    tokenHash: {
      type: DataTypes.STRING(128),
      allowNull: false,
      field: 'token_hash',
      validate: {
        notNull: { msg: 'El token es obligatorio' },
        notEmpty: { msg: 'El token es obligatorio' },
      },
    },
    expiresAt: {
      type: DataTypes.DATE,
      allowNull: false,
      field: 'expires_at',
      validate: {
        notNull: { msg: 'La fecha de expiracion es obligatoria' },
        isDate: { msg: 'La fecha de expiracion no es valida' },
      },
    },
    usedAt: {
      type: DataTypes.DATE,
      allowNull: true,
      field: 'used_at',
    },
  },
  {
    sequelize,
    modelName: 'PasswordResetToken',
    tableName: 'password_reset_token',
    timestamps: true,
    underscored: true,
  }
)

export default PasswordResetToken
