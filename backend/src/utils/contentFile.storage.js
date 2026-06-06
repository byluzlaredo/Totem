import fs from 'fs/promises'
import path from 'path'
import { RequestValidationError } from '../errors/AppError.js'
import storageService from '../services/storage.service.js'

const UPLOADS_ROOT = storageService.getLocalUploadsRootDirectory()
const CONTENT_UPLOADS_ROOT = path.join(UPLOADS_ROOT, 'contents')
const PDF_QUESTION_IMAGES_ROOT = path.join(UPLOADS_ROOT, 'pdf-question-images')
const TEMP_UPLOADS_DIR = path.join(CONTENT_UPLOADS_ROOT, '_tmp')

const FILE_RULES_BY_CONTENT_TYPE = {
  image: {
    folder: 'images',
    allowedMimeTypes: [
      'image/jpeg',
      'image/png',
      'image/webp',
      'image/gif',
      'image/bmp',
      'image/svg+xml',
    ],
    allowedExtensions: ['.jpg', '.jpeg', '.png', '.webp', '.gif', '.bmp', '.svg'],
    maxBytes: 15 * 1024 * 1024,
    requiresFile: true,
  },
  video: {
    folder: 'videos',
    allowedMimeTypes: [
      'video/mp4',
      'video/webm',
      'video/ogg',
      'video/quicktime',
      'video/x-msvideo',
    ],
    allowedExtensions: ['.mp4', '.webm', '.ogg', '.mov', '.avi'],
    maxBytes: 150 * 1024 * 1024,
    requiresFile: true,
  },
  pdf: {
    folder: 'pdfs',
    allowedMimeTypes: ['application/pdf'],
    allowedExtensions: ['.pdf'],
    maxBytes: 25 * 1024 * 1024,
    requiresFile: true,
  },
  news: {
    folder: 'news',
    allowedMimeTypes: [
      'image/jpeg',
      'image/png',
      'image/webp',
      'image/gif',
    ],
    allowedExtensions: ['.jpg', '.jpeg', '.png', '.webp', '.gif'],
    maxBytes: 25 * 1024 * 1024,
    requiresFile: false,
  },
  advertisement: {
    folder: 'advertisements',
    allowedMimeTypes: [
      'image/jpeg',
      'image/png',
      'image/webp',
      'image/gif',
      'image/bmp',
      'image/svg+xml',
    ],
    allowedExtensions: ['.jpg', '.jpeg', '.png', '.webp', '.gif', '.bmp', '.svg'],
    maxBytes: 15 * 1024 * 1024,
    requiresFile: true,
  },
}

const CONTENT_TYPE_LABELS = {
  image: 'imagen',
  video: 'video',
  news: 'noticia',
  advertisement: 'publicidad',
  pdf: 'PDF',
}

const MIME_TO_EXTENSION = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'image/gif': '.gif',
  'image/bmp': '.bmp',
  'image/svg+xml': '.svg',
  'video/mp4': '.mp4',
  'video/webm': '.webm',
  'video/ogg': '.ogg',
  'video/quicktime': '.mov',
  'video/x-msvideo': '.avi',
  'application/pdf': '.pdf',
}

function normalizeText(value) {
  if (typeof value !== 'string') {
    return ''
  }

  return value.trim()
}

function getFileRulesByContentType(contentType) {
  const rules = FILE_RULES_BY_CONTENT_TYPE[contentType]

  if (!rules) {
    throw new RequestValidationError('El tipo de contenido es inválido para almacenamiento')
  }

  return rules
}

function getContentTypeLabel(contentType) {
  return CONTENT_TYPE_LABELS[contentType] ?? String(contentType)
}

function getSafeExtension(file) {
  const originalExtension = path.extname(file?.originalname ?? '').toLowerCase()

  if (originalExtension.length > 0) {
    return originalExtension
  }

  return MIME_TO_EXTENSION[file?.mimetype] ?? ''
}

function getExtensionFromFileUrl(fileUrl) {
  if (typeof fileUrl !== 'string' || fileUrl.trim().length === 0) {
    return ''
  }

  let pathname = fileUrl.trim()

  try {
    pathname = new URL(fileUrl, 'http://localhost').pathname
  } catch {
    pathname = fileUrl.trim()
  }

  return path.extname(pathname).toLowerCase()
}

function validateUploadedFile(file, contentType) {
  if (!file) {
    throw new RequestValidationError('No se encontró el archivo enviado')
  }

  const { buffer } = file

  if (!buffer || !(buffer instanceof Buffer) || buffer.length === 0) {
    throw new RequestValidationError('El archivo recibido está vacío o no contiene datos válidos')
  }

  const rules = getFileRulesByContentType(contentType)
  const extension = getSafeExtension(file)

  if (file.size > rules.maxBytes) {
    throw new RequestValidationError(
      `El archivo excede el tamaño máximo permitido para ${getContentTypeLabel(contentType)}`
    )
  }

  if (!rules.allowedMimeTypes.includes(file.mimetype)) {
    throw new RequestValidationError(
      `El tipo de archivo no es válido para ${getContentTypeLabel(contentType)}`
    )
  }

  if (!rules.allowedExtensions.includes(extension)) {
    throw new RequestValidationError(
      `La extensión del archivo no es válida para ${getContentTypeLabel(contentType)}`
    )
  }

  return {
    rules,
    extension,
  }
}

function toPosixPath(value) {
  return String(value ?? '').replace(/\\/g, '/')
}

