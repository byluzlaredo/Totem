import { AppError } from "../errors/AppError.js";
import totemClientSessionService from "../services/totemClientSession.service.js";

function extractAccessToken(authorizationHeader) {
    if (!authorizationHeader) {
        throw new AppError(
            401,
            'No se envió token de acceso del dispositivo',
            'TOTEM_ACCESS_TOKEN_REQUIRED'
        )
    }

    const [scheme, token] = authorizationHeader.split(' ')

    if (scheme?.toLowerCase() !== 'bearer' || !token?.trim()) {
        throw new AppError(
            401,
            'El formato de autorización no es válido',
            'TOTEM_ACCESS_TOKEN_INVALID_FORMAT'
        )
    }

    return token.trim()
}

export async function authenticateTotemClient(req, res, next) {
    const accessToken = extractAccessToken(req.headers.authorization)
    const { session, totem } = await totemClientSessionService.authenticateAccessToken(accessToken)

    req.clientTotem = totem
    req.clientTotemSession = session
    req.clientDeviceToken = totem.deviceToken
    req.clientAccessToken = accessToken
    next()
}
