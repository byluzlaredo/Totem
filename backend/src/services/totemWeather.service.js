const DEFAULT_CACHE_TTL_SECONDS = 10 * 60
const DEFAULT_REQUEST_TIMEOUT_MS = 4500
const OPEN_METEO_ENDPOINT = 'https://api.open-meteo.com/v1/forecast'

const BOLIVIA_CAMPUS_LOCATIONS = [
  {
    keys: ['cochabamba'],
    latitude: -17.3895,
    longitude: -66.1568,
    defaultLabel: 'Cochabamba',
  },
  {
    keys: ['la paz'],
    latitude: -16.4897,
    longitude: -68.1193,
    defaultLabel: 'La Paz',
  },
  {
    keys: ['sucre'],
    latitude: -19.047,
    longitude: -65.2596,
    defaultLabel: 'Sucre',
  },
  {
    keys: ['trinidad'],
    latitude: -14.8333,
    longitude: -64.9,
    defaultLabel: 'Trinidad',
  },
  {
    keys: ['santa cruz'],
    latitude: -17.7833,
    longitude: -63.1821,
    defaultLabel: 'Santa Cruz',
  },
]

function parsePositiveInteger(rawValue, fallbackValue) {
  const parsedValue = Number(rawValue)

  if (!Number.isInteger(parsedValue) || parsedValue <= 0) {
    return fallbackValue
  }

  return parsedValue
}

function normalizeText(value) {
  if (typeof value !== 'string') {
    return ''
  }

  return value.trim()
}