function normalizeRelativePath(relativePath) {
  const normalizedPath = toPosixPath(relativePath)
    .replace(/^\/+/, '')
    .split('/')
    .filter((segment) => segment.length > 0 && segment !== '.')

  if (normalizedPath.length === 0) {
    return null
  }

  if (normalizedPath.some((segment) => segment === '..')) {
    return null
  }

  return normalizedPath.join('/')
}

function normalizePublicFilesBasePath() {
  const configured = normalizeText(process.env.PUBLIC_FILES_URL)

  if (!configured) {
    return '/uploads'
  }

  if (/^https?:\/\//i.test(configured)) {
    try {
      return new URL(configured).pathname.replace(/\/+$/, '') || '/uploads'
    } catch {
      return '/uploads'
    }
  }

  const normalized = configured.replace(/\/+$/, '')
  return normalized.startsWith('/') ? normalized : '/uploads'
}

function resolveRelativePathFromFileUrl(fileUrl) {
  const normalizedFileUrl = normalizeText(fileUrl)

  if (!normalizedFileUrl) {
    return null
  }

  let pathname = normalizedFileUrl

  try {
    pathname = new URL(normalizedFileUrl, 'http://localhost').pathname
  } catch {
    pathname = normalizedFileUrl
  }

  const normalizedPathname = toPosixPath(pathname)
  const publicBasePath = normalizePublicFilesBasePath()

  if (normalizedPathname.startsWith(`${publicBasePath}/`)) {
    return normalizeRelativePath(normalizedPathname.slice(publicBasePath.length + 1))
  }

  if (normalizedPathname.startsWith('/uploads/')) {
    return normalizeRelativePath(normalizedPathname.slice('/uploads/'.length))
  }

  return null
}

function resolveAbsolutePathFromUploadUrl(fileUrl, rootDirectory, expectedPrefix) {
  const relativePath = resolveRelativePathFromFileUrl(fileUrl)

  if (!relativePath || !relativePath.startsWith(expectedPrefix)) {
    return null
  }

  const normalizedRoot = path.resolve(rootDirectory)
  const absolutePath = path.resolve(path.join(normalizedRoot, relativePath.slice(expectedPrefix.length)))
  const relativeToRoot = path.relative(normalizedRoot, absolutePath)

  if (
    relativeToRoot.length === 0
    || relativeToRoot.startsWith('..')
    || path.isAbsolute(relativeToRoot)
  ) {
    return null
  }

  return absolutePath
}

export function isFileRequiredForContentType(contentType) {
  return getFileRulesByContentType(contentType).requiresFile
}

export function isContentFileUrlCompatibleWithType(fileUrl, contentType) {
  if (typeof fileUrl !== 'string' || fileUrl.trim().length === 0) {
    return !isFileRequiredForContentType(contentType)
  }

  const rules = getFileRulesByContentType(contentType)
  const extension = getExtensionFromFileUrl(fileUrl)

  if (!extension) {
    return false
  }

  return rules.allowedExtensions.includes(extension)
}

export async function ensureTempContentUploadsDirectory() {
  await fs.mkdir(TEMP_UPLOADS_DIR, { recursive: true })
  return TEMP_UPLOADS_DIR
}

export function getUploadsRootDirectory() {
  return UPLOADS_ROOT
}

export async function removeFileIfExists(filePath) {
  if (!filePath) return

  try {
    await fs.unlink(filePath)
  } catch {
    // Compatibilidad: ignora faltantes o rutas inaccesibles.
  }
}

export async function persistContentFileFromTemp(file, contentType) {
  const { rules, extension } = validateUploadedFile(file, contentType)
  const fileName = storageService.buildStorageFileName({ extension })

  const stored = await storageService.uploadFile(file, `contents/${rules.folder}`, {
    fileName,
  })

  return {
    fileUrl: stored.fileUrl,
    filePath: stored.filePath,
    fileProvider: stored.fileProvider,
    fileMimeType: stored.fileMimeType,
    fileSize: stored.fileSize,
    absolutePath: stored.absolutePath,
  }
}

export async function persistPdfQuestionImageFromTemp(file) {
  const { extension } = validateUploadedFile(file, 'image')
  const fileName = storageService.buildStorageFileName({ extension })

  const stored = await storageService.uploadFile(file, 'pdf-question-images', {
    fileName,
  })

  return {
    fileUrl: stored.fileUrl,
    filePath: stored.filePath,
    fileProvider: stored.fileProvider,
    fileMimeType: stored.fileMimeType,
    fileSize: stored.fileSize,
    absolutePath: stored.absolutePath,
  }
}

export function resolveAbsolutePathFromFileUrl(fileUrl) {
  return resolveAbsolutePathFromUploadUrl(fileUrl, CONTENT_UPLOADS_ROOT, 'contents/')
}

export function resolveAbsolutePathFromPdfQuestionImageUrl(fileUrl) {
  return resolveAbsolutePathFromUploadUrl(
    fileUrl,
    PDF_QUESTION_IMAGES_ROOT,
    'pdf-question-images/'
  )
}

export async function removeContentFileByUrl(fileUrl) {
  await storageService.deleteFile({
    fileProvider: 'local',
    fileUrl,
  })
}

export async function removePdfQuestionImageFileByUrl(fileUrl) {
  await storageService.deleteFile({
    fileProvider: 'local',
    fileUrl,
  })
}
