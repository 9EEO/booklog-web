import type { CompletedReadingReport } from "./completedReadingReport";
import type { ReadingPattern } from "./readingPattern";
import type { CompletedBookChatContext } from "../types/bookChat";
import type { Book, ReadingRecord } from "../types/reading";
import type { TierBoard, TierKey } from "../types/tier";

const getBookTier = (tierBoard: TierBoard, bookId: string) =>
  (Object.entries(tierBoard) as Array<[TierKey, string[]]>).find(([, bookIds]) =>
    bookIds.includes(bookId),
  )?.[0] ?? null;

const getDaysBetween = (start: string, end: string | undefined) => {
  if (!start || !end) return null;

  const [startYear, startMonth, startDay] = start.split(".").map(Number);
  const [endYear, endMonth, endDay] = end.split(".").map(Number);
  const startDate = new Date(startYear, startMonth - 1, startDay);
  const endDate = new Date(endYear, endMonth - 1, endDay);

  if (
    !Number.isFinite(startDate.getTime()) ||
    !Number.isFinite(endDate.getTime())
  ) {
    return null;
  }

  return Math.max(
    Math.floor((endDate.getTime() - startDate.getTime()) / 86400000) + 1,
    1,
  );
};

const getSentenceSection = (
  page: number,
  totalPages: number | null,
): "초반" | "중반" | "후반" | "전체" => {
  if (!totalPages) return "전체";

  const progress = page / totalPages;
  if (progress < 0.34) return "초반";
  if (progress < 0.67) return "중반";
  return "후반";
};

const getRecordedPages = (records: ReadingRecord[]) =>
  records.reduce(
    (sum, record) => sum + Math.max(record.endPage - record.startPage, 0),
    0,
  );

export const buildCompletedBookChatContext = ({
  book,
  records,
  report,
  pattern,
  tierBoard,
  completedBooks,
}: {
  book: Book;
  records: ReadingRecord[];
  report: CompletedReadingReport | null;
  pattern: ReadingPattern | null;
  tierBoard: TierBoard;
  completedBooks: Book[];
}): CompletedBookChatContext => {
  const totalSeconds = records.reduce(
    (sum, record) => sum + record.durationSeconds,
    0,
  );
  const recordedPages = getRecordedPages(records);
  const tier = getBookTier(tierBoard, book.id);

  return {
    book: {
      id: book.id,
      title: book.title,
      author: book.author,
      publisher: book.publisher,
      isbn: book.isbn,
      contents: book.contents,
      totalPages: book.totalPages,
      startedAt: book.startedAt,
      completedAt: book.completedAt,
      tier,
    },
    reading: {
      totalSeconds,
      recordedPages,
      sessionCount: records.length,
      completedDays: getDaysBetween(book.startedAt, book.completedAt),
      averageSessionSeconds: pattern?.averageSessionSeconds ?? 0,
      pagesPerHour: pattern?.pagesPerHour ?? 0,
      topWeekday: pattern?.topWeekday ?? "기록 전",
      topTimeBand: pattern?.topTimeBand ?? "시간 미기록",
    },
    sentences: book.sentences.map((sentence) => ({
      id: sentence.id,
      text: sentence.text,
      page: sentence.page,
      recordedAt: sentence.recordedAt,
      section: getSentenceSection(sentence.page, book.totalPages),
    })),
    report: report
      ? {
          leadTitle: report.leadTitle,
          leadDescription: report.leadDescription,
          focusInsight: report.focusInsight,
          rhythmInsight: report.rhythmInsight,
          graphInsight: report.graphInsight,
          journeySummary: report.journeySummary,
          keywords: report.reflection.keywords,
        }
      : null,
    pattern: pattern
      ? {
          typeLabel: pattern.typeLabel,
          summary: pattern.summary,
          sentenceDensity: pattern.sentenceDensity,
          sentencePeak: pattern.sentencePeak,
        }
      : null,
    comparison: completedBooks
      .filter((completedBook) => completedBook.id !== book.id)
      .slice(0, 8)
      .map((completedBook) => ({
        id: completedBook.id,
        title: completedBook.title,
        author: completedBook.author,
        tier: getBookTier(tierBoard, completedBook.id),
        sentenceCount: completedBook.sentences.length,
        completedAt: completedBook.completedAt,
      })),
  };
};
