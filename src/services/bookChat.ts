import type {
  BookChatEvidence,
  BookChatMessage,
  BookChatResponse,
  CompletedBookChatContext,
} from "../types/bookChat";
import { formatDuration } from "../utils/formatDuration";

export type SendBookChatMessageInput = {
  context: CompletedBookChatContext;
  question: string;
  messages: BookChatMessage[];
};

const useMockBookChat = import.meta.env.VITE_BOOK_CHAT_USE_MOCK === "true";

const createId = () =>
  `book-chat-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

const wait = (ms: number) =>
  new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });

const getTopSentences = (context: CompletedBookChatContext) =>
  [...context.sentences]
    .sort((left, right) => right.text.length - left.text.length)
    .slice(0, 3);

const hasReadingRecords = (context: CompletedBookChatContext) =>
  context.reading.sessionCount > 0 && context.reading.totalSeconds > 0;

const hasSentences = (context: CompletedBookChatContext) =>
  context.sentences.length > 0;

const hasBookInfo = (context: CompletedBookChatContext) =>
  Boolean(
    context.book.contents?.trim() ||
      context.book.publisher?.trim() ||
      context.book.isbn?.trim(),
  );

const getBookInfoSummary = (context: CompletedBookChatContext) => {
  const contents = context.book.contents?.trim();
  const publisher = context.book.publisher?.trim();

  if (!contents && !publisher) {
    return "저장된 책 소개나 출판사 정보는 아직 없습니다.";
  }

  const publisherText = publisher ? `${publisher}에서 출간된 책이고, ` : "";
  const contentsText = contents
    ? `책 소개에는 '${contents.slice(0, 120)}${contents.length > 120 ? "..." : ""}'라는 정보가 남아 있어요.`
    : "책 소개글은 아직 저장되어 있지 않습니다.";

  return `${publisherText}${contentsText}`;
};

const formatReadingSummary = (context: CompletedBookChatContext) => {
  if (!hasReadingRecords(context)) {
    return "아직 세부 독서 시간 기록은 많지 않아요.";
  }

  const duration = formatDuration(context.reading.totalSeconds);
  const pages =
    context.reading.recordedPages > 0
      ? `, ${context.reading.recordedPages}p`
      : "";

  return `${context.reading.sessionCount}번의 기록으로 ${duration}${pages}가 남아 있어요.`;
};

const getSentenceSectionSummary = (context: CompletedBookChatContext) => {
  if (!hasSentences(context)) {
    return "아직 저장한 문장이 없어 문장 취향은 판단하기 어렵습니다.";
  }

  const counts = context.sentences.reduce(
    (current, sentence) => ({
      ...current,
      [sentence.section]: (current[sentence.section] ?? 0) + 1,
    }),
    {} as Record<string, number>,
  );
  const topSection = Object.entries(counts).sort(
    (left, right) => right[1] - left[1] || left[0].localeCompare(right[0]),
  )[0];

  return `${topSection[0]} 구간에 저장한 문장이 가장 많이 남아 있어요.`;
};

const getTierSummary = (context: CompletedBookChatContext) => {
  if (!context.book.tier) {
    return "아직 티어가 정해지지 않아 선호도는 단정하지 않겠습니다.";
  }

  return `${context.book.tier} 티어에 둔 책이라 좋은 인상으로 남았을 가능성이 있어요.`;
};

const getPatternSummary = (context: CompletedBookChatContext) => {
  if (!context.pattern) {
    return "패턴 분석에 쓸 기록은 아직 충분하지 않습니다.";
  }

  const pace =
    context.reading.pagesPerHour > 0 ? `${context.reading.pagesPerHour}p/h` : "";
  const timeBand =
    context.reading.topTimeBand !== "시간 미기록"
      ? `${context.reading.topTimeBand} 시간대`
      : "";
  const suffix = [timeBand, pace].filter(Boolean).join(", ");

  return suffix
    ? `${context.pattern.typeLabel}에 가깝고, ${suffix} 흐름이 보여요.`
    : `${context.pattern.typeLabel}에 가까운 흐름이 보여요.`;
};

const getBaseEvidence = (
  context: CompletedBookChatContext,
): BookChatEvidence[] => {
  const evidence: BookChatEvidence[] = [];

  if (hasReadingRecords(context)) {
    evidence.push({
      type: "record",
      label: "완독 기록",
      detail: `${context.reading.sessionCount}번의 기록, ${formatDuration(
        context.reading.totalSeconds,
      )}, ${context.reading.recordedPages}p`,
    });
  }

  if (context.pattern) {
    evidence.push({
      type: "pattern",
      label: context.pattern.typeLabel,
      detail: getPatternSummary(context),
    });
  }

  if (context.book.tier) {
    evidence.push({
      type: "tier",
      label: `${context.book.tier} TIER`,
      detail: "사용자가 직접 남긴 완독 책 선호 신호입니다.",
    });
  }

  if (hasBookInfo(context)) {
    evidence.push({
      type: "bookInfo",
      label: context.book.publisher
        ? `책 정보 · ${context.book.publisher}`
        : "책 정보",
      detail:
        context.book.contents?.trim() ||
        context.book.isbn ||
        "저장된 책 메타데이터입니다.",
    });
  }

  return evidence;
};

const buildQuoteEvidence = (
  context: CompletedBookChatContext,
): BookChatEvidence[] =>
  getTopSentences(context).map((sentence) => ({
    type: "quote",
    label: `${sentence.page}p · ${sentence.section}`,
    detail: sentence.text,
  }));

const includesAny = (source: string, keywords: string[]) =>
  keywords.some((keyword) => source.includes(keyword));

const isBookChatResponse = (value: unknown): value is BookChatResponse => {
  if (!value || typeof value !== "object") return false;

  const response = value as BookChatResponse;
  return (
    typeof response.answer === "string" &&
    Array.isArray(response.evidence) &&
    Array.isArray(response.followUpQuestions)
  );
};

const buildMockBookChatResponse = (
  context: CompletedBookChatContext,
  question: string,
): BookChatResponse => {
  const normalizedQuestion = question.replace(/\s+/g, " ").trim();
  const quoteEvidence = buildQuoteEvidence(context);
  const baseEvidence = getBaseEvidence(context);
  const evidence = [...quoteEvidence.slice(0, 2), ...baseEvidence].slice(0, 4);
  const sentenceSummary = getSentenceSectionSummary(context);
  const readingSummary = formatReadingSummary(context);
  const patternSummary = getPatternSummary(context);
  const bookInfoSummary = getBookInfoSummary(context);
  const keywordText = context.report?.keywords.length
    ? context.report.keywords.join(", ")
    : null;
  const tierSummary = getTierSummary(context);
  const evidenceIntro =
    evidence.length > 0
      ? "아래 근거를 기준으로 보면,"
      : "아직 근거가 많지는 않아서 조심스럽게 말하면,";

  if (includesAny(normalizedQuestion, ["독서모임", "토론", "말할", "질문"])) {
    return {
      answer: `내 기록에서 본 점\n${sentenceSummary} ${readingSummary}\n\n책 정보로 보강한 점\n${bookInfoSummary}\n\n종합 회고\n${context.book.title}을 독서모임에서 말한다면, 줄거리 요약보다 내가 어느 지점에서 멈췄고 어떤 리듬으로 읽었는지를 중심으로 잡는 편이 좋아요. ${tierSummary}\n\n이 답변은 책 전문 분석이 아니라, 앱에 저장된 기록과 책 정보를 바탕으로 만든 회고 초안입니다.`,
      evidence,
      followUpQuestions: [
        "의견 3개만 다시 만들기",
        "독서모임 질문 5개 만들기",
        "저장 문장 감정 뽑기",
      ],
    };
  }

  if (includesAny(normalizedQuestion, ["리뷰", "감상문", "한 문장"])) {
    const sentencePhrase = hasSentences(context)
      ? `${context.sentences.length}개의 저장 문장이 남아 있고, ${sentenceSummary}`
      : "저장 문장은 아직 없지만 완독 기록은 남아 있고,";
    return {
      answer: `내 기록에서 본 점\n${sentencePhrase} ${patternSummary}\n\n책 정보로 보강한 점\n${bookInfoSummary}\n\n종합 회고\n리뷰 초안은 이렇게 잡아볼 수 있어요.\n\n'${context.book.title}은 완독 후에도 읽은 흔적이 남아 있는 책이다. 저장된 책 정보가 책의 바깥 윤곽을 잡아준다면, 내 독서 기록은 이 책이 실제로 나에게 어떻게 남았는지를 보여준다.'`,
      evidence,
      followUpQuestions: [
        "더 감성적인 리뷰 만들기",
        "SNS 공유 문장 만들기",
        "저장 문장 더 반영하기",
      ],
    };
  }

  if (includesAny(normalizedQuestion, ["좋아한", "왜", "티어", "이유"])) {
    return {
      answer: `내 기록에서 본 점\n${evidenceIntro} 이 책을 좋게 기억했을 가능성은 '완독했다는 사실'보다 그 이후에 남은 신호에서 봐야 해요. ${sentenceSummary} ${patternSummary} ${tierSummary}\n\n책 정보로 보강한 점\n${bookInfoSummary}\n\n종합 회고\n좋아한 이유를 확정할 수는 없지만, 내 기록과 책 정보가 만나는 지점을 보면 어떤 분위기나 주제가 오래 남았는지 더 구체적으로 짚어볼 수 있습니다.`,
      evidence,
      followUpQuestions: [
        "좋았던 이유 더 정리하기",
        "아쉬웠을 점 추론하기",
        "다른 완독 책과 비교하기",
      ],
    };
  }

  if (includesAny(normalizedQuestion, ["다음", "추천", "읽을 책"])) {
    const comparedBooks = context.comparison
      .filter((book) => book.tier === "S" || book.tier === "A")
      .slice(0, 2);
    const comparisonText =
      comparedBooks.length > 0
        ? ` 특히 ${comparedBooks.map((book) => book.title).join(", ")}처럼 높은 티어에 둔 책과 함께 보면 선호 흐름을 더 분명히 잡을 수 있어요.`
        : "";
    const recommendationBasis = keywordText
      ? `'${keywordText}' 같은 키워드가 다시 걸리는 방향`
      : hasSentences(context)
        ? "저장한 문장에서 반복되는 감정이나 소재가 이어지는 방향"
        : "완독까지 이어갈 수 있는 분량과 리듬이 비슷한 방향";

    return {
      answer: `내 기록에서 본 점\n${context.book.title}의 기록에서는 ${sentenceSummary} ${patternSummary}${comparisonText}\n\n책 정보로 보강한 점\n${bookInfoSummary}\n\n종합 회고\n다음 책은 ${recommendationBasis}으로 고르는 게 좋아 보여요. 아직 외부 검색까지는 하지 않으므로, 정확한 도서명 추천보다는 선택 방향을 잡는 데 초점을 둔 답변입니다.`,
      evidence: [
        ...evidence,
        ...comparedBooks.map<BookChatEvidence>((book) => ({
          type: "comparison",
          label: book.tier ? `${book.tier} TIER · ${book.title}` : book.title,
          detail: `${book.sentenceCount}개의 문장이 남아 있는 완독 책입니다.`,
        })),
      ].slice(0, 5),
      followUpQuestions: [
        "내 취향 키워드 정리",
        "완독 책 공통점 찾기",
        "다음 책 선택 기준 3개",
      ],
    };
  }

  return {
    answer: `내 기록에서 본 점\n${readingSummary} ${sentenceSummary} ${patternSummary} ${tierSummary}\n\n책 정보로 보강한 점\n${bookInfoSummary}\n\n종합 회고\n이 답변은 책 자체를 아는 척하는 답변이 아니라, 앱에 남은 완독 기록과 저장된 책 정보를 함께 읽어낸 회고 초안입니다. 다음 단계에서 외부 검색을 붙이면 저자 배경이나 유사 도서까지 더 확장할 수 있어요.`,
    evidence,
    followUpQuestions: [
      "끌린 주제 찾기",
      "한 문장 리뷰 만들기",
      "독서모임 의견 3개",
    ],
  };
};

export const sendBookChatMessage = async ({
  context,
  question,
  messages,
}: SendBookChatMessageInput): Promise<BookChatResponse> => {
  if (useMockBookChat) {
    await wait(450);

    return buildMockBookChatResponse(context, question);
  }

  const response = await fetch("/api/book-chat", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      context,
      question,
      messages,
    }),
  });
  const text = await response.text();
  let data: unknown;

  try {
    data = JSON.parse(text);
  } catch {
    throw new Error(
      import.meta.env.DEV
        ? "AI API가 JSON이 아닌 응답을 반환했습니다. 로컬에서는 `vercel dev`로 실행하거나 `.env.local`에 `VITE_BOOK_CHAT_USE_MOCK=true`를 설정해 주세요."
        : "AI API 응답 형식이 올바르지 않습니다.",
    );
  }

  if (!response.ok) {
    const error =
      data && typeof data === "object" && "error" in data
        ? String((data as { error?: unknown }).error)
        : "AI 응답을 생성하지 못했습니다.";

    throw new Error(error);
  }

  if (!isBookChatResponse(data)) {
    throw new Error("AI 응답 구조가 올바르지 않습니다.");
  }

  return data;
};

export const sendMockBookChatMessage = async ({
  context,
  question,
}: SendBookChatMessageInput): Promise<BookChatResponse> => {
  await wait(450);

  return buildMockBookChatResponse(context, question);
};

export const createBookChatMessage = ({
  role,
  content,
  evidence,
  followUpQuestions,
}: Omit<BookChatMessage, "id" | "createdAt">): BookChatMessage => ({
  id: createId(),
  role,
  content,
  evidence,
  followUpQuestions,
  createdAt: new Date().toISOString(),
});
