const WOORIMALSAEM_SEARCH_API_URL = "https://opendict.korean.go.kr/api/search";
const MAX_QUERY_LENGTH = 80;
const DEFAULT_RESULT_COUNT = 10;

const sendJson = (response, statusCode, body) => {
  response.status(statusCode).json(body);
};

const toArray = (value) => {
  if (Array.isArray(value)) return value;
  if (value === null || value === undefined) return [];
  return [value];
};

const cleanText = (value) =>
  typeof value === "string" ? value.replace(/\s+/g, " ").trim() : "";

const cleanQuery = (value) =>
  cleanText(value)
    .replace(/[“”"']/g, "")
    .slice(0, MAX_QUERY_LENGTH);

const decodeXmlText = (value) =>
  value
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");

const getXmlTagText = (text, tagName) => {
  const match = text.match(new RegExp(`<${tagName}>([\\s\\S]*?)</${tagName}>`));
  return match ? decodeXmlText(match[1]).trim() : "";
};

const getDictionaryErrorFromXml = (text) => {
  const code = getXmlTagText(text, "error_code");
  const message = getXmlTagText(text, "message");
  if (!code && !message) return null;

  return {
    code: code || undefined,
    message: message || "우리말샘 검색에 실패했습니다.",
  };
};

const parseDictionaryJson = (text) => {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
};

const clampResultCount = (value) => {
  const count = Number(value);
  if (!Number.isFinite(count)) return DEFAULT_RESULT_COUNT;
  return Math.min(Math.max(Math.trunc(count), 10), 100);
};

const getSearchMethod = (value) => {
  if (["exact", "include", "start", "end"].includes(value)) return value;
  return "exact";
};

const normalizeDefinition = (sense) => ({
  definition: cleanText(sense?.definition),
  pos: cleanText(sense?.pos) || undefined,
  type: cleanText(sense?.type) || undefined,
  category: cleanText(sense?.cat) || undefined,
  origin: cleanText(sense?.origin) || undefined,
  link: cleanText(sense?.link) || undefined,
  targetCode:
    sense?.target_code === undefined || sense?.target_code === null
      ? undefined
      : String(sense.target_code),
  senseNo:
    sense?.sense_no === undefined || sense?.sense_no === null
      ? undefined
      : String(sense.sense_no),
});

const normalizeItem = (item) => {
  const definitions = toArray(item?.sense)
    .map(normalizeDefinition)
    .filter((definition) => definition.definition);

  if (definitions.length === 0) return null;

  return {
    word: cleanText(item?.word),
    definitions,
    source: "woorimalsam",
    sourceName: "우리말샘",
    sourceUrl: definitions[0]?.link ?? "https://opendict.korean.go.kr",
    license: "국립국어원 우리말샘 Open API",
  };
};

const normalizeResponse = (data, query) => {
  const channel = data?.channel ?? {};
  const results = toArray(channel.item).map(normalizeItem).filter(Boolean);

  return {
    query,
    total: Number(channel.total ?? results.length) || results.length,
    results,
    attribution: {
      source: "우리말샘",
      url: "https://opendict.korean.go.kr",
      license: "국립국어원 우리말샘 Open API",
    },
  };
};

export default async function handler(request, response) {
  if (request.method !== "POST") {
    sendJson(response, 405, { error: "POST 요청만 지원합니다." });
    return;
  }

  const apiKey =
    process.env.WOORIMALSAEM_API_KEY ??
    process.env.WOORIMALSAEM_KEY ??
    process.env.OPENDICT_API_KEY;

  if (!apiKey) {
    sendJson(response, 500, {
      error: "WOORIMALSAEM_API_KEY가 서버 환경변수에 설정되어 있지 않습니다.",
    });
    return;
  }

  const query = cleanQuery(request.body?.query ?? request.body?.word);
  if (!query) {
    sendJson(response, 400, { error: "검색할 단어를 입력해 주세요." });
    return;
  }

  const params = new URLSearchParams({
    key: apiKey,
    q: query,
    req_type: "json",
    part: "word",
    sort: "dict",
    advanced: "y",
    target: "1",
    method: getSearchMethod(request.body?.method),
    type1: "all",
    type2: "all",
    type3: "all",
    type4: "all",
    pos: "0",
    num: String(clampResultCount(request.body?.limit)),
    start: "1",
  });

  const dictionaryResponse = await fetch(
    `${WOORIMALSAEM_SEARCH_API_URL}?${params.toString()}`,
  );

  const responseText = await dictionaryResponse.text();
  const data = parseDictionaryJson(responseText);
  const xmlError = data ? null : getDictionaryErrorFromXml(responseText);

  if (xmlError) {
    sendJson(response, dictionaryResponse.ok ? 400 : dictionaryResponse.status, {
      error: xmlError.message,
      code: xmlError.code,
    });
    return;
  }

  if (!data) {
    sendJson(response, 502, {
      error:
        "우리말샘이 JSON이 아닌 응답을 반환했습니다. API 키 상태와 요청 조건을 확인해 주세요.",
    });
    return;
  }

  if (!dictionaryResponse.ok || data?.error) {
    const code = cleanText(data?.error?.error_code);
    const message = cleanText(data?.error?.message);
    sendJson(response, dictionaryResponse.ok ? 400 : dictionaryResponse.status, {
      error: message || "우리말샘 검색에 실패했습니다.",
      code: code || undefined,
    });
    return;
  }

  sendJson(response, 200, normalizeResponse(data, query));
}
