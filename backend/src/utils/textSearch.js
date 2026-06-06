import { Op, col, fn, where as sequelizeWhere } from 'sequelize'

const DIACRITIC_MARKS_REGEX = /[\u0300-\u036f]/g
const LIKE_SPECIAL_CHARACTERS_REGEX = /[\\%_]/g

function normalizeWhitespace(value) {
  return value.replace(/\s+/g, ' ').trim()
}

function escapeLikePattern(value) {
  return value.replace(LIKE_SPECIAL_CHARACTERS_REGEX, '\\$&')
}

export function normalizeTextForSearch(value) {
  if (typeof value !== 'string') {
    return ''
  }

  return normalizeWhitespace(
    value
      .normalize('NFD')
      .replace(DIACRITIC_MARKS_REGEX, '')
      .toLowerCase()
  )
}

function buildNormalizedColumnExpression(columnName) {
  return fn(
    'lower',
    fn('immutable_unaccent', fn('coalesce', col(columnName), ''))
  )
}

export function buildAccentInsensitiveContainsCondition(columnName, rawSearchText) {
  const normalizedSearchText = normalizeTextForSearch(rawSearchText)

  if (!normalizedSearchText) {
    return null
  }

  const escapedSearchText = escapeLikePattern(normalizedSearchText)

  return sequelizeWhere(buildNormalizedColumnExpression(columnName), {
    [Op.like]: `%${escapedSearchText}%`,
  })
}
