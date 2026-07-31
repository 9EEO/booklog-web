const OPENAI_CHAT_COMPLETIONS_API_URL =
  "https://api.openai.com/v1/chat/completions";
const OPENAI_RESPONSES_API_URL = "https://api.openai.com/v1/responses";
const DATA4LIBRARY_USAGE_ANALYSIS_API_URL =
  "https://data4library.kr/api/usageAnalysisList";
const DATA4LIBRARY_RECOMMENDATION_API_URL =
  "https://data4library.kr/api/recommandList";
const DEFAULT_MODEL = "gpt-5.1";
const DEFAULT_LIGHT_MODEL = "gpt-5-mini";
const MAX_QUESTION_LENGTH = 600;
const MAX_CONTEXT_LENGTH = 60_000;
const MAX_MESSAGES = 8;

const responseSchema = {
  type: "object",
  additionalProperties: false,
  required: ["answer", "evidence", "followUpQuestions"],
  properties: {
    answer: {
      type: "string",
      minLength: 1,
      maxLength: 2200,
    },
    evidence: {
      type: "array",
      maxItems: 5,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["type", "label", "detail"],
        properties: {
          type: {
            type: "string",
            enum: [
              "bookInfo",
              "external",
              "quote",
              "record",
              "pattern",
              "report",
              "tier",
              "comparison",
            ],
          },
          label: {
            type: "string",
            minLength: 1,
            maxLength: 80,
          },
          detail: {
            type: "string",
            minLength: 1,
            maxLength: 600,
          },
        },
      },
    },
    followUpQuestions: {
      type: "array",
      minItems: 2,
      maxItems: 4,
      items: {
        type: "string",
        minLength: 1,
        maxLength: 80,
      },
    },
  },
};

const sendJson = (response, statusCode, body) => {
  response.status(statusCode).json(body);
};

const isObject = (value) =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const getUserMessages = (messages) => {
  if (!Array.isArray(messages)) return [];

  return messages
    .filter(
      (message) =>
        isObject(message) &&
        (message.role === "user" || message.role === "assistant") &&
        typeof message.content === "string" &&
        message.content.trim(),
    )
    .slice(-MAX_MESSAGES)
    .map((message) => ({
      role: message.role,
      content: message.content.trim().slice(0, 2400),
    }));
};

const extractOutputText = (data) => {
  const content = data?.choices?.[0]?.message?.content;

  if (typeof content === "string") return content;
  return "";
};

const extractResponseOutputText = (data) => {
  if (typeof data?.output_text === "string") return data.output_text;

  const output = Array.isArray(data?.output) ? data.output : [];
  return output
    .flatMap((item) => (Array.isArray(item?.content) ? item.content : []))
    .map((content) => {
      if (typeof content?.text === "string") return content.text;
      if (typeof content?.content === "string") return content.content;
      return "";
    })
    .filter(Boolean)
    .join("\n")
    .trim();
};

const collectWebSources = (data) => {
  const sources = [];
  const output = Array.isArray(data?.output) ? data.output : [];

  output.forEach((item) => {
    const actionSources = item?.action?.sources;
    if (!Array.isArray(actionSources)) return;

    actionSources.forEach((source) => {
      if (source?.type !== "url" || typeof source.url !== "string") return;
      if (sources.some((itemSource) => itemSource.url === source.url)) return;

      sources.push({
        url: source.url,
        title:
          typeof source.title === "string" && source.title.trim()
            ? source.title.trim()
            : source.url,
      });
    });
  });

  return sources.slice(0, 3);
};

const includesAny = (source, keywords) =>
  keywords.some((keyword) => source.includes(keyword.toLowerCase()));

const needsExternalSearch = (question) => {
  const normalizedQuestion = question.replace(/\s+/g, " ").toLowerCase();
  const searchKeywords = [
    "저자",
    "작가",
    "작품 배경",
    "시대적 배경",
    "시대",
    "유명",
    "왜 유명",
    "외부",
    "검색",
    "평점",
    "줄거리",
    "책 정보",
    "소개",
    "출판",
    "수상",
    "문학사",
    "해설",
    "비교",
  ];

  return includesAny(normalizedQuestion, searchKeywords);
};

