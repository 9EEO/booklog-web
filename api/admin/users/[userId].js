import { handleAdminApiError, requireAdmin, sendJson } from "../_shared.js";

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

    const { userId } = request.query;
    if (!userId || Array.isArray(userId)) {
      sendJson(response, 400, { error: "userId가 필요합니다." });
      return;
    }

    const [userResult, booksResult, roundsResult, recordsResult, highlightsResult, settingsResult] =
      await Promise.all([
        admin.supabase.auth.admin.getUserById(userId),
        admin.supabase
          .from("books")
          .select("*")
          .eq("user_id", userId)
          .order("created_at", { ascending: false }),
        admin.supabase
          .from("reading_rounds")
          .select("*")
          .eq("user_id", userId)
          .order("round_number", { ascending: true }),
        admin.supabase
          .from("reading_records")
          .select("*")
          .eq("user_id", userId)
          .order("read_date", { ascending: false })
          .order("created_at", { ascending: false })
          .limit(100),
        admin.supabase
          .from("highlights")
          .select("*")
          .eq("user_id", userId)
          .order("recorded_at", { ascending: false })
          .order("created_at", { ascending: false })
          .limit(100),
        admin.supabase
          .from("reading_settings")
          .select("*")
          .eq("user_id", userId)
          .maybeSingle(),
      ]);

    const results = [
      userResult,
      booksResult,
      roundsResult,
      recordsResult,
      highlightsResult,
      settingsResult,
    ];
    const failed = results.find((result) => result.error);
    if (failed?.error) throw failed.error;

    sendJson(response, 200, {
      user: {
        id: userResult.data.user.id,
        email: userResult.data.user.email ?? "이메일 없음",
        createdAt: userResult.data.user.created_at,
        lastSignInAt: userResult.data.user.last_sign_in_at ?? null,
      },
      books: booksResult.data ?? [],
      rounds: roundsResult.data ?? [],
      records: recordsResult.data ?? [],
      highlights: highlightsResult.data ?? [],
      settings: settingsResult.data ?? null,
    });
  } catch (error) {
    handleAdminApiError(response, error);
  }
}
