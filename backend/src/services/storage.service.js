import { access } from 'node:fs/promises'
import crypto from 'crypto'
import fs from 'fs/promises'
import path from 'path'
import { createClient } from '@supabase/supabase-js'

const STORAGE_PROVIDER_LOCAL = 'local'
const STORAGE_PROVIDER_SUPABASE = 'supabase'

const DEFAULT_LOCAL_UPLOAD_DIR = 'uploads'
const DEFAULT_PUBLIC_FILES_URL = '/uploads'
const DEFAULT_SUPABASE_BUCKET = 'totem-contents'

function normalizeText(value) {
  if (typeof value !== 'string') {
    return ''
  }

  return value.trim()
}

function normalizeStorageProvider(value) {
  const normalized = normalizeText(value).toLowerCase()

  if (normalized === STORAGE_PROVIDER_SUPABASE) {
    return STORAGE_PROVIDER_SUPABASE
  }

  return STORAGE_PROVIDER_LOCAL
}

function toPosixPath(value) {
  return String(value ?? '').replace(/\\/g, '/')
}

function normalizeRelativePath(filePath) {
  const normalized = toPosixPath(filePath)
    .replace(/^\/+/, '')
    .split('/')
    .filter((segment) => segment.length > 0 && segment !== '.')

  if (normalized.length === 0) {
    return null
  }

  if (normalized.some((segment) => segment === '..')) {
    return null
  }

  return normalized.join('/')
}

function resolveLocalUploadsRootDirectory() {
  const rawDirectory = normalizeText(process.env.LOCAL_UPLOAD_DIR)
  const targetDirectory = rawDirectory.length > 0 ? rawDirectory : DEFAULT_LOCAL_UPLOAD_DIR

  if (path.isAbsolute(targetDirectory)) {
    return path.resolve(targetDirectory)
  }

  return path.resolve(process.cwd(), targetDirectory)
}

function normalizePublicFilesBaseUrl() {
  const configuredBaseUrl = normalizeText(process.env.PUBLIC_FILES_URL)
  const fallbackBaseUrl = DEFAULT_PUBLIC_FILES_URL
  const rawBaseUrl = configuredBaseUrl.length > 0 ? configuredBaseUrl : fallbackBaseUrl
  return rawBaseUrl.replace(/\/+$/, '')
}

function buildPublicFileUrl(relativePath) {
  const normalizedRelativePath = normalizeRelativePath(relativePath)

  if (!normalizedRelativePath) {
    return null
  }

  const baseUrl = normalizePublicFilesBaseUrl()
  return `${baseUrl}/${normalizedRelativePath}`
}

function resolveLocalAbsolutePathFromRelativePath(relativePath) {
  const normalizedRelativePath = normalizeRelativePath(relativePath)

  if (!normalizedRelativePath) {
    return null
  }

  const uploadsRoot = resolveLocalUploadsRootDirectory()
  const absolutePath = path.resolve(path.join(uploadsRoot, normalizedRelativePath))
  const relativeToRoot = path.relative(uploadsRoot, absolutePath)

  if (
    relativeToRoot.length === 0
    || relativeToRoot.startsWith('..')
    || path.isAbsolute(relativeToRoot)
  ) {
    return null
  }

  return absolutePath
}

function resolveRelativePathFromUploadsUrlPath(pathname) {
  const normalizedPathname = toPosixPath(pathname)
  const uploadsPrefix = '/uploads/'

  if (!normalizedPathname.startsWith(uploadsPrefix)) {
    return null
  }

  return normalizeRelativePath(normalizedPathname.slice(uploadsPrefix.length))
}

function resolveRelativePathFromPublicBaseUrl(fileUrl) {
  const trimmedFileUrl = normalizeText(fileUrl)

  if (!trimmedFileUrl) {
    return null
  }

  const baseUrl = normalizePublicFilesBaseUrl()
  if (!baseUrl) {
    return null
  }

  if (/^https?:\/\//i.test(baseUrl)) {
    if (!trimmedFileUrl.startsWith(`${baseUrl}/`)) {
      return null
    }

    return normalizeRelativePath(trimmedFileUrl.slice(baseUrl.length + 1))
  }

  const basePath = toPosixPath(baseUrl).replace(/\/+$/, '')

  if (!basePath.startsWith('/')) {
    return null
  }

  let pathname = trimmedFileUrl

  try {
    pathname = new URL(trimmedFileUrl, 'http://localhost').pathname
  } catch {
    pathname = trimmedFileUrl
  }

  const normalizedPathname = toPosixPath(pathname)

  if (!normalizedPathname.startsWith(`${basePath}/`)) {
    return null
  }

  return normalizeRelativePath(normalizedPathname.slice(basePath.length + 1))
}

