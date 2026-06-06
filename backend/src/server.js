import 'dotenv/config'
import { createServer } from 'node:http'
import cors from 'cors'
import express from 'express'
import session from 'express-session'
import connectPgSimple from 'connect-pg-simple'
import helmet from 'helmet'
import { pool } from './config/db.js'
import {
  errorHandler,
  notFoundHandler,
} from './middlewares/errorHandler.js'
import { requireAuthenticatedUser, requireRoles } from './middlewares/auth.middleware.js'
import { getUploadsRootDirectory } from './utils/contentFile.storage.js'
import authRoutes from './routes/auth.routes.js'
import contentRoutes from './routes/content.routes.js'
import totemRoutes from './routes/totem.routes.js'
import emergencyRoutes from './routes/emergency.routes.js'
import totemClientRoutes from './routes/totemClient.routes.js'
import totemContentRoutes from './routes/totemContent.routes.js'
import notificationRoutes from './routes/notification.routes.js'
import campusRoutes from './routes/campus.routes.js'
import dashboardRoutes from './routes/dashboard.routes.js'
import { usersRouter } from './routes/users.routes.js'
import { initializeTotemClientRealtimeServer } from './services/totemClientRealtime.service.js'

const app = express()
const PORT = Number(process.env.PORT ?? 3000)
const isProduction = process.env.NODE_ENV === 'production'
const FRONTEND_URL = process.env.FRONTEND_URL ?? 'http://localhost:5173'
const FRONTEND_ORIGIN = (() => {
  try {
    return new URL(FRONTEND_URL).origin
  } catch {
    return FRONTEND_URL
  }
})()
const PgSession = connectPgSimple(session)
const SESSION_COOKIE_NAME = process.env.SESSION_COOKIE_NAME?.trim() || 'totem.sid'
const SESSION_MAX_AGE_MS = Number(process.env.SESSION_MAX_AGE_MS ?? 1000 * 60 * 60 * 8)

function getSessionSecret() {
  if (process.env.SESSION_SECRET) {
    return process.env.SESSION_SECRET
  }

  if (isProduction) {
    throw new Error('Falta la variable de entorno SESSION_SECRET en producción')
  }

  console.warn('[WARN] SESSION_SECRET no definida. Se usará una clave temporal solo para desarrollo.')
  return 'dev-session-secret-change-me'
}

app.use((req, res, next) => {
  const startedAt = Date.now()

  res.on('finish', () => {
    const durationMs = Date.now() - startedAt
    const level = res.statusCode >= 500 ? 'ERROR' : res.statusCode >= 400 ? 'WARN' : 'INFO'
    console.log(`[${level}] ${req.method} ${req.originalUrl} -> ${res.statusCode} (${durationMs}ms)`)
  })

  next()
})

app.set('trust proxy', 1)

app.use(
  cors({
    origin: FRONTEND_ORIGIN,
    credentials: true,
  })
)

app.use(helmet())
app.use(express.json())
app.use(
  session({
    name: SESSION_COOKIE_NAME,
    secret: getSessionSecret(),
    store: new PgSession({
      pool,
      tableName: process.env.SESSION_TABLE_NAME ?? 'user_sessions',
      createTableIfMissing: true,
    }),
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: isProduction,
      sameSite: isProduction ? 'none' : 'lax',
      maxAge: SESSION_MAX_AGE_MS,
    },
  })
)

app.use(
  '/uploads',
  (req, res, next) => {
    res.removeHeader('X-Frame-Options')
    res.setHeader('Content-Security-Policy', `frame-ancestors 'self' ${FRONTEND_ORIGIN}`)
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin')
    next()
  },
  express.static(getUploadsRootDirectory())
)

app.use('/client', (req, res, next) => {
  res.removeHeader('X-Frame-Options')
  res.setHeader('Access-Control-Allow-Origin', FRONTEND_ORIGIN)
  res.setHeader('Access-Control-Allow-Credentials', 'true')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
  res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin')

  if (req.method === 'OPTIONS') {
    res.sendStatus(204)
    return
  }

  next()
})

app.get('/', (req, res) => {
  res.json({
    ok: true,
    message: 'TOTEM Backend activo',
    endpoints: [
      '/api/health',
      '/api/db-test',
      '/api/auth',
      '/api/users',
      '/api/campuses',
      '/api/notifications',
      '/api/dashboard',
      '/api/totems',
      '/api/contents',
      '/api/totem-contents',
      '/api/emergency',
      '/client',
    ],
  })
})

app.get('/api/health', (req, res) => {
  res.json({
    ok: true,
    service: 'TOTEM backend',
    timestamp: new Date().toISOString(),
  })
})

app.get('/api/db-test', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        NOW() AS server_time,
        current_database() AS db_name,
        inet_server_addr()::text AS db_server_addr,
        inet_server_port() AS db_server_port
    `)

    res.json({
      ok: true,
      data: result.rows[0],
    })
  } catch (error) {
    console.error('DB ERROR:', error)
    res.status(500).json({
      ok: false,
      message: 'No se pudo conectar a PostgreSQL',
    })
  }
})

app.use('/api/auth', authRoutes)

// Emergencias - sin autenticación
app.use('/api/emergency', emergencyRoutes)

app.use('/api/users', requireAuthenticatedUser, requireRoles('SuperAdmin'), usersRouter)
app.use(
  '/api/campuses',
  requireAuthenticatedUser,
  requireRoles('Admin', 'SuperAdmin'),
  campusRoutes
)
app.use(
  '/api/notifications',
  requireAuthenticatedUser,
  requireRoles('Admin', 'SuperAdmin'),
  notificationRoutes
)
app.use(
  '/api/dashboard',
  requireAuthenticatedUser,
  requireRoles('Admin', 'SuperAdmin'),
  dashboardRoutes
)
app.use(
  '/api/totems',
  requireAuthenticatedUser,
  requireRoles('Admin', 'SuperAdmin'),
  totemRoutes
)
app.use(
  '/api/contents',
  requireAuthenticatedUser,
  requireRoles('Admin', 'SuperAdmin'),
  contentRoutes
)
app.use(
  '/api/totem-contents',
  requireAuthenticatedUser,
  requireRoles('Admin', 'SuperAdmin'),
  totemContentRoutes
)
app.use('/client', totemClientRoutes)

app.use(notFoundHandler)
app.use(errorHandler)

const httpServer = createServer(app)
initializeTotemClientRealtimeServer(httpServer, FRONTEND_ORIGIN)

httpServer.listen(PORT, '0.0.0.0', () => {
  console.log(`Backend ejecutándose en http://localhost:${PORT}`)
})

export default app
