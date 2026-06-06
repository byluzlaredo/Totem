import crypto from 'node:crypto'

const DEFAULT_TOKEN_SIZE_BYTES = Number(process.env.PASSWORD_RESET_TOKEN_BYTES ?? 32)

function resolveTokenByteSize() {
  if (!Number.isInteger(DEFAULT_TOKEN_SIZE_BYTES) || DEFAULT_TOKEN_SIZE_BYTES < 16) {
    return 32
  }

  if (DEFAULT_TOKEN_SIZE_BYTES > 128) {
    return 128
  }

  return DEFAULT_TOKEN_SIZE_BYTES
}

const TOKEN_BYTE_SIZE = resolveTokenByteSize()

export function createPasswordResetToken() {
  return crypto.randomBytes(TOKEN_BYTE_SIZE).toString('base64url')
}

export function hashPasswordResetToken(token) {
  return crypto.createHash('sha256').update(String(token ?? '')).digest('hex')
}
