import { createClient } from "@supabase/supabase-js";
import WebSocket from "ws";

const DATA4LIBRARY_USAGE_ANALYSIS_API_URL =
  "https://data4library.kr/api/usageAnalysisList";
const DATA4LIBRARY_RECOMMENDATION_API_URL =
  "https://data4library.kr/api/recommandList";
const NATIONAL_LIBRARY_SEARCH_API_URL =
  "https://www.nl.go.kr/seoji/SearchApi.do";
const supabaseUrl = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const sendJson = (response, statusCode, body) => {
  response.status(statusCode).json(body);
};

const createCacheClient = () => {
  if (!supabaseUrl || !serviceRoleKey) return null;

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
    realtime: {
      transport: WebSocket,
    },
  });
};

const cleanIsbn = (isbn) => {
  if (typeof isbn !== "string") return "";

  const candidates = isbn.match(/(?:97[89])?\d{9}[\dXx]/g) ?? [];
  return (
    candidates.find((candidate) => candidate.length === 13) ??
    candidates[0]?.toUpperCase() ??
    ""
  );
};

const fetchData4LibraryJson = async ({ url, authKey, isbn }) => {
  const params = new URLSearchParams({
    authKey,
    isbn13: isbn,
    format: "json",
  });
  const data4LibraryResponse = await fetch(`${url}?${params.toString()}`);

  if (!data4LibraryResponse.ok) return null;

  const data = await data4LibraryResponse.json();
  if (data?.response?.errCode || data?.response?.error) return null;

  return data;
};

const fetchNationalLibraryJson = async ({ authKey, isbn }) => {
  const params = new URLSearchParams({
    cert_key: authKey,
    result_style: "json",
    page_no: "1",
    page_size: "1",
    isbn,
  });
  const nationalLibraryResponse = await fetch(
    `${NATIONAL_LIBRARY_SEARCH_API_URL}?${params.toString()}`,
  );

  if (!nationalLibraryResponse.ok) return null;

  return nationalLibraryResponse.json();
};

const findBibliographyRecord = (value) => {
  if (!value) return null;

  if (Array.isArray(value)) {
    for (const item of value) {
      const record = findBibliographyRecord(item);
      if (record) return record;
    }

    return null;
  }

  if (typeof value !== "object") return null;

  if ("EA_ISBN" in value || "TITLE" in value) {
    return value;
  }

  for (const item of Object.values(value)) {
    const record = findBibliographyRecord(item);
    if (record) return record;
  }

  return null;
};

const collectValues = (value, key, results = []) => {
  if (results.length >= 8 || value === null || value === undefined) {
    return results;
  }

  if (Array.isArray(value)) {
    value.forEach((item) => collectValues(item, key, results));
    return results;
  }

  if (typeof value !== "object") return results;

  Object.entries(value).forEach(([entryKey, entryValue]) => {
    if (
      entryKey === key &&
      (typeof entryValue === "string" || typeof entryValue === "number")
    ) {
      results.push(String(entryValue));
      return;
    }

    collectValues(entryValue, key, results);
  });

  return results;
};

const firstText = (...items) =>
  items.find((item) => typeof item === "string" && item.trim())?.trim();

const buildNationalLibraryReference = (data) => {
  const record = findBibliographyRecord(data);
  if (!record) return null;

  const reference = {
    source: "국립중앙도서관",
    title: firstText(record.TITLE),
    author: cleanAuthor(record.AUTHOR),
    isbn: firstText(record.EA_ISBN),
    setIsbn: firstText(record.SET_ISBN),
    publisher: firstText(record.PUBLISHER),
    edition: firstText(record.EDITION_STMT),
    page: firstText(record.PAGE),
    bookSize: firstText(record.BOOK_SIZE),
    form: firstText(record.FORM),
    subject: firstText(record.SUBJECT),
    ebookYn: firstText(record.EBOOK_YN),
    cipYn: firstText(record.CIP_YN),
    coverUrl: firstText(record.TITLE_URL),
    tocUrl: firstText(record.BOOK_TB_CNT_URL),
    introductionUrl: firstText(record.BOOK_INTRODUCTION_URL),
    summaryUrl: firstText(record.BOOK_SUMMARY_URL),
    inputDate: firstText(record.INPUT_DATE),
    updateDate: firstText(record.UPDATE_DATE),
    syncedAt: new Date().toISOString(),
  };

  return Object.fromEntries(
    Object.entries(reference).filter(([, value]) => value),
  );
};

const getRepresentativeTitle = (value) =>
  firstText(value)?.split(/[:：]/)[0]?.trim() ?? "";

