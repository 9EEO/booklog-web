type BookDescriptionSource = {
  title: string;
  contents?: string;
  libraryReference?: {
    contents?: string;
    summary?: string;
  };
};

export const defaultBookDescription = "아직 책 소개 문구가 없습니다.";

const htmlEntities: Record<string, string> = {
  amp: "&",
  apos: "'",
  gt: ">",
  lt: "<",
  nbsp: " ",
  quot: '"',
};

const escapeRegExp = (value: string) =>
  value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const decodeHtmlEntities = (value: string) =>
  value.replace(/&(#\d+|#x[\da-f]+|[a-z]+);/gi, (match, entity: string) => {
    const normalizedEntity = entity.toLowerCase();

    if (normalizedEntity.startsWith("#x")) {
      const codePoint = Number.parseInt(normalizedEntity.slice(2), 16);

      return Number.isFinite(codePoint) ? String.fromCodePoint(codePoint) : match;
    }

    if (normalizedEntity.startsWith("#")) {
      const codePoint = Number.parseInt(normalizedEntity.slice(1), 10);

      return Number.isFinite(codePoint) ? String.fromCodePoint(codePoint) : match;
    }

    return htmlEntities[normalizedEntity] ?? match;
  });

export const sanitizeBookDescription = (
  value: string | undefined,
  title: string,
) => {
  if (!value) return "";

  const trimmedTitle = title.trim();
  const titlePattern = escapeRegExp(trimmedTitle);
  const decodedValue = decodeHtmlEntities(value)
    .replace(/<\/?[a-z][a-z0-9-]*(?:\s[^>]*)?>/gi, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (!decodedValue) return "";

  if (!trimmedTitle) return decodedValue;

  const withoutTitlePrefix = decodedValue
    .replace(new RegExp(`^\\s*${titlePattern}\\s*[:：\\-–—|·ㆍ]\\s*`), "")
    .trim();

  return withoutTitlePrefix || decodedValue;
};

export const getDisplayBookDescription = (
  book: BookDescriptionSource | null | undefined,
) => {
  if (!book) return defaultBookDescription;

  const description =
    sanitizeBookDescription(book.libraryReference?.contents, book.title) ||
    sanitizeBookDescription(book.libraryReference?.summary, book.title) ||
    sanitizeBookDescription(book.contents, book.title);

  return description || defaultBookDescription;
};
