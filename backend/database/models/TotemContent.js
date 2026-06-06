import { DataTypes, Model } from "sequelize";
import { sequelize } from "../../src/config/db.js";

class TotemContent extends Model { }

TotemContent.init(
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
        status: {
            type: DataTypes.ENUM('active', 'inactive'),
            allowNull: false,
            defaultValue: 'active',
            validate: {
                isIn: {
                    args: [['active', 'inactive']],
                    msg: 'El estado solo puede ser active o inactive',
                },
            },
        },
        startAt: {
            type: DataTypes.DATE,
            allowNull: true,
            field: 'start_at',
        },
        endAt: {
            type: DataTypes.DATE,
            allowNull: true,
            field: 'end_at',
        },
        priority: {
            type: DataTypes.INTEGER,
            allowNull: false,
            defaultValue: 1,
            validate: {
                min: {
                    args: [1],
                    msg: 'El campo priority debe ser un entero positivo',
                },
            },
        },
        sortOrder: {
            type: DataTypes.INTEGER,
            allowNull: false,
            defaultValue: 1,
            field: 'sort_order',
            validate: {
                min: {
                    args: [1],
                    msg: 'El campo sortOrder debe ser un entero positivo',
                },
            },
        },
    },
    {
        sequelize,
        modelName: 'TotemContent',
        tableName: 'totem_contents',
        timestamps: true,
        paranoid: true,
        underscored: true,
        validate: {
            hasValidDateRange() {
                if (this.startAt && this.endAt && this.startAt > this.endAt) {
                    throw new Error('La fecha startAt no puede ser mayor a endAt')
                }
            },
        },
    }
)

export default TotemContent
