import { DataTypes, Model } from 'sequelize'
import { sequelize } from '../../src/config/db.js'

class Campus extends Model { }

Campus.init(
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
      unique: true,
      validate: {
        notNull: { msg: 'El nombre del campus es obligatorio' },
        notEmpty: { msg: 'El nombre del campus no puede estar vacio' },
        len: {
          args: [2, 100],
          msg: 'El nombre del campus debe tener entre 2 y 100 caracteres',
        },
      },
    },
  },
  {
    sequelize,
    modelName: 'Campus',
    tableName: 'campuses',
    timestamps: false,
    underscored: true,
  }
)

export default Campus
