import { DataTypes, Model } from "sequelize";
import { sequelize } from "../../src/config/db.js";

class AppUser extends Model { }

AppUser.init(
  {
    id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      autoIncrement: true,
      primaryKey: true,
    },
    name: {
      type: DataTypes.STRING(100),
      allowNull: false,
      validate: {
        notNull: { msg: 'El nombre es obligatorio' },
        notEmpty: { msg: 'El nombre no puede estar vacio' },
        len: {
          args: [3, 100],
          msg: 'El nombre debe tener entre 3 y 100 caracteres',
        },
      },
    },
    email: {
      type: DataTypes.STRING(150),
      allowNull: false,
      validate: {
        notNull: { msg: 'El correo es obligatorio' },
        notEmpty: { msg: 'El correo no puede estar vacio' },
        isEmail: { msg: 'El correo no tiene un formato valido' },
      },
    },
    passwordHash: {
      type: DataTypes.STRING(255),
      allowNull: true,
      field: 'password_hash',
      validate: {
        notEmpty: { msg: 'La contraseña no puede estar vacia' },
      },
    },
    role: {
      type: DataTypes.STRING(20),
      allowNull: false,
      defaultValue: 'Admin',
      validate: {
        isIn: {
          args: [['Admin', 'SuperAdmin']],
          msg: 'El rol solo puede ser Admin o SuperAdmin',
        },
      },
    },
    status: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 2,
      validate: {
        isIn: {
          args: [[0, 1, 2]],
          msg: 'El estado solo puede ser 0, 1 o 2',
        },
      },
    },
    campusId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: 'campus_id',
      validate: {
        notNull: { msg: 'El campus es obligatorio' },
        isInt: { msg: 'El campus debe ser un entero positivo' },
        min: {
          args: [1],
          msg: 'El campus debe ser un entero positivo',
        },
      },
    },
    lastLoginAt: {
      type: DataTypes.DATE,
      allowNull: true,
      field: 'last_login_at',
    },
  },
  {
    sequelize,
    modelName: 'AppUser',
    tableName: 'app_user',
    timestamps: true,
    paranoid: true,
    underscored: true,
    defaultScope: {
      attributes: {
        exclude: ['passwordHash'],
      },
    },
    scopes: {
      withPasswordHash: {
        attributes: {
          include: ['passwordHash'],
        },
      },
    },
  }
);

export default AppUser;
