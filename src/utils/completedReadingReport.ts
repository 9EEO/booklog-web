import type { IconName } from "../components/Icon";
import type { Book, Highlight, ReadingRecord } from "../types/reading";

export type CompletedReportItem = {
  icon: IconName;
  label: string;
  value: string;
};

export type CompletedReportPattern = {
  icon: IconName;
  title: string;
  description: string;
};

export type CompletedReportInsight = {
  icon: IconName;
  label: string;
  value: string;
  description: string;
};

export type CompletedReportReflection = {
  body: string[];
  keywords: string[];
};

export type CompletedReadingReport = {
  totalPages: number | null;
  totalSeconds: number;
  completedDays: number | null;
  summaryText: string;
  leadTitle: string;
  leadDescription: string;
  primaryMetric: CompletedReportItem;
  summaryItems: CompletedReportItem[];
  insights: CompletedReportInsight[];
  focusInsight: string;
  rhythmInsight: string;
  graphInsight: string;
  journeySummary: string;
  journeyChips: string[];
  extraJourneyCount: number;
  patterns: CompletedReportPattern[];
  featuredSentences: Highlight[];
  reflection: CompletedReportReflection;
};

const stopWords = new Set([
  "그리고",
  "그러나",
  "하지만",
  "나는",
  "내가",
  "것은",
  "것이",
  "것을",
  "있는",
  "없는",
  "했다",
  "한다",
  "정말",
  "다시",
]);

const parseDateLabel = (value: string | undefined) => {
  if (!value) return null;

  const [year, month, day] = value.split(".").map(Number);
  const date = new Date(year, month - 1, day);

  if (
    !Number.isFinite(date.getTime()) ||
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return null;
  }

  return date;
};

const formatShortDate = (value: string) => {
  const [, month, day] = value.split(".");
  return month && day ? `${month}.${day}` : value;
};

const formatSecondsAsClock = (seconds: number) => {
  const safeSeconds = Math.max(Math.round(seconds), 0);
  const hours = Math.floor(safeSeconds / 3600);
  const minutes = Math.floor((safeSeconds % 3600) / 60);
  const restSeconds = safeSeconds % 60;

  return [hours, minutes, restSeconds]
    .map((value) => String(value).padStart(2, "0"))
    .join(":");
};

const getDaysBetween = (start: string | undefined, end: string | undefined) => {
  const startDate = parseDateLabel(start);
  const endDate = parseDateLabel(end);
  if (!startDate || !endDate) return null;

  return Math.max(
    Math.floor((endDate.getTime() - startDate.getTime()) / 86400000) + 1,
    1,
  );
};

const getRecordPages = (record: ReadingRecord) =>
  Math.max(record.endPage - record.startPage, 0);

const groupRecordsByDate = (records: ReadingRecord[]) => {
  const groups = new Map<
    string,
    { date: string; seconds: number; pages: number; count: number }
  >();

  records.forEach((record) => {
    const current = groups.get(record.date) ?? {
      date: record.date,
      seconds: 0,
      pages: 0,
      count: 0,
    };

    current.seconds += record.durationSeconds;
    current.pages += getRecordPages(record);
    current.count += 1;
    groups.set(record.date, current);
  });

  return [...groups.values()].sort((left, right) =>
    left.date.localeCompare(right.date),
  );
};

const getTopDate = (
  groups: ReturnType<typeof groupRecordsByDate>,
  key: "seconds" | "pages",
) =>
  groups.length
    ? [...groups].sort(
        (left, right) =>
          right[key] - left[key] || left.date.localeCompare(right.date),
      )[0]
    : null;

const getTimeBand = (isoDate: string | undefined) => {
  if (!isoDate) return null;

  const date = new Date(isoDate);
  if (!Number.isFinite(date.getTime())) return null;

  const hour = date.getHours();
  if (hour < 6) return "새벽";
  if (hour < 12) return "오전";
  if (hour < 18) return "오후";
  return "밤";
};

