import { createClient } from "@supabase/supabase-js";
import WebSocket from "ws";

const supabaseUrl = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

export const sendJson = (response, statusCode, body) => {
  response.status(statusCode).json(body);
};

export const createServiceClient = () => {
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Admin API environment variables are not configured.");
  }

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

const getBearerToken = (request) => {
  const header = request.headers.authorization ?? "";
  const [scheme, token] = header.split(" ");

  return scheme?.toLowerCase() === "bearer" && token ? token : null;
};

export const requireAdmin = async (request) => {
  const token = getBearerToken(request);

  if (!token) {
    return { error: { status: 401, message: "로그인이 필요합니다." } };
  }

  const supabase = createServiceClient();
  const { data: userData, error: userError } = await supabase.auth.getUser(token);

  if (userError || !userData.user) {
    return {
      error: {
        status: 401,
        message: userError?.message
          ? `로그인 세션을 확인하지 못했습니다. (${userError.message})`
          : "로그인 세션을 확인하지 못했습니다.",
      },
    };
  }

  const { data: adminUser, error: adminError } = await supabase
    .from("admin_users")
    .select("user_id")
    .eq("user_id", userData.user.id)
    .maybeSingle();

  if (adminError) {
    return { error: { status: 500, message: adminError.message } };
  }

  if (!adminUser) {
    return { error: { status: 403, message: "관리자 권한이 없습니다." } };
  }

  return { supabase, user: userData.user };
};

export const handleAdminApiError = (response, error) => {
  const status = typeof error?.status === "number" ? error.status : 500;
  const message = error?.message ?? "관리자 데이터를 불러오지 못했습니다.";

  sendJson(response, status, { error: message });
};

export const listAuthUsers = async (supabase) => {
  const users = [];
  const perPage = 1000;
  let page = 1;

  while (page <= 20) {
    const { data, error } = await supabase.auth.admin.listUsers({
      page,
      perPage,
    });

    if (error) throw error;

    const pageUsers = data?.users ?? [];
    users.push(...pageUsers);

    if (pageUsers.length < perPage) break;
    page += 1;
  }

  return users;
};

export const sum = (rows, getValue) =>
  rows.reduce((total, row) => total + (Number(getValue(row)) || 0), 0);

export const maxDate = (rows, getValue) =>
  rows.reduce((latest, row) => {
    const value = getValue(row);
    if (!value) return latest;

    return !latest || value > latest ? value : latest;
  }, null);
