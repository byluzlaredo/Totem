import { DataTypes, Model } from "sequelize";
import { sequelize } from "../../src/config/db.js";

class Totem extends Model { }

Totem.init(
    {
        id: {
            type: DataTypes.INTEGER,
            allowNull: false,
            autoIncrement: true,
            primaryKey: true,
        },
        code: {
            type: DataTypes.STRING(50),
            allowNull: false,
            validate: {
                notNull: { msg: 'El codigo es obligatorio' },
                notEmpty: { msg: 'El codigo no puede estar vacio' },
                len: {
                    args: [3, 50],
                    msg: 'El codigo debe tener entre 3 y 50 caracteres',
                },
            },
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
        connectionStatus: {
            type: DataTypes.ENUM('online', 'offline'),
            field: 'connection_status',
            allowNull: false,
            defaultValue: 'offline',
            validate: {
                isIn: {
                    args: [['online', 'offline']],
                    msg: 'El estado de conexion debe ser online o offline',
                },
            },
        },
        lastSeenAt: {
            type: DataTypes.DATE,
            allowNull: true,
            field: 'last_seen_at',
        },
        deviceToken: {
            type: DataTypes.STRING(128),
            allowNull: false,
            field: 'device_token',
            validate: {
                notNull: { msg: 'El token del dispositivo es obligatorio' },
                notEmpty: { msg: 'El token del dispositivo no puede estar vacio' },
            },
        },
        linkingCode: {
            type: DataTypes.STRING(24),
            allowNull: true,
            field: 'linking_code',
        },
        linkingCodeGeneratedAt: {
            type: DataTypes.DATE,
            allowNull: true,
            field: 'linking_code_generated_at',
        },
        linkingCodeExpiresAt: {
            type: DataTypes.DATE,
            allowNull: true,
            field: 'linking_code_expires_at',
        },
        linkingCodeUsedAt: {
            type: DataTypes.DATE,
            allowNull: true,
            field: 'linking_code_used_at',
        },
        linkingCodeTtlMinutes: {
            type: DataTypes.INTEGER,
            allowNull: true,
            field: 'linking_code_ttl_minutes',
            validate: {
                isInt: {
                    msg: 'La vigencia del codigo de vinculacion debe ser un entero',
                },
                min: {
                    args: [1],
                    msg: 'La vigencia minima del codigo de vinculacion es de 1 minuto',
                },
                max: {
                    args: [120],
                    msg: 'La vigencia maxima del codigo de vinculacion es de 120 minutos',
                },
            },
        },
        state: {
            type: DataTypes.ENUM('active', 'inactive'),
            allowNull: false,
            defaultValue: 'active',
            validate: {
                isIn: {
                    args: [['active', 'inactive']],
                    msg: 'EL estado debe ser active o inactive'
                },
            },
        },
    },
    {
        sequelize,
        modelName: 'Totem',
        tableName: 'totems',
        timestamps: true,
        paranoid: true,
        underscored: true,
        defaultScope: {
            attributes: {
                exclude: ['deviceToken'],
            },
        },
    }
)

export default Totem