const needsLibraryReference = (question) => {
  const normalizedQuestion = question.replace(/\s+/g, " ").toLowerCase();
  const libraryKeywords = [
    "도서관",
    "정보나루",
    "대출",
    "인기",
    "이용",
    "독자",
    "연령",
    "성별",
    "통계",
    "키워드",
    "함께",
    "비슷한",
    "추천",
    "다음 책",
  ];

  return includesAny(normalizedQuestion, libraryKeywords);
};

const canUseLightModel = (question) => {
  const normalizedQuestion = question.replace(/\s+/g, " ").toLowerCase();
  const lightKeywords = [
    "한 문장",
    "짧게",
    "줄여",
    "sns",
    "키워드",
    "태그",
    "제목",
  ];

  return includesAny(normalizedQuestion, lightKeywords);
};

const getOpenAIErrorMessage = (status, data) => {
  const rawMessage = data?.error?.message;

  if (status === 401) {
    return "OpenAI API 키를 확인하지 못했습니다. OPENAI_API_KEY 값을 다시 확인해 주세요.";
  }

  if (status === 429) {
    return "OpenAI API 사용 한도 또는 결제 크레딧이 부족합니다. OpenAI 대시보드의 Billing/Usage 설정을 확인해 주세요.";
  }

  if (typeof rawMessage === "string" && rawMessage.trim()) {
    return rawMessage;
  }

  return "AI 응답을 생성하지 못했습니다.";
};

const buildPrompt = ({
  context,
  question,
  messages,
  externalResearch,
  libraryReference,
}) => `
너는 사용자의 완독 기록과 저장된 책 정보를 함께 읽어 회고를 돕는 AI다.

반드시 지켜야 할 규칙:
- 책 전문을 알고 있는 척하지 않는다.
- web search 도구가 제공된 경우에만 외부 정보를 사용할 수 있다.
- web search 도구가 제공되지 않은 경우 인터넷을 검색했다고 말하지 않는다.
- 외부 도서 참고 데이터가 제공된 경우에만 대출/이용/추천/서지 데이터를 사용할 수 있다.
- 제공된 완독 기록, 저장 문장, 독서 패턴, 티어 정보, 책 메타데이터, 책 컨텍스트에 저장된 외부 도서 참고 데이터, web search 결과만 근거로 답한다.
- 책 메타데이터의 contents/publisher/isbn은 "책 정보"로만 다루고, 책 전문이나 검증된 외부 검색 결과처럼 과장하지 않는다.
- 외부 도서 참고 데이터는 이용 경향, 추천, 서지 정보일 뿐, 작품 내용이나 사용자의 감상을 증명하는 근거처럼 과장하지 않는다.
- 답변 구조는 질문 의도에 맞게 고른다.
- 사용자가 내 기록, 저장 문장, 독서 패턴, 티어, 감상, 회고를 묻는 경우에만 "내 기록에서 본 점"을 포함한다.
- 사용자가 저자/작가 배경, 작품 배경, 출판, 수상, 외부 정보만 묻는 경우에는 "내 기록에서 본 점" 섹션을 만들지 않는다.
- 사용자가 외부 정보와 내 기록을 연결해 달라고 요청한 경우에만 "내 기록과 연결되는 지점"을 만든다.
- 한 문장 리뷰, 짧은 요약, 키워드 추출처럼 결과 형식이 중요한 요청은 섹션 제목 없이 바로 답한다.
- 질문 의도가 애매하면 질문의 중심 의도를 기준으로 답하고, 근거 없는 사용자 기록 연결을 억지로 만들지 않는다.
- 추론은 "추론" 또는 "가능성"이라고 표현한다.
- 사용자의 개인 상황, 감정, 가족/학교/직장 문제처럼 컨텍스트에 없는 사정은 invent하지 않는다.
- 외부 정보는 책과 저자 맥락을 설명하는 데만 쓰고, 사용자 기록과 연결할 때는 제공된 독서 기록과 저장 문장에만 연결한다.
- 근거가 부족하면 부족하다고 말한다.
- 답변은 한국어로 한다.
- answer는 900자 이내로 간결하게 쓴다.
- 사용자가 바로 읽기 좋은 자연스러운 문장으로 답한다.
- evidence에는 답변에 실제로 사용한 근거만 담는다.
- 외부 도서 참고 데이터를 사용했다면 evidence에 type "external"을 포함하고 label은 해당 출처명으로 쓴다.
- web search 결과를 사용했다면 evidence에 type "external"을 포함하고 출처 이름이나 URL을 detail에 적는다.
- followUpQuestions는 사용자가 AI에게 그대로 보내는 짧은 질문/명령문으로 만든다.
- followUpQuestions에 AI가 사용자에게 되묻는 문장이나 선택을 요청하는 문장을 넣지 않는다.
- 좋은 followUpQuestions 예: "내 독서 과정 3줄 정리", "끌린 주제 더 찾기", "한 문장 리뷰 만들기"
- 나쁜 followUpQuestions 예: "더 깊게 이야기하고 싶나요?", "다른 분위기의 작품도 괜찮으세요?"

완독 책 컨텍스트:
${JSON.stringify(context, null, 2)}

최근 대화:
${JSON.stringify(messages, null, 2)}

사용자 질문:
${question}

${
  libraryReference
    ? `외부 도서 참고 데이터:\n${JSON.stringify(libraryReference, null, 2)}`
    : "외부 도서 참고 데이터: 없음"
}

${
  externalResearch
    ? `web search로 수집한 외부 정보:\n${JSON.stringify(externalResearch, null, 2)}`
    : "web search로 수집한 외부 정보: 없음"
}
`;

