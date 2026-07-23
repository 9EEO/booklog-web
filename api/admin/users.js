import {
  handleAdminApiError,
  listAuthUsers,
  maxDate,
  requireAdmin,
  sendJson,
  sum,
} from "./_shared.js";

const getNumberParam = (request, key, fallback, max) => {
  const value = Number(request.query[key]);
  if (!Number.isFinite(value) || value < 1) return fallback;

  return Math.min(Math.floor(value), max);
};

const groupByUserId = (rows) => {
  const groups = new Map();

  rows.forEach((row) => {
    const current = groups.get(row.user_id) ?? [];
    current.push(row);
    groups.set(row.user_id, current);
  });

  return groups;
};

export default async function handler(request, response) {
  if (request.method !== "GET") {
    sendJson(response, 405, { error: "Method not allowed" });
    return;
  }

  try {
    const admin = await requireAdmin(request);
    if (admin.error) {
      handleAdminApiError(response, admin.error);
      return;
    }

    const page = getNumberParam(request, "page", 1, 1000);
    const pageSize = getNumberParam(request, "pageSize", 20, 100);
    const query = String(request.query.q ?? "").trim().toLowerCase();
    const users = (await listAuthUsers(admin.supabase))
      .filter((user) => {
        if (!query) return true;

        return (
          user.email?.toLowerCase().includes(query) ||
          user.id.toLowerCase().includes(query)
        );
      })
      .sort((left, right) => right.created_at.localeCompare(left.created_at));
    const total = users.length;
    const pageUsers = users.slice((page - 1) * pageSize, page * pageSize);
    const userIds = pageUsers.map((user) => user.id);

    if (userIds.length === 0) {
      sendJson(response, 200, { users: [], total, page, pageSize });
      return;
    }

    const [booksResult, recordsResult, highlightsResult] = await Promise.all([
      admin.supabase
        .from("books")
        .select("id,user_id,status,accumulated_seconds")
        .in("user_id", userIds),
      admin.supabase
        .from("reading_records")
        .select("id,user_id,read_date,duration_seconds")
        .in("user_id", userIds),
      admin.supabase
        .from("highlights")
        .select("id,user_id")
        .in("user_id", userIds),
    ]);

    const results = [booksResult, recordsResult, highlightsResult];
    const failed = results.find((result) => result.error);
    if (failed?.error) throw failed.error;

    const booksByUser = groupByUserId(booksResult.data ?? []);
    const recordsByUser = groupByUserId(recordsResult.data ?? []);
    const highlightsByUser = groupByUserId(highlightsResult.data ?? []);

    sendJson(response, 200, {
      total,
      page,
      pageSize,
      users: pageUsers.map((user) => {
        const books = booksByUser.get(user.id) ?? [];
        const records = recordsByUser.get(user.id) ?? [];
        const highlights = highlightsByUser.get(user.id) ?? [];

        return {
          id: user.id,
          email: user.email ?? "이메일 없음",
          createdAt: user.created_at,
          lastSignInAt: user.last_sign_in_at ?? null,
          bookCount: books.length,
          completedBookCount: books.filter((book) => book.status === "completed")
            .length,
          recordCount: records.length,
          highlightCount: highlights.length,
          totalSeconds:
            sum(records, (record) => record.duration_seconds) ||
            sum(books, (book) => book.accumulated_seconds),
          recentReadDate: maxDate(records, (record) => record.read_date),
        };
      }),
    });
  } catch (error) {
    handleAdminApiError(response, error);
  }
}
