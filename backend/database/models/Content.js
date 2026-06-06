import { DataTypes, Model } from "sequelize";
import { sequelize } from "../../src/config/db.js";

class Content extends Model { }

Content.init(
    {
        id: {
            type: DataTypes.INTEGER,
            allowNull: false,
            autoIncrement: true,
            primaryKey: true,
        },
        title: {
            type: DataTypes.STRING(180),
            allowNull: false,
            validate: {
                notNull: { msg: 'El titulo es obligatorio' },
                notEmpty: { msg: 'El titulo no puede estar vacio' },
                len: {
                    args: [3, 180],
                    msg: 'El titulo debe tener entre 3 y 180 caracteres',
                },
            },
        },
        description: {
            type: DataTypes.TEXT,
            allowNull: true,
        },
        contentType: {
            type: DataTypes.ENUM('image', 'video', 'news', 'advertisement', 'pdf'),
            allowNull: false,
            field: 'content_type',
            validate: {
                isIn: {
                    args: [['image', 'video', 'news', 'advertisement', 'pdf']],
                    msg: 'El tipo de contenido es invalido',
                },
            },
        },
        fileUrl: {
            type: DataTypes.TEXT,
            allowNull: true,
            field: 'file_url',
        },
        filePath: {
            type: DataTypes.STRING(500),
            allowNull: true,
            field: 'file_path',
        },
        fileProvider: {
            type: DataTypes.STRING(40),
            allowNull: true,
            field: 'file_provider',
        },
        fileMimeType: {
            type: DataTypes.STRING(200),
            allowNull: true,
            field: 'file_mime_type',
        },
        fileSize: {
            type: DataTypes.BIGINT,
            allowNull: true,
            field: 'file_size',
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
    },
    {
        sequelize,
        modelName: 'Content',
        tableName: 'contents',
        timestamps: true,
        paranoid: true,
        underscored: true,
    }
)

export default Content
