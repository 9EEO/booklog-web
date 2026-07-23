type GoogleBooksImageLinks = Partial<
  Record<
    | "smallThumbnail"
    | "thumbnail"
    | "small"
    | "medium"
    | "large"
    | "extraLarge",
    string
  >
>;

type GoogleBooksVolume = {
  volumeInfo?: {
    imageLinks?: GoogleBooksImageLinks;
  };
};

type GoogleBooksResponse = {
  items?: GoogleBooksVolume[];
};

type ResolveBookCoverInput = {
  isbn?: string;
  fallbackThumbnail?: string;
};

const GOOGLE_BOOKS_VOLUME_URL = "https://www.googleapis.com/books/v1/volumes";
const coverCache = new Map<string, Promise<string | undefined>>();

const normalizeImageUrl = (url: string | undefined) => {
  if (!url) return undefined;

  return url.replace(/^http:\/\//, "https://");
};

export const extractPrimaryIsbn = (isbn: string | undefined) => {
  if (!isbn) return undefined;

  const candidates = isbn
    .split(/\s+/)
    .map((value) => value.replace(/[^0-9Xx]/g, ""))
    .filter(Boolean);

  return (
    candidates.find((candidate) => candidate.length === 13) ??
    candidates.find((candidate) => candidate.length === 10)
  );
};

const pickGoogleCover = (imageLinks: GoogleBooksImageLinks | undefined) =>
  normalizeImageUrl(
    imageLinks?.extraLarge ??
      imageLinks?.large ??
      imageLinks?.medium ??
      imageLinks?.small ??
      imageLinks?.thumbnail ??
      imageLinks?.smallThumbnail,
  );

const findGoogleBooksCover = async (isbn: string) => {
  const params = new URLSearchParams({
    q: `isbn:${isbn}`,
    projection: "lite",
    maxResults: "1",
  });
  const response = await fetch(`${GOOGLE_BOOKS_VOLUME_URL}?${params}`);

  if (!response.ok) return undefined;

  const data = (await response.json()) as GoogleBooksResponse;

  return pickGoogleCover(data.items?.[0]?.volumeInfo?.imageLinks);
};

const getOpenLibraryCoverUrl = (isbn: string) =>
  `https://covers.openlibrary.org/b/isbn/${encodeURIComponent(isbn)}-L.jpg?default=false`;

const canLoadImage = (src: string) =>
  new Promise<boolean>((resolve) => {
    if (typeof Image === "undefined") {
      resolve(false);
      return;
    }

    const image = new Image();
    const timeoutId = window.setTimeout(() => {
      image.onload = null;
      image.onerror = null;
      resolve(false);
    }, 3500);

    image.onload = () => {
      window.clearTimeout(timeoutId);
      resolve(image.naturalWidth > 1 && image.naturalHeight > 1);
    };
    image.onerror = () => {
      window.clearTimeout(timeoutId);
      resolve(false);
    };
    image.src = src;
  });

const resolveUncachedBookCover = async ({
  isbn,
  fallbackThumbnail,
}: ResolveBookCoverInput) => {
  const primaryIsbn = extractPrimaryIsbn(isbn);

  if (!primaryIsbn) return fallbackThumbnail;

  try {
    const googleCover = await findGoogleBooksCover(primaryIsbn);
    if (googleCover) return googleCover;
  } catch {
    // Fallback to Open Library below.
  }

  const openLibraryCover = getOpenLibraryCoverUrl(primaryIsbn);
  if (await canLoadImage(openLibraryCover)) return openLibraryCover;

  return fallbackThumbnail;
};

export const resolveBestBookCover = (input: ResolveBookCoverInput) => {
  const cacheKey = `${extractPrimaryIsbn(input.isbn) ?? ""}:${input.fallbackThumbnail ?? ""}`;

  if (!coverCache.has(cacheKey)) {
    coverCache.set(cacheKey, resolveUncachedBookCover(input));
  }

  return coverCache.get(cacheKey) ?? Promise.resolve(input.fallbackThumbnail);
};
