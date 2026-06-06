const DIACRITIC_MARKS_REGEX = /[\u0300-\u036f]/g;

function normalizeWhitespace(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

export function normalizeTextForSearch(value: string) {
  if (typeof value !== "string") {
    return "";
  }

  return normalizeWhitespace(
    value
      .normalize("NFD")
      .replace(DIACRITIC_MARKS_REGEX, "")
      .toLowerCase(),
  );
}

export function includesNormalizedText(text: string, rawQuery: string) {
  const normalizedQuery = normalizeTextForSearch(rawQuery);

  if (!normalizedQuery) {
    return true;
  }

  return normalizeTextForSearch(text).includes(normalizedQuery);
}

export function normalizeSearchInputForQuery(
  value: string,
  minChars = 3,
) {
  if (typeof value !== "string") {
    return undefined;
  }

  const trimmedValue = value.trim();

  if (trimmedValue.length < minChars) {
    return undefined;
  }

  return trimmedValue;
}