const normalizeTitle = (value) =>
  getRepresentativeTitle(value).replace(/\s+/g, "").toLowerCase();

const cleanAuthor = (value) =>
  firstText(value)?.replace(/^(지은이|저자|글|옮긴이|엮은이)\s*[:：]\s*/, "") ??
  undefined;

const buildSummary = (contents, recommendedBooks, nationalLibrary) => {
  const parts = [];

  if (contents) {
    parts.push(contents);
  }

  if (recommendedBooks.length > 0) {
    parts.push(
      `함께 읽힌 책: ${recommendedBooks
        .map((book) => (book.author ? `${book.title}(${book.author})` : book.title))
        .join(", ")}`,
    );
  }

  if (nationalLibrary) {
    parts.push(
      `서지정보: ${[
        nationalLibrary.title,
        nationalLibrary.author,
        nationalLibrary.publisher,
      ]
        .filter(Boolean)
        .join(" · ")}`,
    );
  }

  return parts.join("\n");
};

const removeDuplicateRecommendationTitles = (recommendedBooks, title) => {
  const sourceTitle = normalizeTitle(title);
  const seenTitles = new Set();

  return (Array.isArray(recommendedBooks) ? recommendedBooks : [])
    .map((book) => ({
      title: getRepresentativeTitle(book?.title),
      author: cleanAuthor(book?.author),
    }))
    .filter((book) => {
      const normalizedTitle = normalizeTitle(book.title);

      if (
        !normalizedTitle ||
        normalizedTitle === sourceTitle ||
        seenTitles.has(normalizedTitle)
      ) {
        return false;
      }

      seenTitles.add(normalizedTitle);
      return true;
    })
    .slice(0, 3);
};

const sanitizeReference = (libraryReference, title) => {
  if (!libraryReference) return null;

  const recommendedBooks = removeDuplicateRecommendationTitles(
    libraryReference.recommendedBooks,
    title,
  );

  const source = [
    libraryReference.contents || recommendedBooks.length > 0
      ? "도서관 정보나루"
      : "",
    libraryReference.nationalLibrary ? "국립중앙도서관" : "",
  ]
    .filter(Boolean)
    .join(" · ");

  return {
    ...libraryReference,
    source: source || libraryReference.source || "외부 도서 자료",
    title:
      libraryReference.title ??
      getRepresentativeTitle(title ?? libraryReference.nationalLibrary?.title),
    recommendedBooks,
    summary: buildSummary(
      libraryReference.contents,
      recommendedBooks,
      libraryReference.nationalLibrary,
    ),
  };
};

const hasReferenceContent = (libraryReference) =>
  Boolean(
    libraryReference?.contents ||
      libraryReference?.nationalLibrary ||
      (Array.isArray(libraryReference?.recommendedBooks) &&
        libraryReference.recommendedBooks.length > 0),
  );

const sendReference = (response, libraryReference) => {
  sendJson(response, 200, {
    libraryReference: hasReferenceContent(libraryReference)
      ? libraryReference
      : null,
  });
};

const buildReference = ({
  usageAnalysis,
  recommendations,
  nationalLibrary,
  title,
}) => {
  const contents = firstText(
    usageAnalysis?.response?.book?.description,
    usageAnalysis?.response?.book?.contents,
  );
  const displayTitle = getRepresentativeTitle(
    firstText(title, usageAnalysis?.response?.book?.bookname, nationalLibrary?.title),
  );
  const sourceTitle = normalizeTitle(displayTitle);
  const bookNames = collectValues(recommendations, "bookname");
  const authors = collectValues(recommendations, "authors");
  const seenTitles = new Set();
  const recommendedBooks = bookNames.reduce((books, bookName, index) => {
    const normalizedTitle = normalizeTitle(bookName);

    if (
      !normalizedTitle ||
      normalizedTitle === sourceTitle ||
      seenTitles.has(normalizedTitle) ||
      books.length >= 3
    ) {
      return books;
    }

    seenTitles.add(normalizedTitle);
    books.push({
      title: getRepresentativeTitle(bookName),
      author: cleanAuthor(authors[index]),
    });
    return books;
  }, []);
  const summary = buildSummary(contents, recommendedBooks, nationalLibrary);

  if (!summary) return null;

  return {
    source: [
      contents || recommendedBooks.length > 0 ? "도서관 정보나루" : "",
      nationalLibrary ? "국립중앙도서관" : "",
    ]
      .filter(Boolean)
      .join(" · "),
    title: displayTitle,
    summary,
    contents,
    recommendedBooks,
    nationalLibrary,
    syncedAt: new Date().toISOString(),
  };
};

