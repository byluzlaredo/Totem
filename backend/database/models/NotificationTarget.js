import { DataTypes, Model } from 'sequelize'
import { sequelize } from '../../src/config/db.js'

class NotificationTarget extends Model {}

NotificationTarget.init(
    {
        id: {
            type: DataTypes.INTEGER,
            allowNull: false,
            autoIncrement: true,
            primaryKey: true,
        },
        notificationId: {
            type: DataTypes.INTEGER,
            allowNull: false,
            field: 'notification_id',
            validate: {
                min: {
                    args: [1],
                    msg: 'El campo notificationId debe ser un entero positivo',
                },
            },
        },
        targetType: {
            type: DataTypes.STRING(20),
            allowNull: false,
            field: 'target_type',
            validate: {
                isIn: {
                    args: [['all', 'campus', 'totem']],
                    msg: 'El tipo de destino es invalido',
                },
            },
        },
        totemId: {
            type: DataTypes.INTEGER,
            allowNull: true,
            field: 'totem_id',
            validate: {
                min: {
                    args: [1],
                    msg: 'El campo totemId debe ser un entero positivo',
                },
            },
        },
        campusId: {
            type: DataTypes.INTEGER,
            allowNull: true,
            field: 'campus_id',
            validate: {
                min: {
                    args: [1],
                    msg: 'El campo campusId debe ser un entero positivo',
                },
            },
        },
    },
    {
        sequelize,
        modelName: 'NotificationTarget',
        tableName: 'notification_target',
        timestamps: true,
        underscored: true,
    }
)

export default NotificationTarget