function resolveSupabaseObjectPathFromPublicUrl(fileUrl) {
  const trimmedFileUrl = normalizeText(fileUrl)

  if (!trimmedFileUrl) {
    return null
  }

  const bucket = normalizeText(process.env.SUPABASE_STORAGE_BUCKET) || DEFAULT_SUPABASE_BUCKET

  try {
    const parsedUrl = new URL(trimmedFileUrl)
    const pathname = toPosixPath(parsedUrl.pathname)
    const marker = `/storage/v1/object/public/${bucket}/`

    if (!pathname.startsWith(marker)) {
      return null
    }

    const objectPath = pathname.slice(marker.length)
    return normalizeRelativePath(decodeURIComponent(objectPath))
  } catch {
    return null
  }
}

function splitRelativePath(relativePath) {
  const normalizedPath = normalizeRelativePath(relativePath)

  if (!normalizedPath) {
    return null
  }

  const lastSlashIndex = normalizedPath.lastIndexOf('/')

  if (lastSlashIndex < 0) {
    return {
      directory: '',
      fileName: normalizedPath,
    }
  }

  const directory = normalizedPath.slice(0, lastSlashIndex)
  const fileName = normalizedPath.slice(lastSlashIndex + 1)

  if (!fileName) {
    return null
  }

  return {
    directory,
    fileName,
  }
}

function resolveRelativePathFromReference({ filePath, fileUrl }) {
  const normalizedPath = normalizeRelativePath(filePath)

  if (normalizedPath) {
    return normalizedPath
  }

  const fromPublicBase = resolveRelativePathFromPublicBaseUrl(fileUrl)

  if (fromPublicBase) {
    return fromPublicBase
  }

  let pathname = normalizeText(fileUrl)

  if (!pathname) {
    return null
  }

  try {
    pathname = new URL(pathname, 'http://localhost').pathname
  } catch {
    pathname = normalizeText(fileUrl)
  }

  return resolveRelativePathFromUploadsUrlPath(pathname)
}

function resolveSupabaseConfig() {
  const url = normalizeText(process.env.SUPABASE_URL)
  const serviceRoleKey = normalizeText(process.env.SUPABASE_SERVICE_ROLE_KEY)
  const bucket = normalizeText(process.env.SUPABASE_STORAGE_BUCKET) || DEFAULT_SUPABASE_BUCKET

  if (!url || !serviceRoleKey) {
    throw new Error(
      'Faltan variables de entorno de Supabase: SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY'
    )
  }

  return {
    url,
    serviceRoleKey,
    bucket,
  }
}

let supabaseClientCache = null
let supabaseBucketCache = null

function getSupabaseClientContext() {
  if (supabaseClientCache && supabaseBucketCache) {
    return {
      client: supabaseClientCache,
      bucket: supabaseBucketCache,
    }
  }

  const { url, serviceRoleKey, bucket } = resolveSupabaseConfig()

  supabaseClientCache = createClient(url, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  })
  supabaseBucketCache = bucket

  return {
    client: supabaseClientCache,
    bucket: supabaseBucketCache,
  }
}

async function removeLocalFileByRelativePath(relativePath) {
  const absolutePath = resolveLocalAbsolutePathFromRelativePath(relativePath)

  if (!absolutePath) {
    return
  }

  try {
    await fs.unlink(absolutePath)
  } catch {
    // Compatibilidad: si el archivo ya no existe, no interrumpir el flujo.
  }
}