const getCachedReference = async (isbn) => {
  const supabase = createCacheClient();
  if (!supabase) return null;

  const { data, error } = await supabase
    .from("book_library_references")
    .select("library_reference")
    .eq("isbn13", isbn)
    .maybeSingle();

  if (error) return null;
  return data?.library_reference ?? null;
};

const saveCachedReference = async (isbn, libraryReference) => {
  const supabase = createCacheClient();
  if (!supabase || !libraryReference) return;

  await supabase.from("book_library_references").upsert({
    isbn13: isbn,
    library_reference: libraryReference,
    updated_at: new Date().toISOString(),
  });
};

const buildEmptyCachedReference = ({ title, checkedAt }) => ({
  source: "외부 도서 자료",
  title: getRepresentativeTitle(title),
  summary: "",
  recommendedBooks: [],
  data4LibraryCheckedAt: checkedAt,
  nationalLibraryCheckedAt: checkedAt,
  syncedAt: checkedAt,
});

export default async function handler(request, response) {
  if (request.method !== "POST") {
    sendJson(response, 405, { error: "Method not allowed" });
    return;
  }

  const data4LibraryAuthKey =
    process.env.DATA4LIBRARY_AUTH_KEY ?? process.env.DATA4LIBRARY_API_KEY;
  const nationalLibraryAuthKey =
    process.env.NATIONAL_LIBRARY_CERT_KEY ??
    process.env.NATIONAL_LIBRARY_API_KEY ??
    process.env.NL_CERT_KEY ??
    process.env.NL_API_KEY;
  const isbn = cleanIsbn(request.body?.isbn);

  if (!isbn) {
    sendJson(response, 400, { error: "ISBN이 없습니다." });
    return;
  }

  try {
    const cachedReference = await getCachedReference(isbn);

    if (cachedReference) {
      const sanitizedReference = sanitizeReference(
        cachedReference,
        request.body?.title,
      );
      const hasCheckedNationalLibrary = Boolean(
        cachedReference.nationalLibrary || cachedReference.nationalLibraryCheckedAt,
      );

      if (!nationalLibraryAuthKey || hasCheckedNationalLibrary) {
        sendReference(response, sanitizedReference);
        return;
      }

      const checkedAt = new Date().toISOString();
      const nationalLibrary = buildNationalLibraryReference(
        await fetchNationalLibraryJson({
          authKey: nationalLibraryAuthKey,
          isbn,
        }),
      );
      const enrichedReference = sanitizeReference(
        {
          ...sanitizedReference,
          nationalLibrary:
            nationalLibrary ?? sanitizedReference?.nationalLibrary,
          nationalLibraryCheckedAt: checkedAt,
          syncedAt: checkedAt,
        },
        request.body?.title,
      );

      await saveCachedReference(isbn, enrichedReference);

      sendReference(response, enrichedReference);
      return;
    }

    if (!data4LibraryAuthKey && !nationalLibraryAuthKey) {
      sendJson(response, 200, { libraryReference: null });
      return;
    }

    const checkedAt = new Date().toISOString();
    const [usageAnalysis, recommendations, nationalLibraryJson] = await Promise.all([
      data4LibraryAuthKey
        ? fetchData4LibraryJson({
            url: DATA4LIBRARY_USAGE_ANALYSIS_API_URL,
            authKey: data4LibraryAuthKey,
            isbn,
          })
        : null,
      data4LibraryAuthKey
        ? fetchData4LibraryJson({
            url: DATA4LIBRARY_RECOMMENDATION_API_URL,
            authKey: data4LibraryAuthKey,
            isbn,
          })
        : null,
      nationalLibraryAuthKey
        ? fetchNationalLibraryJson({
            authKey: nationalLibraryAuthKey,
            isbn,
          })
        : null,
    ]);
    const libraryReference = sanitizeReference(
      {
        ...(buildReference({
          usageAnalysis,
          recommendations,
          nationalLibrary: buildNationalLibraryReference(nationalLibraryJson),
          title: request.body?.title,
        }) ?? buildEmptyCachedReference({ title: request.body?.title, checkedAt })),
        data4LibraryCheckedAt: data4LibraryAuthKey ? checkedAt : undefined,
        nationalLibraryCheckedAt: nationalLibraryAuthKey ? checkedAt : undefined,
      },
      request.body?.title,
    );

    await saveCachedReference(isbn, libraryReference);

    sendReference(response, libraryReference);
  } catch {
    sendJson(response, 200, { libraryReference: null });
  }
}
