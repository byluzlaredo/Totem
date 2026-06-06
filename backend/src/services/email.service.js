import nodemailer from 'nodemailer'

const SMTP_HOST = String(process.env.SMTP_HOST ?? 'smtp.gmail.com').trim()
const SMTP_PORT_RAW = Number(process.env.SMTP_PORT ?? 465)
const SMTP_PORT = Number.isInteger(SMTP_PORT_RAW) && SMTP_PORT_RAW > 0
  ? SMTP_PORT_RAW
  : 465
const SMTP_SECURE = String(process.env.SMTP_SECURE ?? (SMTP_PORT === 465 ? 'true' : 'false'))
  .trim()
  .toLowerCase() === 'true'
const SMTP_USER = String(process.env.SMTP_USER ?? '').trim()
const SMTP_PASS = String(process.env.SMTP_PASS ?? '').trim()
const SMTP_FROM = String(process.env.SMTP_FROM ?? SMTP_USER).trim()
const APP_NAME = String(process.env.EMAIL_APP_NAME ?? 'TOTEM').trim() || 'TOTEM'
const EMAIL_LOGO_URL = String(process.env.EMAIL_LOGO_URL ?? '').trim()

function hasSmtpConfiguration() {
  return (
    SMTP_HOST.length > 0 &&
    SMTP_PORT > 0 &&
    SMTP_USER.length > 0 &&
    SMTP_PASS.length > 0 &&
    SMTP_FROM.length > 0
  )
}