async function uploadToLocal({ file, folder, fileName }) {
  const safeFolder = normalizeRelativePath(folder)
  const safeFileName = normalizeRelativePath(fileName)

  if (!safeFolder || !safeFileName) {
    throw new Error('No se pudo resolver la ruta local del archivo a guardar')
  }

  const relativePath = normalizeRelativePath(path.posix.join(safeFolder, safeFileName))

  if (!relativePath) {
    throw new Error('No se pudo resolver la ruta local del archivo a guardar')
  }

  const absolutePath = resolveLocalAbsolutePathFromRelativePath(relativePath)

  if (!absolutePath) {
    throw new Error('No se pudo resolver la ruta local del archivo a guardar')
  }

  await fs.mkdir(path.dirname(absolutePath), { recursive: true })
  await fs.writeFile(absolutePath, file.buffer)

  return {
    fileProvider: STORAGE_PROVIDER_LOCAL,
    filePath: relativePath,
    fileUrl: buildPublicFileUrl(relativePath),
    absolutePath,
  }
}

async function uploadToSupabase({ file, folder, fileName }) {
  const safeFolder = normalizeRelativePath(folder)
  const safeFileName = normalizeRelativePath(fileName)

  if (!safeFolder || !safeFileName) {
    throw new Error('No se pudo resolver la ruta de Supabase para el archivo')
  }

  const objectPath = normalizeRelativePath(path.posix.join(safeFolder, safeFileName))

  if (!objectPath) {
    throw new Error('No se pudo resolver la ruta de Supabase para el archivo')
  }

  const { client, bucket } = getSupabaseClientContext()
  const storageApi = client.storage.from(bucket)
  const { error: uploadError } = await storageApi.upload(objectPath, file.buffer, {
    contentType: file.mimetype,
    upsert: false,
  })

  if (uploadError) {
    throw new Error(uploadError.message || 'No se pudo subir el archivo a Supabase Storage')
  }

  const { data: publicUrlData } = storageApi.getPublicUrl(objectPath)
  const publicUrl = normalizeText(publicUrlData?.publicUrl)

  if (!publicUrl) {
    throw new Error('No se pudo obtener la URL pública del archivo en Supabase')
  }

  return {
    fileProvider: STORAGE_PROVIDER_SUPABASE,
    filePath: objectPath,
    fileUrl: publicUrl,
    absolutePath: null,
  }
}

async function removeFromSupabase(objectPath) {
  const normalizedObjectPath = normalizeRelativePath(objectPath)

  if (!normalizedObjectPath) {
    return
  }

  const { client, bucket } = getSupabaseClientContext()
  const { error } = await client.storage.from(bucket).remove([normalizedObjectPath])

  if (error) {
    console.warn('No se pudo eliminar archivo de Supabase Storage', {
      objectPath: normalizedObjectPath,
      error: error.message,
    })
  }
}

async function readFromLocal(reference) {
  const relativePath = resolveRelativePathFromReference(reference)

  if (!relativePath) {
    throw new Error('No se pudo resolver la ruta local del archivo')
  }

  const absolutePath = resolveLocalAbsolutePathFromRelativePath(relativePath)

  if (!absolutePath) {
    throw new Error('No se pudo resolver la ruta local del archivo')
  }

  const buffer = await fs.readFile(absolutePath)

  return {
    buffer,
    filePath: relativePath,
    fileProvider: STORAGE_PROVIDER_LOCAL,
  }
}

async function readFromSupabase(reference) {
  const inferredPath =
    normalizeRelativePath(reference.filePath)
    || resolveSupabaseObjectPathFromPublicUrl(reference.fileUrl)

  if (!inferredPath) {
    throw new Error('No se pudo resolver la ruta del archivo en Supabase Storage')
  }

  const { client, bucket } = getSupabaseClientContext()
  const { data, error } = await client.storage.from(bucket).download(inferredPath)

  if (error) {
    throw new Error(error.message || 'No se pudo descargar el archivo desde Supabase Storage')
  }

  if (!data) {
    throw new Error('Supabase no devolvió el contenido del archivo solicitado')
  }

  const arrayBuffer = await data.arrayBuffer()

  return {
    buffer: Buffer.from(arrayBuffer),
    filePath: inferredPath,
    fileProvider: STORAGE_PROVIDER_SUPABASE,
  }
}

