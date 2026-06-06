export class AppError extends Error {
    constructor(statusCode, message, code = 'APP_ERROR', details = null) {
        super(message)
        this.name = "AppError"
        this.statusCode = statusCode
        this.code = code
        this.details = details
    }
}

export class RequestValidationError extends AppError {
    constructor(message, details = null) {
        super(422, message, 'VALIDATION_ERROR', details)
    }
}

export class NotFoundError extends AppError {
    constructor(message = 'Recurso no encontrado', details = null) {
        super(404, message, 'NOT_FOUND', details)
    }
}

export class ConflictError extends AppError {
    constructor(message = 'Conflicto de datos', details = null) {
        super(409, message, 'CONFLICT', details)
    }
}

export class UnauthorizedError extends AppError {
    constructor(message = 'No autenticado', details = null) {
        super(401, message, 'UNAUTHORIZED', details)
    }
}

export class ForbiddenError extends AppError {
    constructor(message = 'No tienes permisos para realizar esta acción', details = null) {
        super(403, message, 'FORBIDDEN', details)
    }
}