const buildSearchInput = ({ context, question }) => {
  const book = context.book;
  const queryParts = [
    book.title,
    book.author,
    book.publisher,
    book.isbn,
    question,
  ].filter(Boolean);

  return `다음 책에 대해 신뢰할 만한 외부 정보를 검색해 한국어로 간결히 요약해줘.

책: ${book.title}
저자: ${book.author}
출판사: ${book.publisher ?? "미상"}
ISBN: ${book.isbn ?? "미상"}
사용자 질문: ${question}

검색 초점:
- 저자 배경
- 작품 배경
- 주요 주제
- 유사 도서나 독서모임에 도움이 되는 맥락

검색 키워드: ${queryParts.join(" ")}

출처를 확인할 수 있는 정보 중심으로 5문장 이내로 요약해줘.`;
};

const validateRequestBody = (body) => {
  if (!isObject(body)) {
    return "요청 형식이 올바르지 않습니다.";
  }

  if (!isObject(body.context)) {
    return "완독 책 컨텍스트가 없습니다.";
  }

  if (typeof body.question !== "string" || !body.question.trim()) {
    return "질문을 입력해 주세요.";
  }

  if (body.question.length > MAX_QUESTION_LENGTH) {
    return "질문은 600자 이하로 입력해 주세요.";
  }

  if (JSON.stringify(body.context).length > MAX_CONTEXT_LENGTH) {
    return "AI에게 보낼 완독 기록이 너무 많습니다.";
  }

  return null;
};

const appendExternalEvidence = (parsed, externalResearch) => {
  if (!Array.isArray(parsed?.evidence) || !externalResearch?.summary) {
    return parsed;
  }

  const hasExternalEvidence = parsed.evidence.some(
    (evidence) => evidence?.type === "external",
  );

  if (hasExternalEvidence) return parsed;

  const sourceText =
    externalResearch.sources.length > 0
      ? externalResearch.sources
          .map((source) => `${source.title} · ${source.url}`)
          .join("\n")
      : externalResearch.summary;

  return {
    ...parsed,
    evidence: [
      {
        type: "external",
        label: "외부 검색",
        detail: sourceText.slice(0, 600),
      },
      ...parsed.evidence,
    ].slice(0, 5),
  };
};

const appendLibraryEvidence = (parsed, libraryReference) => {
  if (!Array.isArray(parsed?.evidence) || !libraryReference?.summary) {
    return parsed;
  }

  const hasLibraryEvidence = parsed.evidence.some(
    (evidence) => evidence?.label === libraryReference.source,
  );

  if (hasLibraryEvidence) return parsed;

  return {
    ...parsed,
    evidence: [
      {
        type: "external",
        label: libraryReference.source,
        detail: libraryReference.summary.slice(0, 600),
      },
      ...parsed.evidence,
    ].slice(0, 5),
  };
};

