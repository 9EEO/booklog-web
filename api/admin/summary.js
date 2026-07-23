import {
  handleAdminApiError,
  listAuthUsers,
  requireAdmin,
  sendJson,
} from "./_shared.js";

const getSevenDaysAgo = () => {
  const date = new Date();
  date.setDate(date.getDate() - 6);

  return date.toISOString().slice(0, 10);
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

    const { supabase } = admin;
    const [
      users,
      booksResult,
      completedBooksResult,
      recordsResult,
      highlightsResult,
      recentRecordsResult,
    ] = await Promise.all([
      listAuthUsers(supabase),
      supabase.from("books").select("id", { count: "exact", head: true }),
      supabase
        .from("books")
        .select("id", { count: "exact", head: true })
        .eq("status", "completed"),
      supabase
        .from("reading_records")
        .select("id", { count: "exact", head: true }),
      supabase.from("highlights").select("id", { count: "exact", head: true }),
      supabase
        .from("reading_records")
        .select("user_id")
        .gte("read_date", getSevenDaysAgo()),
    ]);

    const results = [
      booksResult,
      completedBooksResult,
      recordsResult,
      highlightsResult,
      recentRecordsResult,
    ];
    const failed = results.find((result) => result.error);
    if (failed?.error) throw failed.error;

    sendJson(response, 200, {
      totalUsers: users.length,
      totalBooks: booksResult.count ?? 0,
      completedBooks: completedBooksResult.count ?? 0,
      totalRecords: recordsResult.count ?? 0,
      totalHighlights: highlightsResult.count ?? 0,
      activeUsers7d: new Set(
        (recentRecordsResult.data ?? []).map((record) => record.user_id),
      ).size,
    });
  } catch (error) {
    handleAdminApiError(response, error);
  }
}
