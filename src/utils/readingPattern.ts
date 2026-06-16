import type { Book, ReadingRecord } from "../types/reading";

export type ReadingPattern = {
  typeLabel: string;
  summary: string;
  sessionCount: number;
  averageSessionSeconds: number;
  pagesPerHour: number;
  topWeekday: string;
  topTimeBand: string;
  sentenceDensity: number;
  sentencePeak: string;
};

const weekdayLabels = ["일", "월", "화", "수", "목", "금", "토"];

const parseDateLabel = (value: string) => {
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

const getTopLabel = (labels: string[], fallback: string) => {
  if (labels.length === 0) return fallback;

  const counts = new Map<string, number>();
  labels.forEach((label) => counts.set(label, (counts.get(label) ?? 0) + 1));

  return [...counts.entries()].sort(
    (left, right) => right[1] - left[1] || left[0].localeCompare(right[0]),
  )[0][0];
};

const getTimeBand = (isoDate: string | undefined): string | null => {
  if (!isoDate) return null;

  const date = new Date(isoDate);
  if (!Number.isFinite(date.getTime())) return null;

  const hour = date.getHours();
  if (hour < 6) return "새벽";
  if (hour < 12) return "오전";
  if (hour < 18) return "오후";
  return "밤";
};

const getSentencePeak = (book: Book) => {
  if (book.sentences.length === 0) return "기록 전";
  if (!book.totalPages) return `${book.sentences.length}개`;

  const buckets = { 초반: 0, 중반: 0, 후반: 0 };
  book.sentences.forEach((sentence) => {
    const progress = sentence.page / book.totalPages!;
    if (progress < 0.34) buckets.초반 += 1;
    else if (progress < 0.67) buckets.중반 += 1;
    else buckets.후반 += 1;
  });

  return getTopLabel(
    Object.entries(buckets).flatMap(([label, count]) =>
      Array.from({ length: count }, () => label),
    ),
    "기록 전",
  );
};

export const buildReadingPattern = (
  book: Book,
  records: ReadingRecord[],
): ReadingPattern | null => {
  if (records.length === 0) return null;

  const totalSeconds = records.reduce(
    (sum, record) => sum + record.durationSeconds,
    0,
  );
  const totalPages = records.reduce(
    (sum, record) => sum + Math.max(record.endPage - record.startPage, 0),
    0,
  );
  const averageSessionSeconds = Math.round(totalSeconds / records.length);
  const pagesPerHour =
    totalSeconds > 0 ? Math.round((totalPages / totalSeconds) * 3600) : 0;
  const topWeekday = getTopLabel(
    records
      .map((record) => parseDateLabel(record.date))
      .filter((date): date is Date => Boolean(date))
      .map((date) => `${weekdayLabels[date.getDay()]}요일`),
    "기록 전",
  );
  const topTimeBand = getTopLabel(
    records
      .map((record) => getTimeBand(record.startedAt))
      .filter((label): label is string => Boolean(label)),
    "시간 미기록",
  );
  const sentenceDensity =
    totalPages > 0 ? Math.round((book.sentences.length / totalPages) * 10) : 0;
  const typeLabel =
    averageSessionSeconds < 15 * 60 && records.length >= 4
      ? "짧게 자주 읽는 타입"
      : averageSessionSeconds >= 45 * 60
        ? "한 번 잡으면 오래 몰입하는 타입"
        : pagesPerHour >= 40
          ? "속도감 있게 읽는 타입"
          : book.sentences.length >= Math.max(3, Math.ceil(records.length / 2))
            ? "문장을 많이 붙잡는 타입"
            : "꾸준히 쌓아가는 타입";

  return {
    typeLabel,
    summary: `총 ${records.length}번의 기록에서 ${totalPages}p를 읽었습니다.`,
    sessionCount: records.length,
    averageSessionSeconds,
    pagesPerHour,
    topWeekday,
    topTimeBand,
    sentenceDensity,
    sentencePeak: getSentencePeak(book),
  };
};