const fallbackFollowUpQuestions = [
  "내 독서 과정 3줄 정리",
  "끌린 주제 더 찾기",
  "한 문장 리뷰 만들기",
];

const isAssistantQuestionToUser = (text) =>
  [
    "싶나요",
    "볼까요",
    "괜찮으세요",
    "원하나요",
    "궁금한가요",
    "궁금하세요",
    "해볼까요",
    "드릴까요",
    "하시겠어요",
    "아니면",
  ].some((ending) => text.includes(ending));

const normalizeFollowUpQuestions = (parsed) => {
  if (!Array.isArray(parsed?.followUpQuestions)) return parsed;

  const validQuestions = parsed.followUpQuestions
    .filter((question) => typeof question === "string" && question.trim())
    .map((question) => question.trim())
    .filter((question) => !isAssistantQuestionToUser(question));
  const followUpQuestions = [
    ...validQuestions,
    ...fallbackFollowUpQuestions.filter(
      (question) => !validQuestions.includes(question),
    ),
  ].slice(0, 3);

  return {
    ...parsed,
    followUpQuestions,
  };
};

const fetchExternalResearch = async ({ apiKey, model, context, question }) => {
  const openaiResponse = await fetch(OPENAI_RESPONSES_API_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      input: buildSearchInput({ context, question }),
      tools: [
        {
          type: "web_search",
          search_context_size: "low",
        },
      ],
      tool_choice: "required",
      max_output_tokens: 900,
    }),
  });

  const data = await openaiResponse.json();

  if (!openaiResponse.ok) {
    const error = new Error(getOpenAIErrorMessage(openaiResponse.status, data));
    error.status = openaiResponse.status;
    throw error;
  }

  return {
    summary: extractResponseOutputText(data),
    sources: collectWebSources(data),
  };
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

const collectData4LibraryWords = (value, key, results = []) => {
  if (results.length >= 8 || value === null || value === undefined) {
    return results;
  }

  if (Array.isArray(value)) {
    value.forEach((item) => collectData4LibraryWords(item, key, results));
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

    collectData4LibraryWords(entryValue, key, results);
  });

  return results;
};

const getRepresentativeBookTitle = (value) =>
  typeof value === "string" ? value.split(/[:：]/)[0]?.trim() ?? "" : "";

const normalizeBookTitle = (value) =>
  getRepresentativeBookTitle(value).replace(/\s+/g, "").toLowerCase();

const cleanBookAuthor = (value) =>
  typeof value === "string"
    ? value.replace(/^(지은이|저자|글|옮긴이|엮은이)\s*[:：]\s*/, "").trim()
    : "";

const buildLibraryReferenceSummary = ({
  usageAnalysis,
  recommendations,
  title,
}) => {
  const contents =
    usageAnalysis?.response?.book?.description ??
    usageAnalysis?.response?.book?.contents;
  const sourceTitle = normalizeBookTitle(
    title ?? usageAnalysis?.response?.book?.bookname,
  );
  const bookNames = collectData4LibraryWords(recommendations, "bookname");
  const authors = collectData4LibraryWords(recommendations, "authors");
  const seenTitles = new Set();
  const recommendedBooks = bookNames.reduce((books, bookName, index) => {
    const normalizedTitle = normalizeBookTitle(bookName);

    if (
      !normalizedTitle ||
      normalizedTitle === sourceTitle ||
      seenTitles.has(normalizedTitle) ||
      books.length >= 3
    ) {
      return books;
    }

    seenTitles.add(normalizedTitle);
    const representativeTitle = getRepresentativeBookTitle(bookName);
    const author = cleanBookAuthor(authors[index]);

    books.push(author ? `${representativeTitle}(${author})` : representativeTitle);
    return books;
  }, []);
  const parts = [];

  if (typeof contents === "string" && contents.trim()) {
    parts.push(contents.trim());
  }

  if (recommendedBooks.length > 0) {
    parts.push(`추천/함께 읽힌 책: ${recommendedBooks.join(", ")}`);
  }

  return parts.length > 0
    ? parts.join("\n")
    : "ISBN 기반 도서 이용분석 데이터를 참고했습니다.";
};

