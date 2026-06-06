import { apiRequest } from '../../../services/api'
import type { CampusOption } from '../../../types/campus'

const CAMPUS_OPTIONS_CACHE_TTL_MS = 5 * 60 * 1000
let campusOptionsCache: CampusOption[] | null = null
let campusOptionsCacheExpiresAt = 0
let campusOptionsInFlightPromise: Promise<CampusOption[]> | null = null

function normalizeCampusOptions(campuses: CampusOption[]) {
  return campuses
    .map((campus) => ({
      id: campus.id,
      name: campus.name,
    }))
    .sort((left, right) => left.name.localeCompare(right.name, 'es', { sensitivity: 'base' }))
}

function cloneCampusOptions(options: CampusOption[]) {
  return options.map((option) => ({
    id: option.id,
    name: option.name,
  }))
}

export const campusService = {
  async getCampusOptions(options: { forceRefresh?: boolean } = {}) {
    const nowMs = Date.now()
    const shouldReuseCache =
      !options.forceRefresh
      && Array.isArray(campusOptionsCache)
      && campusOptionsCacheExpiresAt > nowMs

    if (shouldReuseCache && campusOptionsCache) {
      return cloneCampusOptions(campusOptionsCache)
    }

    if (!options.forceRefresh && campusOptionsInFlightPromise) {
      const inFlightOptions = await campusOptionsInFlightPromise
      return cloneCampusOptions(inFlightOptions)
    }

    campusOptionsInFlightPromise = apiRequest<{ ok: boolean; data: CampusOption[] }>('/api/campuses')
      .then((response) => {
        const normalizedOptions = normalizeCampusOptions(response.data)
        campusOptionsCache = normalizedOptions
        campusOptionsCacheExpiresAt = Date.now() + CAMPUS_OPTIONS_CACHE_TTL_MS
        return normalizedOptions
      })
      .finally(() => {
        campusOptionsInFlightPromise = null
      })

    const normalizedOptions = await campusOptionsInFlightPromise
    return cloneCampusOptions(normalizedOptions)
  },
}
