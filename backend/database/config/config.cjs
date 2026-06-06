// Configuracion de base de datos para Sequelize

require('dotenv').config()
const fs = require('fs')
const path = require('path')

function toBoolean(value) {
    if (typeof value !== 'string') {
        return false
    }
    return ['1', 'true', 'yes', 'on'].includes(value.toLowerCase())
}

function getDialectOptions() {
    const sslEnabled = toBoolean(process.env.PGSSL) || process.env.PGSSLMODE === 'require'
    if (!sslEnabled) {
        return {}
    }

    const ssl = {
        rejectUnauthorized: process.env.PGSSL_REJECT_UNAUTHORIZED !== 'false',
    }

    if (process.env.PGSSL_CA_CERT) {
        ssl.ca = process.env.PGSSL_CA_CERT.replace(/\\n/g, '\n')
    } else if (process.env.PGSSL_CA_CERT_PATH) {
        const certPath = path.resolve(process.cwd(), process.env.PGSSL_CA_CERT_PATH)
        ssl.ca = fs.readFileSync(certPath, 'utf8')
    }

    return { ssl }
}

const baseConfig = {
    username: process.env.PGUSER,
    password: process.env.PGPASSWORD,
    database: process.env.PGDATABASE,
    host: process.env.PGHOST,
    port: Number(process.env.PGPORT ?? 5432),
    dialect: 'postgres',
    dialectOptions: getDialectOptions(),
}

module.exports = {
    // Configuracion usada durante el desarrollo de la apliacion
    development: baseConfig,
    // Configuracion usada durante la ejecucion de pruebas automatizadas
    test: baseConfig,
    // Configuracion usada cuando la aplicacion se ejecuta en produccion
    production: baseConfig,
}