const compactLibraryPayload = (value) => JSON.stringify(value).slice(0, 6000);

const fetchLibraryReference = async ({ context, question }) => {
  const authKey =
    process.env.DATA4LIBRARY_AUTH_KEY ?? process.env.DATA4LIBRARY_API_KEY;
  const isbn = cleanIsbn(context.book?.isbn);

  if (!authKey || !isbn || !needsLibraryReference(question)) return null;

  try {
    const [usageAnalysis, recommendations] = await Promise.all([
      fetchData4LibraryJson({
        url: DATA4LIBRARY_USAGE_ANALYSIS_API_URL,
        authKey,
        isbn,
      }),
      fetchData4LibraryJson({
        url: DATA4LIBRARY_RECOMMENDATION_API_URL,
        authKey,
        isbn,
      }),
    ]);

    if (!usageAnalysis && !recommendations) return null;

    return {
      source: "도서관 정보나루",
      summary: buildLibraryReferenceSummary({
        usageAnalysis,
        recommendations,
        title: context.book?.title,
      }),
      usageAnalysis: compactLibraryPayload(usageAnalysis),
      recommendations: compactLibraryPayload(recommendations),
    };
  } catch {
    return null;
  }
};

export default async function handler(request, response) {
  if (request.method !== "POST") {
    sendJson(response, 405, { error: "Method not allowed" });
    return;
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    sendJson(response, 500, {
      error: "OPENAI_API_KEY가 서버 환경변수에 설정되어 있지 않습니다.",
    });
    return;
  }

  const validationError = validateRequestBody(request.body);
  if (validationError) {
    sendJson(response, 400, { error: validationError });
    return;
  }

  const context = request.body.context;
  const question = request.body.question.trim();
  const messages = getUserMessages(request.body.messages);
  const mainModel = process.env.OPENAI_BOOK_CHAT_MODEL ?? DEFAULT_MODEL;
  const lightModel =
    process.env.OPENAI_BOOK_CHAT_LIGHT_MODEL ?? DEFAULT_LIGHT_MODEL;
  const shouldUseWebSearch = needsExternalSearch(question);
  const shouldUseLibraryReference = needsLibraryReference(question);
  const model =
    !shouldUseWebSearch && !shouldUseLibraryReference && canUseLightModel(question)
      ? lightModel
      : mainModel;

  try {
    const [externalResearch, libraryReference] = await Promise.all([
      shouldUseWebSearch
        ? fetchExternalResearch({
            apiKey,
            model: mainModel,
            context,
            question,
          })
        : null,
      fetchLibraryReference({
        context,
        question,
      }),
    ]);

    const openaiResponse = await fetch(OPENAI_CHAT_COMPLETIONS_API_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        messages: [
          {
            role: "system",
            content: buildPrompt({
              context,
              question,
              messages,
              externalResearch,
              libraryReference,
            }),
          },
          {
            role: "user",
            content: question,
          },
        ],
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "book_chat_response",
            strict: true,
            schema: responseSchema,
          },
        },
        max_completion_tokens: 3200,
      }),
    });

    const data = await openaiResponse.json();

    if (!openaiResponse.ok) {
      sendJson(response, openaiResponse.status, {
        error: getOpenAIErrorMessage(openaiResponse.status, data),
      });
      return;
    }

    const outputText = extractOutputText(data);
    const parsed = normalizeFollowUpQuestions(JSON.parse(outputText));
    const withLibraryEvidence = appendLibraryEvidence(parsed, libraryReference);

    sendJson(
      response,
      200,
      externalResearch
        ? appendExternalEvidence(withLibraryEvidence, externalResearch)
        : withLibraryEvidence,
    );
  } catch (error) {
    sendJson(response, 500, {
      error:
        error instanceof SyntaxError
          ? "AI 응답 형식을 해석하지 못했습니다."
          : error?.message ?? "AI 응답을 생성하는 중 문제가 발생했습니다.",
    });
  }
}