const getDominantTimeBand = (records: ReadingRecord[]) => {
  const bands = new Map<string, number>();
  let totalSeconds = 0;

  records.forEach((record) => {
    const band = getTimeBand(record.startedAt);
    if (!band) return;

    bands.set(band, (bands.get(band) ?? 0) + record.durationSeconds);
    totalSeconds += record.durationSeconds;
  });

  const top = [...bands.entries()].sort((left, right) => right[1] - left[1])[0];
  if (!top || totalSeconds <= 0) return null;

  return {
    label: top[0],
    percent: Math.round((top[1] / totalSeconds) * 100),
  };
};

const getSentencePeak = (book: Book) => {
  if (book.sentences.length === 0) return null;
  if (!book.totalPages) return "전체 구간";

  const buckets = { 초반: 0, 중반: 0, 후반: 0 };

  book.sentences.forEach((sentence) => {
    const progress = sentence.page / book.totalPages!;
    if (progress < 0.34) buckets.초반 += 1;
    else if (progress < 0.67) buckets.중반 += 1;
    else buckets.후반 += 1;
  });

  return Object.entries(buckets).sort(
    (left, right) => right[1] - left[1] || left[0].localeCompare(right[0]),
  )[0][0];
};

const getKeywords = (sentences: Highlight[]) => {
  const counts = new Map<string, number>();

  sentences
    .flatMap((sentence) =>
      sentence.text
        .replace(/[^\p{L}\p{N}\s]/gu, " ")
        .split(/\s+/)
        .map((word) => word.trim())
        .filter((word) => word.length > 1 && !stopWords.has(word)),
    )
    .forEach((word) => counts.set(word, (counts.get(word) ?? 0) + 1));

  return [...counts.entries()]
    .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
    .slice(0, 4)
    .map(([word]) => word);
};

const getAverageReadingGapDays = (
  groups: ReturnType<typeof groupRecordsByDate>,
) => {
  if (groups.length <= 1) return null;

  const gaps: number[] = [];
  for (let index = 1; index < groups.length; index += 1) {
    const previous = parseDateLabel(groups[index - 1].date);
    const current = parseDateLabel(groups[index].date);
    if (!previous || !current) continue;

    gaps.push(
      Math.max(
        Math.floor((current.getTime() - previous.getTime()) / 86400000),
        0,
      ),
    );
  }

  if (gaps.length === 0) return null;

  return Math.round(gaps.reduce((sum, gap) => sum + gap, 0) / gaps.length);
};

const getRhythmInsight = (
  records: ReadingRecord[],
  dateGroups: ReturnType<typeof groupRecordsByDate>,
  averageSessionSeconds: number,
) => {
  if (records.length <= 1) {
    return "처음부터 끝까지 한 흐름으로 읽었어요.";
  }

  const averageSessionMinutes = Math.round(averageSessionSeconds / 60);
  if (averageSessionMinutes >= 5) {
    return `한 번 읽을 때 평균 ${averageSessionMinutes}분씩 집중했어요.`;
  }

  const averageGapDays = getAverageReadingGapDays(dateGroups);
  if (averageGapDays !== null && averageGapDays >= 1) {
    return `읽은 날 사이를 평균 ${averageGapDays}일 간격으로 이어갔어요.`;
  }

  return "짧은 회차를 이어 붙이며 완독까지 갔어요.";
};

const getLeadTitle = (
  completedDays: number | null,
  records: ReadingRecord[],
  averageSessionSeconds: number,
) => {
  if (records.length <= 1) return "한 번의 흐름으로 끝까지 읽은 책";
  if (completedDays && completedDays <= 7) return "짧은 기간에 집중해서 읽은 책";
  if (averageSessionSeconds >= 30 * 60) return "한 번 앉으면 깊게 들어간 책";
  if (records.length >= 5) return "여러 번의 작은 리듬으로 완성한 책";
  return "천천히 완독까지 이어진 책";
};

