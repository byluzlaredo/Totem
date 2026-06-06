import { Op } from 'sequelize'
import { Content } from '../../database/models/index.js'
import { isContentFileUrlCompatibleWithType } from './contentFile.storage.js'
import storageService from '../services/storage.service.js'

const CONTENT_TYPES_REQUIRING_FILE = ['image', 'video', 'advertisement', 'pdf']
const DEFAULT_UNAVAILABLE_FILE_CHECK_CACHE_TTL_MS = 45_000
const DEFAULT_FILE_AVAILABILITY_CHECK_CONCURRENCY = 8
const MIN_FILE_AVAILABILITY_CHECK_CONCURRENCY = 1
const MAX_FILE_AVAILABILITY_CHECK_CONCURRENCY = 32
const unavailableFilesCacheByScope = new Map()
const unavailableFilesInFlightByScope = new Map()

function resolveInteger(rawValue, fallbackValue, { min = 0, max = Number.POSITIVE_INFINITY } = {}) {
  const parsedValue = Number(rawValue)

  if (!Number.isInteger(parsedValue)) {
    return fallbackValue
  }

  return Math.max(min, Math.min(max, parsedValue))
}

function resolveUnavailableFileCheckCacheTtlMs() {
  return resolveInteger(
    process.env.CONTENT_UNAVAILABLE_FILE_CHECK_CACHE_TTL_MS,
    DEFAULT_UNAVAILABLE_FILE_CHECK_CACHE_TTL_MS,
    {
      min: 0,
      max: 10 * 60 * 1000,
    }
  )
}

function resolveFileAvailabilityCheckConcurrency() {
  return resolveInteger(
    process.env.CONTENT_FILE_AVAILABILITY_CHECK_CONCURRENCY,
    DEFAULT_FILE_AVAILABILITY_CHECK_CONCURRENCY,
    {
      min: MIN_FILE_AVAILABILITY_CHECK_CONCURRENCY,
      max: MAX_FILE_AVAILABILITY_CHECK_CONCURRENCY,
    }
  )
}

function buildScopeCacheKey(scopedCampusId) {
  if (scopedCampusId === null) {
    return 'all'
  }

  return `campus:${Number(scopedCampusId)}`
}

function createEmptySummary() {
  return {
    ids: [],
    count: 0,
  }
}

function cloneSummary(summary) {
  return {
    ids: [...summary.ids],
    count: summary.count,
  }
}

async function runWithConcurrency(items, concurrency, worker) {
  if (!Array.isArray(items) || items.length === 0) {
    return
  }

  const normalizedConcurrency = Math.max(
    1,
    Math.min(resolveFileAvailabilityCheckConcurrency(), concurrency, items.length)
  )
  let nextIndex = 0

  async function consume() {
    while (nextIndex < items.length) {
      const currentIndex = nextIndex
      nextIndex += 1
      await worker(items[currentIndex], currentIndex)
    }
  }

  await Promise.all(
    Array.from({ length: normalizedConcurrency }, () => consume())
  )
}

async function buildUnavailableFilesSummary(scopedCampusId) {
  const rows = await Content.findAll({
    where: {
      status: 'active',
      contentType: {
        [Op.in]: CONTENT_TYPES_REQUIRING_FILE,
      },
      ...(scopedCampusId === null ? {} : { campusId: scopedCampusId }),
    },
    attributes: ['id', 'contentType', 'fileUrl', 'filePath', 'fileProvider'],
    raw: true,
  })

  if (!Array.isArray(rows) || rows.length === 0) {
    return createEmptySummary()
  }

  const unavailableIds = new Set()

  function markAsUnavailable(row) {
    const id = Number(row?.id)

    if (!Number.isInteger(id) || id <= 0) {
      return
    }

    unavailableIds.add(id)
  }

  await runWithConcurrency(
    rows,
    resolveFileAvailabilityCheckConcurrency(),
    async (row) => {
      const contentType = String(row?.contentType ?? '')
      const fileUrl = row?.fileUrl

      if (!isContentFileUrlCompatibleWithType(fileUrl, contentType)) {
        markAsUnavailable(row)
        return
      }

      const isAvailable = await storageService.isFileAvailable({
        fileProvider: row?.fileProvider,
        filePath: row?.filePath,
        fileUrl,
      })

      if (!isAvailable) {
        markAsUnavailable(row)
      }
    }
  )

  const ids = [...unavailableIds]

  return {
    ids,
    count: ids.length,
  }
}

async function getUnavailableFilesSummary(scopedCampusId) {
  const cacheTtlMs = resolveUnavailableFileCheckCacheTtlMs()
  const cacheKey = buildScopeCacheKey(scopedCampusId)
  const nowMs = Date.now()

  if (cacheTtlMs > 0) {
    const cachedEntry = unavailableFilesCacheByScope.get(cacheKey)

    if (cachedEntry && cachedEntry.expiresAt > nowMs) {
      return cloneSummary(cachedEntry.summary)
    }
  }

  const inFlightPromise = unavailableFilesInFlightByScope.get(cacheKey)

  if (inFlightPromise) {
    const summary = await inFlightPromise
    return cloneSummary(summary)
  }

  const summaryPromise = buildUnavailableFilesSummary(scopedCampusId)
    .then((summary) => {
      if (cacheTtlMs > 0) {
        unavailableFilesCacheByScope.set(cacheKey, {
          summary,
          expiresAt: Date.now() + cacheTtlMs,
        })
      } else {
        unavailableFilesCacheByScope.delete(cacheKey)
      }

      return summary
    })
    .finally(() => {
      unavailableFilesInFlightByScope.delete(cacheKey)
    })

  unavailableFilesInFlightByScope.set(cacheKey, summaryPromise)
  const summary = await summaryPromise
  return cloneSummary(summary)
}

export async function listActiveContentsWithUnavailableFileIds(scopedCampusId) {
  const summary = await getUnavailableFilesSummary(scopedCampusId)
  return summary.ids
}

export async function countActiveContentsWithUnavailableFile(scopedCampusId) {
  const summary = await getUnavailableFilesSummary(scopedCampusId)
  return summary.count
}