function normalizeLocationKey(value) {
  const normalizedText = normalizeText(value)

  if (!normalizedText) {
    return ''
  }

  return normalizedText
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function roundToSingleDecimal(value) {
  const parsedValue = Number(value)

  if (!Number.isFinite(parsedValue)) {
    return null
  }

  return Math.round(parsedValue * 10) / 10
}

function parseWeatherCode(value) {
  const parsedValue = Number(value)

  if (!Number.isInteger(parsedValue)) {
    return null
  }

  return parsedValue
}

function resolveConditionPayload(weatherCode) {
  if (weatherCode === 0) {
    return { conditionKey: 'clear', conditionLabel: 'Despejado' }
  }

  if (weatherCode === 1 || weatherCode === 2) {
    return { conditionKey: 'partly_cloudy', conditionLabel: 'Parcialmente nublado' }
  }

  if (weatherCode === 3) {
    return { conditionKey: 'cloudy', conditionLabel: 'Nublado' }
  }

  if (weatherCode === 45 || weatherCode === 48) {
    return { conditionKey: 'fog', conditionLabel: 'Niebla' }
  }

  if ([51, 53, 55, 56, 57].includes(weatherCode)) {
    return { conditionKey: 'drizzle', conditionLabel: 'Llovizna' }
  }

  if ([61, 63, 65, 66, 67, 80, 81, 82].includes(weatherCode)) {
    return { conditionKey: 'rain', conditionLabel: 'Lluvia' }
  }

  if ([71, 73, 75, 77, 85, 86].includes(weatherCode)) {
    return { conditionKey: 'snow', conditionLabel: 'Nieve' }
  }

  if ([95, 96, 99].includes(weatherCode)) {
    return { conditionKey: 'thunderstorm', conditionLabel: 'Tormenta' }
  }

  return { conditionKey: 'unknown', conditionLabel: 'Condición variable' }
}

function resolveCampusLocation(totem) {
  const rawCampusName =
    normalizeText(totem?.campus?.name)
    || normalizeText(totem?.campusName)
    || normalizeText(totem?.headquarters)

  if (!rawCampusName) {
    return null
  }

  const normalizedCampusName = normalizeLocationKey(rawCampusName)

  if (!normalizedCampusName) {
    return null
  }

  const exactMatch = BOLIVIA_CAMPUS_LOCATIONS.find((entry) =>
    entry.keys.some((key) => normalizeLocationKey(key) === normalizedCampusName)
  )

  if (exactMatch) {
    return {
      latitude: exactMatch.latitude,
      longitude: exactMatch.longitude,
      label: rawCampusName,
    }
  }

  const partialMatch = BOLIVIA_CAMPUS_LOCATIONS.find((entry) =>
    entry.keys.some((key) => normalizedCampusName.includes(normalizeLocationKey(key)))
  )

  if (!partialMatch) {
    return null
  }

  return {
    latitude: partialMatch.latitude,
    longitude: partialMatch.longitude,
    label: rawCampusName || partialMatch.defaultLabel,
  }
}

function buildCacheKey(location) {
  return `${location.latitude}:${location.longitude}`
}

class TotemWeatherService {
  constructor() {
    this.cacheTtlMs =
      parsePositiveInteger(process.env.TOTEM_WEATHER_CACHE_TTL_SECONDS, DEFAULT_CACHE_TTL_SECONDS)
      * 1000
    this.requestTimeoutMs = parsePositiveInteger(
      process.env.TOTEM_WEATHER_REQUEST_TIMEOUT_MS,
      DEFAULT_REQUEST_TIMEOUT_MS
    )
    this.cacheByLocation = new Map()
  }

  getCacheEntry(cacheKey) {
    return this.cacheByLocation.get(cacheKey) ?? null
  }

  getValidCache(cacheKey, nowMs) {
    const cacheEntry = this.getCacheEntry(cacheKey)

    if (!cacheEntry) {
      return null
    }

    if (cacheEntry.expiresAtMs <= nowMs) {
      return null
    }

    return cacheEntry
  }

  saveCache(cacheKey, weatherData, nowMs) {
    this.cacheByLocation.set(cacheKey, {
      data: weatherData,
      expiresAtMs: nowMs + this.cacheTtlMs,
    })
  }

  async fetchFromOpenMeteo(location) {
    const url = new URL(OPEN_METEO_ENDPOINT)
    url.searchParams.set('latitude', String(location.latitude))
    url.searchParams.set('longitude', String(location.longitude))
    url.searchParams.set(
      'current',
      'temperature_2m,apparent_temperature,weather_code,is_day,wind_speed_10m'
    )
    url.searchParams.set('timezone', 'auto')

    const controller = new AbortController()
    const timeout = setTimeout(() => {
      controller.abort()
    }, this.requestTimeoutMs)

    try {
      const response = await fetch(url.toString(), {
        method: 'GET',
        cache: 'no-store',
        signal: controller.signal,
      })

      if (!response.ok) {
        throw new Error(`weather_provider_http_${response.status}`)
      }

      const payload = await response.json()
      const current = payload?.current

      if (!current || typeof current !== 'object') {
        throw new Error('weather_provider_payload_invalid')
      }

      const weatherCode = parseWeatherCode(current.weather_code)
      const condition = resolveConditionPayload(weatherCode)
      const isDayRaw = Number(current.is_day)
      const isDay = isDayRaw === 1 ? true : isDayRaw === 0 ? false : null

      return {
        provider: 'open-meteo',
        source: 'live',
        locationName: location.label,
        temperatureC: roundToSingleDecimal(current.temperature_2m),
        apparentTemperatureC: roundToSingleDecimal(current.apparent_temperature),
        weatherCode,
        conditionKey: condition.conditionKey,
        conditionLabel: condition.conditionLabel,
        isDay,
        windSpeedKmh: roundToSingleDecimal(current.wind_speed_10m),
        observedAt: typeof current.time === 'string' ? current.time : null,
        fetchedAt: new Date().toISOString(),
      }
    } finally {
      clearTimeout(timeout)
    }
  }

  async getCurrentWeatherForTotem(totem) {
    const location = resolveCampusLocation(totem)

    if (!location) {
      return null
    }

    const nowMs = Date.now()
    const cacheKey = buildCacheKey(location)
    const validCacheEntry = this.getValidCache(cacheKey, nowMs)

    if (validCacheEntry) {
      return {
        ...validCacheEntry.data,
        source: 'cache',
        locationName: location.label,
      }
    }

    try {
      const weatherData = await this.fetchFromOpenMeteo(location)
      this.saveCache(cacheKey, weatherData, nowMs)
      return weatherData
    } catch (error) {
      const staleCacheEntry = this.getCacheEntry(cacheKey)

      if (staleCacheEntry) {
        return {
          ...staleCacheEntry.data,
          source: 'cache',
          locationName: location.label,
        }
      }

      const reason =
        error instanceof Error ? error.message : 'weather_provider_unknown_error'
      console.warn(
        `[WARN] No se pudo obtener el clima para "${location.label}": ${reason}`
      )

      return null
    }
  }
}

export default new TotemWeatherService()
