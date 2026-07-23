import { requireSupabase } from "./supabase";

export type AdminSummary = {
  totalUsers: number;
  totalBooks: number;
  completedBooks: number;
  totalRecords: number;
  totalHighlights: number;
  activeUsers7d: number;
};

export type AdminUserSummary = {
  id: string;
  email: string;
  createdAt: string;
  lastSignInAt: string | null;
  bookCount: number;
  completedBookCount: number;
  recordCount: number;
  highlightCount: number;
  totalSeconds: number;
  recentReadDate: string | null;
};

export type AdminUsersResponse = {
  users: AdminUserSummary[];
  total: number;
  page: number;
  pageSize: number;
};

export type AdminUserDetail = {
  user: {
    id: string;
    email: string;
    createdAt: string;
    lastSignInAt: string | null;
  };
  books: Array<{
    id: string;
    title: string;
    author: string;
    status: string;
    total_pages: number | null;
    current_page: number;
    accumulated_seconds: number;
    created_at?: string;
  }>;
  rounds: Array<{
    id: string;
    book_id: string;
    round_number: number;
    status: string;
    current_page: number;
    accumulated_seconds: number;
  }>;
  records: Array<{
    id: string;
    book_id: string;
    book_title: string | null;
    read_date: string;
    session_started_at: string | null;
    session_ended_at: string | null;
    duration_seconds: number;
    start_page: number;
    end_page: number;
  }>;
  highlights: Array<{
    id: string;
    book_id: string;
    text: string;
    page: number;
    recorded_at: string;
  }>;
  settings: unknown;
};

const getAdminToken = async () => {
  const supabase = requireSupabase();
  const { data, error } = await supabase.auth.getSession();

  if (error) throw error;
  if (!data.session?.access_token) {
    throw new Error("로그인이 필요합니다.");
  }

  const expiresAt = data.session.expires_at ?? 0;
  if (expiresAt * 1000 < Date.now() + 30_000) {
    const { data: refreshedData, error: refreshError } =
      await supabase.auth.refreshSession();

    if (refreshError) throw refreshError;
    if (!refreshedData.session?.access_token) {
      throw new Error("로그인 세션이 만료되었습니다. 다시 로그인해주세요.");
    }

    return refreshedData.session.access_token;
  }

  return data.session.access_token;
};

const fetchAdmin = async <T>(path: string): Promise<T> => {
  const token = await getAdminToken();
  const response = await fetch(path, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  const text = await response.text();
  let data: T | { error?: string };

  try {
    data = JSON.parse(text) as T | { error?: string };
  } catch {
    throw new Error(
      import.meta.env.DEV
        ? "관리자 API가 JSON이 아닌 응답을 반환했습니다. 로컬에서는 Vite dev 서버가 아니라 `vercel dev`로 실행해야 /api/admin 함수가 동작합니다."
        : "관리자 API가 올바르지 않은 응답을 반환했습니다. 배포 설정에서 /api 경로와 서버 함수를 확인해주세요.",
    );
  }

  if (!response.ok) {
    const errorMessage =
      typeof data === "object" && data !== null && "error" in data
        ? data.error
        : null;

    throw new Error(
      errorMessage ?? "관리자 데이터를 불러오지 못했습니다.",
    );
  }

  return data as T;
};

export const fetchAdminSummary = () =>
  fetchAdmin<AdminSummary>("/api/admin/summary");

export const fetchAdminUsers = (input: {
  page: number;
  pageSize: number;
  query: string;
}) => {
  const params = new URLSearchParams({
    page: String(input.page),
    pageSize: String(input.pageSize),
  });

  if (input.query.trim()) {
    params.set("q", input.query.trim());
  }

  return fetchAdmin<AdminUsersResponse>(`/api/admin/users?${params}`);
};

export const fetchAdminUserDetail = (userId: string) =>
  fetchAdmin<AdminUserDetail>(`/api/admin/users/${encodeURIComponent(userId)}`);
