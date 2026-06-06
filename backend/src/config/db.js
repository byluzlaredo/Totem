// Configuracion de conexion a PostgreSQL

import 'dotenv/config'
import fs from 'fs'
import path from 'path'
import { Pool } from 'pg'
import { Sequelize } from 'sequelize'

// Lista de variables de entorno obligatorias para poder conectarse a la base de datos
const requiredEnv = ['PGHOST', 'PGUSER', 'PGPASSWORD', 'PGDATABASE']

// Verifica que todas las variables requeridas existan antes de crear la conexion
for (const key of requiredEnv) {
    if (!process.env[key]) {
        throw new Error(`Falta la variable de entorno ${key}`)
    }
}

function toBoolean(value) {
    if (typeof value !== 'string') {
        return false
    }
    return ['1', 'true', 'yes', 'on'].includes(value.toLowerCase())
}

function resolveSslConfig() {
    const sslEnabled = toBoolean(process.env.PGSSL) || process.env.PGSSLMODE === 'require'
    if (!sslEnabled) {
        return undefined
    }

    const rejectUnauthorized = process.env.PGSSL_REJECT_UNAUTHORIZED !== 'false'
    const ssl = { rejectUnauthorized }

    if (process.env.PGSSL_CA_CERT) {
        // Allows storing multiline certs in .env using escaped new lines.
        ssl.ca = process.env.PGSSL_CA_CERT.replace(/\\n/g, '\n')
        return ssl
    }

    if (process.env.PGSSL_CA_CERT_PATH) {
        const certPath = path.resolve(process.cwd(), process.env.PGSSL_CA_CERT_PATH)
        ssl.ca = fs.readFileSync(certPath, 'utf8')
    }

    return ssl
}

export const pool = new Pool({
    host: process.env.PGHOST,
    port: Number(process.env.PGPORT ?? 5432),
    user: process.env.PGUSER,
    password: process.env.PGPASSWORD,
    database: process.env.PGDATABASE,
    ssl: resolveSslConfig(),
    connectionTimeoutMillis: Number(process.env.PG_CONNECTION_TIMEOUT_MS ?? 10000),
    idleTimeoutMillis: 10000,
    max: Number(process.env.PG_POOL_MAX ?? 5)
})

const sequelizeSsl = resolveSslConfig()

export const sequelize = new Sequelize(
    process.env.PGDATABASE,
    process.env.PGUSER,
    process.env.PGPASSWORD,
    {
        host: process.env.PGHOST,
        port: Number(process.env.PGPORT ?? 5432),
        dialect: 'postgres',
        dialectOptions: sequelizeSsl ? { ssl: sequelizeSsl } : {},
        logging: process.env.DB_LOGGING === 'true' ? console.log : false,
        pool: {
            max: Number(process.env.SEQUELIZE_POOL_MAX ?? 5),
            min: 0,
            acquire: 10000,
            idle: 10000,
        }
    }
)
