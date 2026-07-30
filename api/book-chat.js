const OPENAI_CHAT_COMPLETIONS_API_URL =
  "https://api.openai.com/v1/chat/completions";
const OPENAI_RESPONSES_API_URL = "https://api.openai.com/v1/responses";
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
    "배경",
    "시대",
    "유명",
    "왜 유명",
    "비슷한",
    "추천",
    "외부",
    "검색",
    "평점",
    "작품",
    "줄거리",
    "책 정보",
    "소개",
    "독서모임",
    "토론",
    "출판",
    "수상",
    "문학사",
    "해설",
    "비교",
  ];

  return includesAny(normalizedQuestion, searchKeywords);
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

const buildPrompt = ({ context, question, messages, externalResearch }) => `
너는 사용자의 완독 기록과 저장된 책 정보를 함께 읽어 회고를 돕는 AI다.

반드시 지켜야 할 규칙:
- 책 전문을 알고 있는 척하지 않는다.
- web search 도구가 제공된 경우에만 외부 정보를 사용할 수 있다.
- web search 도구가 제공되지 않은 경우 인터넷을 검색했다고 말하지 않는다.
- 제공된 완독 기록, 저장 문장, 독서 패턴, 티어 정보, 책 메타데이터, web search 결과만 근거로 답한다.
- 책 메타데이터의 contents/publisher/isbn은 "책 정보"로만 다루고, 책 전문이나 검증된 외부 검색 결과처럼 과장하지 않는다.
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
- web search 결과를 사용했다면 evidence에 type "external"을 포함하고 출처 이름이나 URL을 detail에 적는다.
- followUpQuestions는 사용자가 이어서 누르기 좋은 짧은 질문으로 만든다.

완독 책 컨텍스트:
${JSON.stringify(context, null, 2)}

최근 대화:
${JSON.stringify(messages, null, 2)}

사용자 질문:
${question}

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
  const model =
    !shouldUseWebSearch && canUseLightModel(question) ? lightModel : mainModel;

  try {
    const externalResearch = shouldUseWebSearch
      ? await fetchExternalResearch({
          apiKey,
          model: mainModel,
          context,
          question,
        })
      : null;

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
    const parsed = JSON.parse(outputText);

    sendJson(
      response,
      200,
      externalResearch
        ? appendExternalEvidence(parsed, externalResearch)
        : parsed,
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
