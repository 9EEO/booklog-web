export type WordDictionarySearchMethod = "exact" | "include" | "start" | "end";

export type WordDefinition = {
  definition: string;
  pos?: string;
  type?: string;
  category?: string;
  origin?: string;
  link?: string;
  targetCode?: string;
  senseNo?: string;
};

export type WordDictionaryResult = {
  word: string;
  definitions: WordDefinition[];
  source: "woorimalsam";
  sourceName: string;
  sourceUrl: string;
  license: string;
};

export type WordDictionaryAttribution = {
  source: string;
  url: string;
  license: string;
};

export type WordDictionaryResponse = {
  query: string;
  total: number;
  results: WordDictionaryResult[];
  attribution: WordDictionaryAttribution;
};

type SearchWordOptions = {
  method?: WordDictionarySearchMethod;
  limit?: number;
};

const getDictionaryErrorMessage = (status: number, data: unknown) => {
  const error =
    typeof data === "object" &&
    data !== null &&
    "error" in data &&
    typeof data.error === "string"
      ? data.error
      : "";

  if (error) return error;
  if (status === 500) return "사전 API 키 설정을 확인해 주세요.";
  if (status === 429) return "사전 검색 요청이 많습니다. 잠시 후 다시 시도해 주세요.";
  return "단어를 검색하지 못했습니다.";
};

export const searchKoreanWord = async (
  word: string,
  options: SearchWordOptions = {},
): Promise<WordDictionaryResponse> => {
  const query = word.trim();
  if (!query) {
    throw new Error("검색할 단어를 입력해 주세요.");
  }

  const response = await fetch("/api/word-lookup", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      query,
      method: options.method ?? "exact",
      limit: options.limit ?? 10,
    }),
  });

  const data = (await response.json().catch(() => null)) as
    | WordDictionaryResponse
    | { error?: string }
    | null;

  if (!response.ok) {
    throw new Error(getDictionaryErrorMessage(response.status, data));
  }

  if (!data || !("results" in data) || !Array.isArray(data.results)) {
    throw new Error("사전 검색 응답이 올바르지 않습니다.");
  }

  return data;
};
