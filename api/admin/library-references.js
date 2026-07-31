import { handleAdminApiError, requireAdmin, sendJson } from "./_shared.js";

const getNumberParam = (request, key, fallback, max) => {
  const value = Number(request.query[key]);
  if (!Number.isFinite(value) || value < 1) return fallback;

  return Math.min(Math.floor(value), max);
};

const getSearchText = (row) => {
  const reference = row.library_reference ?? {};
  const recommendedBooks = Array.isArray(reference.recommendedBooks)
    ? reference.recommendedBooks
    : [];

  return [
    row.isbn13,
    reference.title,
    reference.source,
    reference.contents,
    reference.summary,
    ...Object.values(reference.nationalLibrary ?? {}),
    ...recommendedBooks.flatMap((book) => [book?.title, book?.author]),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
};

const mapReference = (row) => {
  const reference = row.library_reference ?? {};

  return {
    isbn13: row.isbn13,
    title: reference.title ?? reference.nationalLibrary?.title ?? "",
    source: reference.source ?? "도서관 정보나루",
    contents: reference.contents ?? "",
    summary: reference.summary ?? "",
    nationalLibrary: reference.nationalLibrary ?? null,
    recommendedBooks: Array.isArray(reference.recommendedBooks)
      ? reference.recommendedBooks
      : [],
    raw: {
      isbn13: row.isbn13,
      created_at: row.created_at,
      updated_at: row.updated_at,
      library_reference: reference,
    },
    syncedAt: reference.syncedAt ?? null,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
};

const handleGet = async (request, response, admin) => {
  const page = getNumberParam(request, "page", 1, 1000);
  const pageSize = getNumberParam(request, "pageSize", 20, 100);
  const query = String(request.query.q ?? "").trim().toLowerCase();
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;
  let referencesQuery = admin.supabase
    .from("book_library_references")
    .select("isbn13,library_reference,created_at,updated_at", {
      count: "exact",
    })
    .order("updated_at", { ascending: false });

  if (!query) {
    referencesQuery = referencesQuery.range(from, to);
  } else {
    referencesQuery = referencesQuery.limit(1000);
  }

  const { data, error, count } = await referencesQuery;
  if (error) throw error;

  const rows = query
    ? (data ?? []).filter((row) => getSearchText(row).includes(query))
    : (data ?? []);
  const pageRows = query ? rows.slice(from, to + 1) : rows;

  sendJson(response, 200, {
    references: pageRows.map(mapReference),
    total: query ? rows.length : (count ?? 0),
    page,
    pageSize,
  });
};

const handleDelete = async (request, response, admin) => {
  const isbn13 = String(request.query.isbn13 ?? "").trim();

  if (!isbn13) {
    sendJson(response, 400, { error: "isbn13이 필요합니다." });
    return;
  }

  const { error } = await admin.supabase
    .from("book_library_references")
    .delete()
    .eq("isbn13", isbn13);

  if (error) throw error;

  sendJson(response, 200, { ok: true });
};

export default async function handler(request, response) {
  try {
    const admin = await requireAdmin(request);
    if (admin.error) {
      handleAdminApiError(response, admin.error);
      return;
    }

    if (request.method === "GET") {
      await handleGet(request, response, admin);
      return;
    }

    if (request.method === "DELETE") {
      await handleDelete(request, response, admin);
      return;
    }

    sendJson(response, 405, { error: "Method not allowed" });
  } catch (error) {
    handleAdminApiError(response, error);
  }
}
