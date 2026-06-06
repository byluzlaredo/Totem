import { DataTypes, Model } from 'sequelize'
import { sequelize } from '../../src/config/db.js'

class TotemDeviceSession extends Model { }

TotemDeviceSession.init(
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
        isInt: {
          msg: 'El id del totem debe ser un entero',
        },
      },
    },
    accessTokenHash: {
      type: DataTypes.STRING(128),
      allowNull: false,
      field: 'access_token_hash',
      validate: {
        notNull: { msg: 'El hash del access token es obligatorio' },
        notEmpty: { msg: 'El hash del access token no puede estar vacio' },
      },
    },
    refreshTokenHash: {
      type: DataTypes.STRING(128),
      allowNull: false,
      field: 'refresh_token_hash',
      validate: {
        notNull: { msg: 'El hash del refresh token es obligatorio' },
        notEmpty: { msg: 'El hash del refresh token no puede estar vacio' },
      },
    },
    accessTokenExpiresAt: {
      type: DataTypes.DATE,
      allowNull: false,
      field: 'access_token_expires_at',
    },
    refreshTokenExpiresAt: {
      type: DataTypes.DATE,
      allowNull: false,
      field: 'refresh_token_expires_at',
    },
    linkedAt: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
      field: 'linked_at',
    },
    lastAccessAt: {
      type: DataTypes.DATE,
      allowNull: true,
      field: 'last_access_at',
    },
    lastRefreshedAt: {
      type: DataTypes.DATE,
      allowNull: true,
      field: 'last_refreshed_at',
    },
    revokedAt: {
      type: DataTypes.DATE,
      allowNull: true,
      field: 'revoked_at',
    },
    revokedReason: {
      type: DataTypes.STRING(120),
      allowNull: true,
      field: 'revoked_reason',
    },
  },
  {
    sequelize,
    modelName: 'TotemDeviceSession',
    tableName: 'totem_device_sessions',
    timestamps: true,
    underscored: true,
  }
)

export default TotemDeviceSession