async function isSupabaseObjectAvailable(reference) {
  const inferredPath =
    normalizeRelativePath(reference.filePath)
    || resolveSupabaseObjectPathFromPublicUrl(reference.fileUrl)

  if (!inferredPath) {
    return Boolean(normalizeText(reference.fileUrl))
  }

  const pathParts = splitRelativePath(inferredPath)

  if (!pathParts) {
    return false
  }

  const { directory, fileName } = pathParts
  const { client, bucket } = getSupabaseClientContext()
  const { data, error } = await client.storage.from(bucket).list(directory, {
    limit: 100,
    search: fileName,
  })

  if (error) {
    throw new Error(error.message || 'No se pudo verificar archivo en Supabase Storage')
  }

  if (!Array.isArray(data) || data.length === 0) {
    return false
  }

  return data.some((item) => normalizeText(item?.name) === fileName)
}

class StorageService {
  constructor() {
    this.activeProvider = normalizeStorageProvider(process.env.STORAGE_PROVIDER)
  }

  getProviderName() {
    return this.activeProvider
  }

  getLocalUploadsRootDirectory() {
    return resolveLocalUploadsRootDirectory()
  }

  buildStorageFileName({ extension }) {
    const normalizedExtension = normalizeText(extension).toLowerCase()
    return `${Date.now()}-${crypto.randomUUID()}${normalizedExtension}`
  }

  async uploadFile(file, folder, { fileName } = {}) {
    if (!file?.buffer) {
      throw new Error('No se encontró el buffer del archivo recibido')
    }

    const resolvedFileName =
      normalizeRelativePath(fileName) || this.buildStorageFileName({ extension: '' })

    const storedFile =
      this.activeProvider === STORAGE_PROVIDER_SUPABASE
        ? await uploadToSupabase({ file, folder, fileName: resolvedFileName })
        : await uploadToLocal({ file, folder, fileName: resolvedFileName })

    return {
      ...storedFile,
      fileMimeType: normalizeText(file.mimetype) || null,
      fileSize: Number.isFinite(Number(file.size)) ? Number(file.size) : null,
    }
  }

  async deleteFile({ fileProvider, filePath, fileUrl }) {
    const normalizedProvider = normalizeStorageProvider(fileProvider)

    if (normalizedProvider === STORAGE_PROVIDER_SUPABASE) {
      const resolvedPath = normalizeRelativePath(filePath) || resolveSupabaseObjectPathFromPublicUrl(fileUrl)

      if (!resolvedPath) {
        return
      }

      await removeFromSupabase(resolvedPath)
      return
    }

    const resolvedPath = resolveRelativePathFromReference({ filePath, fileUrl })

    if (!resolvedPath) {
      const inferredSupabasePath = resolveSupabaseObjectPathFromPublicUrl(fileUrl)

      if (inferredSupabasePath) {
        await removeFromSupabase(inferredSupabasePath)
      }

      return
    }

    await removeLocalFileByRelativePath(resolvedPath)
  }

  async readFileBuffer({ fileProvider, filePath, fileUrl }) {
    const normalizedProvider = normalizeStorageProvider(fileProvider)

    if (normalizedProvider === STORAGE_PROVIDER_SUPABASE) {
      return readFromSupabase({ filePath, fileUrl })
    }

    const normalizedPath = normalizeRelativePath(filePath)
    const inferredSupabasePath = !normalizedPath
      ? resolveSupabaseObjectPathFromPublicUrl(fileUrl)
      : null

    if (inferredSupabasePath) {
      return readFromSupabase({ filePath: inferredSupabasePath, fileUrl })
    }

    return readFromLocal({ filePath, fileUrl })
  }

  async isFileAvailable({ fileProvider, filePath, fileUrl }) {
    try {
      const normalizedProvider = normalizeStorageProvider(fileProvider)

      if (normalizedProvider === STORAGE_PROVIDER_SUPABASE) {
        return await isSupabaseObjectAvailable({ filePath, fileUrl })
      }

      const resolvedPath = resolveRelativePathFromReference({ filePath, fileUrl })

      if (!resolvedPath) {
        return Boolean(normalizeText(fileUrl))
      }

      const absolutePath = resolveLocalAbsolutePathFromRelativePath(resolvedPath)

      if (!absolutePath) {
        return false
      }

      await access(absolutePath)
      return true
    } catch {
      return false
    }
  }
}

export default new StorageService()
