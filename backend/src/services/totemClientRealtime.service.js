import { Server as SocketIOServer } from 'socket.io'
import { AppError } from '../errors/AppError.js'
import totemClientSessionService from './totemClientSession.service.js'

let io = null

function buildTotemRoom(deviceToken) {
  return `totem:${deviceToken}`
}

function extractBearerToken(authorizationHeader) {
  if (typeof authorizationHeader !== 'string') {
    return null
  }

  const [scheme, token] = authorizationHeader.trim().split(' ')

  if (scheme?.toLowerCase() !== 'bearer' || !token?.trim()) {
    return null
  }

  return token.trim()
}

function resolveHandshakeAccessToken(socket) {
  const authToken =
    typeof socket.handshake.auth?.accessToken === 'string'
      ? socket.handshake.auth.accessToken.trim()
      : ''

  if (authToken.length > 0) {
    return authToken
  }

  const queryToken =
    typeof socket.handshake.query?.accessToken === 'string'
      ? socket.handshake.query.accessToken.trim()
      : ''

  if (queryToken.length > 0) {
    return queryToken
  }

  return extractBearerToken(socket.handshake.headers?.authorization)
}

export function initializeTotemClientRealtimeServer(httpServer, corsOrigin) {
  io = new SocketIOServer(httpServer, {
    cors: {
      origin: corsOrigin,
      credentials: true,
    },
  })

  io.use(async (socket, next) => {
    try {
      const accessToken = resolveHandshakeAccessToken(socket)

      if (!accessToken) {
        return next(new Error('TOTEM_ACCESS_TOKEN_REQUIRED'))
      }

      const { totem } = await totemClientSessionService.authenticateAccessToken(
        accessToken
      )

      if (!totem?.deviceToken) {
        return next(new Error('TOTEM_ACCESS_REVOKED'))
      }

      socket.data.deviceToken = totem.deviceToken
      socket.data.totemId = totem.id
      socket.join(buildTotemRoom(totem.deviceToken))
      next()
    } catch (error) {
      if (error instanceof AppError) {
        next(new Error(error.code))
        return
      }

      next(error instanceof Error ? error : new Error('SOCKET_AUTH_FAILED'))
    }
  })

  io.on('connection', () => {
    // Conexion autenticada y unida a sala por deviceToken.
  })

  return io
}

export function emitTotemQuestionModeState(deviceToken, payload) {
  if (!io || !deviceToken) {
    return
  }

  io.to(buildTotemRoom(deviceToken)).emit('totem:question-mode', payload)
}

export function emitTotemEmergency(deviceToken, message) {
  if (!io || !deviceToken) {
    return
  }

  io.to(buildTotemRoom(deviceToken)).emit('totem:emergency', { message })
}

export function emitTotemEmergencyBroadcast(payload) {
  if (!io) {
    return
  }

  io.emit('totem:emergency', payload)
}

export function emitTotemNotificationsUpdated(payload) {
  if (!io) {
    return
  }

  io.emit('totem:notifications-updated', payload)
}

export function emitTotemContentsUpdated(payload) {
  if (!io) {
    return
  }

  io.emit('totem:contents-updated', payload)
}

export async function disconnectTotemRealtimeClients(deviceToken) {
  if (!io || !deviceToken) {
    return
  }

  try {
    const sockets = await io.in(buildTotemRoom(deviceToken)).fetchSockets()

    for (const socket of sockets) {
      socket.disconnect(true)
    }
  } catch {
    // Una falla al cerrar sockets no debe romper el flujo del backend.
  }
}