export const buildCompletedReadingReport = (
  book: Book,
  records: ReadingRecord[],
): CompletedReadingReport => {
  const dateGroups = groupRecordsByDate(records);
  const totalSecondsFromRecords = records.reduce(
    (sum, record) => sum + record.durationSeconds,
    0,
  );
  const totalSeconds = totalSecondsFromRecords || book.accumulatedSeconds;
  const totalReadPages = records.reduce(
    (sum, record) => sum + getRecordPages(record),
    0,
  );
  const fallbackTotalPages = Math.max(book.currentPage, totalReadPages, 0);
  const totalPages = book.totalPages ?? (fallbackTotalPages || null);
  const completedDays =
    getDaysBetween(book.startedAt, book.completedAt) ??
    (dateGroups.length > 0
      ? getDaysBetween(dateGroups[0].date, dateGroups.at(-1)?.date)
      : null);
  const averagePagesPerHour =
    totalSeconds > 0 ? Math.round(((totalReadPages || totalPages || 0) / totalSeconds) * 3600) : 0;
  const longestDay = getTopDate(dateGroups, "seconds");
  const mostPagesDay = getTopDate(dateGroups, "pages");
  const dominantTime = getDominantTimeBand(records);
  const averageSessionSeconds = records.length
    ? Math.round(totalSeconds / records.length)
    : 0;
  const sentencePeak = getSentencePeak(book);
  const lastRecord = [...records].sort(
    (left, right) =>
      left.date.localeCompare(right.date) ||
      (left.startedAt ?? "").localeCompare(right.startedAt ?? "") ||
      left.id.localeCompare(right.id),
  ).at(-1);
  const lastRecordPages = lastRecord ? getRecordPages(lastRecord) : 0;
  const lastRecordPercent =
    totalReadPages > 0 ? Math.round((lastRecordPages / totalReadPages) * 100) : 0;
  const keywords = getKeywords(book.sentences);
  const journeyChips = [...records]
    .sort(
      (left, right) =>
        left.date.localeCompare(right.date) ||
        (left.startedAt ?? "").localeCompare(right.startedAt ?? "") ||
        left.id.localeCompare(right.id),
    )
    .slice(0, 3)
    .map(
      (record, index) =>
        `${index + 1}회차 ${formatShortDate(record.date)} · ${getRecordPages(record)}p`,
    );

  const patterns: CompletedReportPattern[] = [];
  if (dominantTime) {
    patterns.push({
      icon: "clock",
      title: dominantTime.label === "밤" || dominantTime.label === "새벽" ? "야행성 독서가" : `${dominantTime.label} 독서가`,
      description: `독서 시간의 ${dominantTime.percent}%가 ${dominantTime.label}에 이루어졌어요.`,
    });
  }
  if (averageSessionSeconds >= 20 * 60) {
    patterns.push({
      icon: "timer",
      title: "집중형 독서",
      description: "평균 20분 이상 연속 독서를 유지했어요.",
    });
  }
  if (records.length >= 2 && mostPagesDay) {
    patterns.push({
      icon: "leaf",
      title: "가속형 독서",
      description: `${formatShortDate(mostPagesDay.date)}에 가장 많은 페이지를 읽었어요.`,
    });
  }
  if (book.sentences.length > 0) {
    patterns.push({
      icon: "quote",
      title: "문장 수집가",
      description: "마음에 남은 문장을 기록했어요.",
    });
  }

  const leadTitle = getLeadTitle(
    completedDays,
    records,
    averageSessionSeconds,
  );
  const leadDescription =
    records.length <= 1
      ? "긴 관리표보다, 이 책은 하나의 집중된 독서 경험으로 남아 있습니다."
      : `${records.length}번의 독서 기록이 모여 한 권의 완독 리듬을 만들었어요.`;
  const insights: CompletedReportInsight[] = [
    {
      icon: "calendar",
      label: "완독 리듬",
      value: completedDays ? `${completedDays}일` : `${records.length || 1}회`,
      description:
        records.length <= 1
          ? "한 번의 집중 독서로 완독까지 도착했어요."
          : `${records.length}번에 나누어 끝까지 읽었습니다.`,
    },
    {
      icon: "book",
      label: "몰입 피크",
      value: mostPagesDay
        ? `${formatShortDate(mostPagesDay.date)}`
        : totalPages
          ? `${totalPages}p`
          : "-",
      description: mostPagesDay
        ? `이날 ${mostPagesDay.pages}p를 읽으며 가장 많이 앞으로 나아갔어요.`
        : "페이지 기록이 더 쌓이면 가장 몰입한 날을 보여드려요.",
    },
    {
      icon: "timer",
      label: "속도감",
      value: averagePagesPerHour ? `${averagePagesPerHour}p/h` : "-",
      description: longestDay
        ? `${formatShortDate(longestDay.date)}에는 ${Math.round(longestDay.seconds / 60)}분 동안 가장 오래 머물렀어요.`
        : "독서 시간이 쌓이면 평균 속도와 몰입 시간을 비교해드려요.",
    },
    {
      icon: "clock",
      label: "읽는 시간",
      value: dominantTime?.label ?? "기록 전",
      description: dominantTime
        ? `전체 독서 시간의 ${dominantTime.percent}%가 ${dominantTime.label}에 모여 있어요.`
        : "시작 시간이 기록되면 선호 시간대를 볼 수 있어요.",
    },
    {
      icon: "quote",
      label: "문장 반응",
      value: `${book.sentences.length}개`,
      description: sentencePeak
        ? `${sentencePeak} 구간에서 문장을 가장 많이 붙잡았습니다.`
        : "아직 기록한 문장은 없지만, 완독 흐름은 남아 있어요.",
    },
  ];
  const reflection: CompletedReportReflection =
    book.sentences.length > 0
      ? {
          body: [
            `이번 독서에서 당신은 ${keywords.slice(0, 2).join(", ") || "기록한 문장"}에 가까운 문장에 오래 머물렀어요.`,
            "이 책은 이야기의 흐름만큼이나, 읽는 동안 떠오른 생각의 방향을 남긴 책에 가까워 보여요.",
          ],
          keywords: keywords.length > 0 ? keywords : ["문장", "기록"],
        }
      : {
          body: [
            "이번 완독에는 아직 남겨둔 문장이 없어요.",
            "다음에 다시 펼친다면, 오래 멈추게 되는 한 문장을 책갈피처럼 남겨보세요.",
          ],
          keywords: ["완독", "기록"],
        };
  return {
    totalPages,
    totalSeconds,
    completedDays,
    summaryText: completedDays
      ? `${completedDays}일 동안 완독했어요.`
      : "이 책을 끝까지 읽었어요.",
    leadTitle,
    leadDescription,
    primaryMetric: {
      icon: "calendar",
      label: "완독까지",
      value: completedDays ? `${completedDays}일` : `${records.length || 1}회`,
    },
    summaryItems: [
      { icon: "book", label: "페이지", value: totalPages ? `${totalPages}p` : "-" },
      { icon: "clock", label: "총 독서 시간", value: formatSecondsAsClock(totalSeconds) },
      { icon: "records", label: "기록", value: `${records.length}회` },
      { icon: "quote", label: "문장", value: `${book.sentences.length}개` },
    ],
    insights,
    focusInsight: mostPagesDay
      ? `${formatShortDate(mostPagesDay.date)}에 가장 깊게 몰입했어요. 이날 ${mostPagesDay.pages}p를 넘겼습니다.`
      : "독서 기록이 더 쌓이면 가장 몰입한 날을 보여드려요.",
    rhythmInsight: getRhythmInsight(
      records,
      dateGroups,
      averageSessionSeconds,
    ),
    graphInsight:
      lastRecord && lastRecordPercent > 0
        ? `마지막 기록에서 전체 독서량의 ${lastRecordPercent}%를 읽었어요.`
        : "한 번의 집중 독서로 완독까지 도착했어요.",
    journeySummary:
      records.length <= 1
        ? "한 번의 집중 독서로 완독했어요."
        : `${records.length}번에 나누어 읽었고, ${mostPagesDay ? `${formatShortDate(mostPagesDay.date)}에 가장 많이 읽었어요.` : "천천히 완독까지 이어졌어요."}`,
    journeyChips,
    extraJourneyCount: Math.max(records.length - journeyChips.length, 0),
    patterns: patterns.slice(0, 3),
    featuredSentences: [...book.sentences]
      .sort((left, right) => left.page - right.page)
      .slice(0, 2),
    reflection,
  };
};