function escapeHtml(raw) {
  return String(raw ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

function normalizeLogoUrl(rawUrl) {
  const value = String(rawUrl ?? '').trim()

  if (!value) {
    return ''
  }

  try {
    const parsed = new URL(value)
    const protocol = parsed.protocol.toLowerCase()

    if (protocol === 'http:' || protocol === 'https:') {
      return parsed.toString()
    }

    return ''
  } catch {
    return ''
  }
}

const NORMALIZED_LOGO_URL = normalizeLogoUrl(EMAIL_LOGO_URL)

class EmailService {
  constructor() {
    this.transporter = null
    this.warnedMissingConfiguration = false
    this.warnedInvalidLogoUrl = false
  }

  isConfigured() {
    return hasSmtpConfiguration()
  }

  getTransporter() {
    if (!this.isConfigured()) {
      return null
    }

    if (!this.transporter) {
      this.transporter = nodemailer.createTransport({
        host: SMTP_HOST,
        port: SMTP_PORT,
        secure: SMTP_SECURE,
        auth: {
          user: SMTP_USER,
          pass: SMTP_PASS,
        },
      })
    }

    return this.transporter
  }

  warnIfMissingConfiguration() {
    if (this.warnedMissingConfiguration || this.isConfigured()) {
      return
    }

    this.warnedMissingConfiguration = true
    console.warn(
      '[WARN] SMTP no configurado. Define SMTP_HOST, SMTP_PORT, SMTP_SECURE, SMTP_USER, SMTP_PASS y SMTP_FROM para habilitar correos.'
    )
  }

  warnIfInvalidLogoUrl() {
    if (this.warnedInvalidLogoUrl || !EMAIL_LOGO_URL || NORMALIZED_LOGO_URL) {
      return
    }

    this.warnedInvalidLogoUrl = true
    console.warn(
      '[WARN] EMAIL_LOGO_URL no es una URL http/https válida. El correo se enviará sin logo.'
    )
  }

  buildLogoMarkup(safeAppName) {
    this.warnIfInvalidLogoUrl()

    if (NORMALIZED_LOGO_URL) {
      const safeLogoUrl = escapeHtml(NORMALIZED_LOGO_URL)

      return `
        <div style="text-align: center; margin-bottom: 16px;">
          <img
            src="${safeLogoUrl}"
            alt="${safeAppName}"
            style="display: inline-block; width: 70px; height: 70px; object-fit: contain; border-radius: 999px; background: #ffffff; padding: 8px;"
          />
        </div>
      `
    }

    return `
      <div style="text-align: center; margin-bottom: 16px;">
        <div style="display: inline-block; border-radius: 999px; background: #ffffff; padding: 10px 16px; font-weight: 700; color: #ca1f3d; letter-spacing: 0.08em;">
          ${safeAppName}
        </div>
      </div>
    `
  }

  async sendUserInvitationEmail({
    to,
    recipientName,
    activationUrl,
    expiresInHours,
  }) {
    const transporter = this.getTransporter()

    if (!transporter) {
      this.warnIfMissingConfiguration()
      return false
    }

    const safeAppName = escapeHtml(APP_NAME)
    const safeRecipientName = escapeHtml(recipientName || 'usuario')
    const safeActivationUrl = escapeHtml(activationUrl)
    const safeExpiresInHours = escapeHtml(expiresInHours)
    const subject = 'Bienvenido a TOTEM'
    const logoMarkup = this.buildLogoMarkup(safeAppName)

    const text = [
      `Hola ${recipientName || 'usuario'},`,
      '',
      `Tu cuenta en ${APP_NAME} fue creada por un administrador.`,
      `Configura tu contraseña para activar tu acceso. Este enlace expira en ${expiresInHours} horas y solo puede usarse una vez.`,
      '',
      `Configurar contraseña: ${activationUrl}`,
      '',
      'Si no reconoces esta invitación, ignora este mensaje.',
      '',
      `${APP_NAME}`,
    ].join('\n')

    const html = `
      <!doctype html>
      <html lang="es">
        <head>
          <meta charset="utf-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1" />
          <title>Invitación de acceso</title>
        </head>
        <body style="margin: 0; padding: 0; background: #f2f4f7; font-family: Arial, Helvetica, sans-serif; color: #1f2937;">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background: #f2f4f7; padding: 24px 12px;">
            <tr>
              <td align="center">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width: 560px; overflow: hidden; border-radius: 16px; background: #ffffff; box-shadow: 0 8px 24px rgba(0, 0, 0, 0.08);">
                  <tr>
                    <td style="height: 6px; background: linear-gradient(90deg, #ca1f3d 0%, #e11d48 100%);"></td>
                  </tr>
                  <tr>
                    <td style="padding: 28px 26px 16px 26px;">
                      ${logoMarkup}
                      <p style="margin: 0; text-align: center; font-size: 12px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; color: #ca1f3d;">
                        Invitación de acceso
                      </p>
                      <h1 style="margin: 8px 0 0 0; text-align: center; font-size: 28px; line-height: 1.2; color: #111827;">
                        Bienvenido a ${safeAppName}
                      </h1>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding: 0 26px 24px 26px; font-size: 15px; line-height: 1.6; color: #4b5563;">
                      <p style="margin: 0 0 12px 0;">Hola ${safeRecipientName},</p>
                      <p style="margin: 0 0 12px 0;">
                        Tu cuenta fue creada en ${safeAppName}. Para activar tu acceso, configura tu contraseña desde el siguiente enlace.
                      </p>
                      <p style="margin: 0 0 20px 0;">
                        Este enlace expira en <strong>${safeExpiresInHours} horas</strong> y solo puede usarse una vez.
                      </p>

                      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-bottom: 18px;">
                        <tr>
                          <td align="center">
                            <a href="${safeActivationUrl}" style="display: inline-block; border-radius: 10px; background: #ca1f3d; color: #ffffff; text-decoration: none; font-size: 15px; font-weight: 700; padding: 12px 20px;">
                              Configurar contraseña
                            </a>
                          </td>
                        </tr>
                      </table>

                      <div style="border-radius: 12px; border: 1px solid #f0d6dc; background: #fff4f6; padding: 12px 14px; margin-bottom: 18px;">
                        <p style="margin: 0; font-size: 13px; line-height: 1.5; color: #7a2f3f;">
                          Si no reconoces esta invitación, ignora este mensaje.
                        </p>
                      </div>

                      <p style="margin: 0 0 6px 0; font-size: 13px; color: #6b7280;">
                        Si el botón no funciona, copia y pega este enlace en tu navegador:
                      </p>
                      <p style="margin: 0; word-break: break-word; font-size: 13px;">
                        <a href="${safeActivationUrl}" style="color: #ca1f3d; text-decoration: underline;">${safeActivationUrl}</a>
                      </p>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
        </body>
      </html>
    `

    await transporter.sendMail({
      from: SMTP_FROM,
      to,
      subject,
      text,
      html,
    })

    return true
  }

  async sendPasswordResetEmail({
    to,
    recipientName,
    resetUrl,
    expiresInMinutes,
  }) {
    const transporter = this.getTransporter()

    if (!transporter) {
      this.warnIfMissingConfiguration()
      return false
    }

    const safeAppName = escapeHtml(APP_NAME)
    const safeRecipientName = escapeHtml(recipientName || 'usuario')
    const safeResetUrl = escapeHtml(resetUrl)
    const safeExpiresInMinutes = escapeHtml(expiresInMinutes)
    const subject = `Restablece tu contraseña - ${APP_NAME}`
    const logoMarkup = this.buildLogoMarkup(safeAppName)

    const text = [
      `Hola ${recipientName || 'usuario'},`,
      '',
      'Recibimos una solicitud para restablecer tu contraseña.',
      `Este enlace expira en ${expiresInMinutes} minutos y solo puede usarse una vez.`,
      '',
      `Restablecer contraseña: ${resetUrl}`,
      '',
      'Si no solicitaste este cambio, ignora este mensaje.',
      '',
      `${APP_NAME}`,
    ].join('\n')

    const html = `
      <!doctype html>
      <html lang="es">
        <head>
          <meta charset="utf-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1" />
          <title>Restablecer contraseña</title>
        </head>
        <body style="margin: 0; padding: 0; background: #f2f4f7; font-family: Arial, Helvetica, sans-serif; color: #1f2937;">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background: #f2f4f7; padding: 24px 12px;">
            <tr>
              <td align="center">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width: 560px; overflow: hidden; border-radius: 16px; background: #ffffff; box-shadow: 0 8px 24px rgba(0, 0, 0, 0.08);">
                  <tr>
                    <td style="height: 6px; background: linear-gradient(90deg, #ca1f3d 0%, #e11d48 100%);"></td>
                  </tr>
                  <tr>
                    <td style="padding: 28px 26px 16px 26px;">
                      ${logoMarkup}
                      <p style="margin: 0; text-align: center; font-size: 12px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; color: #ca1f3d;">
                        Recuperación de acceso
                      </p>
                      <h1 style="margin: 8px 0 0 0; text-align: center; font-size: 28px; line-height: 1.2; color: #111827;">
                        Restablece tu contraseña
                      </h1>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding: 0 26px 24px 26px; font-size: 15px; line-height: 1.6; color: #4b5563;">
                      <p style="margin: 0 0 12px 0;">Hola ${safeRecipientName},</p>
                      <p style="margin: 0 0 12px 0;">
                        Recibimos una solicitud para restablecer tu contraseña de ${safeAppName}.
                      </p>
                      <p style="margin: 0 0 20px 0;">
                        Este enlace expira en <strong>${safeExpiresInMinutes} minutos</strong> y solo puede usarse una vez.
                      </p>

                      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-bottom: 18px;">
                        <tr>
                          <td align="center">
                            <a href="${safeResetUrl}" style="display: inline-block; border-radius: 10px; background: #ca1f3d; color: #ffffff; text-decoration: none; font-size: 15px; font-weight: 700; padding: 12px 20px;">
                              Restablecer contraseña
                            </a>
                          </td>
                        </tr>
                      </table>

                      <div style="border-radius: 12px; border: 1px solid #f0d6dc; background: #fff4f6; padding: 12px 14px; margin-bottom: 18px;">
                        <p style="margin: 0; font-size: 13px; line-height: 1.5; color: #7a2f3f;">
                          Si no solicitaste este cambio, ignora este correo. Tu cuenta seguirá protegida.
                        </p>
                      </div>

                      <p style="margin: 0 0 6px 0; font-size: 13px; color: #6b7280;">
                        Si el botón no funciona, copia y pega este enlace en tu navegador:
                      </p>
                      <p style="margin: 0; word-break: break-word; font-size: 13px;">
                        <a href="${safeResetUrl}" style="color: #ca1f3d; text-decoration: underline;">${safeResetUrl}</a>
                      </p>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
        </body>
      </html>
    `

    await transporter.sendMail({
      from: SMTP_FROM,
      to,
      subject,
      text,
      html,
    })

    return true
  }
}

export default new EmailService()
