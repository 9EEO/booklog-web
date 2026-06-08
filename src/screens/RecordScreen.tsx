import { useMemo, useState, type FormEvent } from "react";
import { BottomSheetModal } from "../components/BottomSheetModal";
import { Icon } from "../components/Icon";
import { SwipeSegmentedControl } from "../components/SwipeSegmentedControl";
import { useBackNavigationLayer } from "../hooks/useBackNavigationLayer";
import type {
  Book,
  ReadingRecord,
  ReadingRecordUpdateInput,
} from "../types/reading";
import { parsePageInput } from "../utils/pageInput";

type RecordScreenProps = {
  books: Book[];
  records: ReadingRecord[];
  onUpdateRecord: (
    recordId: string,
    input: ReadingRecordUpdateInput,
  ) => Promise<void>;
  onDeleteRecord: (recordId: string) => Promise<void>;
};

type RecordView = "records" | "sentences" | "calendar";
type SentenceSort = "recent" | "page";
type RecordSentenceFilter = "all" | "withSentence";

const recordViewOptions: Array<{ value: RecordView; label: string }> = [
  { value: "calendar", label: "캘린더" },
  { value: "records", label: "기록" },
  { value: "sentences", label: "문장" },
];

type SentenceItem = {
  id: string;
  text: string;
  page: number;
  recordedAt: string;
  bookId: string;
  bookTitle: string;
};

type CalendarBookPreview = Pick<
  Book,
  "id" | "title" | "thumbnail" | "coverColor" | "accentColor"
>;

type RecordEditDraft = {
  startPage: number;
  endPage: number;
  durationMinutes: number;
  sentence: string;
  sentencePage: number;
};

type RecordBookGroup = {
  bookId: string;
  bookTitle: string;
  durationSeconds: number;
  pages: number;
  records: ReadingRecord[];
};

const weekdayLabels = ["일", "월", "화", "수", "목", "금", "토"];

const pad2 = (value: number) => value.toString().padStart(2, "0");

const formatDateLabel = (date: Date) =>
  `${date.getFullYear()}.${pad2(date.getMonth() + 1)}.${pad2(date.getDate())}`;

const parseDateLabel = (dateLabel: string) => {
  const [year, month, day] = dateLabel.split(".").map(Number);
  const date = new Date(year, month - 1, day);

  return Number.isFinite(date.getTime()) ? date : null;
};

const createMonthCursor = (date: Date) =>
  new Date(date.getFullYear(), date.getMonth(), 1);

const isSameMonth = (date: Date, monthCursor: Date) =>
  date.getFullYear() === monthCursor.getFullYear() &&
  date.getMonth() === monthCursor.getMonth();

const formatMonthTitle = (date: Date) =>
  `${date.getFullYear()}년 ${date.getMonth() + 1}월`;

const formatCompactDuration = (seconds: number) => {
  if (seconds <= 0) return "0분";

  const minutes = Math.max(Math.round(seconds / 60), 1);
  const hours = Math.floor(minutes / 60);
  const remainMinutes = minutes % 60;

  if (hours === 0) return `${minutes}분`;
  if (remainMinutes === 0) return `${hours}시간`;

  return `${hours}시간 ${remainMinutes}분`;
};

const formatSessionClock = (value?: string) => {
  if (!value) return "";

  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "";

  return new Intl.DateTimeFormat("ko-KR", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
};

const formatSessionTimeRange = (record: ReadingRecord) => {
  const startedAt = formatSessionClock(record.startedAt);
  const endedAt = formatSessionClock(record.endedAt);

  if (startedAt && endedAt) return `${startedAt} - ${endedAt}`;
  if (startedAt) return `${startedAt} 시작`;
  if (endedAt) return `${endedAt} 종료`;

  return "";
};

const formatRoundLabel = (record: ReadingRecord) =>
  (record.roundNumber ?? 1) > 1 ? `${record.roundNumber}회독` : "";

const getCalendarDays = (monthCursor: Date) => {
  const firstDay = createMonthCursor(monthCursor);
  const gridStart = new Date(firstDay);

  gridStart.setDate(firstDay.getDate() - firstDay.getDay());

  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(gridStart);
    date.setDate(gridStart.getDate() + index);
    return date;
  });
};

const createRecordEditDraft = (record: ReadingRecord): RecordEditDraft => ({
  startPage: record.startPage,
  endPage: record.endPage,
  durationMinutes: Math.max(Math.round(record.durationSeconds / 60), 1),
  sentence: record.sentence ?? "",
  sentencePage: record.sentencePage ?? record.endPage,
});

const formatSentenceForSharing = (sentence: SentenceItem) =>
  `“${sentence.text}”\n\n${sentence.bookTitle} · p.${sentence.page}`;

const copyText = async (text: string) => {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }

  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  document.body.appendChild(textarea);
  textarea.select();
  document.execCommand("copy");
  textarea.remove();
};

const getRecordBookGroups = (records: ReadingRecord[]): RecordBookGroup[] =>
  Array.from(
    records
      .reduce<Map<string, RecordBookGroup>>((groups, record) => {
        const group = groups.get(record.bookId) ?? {
          bookId: record.bookId,
          bookTitle: record.bookTitle,
          durationSeconds: 0,
          pages: 0,
          records: [],
        };

        group.durationSeconds += record.durationSeconds;
        group.pages += Math.max(record.endPage - record.startPage, 0);
        group.records.push(record);
        groups.set(record.bookId, group);

        return groups;
      }, new Map())
      .values(),
  )
    .map((group) => ({
      ...group,
      records: [...group.records].sort(
        (left, right) =>
          (left.startedAt ?? "").localeCompare(right.startedAt ?? "") ||
          left.id.localeCompare(right.id),
      ),
    }))
    .sort((left, right) => right.durationSeconds - left.durationSeconds);

export const RecordScreen = ({
  books,
  records,
  onUpdateRecord,
  onDeleteRecord,
}: RecordScreenProps) => {
  const [view, setView] = useState<RecordView>("calendar");
  const [recordBookFilter, setRecordBookFilter] = useState("all");
  const [recordSentenceFilter, setRecordSentenceFilter] =
    useState<RecordSentenceFilter>("all");
  const [bookFilter, setBookFilter] = useState("all");
  const [sentenceSort, setSentenceSort] = useState<SentenceSort>("recent");
  const [randomSentenceId, setRandomSentenceId] = useState<string | null>(null);
  const [monthCursor, setMonthCursor] = useState(() =>
    createMonthCursor(new Date()),
  );
  const [selectedDate, setSelectedDate] = useState(() =>
    formatDateLabel(new Date()),
  );
  const [isDateDetailOpen, setIsDateDetailOpen] = useState(false);
  const [editingRecordId, setEditingRecordId] = useState<string | null>(null);
  const [deleteRecordId, setDeleteRecordId] = useState<string | null>(null);
  const [recordEditDraft, setRecordEditDraft] =
    useState<RecordEditDraft | null>(null);
  const [recordEditError, setRecordEditError] = useState<string | null>(null);
  const [isRecordMutating, setIsRecordMutating] = useState(false);
  const [sentenceActionId, setSentenceActionId] = useState<string | null>(null);

  const filteredRecords = useMemo(() => {
    return records.filter((record) => {
      const matchesBook =
        recordBookFilter === "all" || record.bookId === recordBookFilter;
      const matchesSentence =
        recordSentenceFilter === "all" || Boolean(record.sentence);

      return matchesBook && matchesSentence;
    });
  }, [recordBookFilter, recordSentenceFilter, records]);

  const recordGroups = useMemo(() => {
    const groups = filteredRecords.reduce<
      Array<{ date: string; durationSeconds: number; records: ReadingRecord[] }>
    >((currentGroups, record) => {
      const group = currentGroups.find((item) => item.date === record.date);

      if (group) {
        group.durationSeconds += record.durationSeconds;
        group.records.push(record);
        return currentGroups;
      }

      currentGroups.push({
        date: record.date,
        durationSeconds: record.durationSeconds,
        records: [record],
      });

      return currentGroups;
    }, []);

    return groups.sort((left, right) => right.date.localeCompare(left.date));
  }, [filteredRecords]);

  const sentenceItems = useMemo<SentenceItem[]>(
    () =>
      books.flatMap((book) =>
        book.sentences.map((sentence) => ({
          ...sentence,
          bookId: book.id,
          bookTitle: book.title,
        })),
      ),
    [books],
  );

  const visibleSentences = useMemo(() => {
    const filteredSentences =
      bookFilter === "all"
        ? sentenceItems
        : sentenceItems.filter((sentence) => sentence.bookId === bookFilter);

    return [...filteredSentences].sort((left, right) => {
      if (sentenceSort === "page") {
        return (
          left.bookTitle.localeCompare(right.bookTitle) ||
          left.page - right.page ||
          right.recordedAt.localeCompare(left.recordedAt)
        );
      }

      return (
        right.recordedAt.localeCompare(left.recordedAt) ||
        right.page - left.page
      );
    });
  }, [bookFilter, sentenceItems, sentenceSort]);

  const randomSentence =
    visibleSentences.find((sentence) => sentence.id === randomSentenceId) ??
    null;

  const booksById = useMemo(
    () => new Map(books.map((book) => [book.id, book])),
    [books],
  );

  const calendarDays = useMemo(
    () => getCalendarDays(monthCursor),
    [monthCursor],
  );

  const calendarStatsByDate = useMemo(() => {
    return records.reduce<
      Record<
        string,
        {
          durationSeconds: number;
          pages: number;
          records: ReadingRecord[];
        }
      >
    >((stats, record) => {
      const currentStats = stats[record.date] ?? {
        durationSeconds: 0,
        pages: 0,
        records: [],
      };

      currentStats.durationSeconds += record.durationSeconds;
      currentStats.pages += Math.max(record.endPage - record.startPage, 0);
      currentStats.records.push(record);
      stats[record.date] = currentStats;

      return stats;
    }, {});
  }, [records]);

  const selectedDateStats = calendarStatsByDate[selectedDate] ?? null;

  const selectedDateRecords = useMemo(
    () =>
      [...(selectedDateStats?.records ?? [])].sort(
        (left, right) => right.durationSeconds - left.durationSeconds,
      ),
    [selectedDateStats],
  );

  const selectedDateBookGroups = useMemo(() => {
    return Array.from(
      selectedDateRecords
        .reduce<
          Map<
            string,
            {
              bookId: string;
              bookTitle: string;
              durationSeconds: number;
              pages: number;
              sentenceCount: number;
              records: ReadingRecord[];
            }
          >
        >((groups, record) => {
          const currentGroup = groups.get(record.bookId) ?? {
            bookId: record.bookId,
            bookTitle: record.bookTitle,
            durationSeconds: 0,
            pages: 0,
            sentenceCount: 0,
            records: [],
          };

          currentGroup.durationSeconds += record.durationSeconds;
          currentGroup.pages += Math.max(record.endPage - record.startPage, 0);
          currentGroup.sentenceCount += record.sentence ? 1 : 0;
          currentGroup.records.push(record);
          groups.set(record.bookId, currentGroup);

          return groups;
        }, new Map())
        .values(),
    ).sort((left, right) => right.durationSeconds - left.durationSeconds);
  }, [selectedDateRecords]);

  const selectedDateSentenceCount =
    selectedDateStats?.records.filter((record) => Boolean(record.sentence))
      .length ?? 0;

  const editingRecord = editingRecordId
    ? (records.find((record) => record.id === editingRecordId) ?? null)
    : null;
  const deleteRecord = deleteRecordId
    ? (records.find((record) => record.id === deleteRecordId) ?? null)
    : null;
  const editingBook = editingRecord
    ? (booksById.get(editingRecord.bookId) ?? null)
    : null;

  const monthStats = useMemo(() => {
    return records.reduce(
      (stats, record) => {
        const date = parseDateLabel(record.date);
        if (!date || !isSameMonth(date, monthCursor)) return stats;

        stats.durationSeconds += record.durationSeconds;
        stats.pages += Math.max(record.endPage - record.startPage, 0);
        stats.readingDates.add(record.date);

        return stats;
      },
      {
        durationSeconds: 0,
        pages: 0,
        readingDates: new Set<string>(),
      },
    );
  }, [monthCursor, records]);

  const pickRandomSentence = () => {
    if (visibleSentences.length === 0) return;

    const nextSentence =
      visibleSentences[Math.floor(Math.random() * visibleSentences.length)];
    setRandomSentenceId(nextSentence.id);
  };

  const showSentenceActionFeedback = (sentenceId: string) => {
    setSentenceActionId(sentenceId);
    window.setTimeout(() => {
      setSentenceActionId((current) =>
        current === sentenceId ? null : current,
      );
    }, 1400);
  };

  const copySentence = async (sentence: SentenceItem) => {
    await copyText(formatSentenceForSharing(sentence));
    showSentenceActionFeedback(sentence.id);
  };

  const shareSentence = async (sentence: SentenceItem) => {
    const text = formatSentenceForSharing(sentence);

    if (navigator.share) {
      try {
        await navigator.share({
          title: sentence.bookTitle,
          text,
        });
        showSentenceActionFeedback(sentence.id);
        return;
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError")
          return;
      }
    }

    await copyText(text);
    showSentenceActionFeedback(sentence.id);
  };

  const moveMonth = (delta: number) => {
    setMonthCursor(
      (current) =>
        new Date(current.getFullYear(), current.getMonth() + delta, 1),
    );
  };

  const moveToToday = () => {
    const today = new Date();

    setMonthCursor(createMonthCursor(today));
    setSelectedDate(formatDateLabel(today));
  };

  const selectCalendarDate = (date: Date) => {
    setSelectedDate(formatDateLabel(date));
    setIsDateDetailOpen(true);

    if (!isSameMonth(date, monthCursor)) {
      setMonthCursor(createMonthCursor(date));
    }
  };

  const openRecordEditor = (record: ReadingRecord) => {
    setEditingRecordId(record.id);
    setRecordEditDraft(createRecordEditDraft(record));
    setRecordEditError(null);
  };

  const closeRecordEditor = () => {
    if (isRecordMutating) return;

    setEditingRecordId(null);
    setRecordEditDraft(null);
    setRecordEditError(null);
  };

  const updateRecordEditDraft = (input: Partial<RecordEditDraft>) => {
    setRecordEditDraft((current) =>
      current ? { ...current, ...input } : current,
    );
  };

  const submitRecordEdit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!editingRecord || !recordEditDraft) return;

    const totalPages =
      editingBook?.totalPages ??
      Math.max(editingRecord.endPage, recordEditDraft.endPage, 1);
    const startPage = Math.min(
      Math.max(recordEditDraft.startPage || 1, 1),
      totalPages,
    );
    const endPage = Math.min(
      Math.max(recordEditDraft.endPage || startPage, startPage),
      totalPages,
    );
    const durationMinutes = Math.max(recordEditDraft.durationMinutes || 1, 1);
    const sentence = recordEditDraft.sentence.trim();
    const sentencePage = sentence
      ? Math.min(
          Math.max(recordEditDraft.sentencePage || endPage, 1),
          totalPages,
        )
      : undefined;

    try {
      setIsRecordMutating(true);
      setRecordEditError(null);
      await onUpdateRecord(editingRecord.id, {
        startPage,
        endPage,
        durationSeconds: durationMinutes * 60,
        sentence: sentence || undefined,
        sentencePage,
      });
      setEditingRecordId(null);
      setRecordEditDraft(null);
    } catch (error) {
      setRecordEditError(
        error instanceof Error ? error.message : "기록을 수정하지 못했습니다.",
      );
    } finally {
      setIsRecordMutating(false);
    }
  };

  const confirmDeleteRecord = async () => {
    if (!deleteRecordId) return;

    try {
      setIsRecordMutating(true);
      setRecordEditError(null);
      await onDeleteRecord(deleteRecordId);
      if (editingRecordId === deleteRecordId) {
        setEditingRecordId(null);
        setRecordEditDraft(null);
      }
      setDeleteRecordId(null);
    } catch (error) {
      setRecordEditError(
        error instanceof Error ? error.message : "기록을 삭제하지 못했습니다.",
      );
    } finally {
      setIsRecordMutating(false);
    }
  };

  const todayDateLabel = formatDateLabel(new Date());

  useBackNavigationLayer(
    isDateDetailOpen && view === "calendar",
    () => setIsDateDetailOpen(false),
    "record-date-detail",
  );
  useBackNavigationLayer(
    Boolean(editingRecord),
    closeRecordEditor,
    "record-edit",
  );
  useBackNavigationLayer(
    Boolean(deleteRecord),
    () => setDeleteRecordId(null),
    "record-delete",
  );

  return (
    <div className="record-page">
      <header className="record-page-header">
        <h1>기록</h1>
        <p>날짜별 독서 흐름과 남겨둔 문장을 확인해요.</p>
      </header>

      <SwipeSegmentedControl
        options={recordViewOptions}
        value={view}
        onChange={setView}
        ariaLabel="기록 보기 방식"
        className="record-view-tabs"
      />

      <div key={view} className="record-view-content">
        {view === "records" &&
          (records.length === 0 ? (
            <div className="record-empty-state">
              아직 저장된 독서 기록이 없습니다.
            </div>
          ) : (
            <div className="record-panel">
              <div className="record-filter-card">
                <select
                  className="record-select"
                  value={recordBookFilter}
                  onChange={(event) => setRecordBookFilter(event.target.value)}
                  aria-label="기록 책 필터"
                >
                  <option value="all">전체 책</option>
                  {books
                    .filter((book) =>
                      records.some((record) => record.bookId === book.id),
                    )
                    .map((book) => (
                      <option key={book.id} value={book.id}>
                        {book.title}
                      </option>
                    ))}
                </select>
                <div className="record-filter-actions">
                  <button
                    type="button"
                    className={`record-filter-button ${recordSentenceFilter === "all" ? "record-filter-button-active" : ""}`}
                    onClick={() => setRecordSentenceFilter("all")}
                  >
                    전체
                  </button>
                  <button
                    type="button"
                    className={`record-filter-button ${recordSentenceFilter === "withSentence" ? "record-filter-button-active" : ""}`}
                    onClick={() => setRecordSentenceFilter("withSentence")}
                  >
                    문장 있음
                  </button>
                </div>
              </div>

              {recordGroups.length === 0 ? (
                <div className="record-empty-state">
                  조건에 맞는 기록이 없습니다.
                </div>
              ) : (
                recordGroups.map((group) => (
                  <section key={group.date} className="record-group">
                    <div className="record-group-header">
                      <h2>{group.date}</h2>
                      <p>총 {formatCompactDuration(group.durationSeconds)}</p>
                    </div>
                    <div className="record-list">
                      {getRecordBookGroups(group.records).map((bookGroup) => {
                        const recordBook = booksById.get(bookGroup.bookId);

                        return (
                          <article
                            key={bookGroup.bookId}
                            className="record-card"
                          >
                            <div className="record-card-main">
                              <div className="record-card-book">
                                <span
                                  className="record-card-cover"
                                  style={{
                                    backgroundColor:
                                      recordBook?.coverColor ?? "#f2c94c",
                                  }}
                                >
                                  {recordBook?.thumbnail ? (
                                    <img src={recordBook.thumbnail} alt="" />
                                  ) : (
                                    <span
                                      style={{
                                        backgroundColor:
                                          recordBook?.accentColor ?? "#76b852",
                                      }}
                                    />
                                  )}
                                </span>
                                <div className="record-card-copy">
                                  <p className="record-card-title">
                                    {bookGroup.bookTitle}
                                  </p>
                                  <p className="record-card-meta">
                                    세션 {bookGroup.records.length}개 ·{" "}
                                    {bookGroup.pages}p
                                  </p>
                                </div>
                              </div>
                              <strong className="record-card-total-duration">
                                {formatCompactDuration(
                                  bookGroup.durationSeconds,
                                )}
                              </strong>
                            </div>

                            <div className="record-session-list">
                              {bookGroup.records.map((record) => {
                                const roundLabel = formatRoundLabel(record);
                                const pagesRead = Math.max(
                                  record.endPage - record.startPage,
                                  0,
                                );

                                return (
                                  <div
                                    key={record.id}
                                    className="record-session-item"
                                  >
                                    <div className="record-session-row">
                                      <div className="record-session-copy">
                                        <p className="record-session-pages">
                                          {roundLabel && <>{roundLabel} · </>}
                                          {record.startPage}p → {record.endPage}
                                          p
                                        </p>
                                        {formatSessionTimeRange(record) && (
                                          <span className="record-session-time">
                                            {formatSessionTimeRange(record)}
                                          </span>
                                        )}
                                        <div className="record-session-badges">
                                          <time className="record-duration-badge">
                                            {formatCompactDuration(
                                              record.durationSeconds,
                                            )}
                                          </time>
                                          <span className="record-page-delta">
                                            +{pagesRead}p
                                          </span>
                                        </div>
                                      </div>
                                      <div className="record-card-actions">
                                        <button
                                          type="button"
                                          onClick={() =>
                                            openRecordEditor(record)
                                          }
                                          aria-label="기록 수정"
                                        >
                                          수정
                                        </button>
                                        <button
                                          type="button"
                                          className="record-card-delete-button"
                                          onClick={() => {
                                            setRecordEditError(null);
                                            setDeleteRecordId(record.id);
                                          }}
                                          aria-label="기록 삭제"
                                        >
                                          삭제
                                        </button>
                                      </div>
                                    </div>
                                    {record.sentence && (
                                      <blockquote className="record-quote-card">
                                        {record.sentence}
                                        {record.sentencePage && (
                                          <span>{record.sentencePage}p</span>
                                        )}
                                      </blockquote>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          </article>
                        );
                      })}
                    </div>
                  </section>
                ))
              )}
            </div>
          ))}

        {view === "sentences" && (
          <div className="record-panel">
            <div className="record-filter-card">
              <div className="record-sentence-filter-row">
                <select
                  className="record-select"
                  value={bookFilter}
                  onChange={(event) => {
                    setBookFilter(event.target.value);
                    setRandomSentenceId(null);
                  }}
                  aria-label="책 필터"
                >
                  <option value="all">전체 책</option>
                  {books
                    .filter((book) => book.sentences.length > 0)
                    .map((book) => (
                      <option key={book.id} value={book.id}>
                        {book.title}
                      </option>
                    ))}
                </select>
                <button
                  type="button"
                  className="record-random-button"
                  onClick={pickRandomSentence}
                  disabled={visibleSentences.length === 0}
                >
                  <Icon name="swap" className="h-4 w-4" />
                  랜덤
                </button>
              </div>
              <div className="record-filter-actions">
                <button
                  type="button"
                  className={`record-filter-button ${sentenceSort === "recent" ? "record-filter-button-active" : ""}`}
                  onClick={() => setSentenceSort("recent")}
                >
                  등록순
                </button>
                <button
                  type="button"
                  className={`record-filter-button ${sentenceSort === "page" ? "record-filter-button-active" : ""}`}
                  onClick={() => setSentenceSort("page")}
                >
                  페이지순
                </button>
              </div>
            </div>

            {randomSentence && (
              <article className="record-random-sentence">
                <p>오늘의 문장</p>
                <blockquote>“{randomSentence.text}”</blockquote>
                <span>
                  {randomSentence.bookTitle} · p.{randomSentence.page}
                </span>
              </article>
            )}

            {visibleSentences.length === 0 ? (
              <div className="record-empty-state">
                아직 모아둔 문장이 없습니다.
              </div>
            ) : (
              visibleSentences.map((sentence) => (
                <article key={sentence.id} className="record-sentence-card">
                  <div className="record-sentence-card-header">
                    <blockquote>“{sentence.text}”</blockquote>
                    <div className="record-sentence-actions">
                      <button
                        type="button"
                        onClick={() => void copySentence(sentence)}
                        aria-label="문장 복사"
                        title="복사"
                      >
                        <Icon
                          name={
                            sentenceActionId === sentence.id ? "check" : "copy"
                          }
                          className="h-4 w-4"
                        />
                      </button>
                      <button
                        type="button"
                        onClick={() => void shareSentence(sentence)}
                        aria-label="문장 공유"
                        title="공유"
                      >
                        <Icon name="share" className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                  <div className="record-sentence-meta">
                    <p>{sentence.bookTitle}</p>
                    <span>
                      p.{sentence.page} · {sentence.recordedAt}
                    </span>
                  </div>
                </article>
              ))
            )}
          </div>
        )}

        {view === "calendar" && (
          <div className="record-panel">
            <section className="record-calendar-card">
              <div className="record-calendar-header">
                <h2>{formatMonthTitle(monthCursor)}</h2>
                <div className="record-calendar-nav">
                  <button
                    type="button"
                    className="record-calendar-nav-button"
                    onClick={() => moveMonth(-1)}
                    aria-label="이전 달"
                  >
                    <Icon name="chevronLeft" className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    className="calendar-today-button"
                    onClick={moveToToday}
                  >
                    오늘
                  </button>
                  <button
                    type="button"
                    className="record-calendar-nav-button"
                    onClick={() => moveMonth(1)}
                    aria-label="다음 달"
                  >
                    <Icon name="chevronRight" className="h-4 w-4" />
                  </button>
                </div>
              </div>

              <div className="calendar-month-summary">
                <div className="calendar-month-summary-item">
                  <p>독서일</p>
                  <strong>{monthStats.readingDates.size}일</strong>
                </div>
                <div className="calendar-month-summary-item">
                  <p>독서 시간</p>
                  <strong>
                    {formatCompactDuration(monthStats.durationSeconds)}
                  </strong>
                </div>
                <div className="calendar-month-summary-item">
                  <p>페이지</p>
                  <strong>{monthStats.pages}p</strong>
                </div>
              </div>

              <div className="record-weekdays">
                {weekdayLabels.map((weekday) => (
                  <span key={weekday}>{weekday}</span>
                ))}
              </div>

              <div className="record-calendar-grid">
                {calendarDays.map((date) => {
                  const dateLabel = formatDateLabel(date);
                  const dayStats = calendarStatsByDate[dateLabel];
                  const hasRecord = Boolean(dayStats);
                  const isCurrentMonth = isSameMonth(date, monthCursor);
                  const isSelected = dateLabel === selectedDate;
                  const isToday = dateLabel === todayDateLabel;
                  const weekendClass =
                    date.getDay() === 0
                      ? "calendar-day-sunday"
                      : date.getDay() === 6
                        ? "calendar-day-saturday"
                        : "";
                  const dayBookPreviews = dayStats
                    ? Array.from(
                        dayStats.records
                          .reduce<
                            Map<
                              string,
                              CalendarBookPreview & { durationSeconds: number }
                            >
                          >((bookMap, record) => {
                            const existingBook = bookMap.get(record.bookId);

                            if (existingBook) {
                              existingBook.durationSeconds +=
                                record.durationSeconds;
                              return bookMap;
                            }
                            const book = booksById.get(record.bookId);

                            bookMap.set(
                              record.bookId,
                              book
                                ? {
                                    id: book.id,
                                    title: book.title,
                                    thumbnail: book.thumbnail,
                                    coverColor: book.coverColor,
                                    accentColor: book.accentColor,
                                    durationSeconds: record.durationSeconds,
                                  }
                                : {
                                    id: record.bookId,
                                    title: record.bookTitle,
                                    coverColor: "#8a5a3c",
                                    accentColor: "#e8c48f",
                                    durationSeconds: record.durationSeconds,
                                  },
                            );

                            return bookMap;
                          }, new Map())
                          .values(),
                      ).sort(
                        (left, right) =>
                          right.durationSeconds - left.durationSeconds,
                      )
                    : [];
                  const primaryBookPreview = dayBookPreviews[0];
                  const hiddenBookCount = Math.max(
                    dayBookPreviews.length - 1,
                    0,
                  );

                  return (
                    <button
                      key={dateLabel}
                      type="button"
                      className={`calendar-day-card ${hasRecord ? "calendar-day-card-record" : "calendar-day-card-empty"} ${
                        isSelected ? "calendar-day-card-selected" : ""
                      } ${isCurrentMonth ? "" : "calendar-day-card-muted"}`}
                      onClick={() => selectCalendarDate(date)}
                      aria-label={`${dateLabel} 독서 기록 보기`}
                    >
                      {hasRecord && primaryBookPreview ? (
                        <>
                          <span
                            className={`calendar-day-header ${weekendClass} ${isToday ? "calendar-day-header-today" : ""}`}
                          >
                            {date.getDate()}
                            {hiddenBookCount > 0 && (
                              <span className="calendar-day-count">
                                +{hiddenBookCount}
                              </span>
                            )}
                          </span>
                          <span
                            className="calendar-day-cover"
                            style={{
                              backgroundColor: primaryBookPreview.coverColor,
                            }}
                          >
                            {primaryBookPreview.thumbnail ? (
                              <img src={primaryBookPreview.thumbnail} alt="" />
                            ) : (
                              <span
                                className="calendar-day-cover-fallback"
                                style={{
                                  backgroundColor:
                                    primaryBookPreview.accentColor,
                                }}
                              />
                            )}
                          </span>
                        </>
                      ) : (
                        <span
                          className={`calendar-day-empty-date ${weekendClass} ${isToday ? "calendar-day-empty-date-today" : ""}`}
                        >
                          {date.getDate()}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </section>
          </div>
        )}
      </div>

      <BottomSheetModal
        isOpen={view === "calendar" && isDateDetailOpen}
        ariaLabel="날짜별 독서 기록"
        panelClassName="record-date-sheet"
        onBackdropClick={() => setIsDateDetailOpen(false)}
      >
        <div className="record-date-sheet-header">
          <div>
            <p>선택한 날짜</p>
            <h2>{selectedDate}</h2>
          </div>
          <button
            type="button"
            className="record-sheet-close-button"
            onClick={() => setIsDateDetailOpen(false)}
            aria-label="닫기"
          >
            <Icon name="close" className="h-5 w-5" />
          </button>
        </div>

        {!selectedDateStats ? (
          <div className="record-date-empty">이 날의 독서 기록이 없습니다.</div>
        ) : (
          <div className="record-date-sheet-body">
            <div className="record-date-summary">
              <div className="record-date-summary-item">
                <p>시간</p>
                <strong>
                  {formatCompactDuration(selectedDateStats.durationSeconds)}
                </strong>
              </div>
              <div className="record-date-summary-item">
                <p>페이지</p>
                <strong>{selectedDateStats.pages}p</strong>
              </div>
              <div className="record-date-summary-item">
                <p>세션</p>
                <strong>{selectedDateStats.records.length}개</strong>
              </div>
              <div className="record-date-summary-item">
                <p>문장</p>
                <strong>{selectedDateSentenceCount}개</strong>
              </div>
            </div>

            {selectedDateBookGroups.map((group) => {
              const book = booksById.get(group.bookId);

              return (
                <article key={group.bookId} className="record-date-book-card">
                  <div className="record-date-book-header">
                    <div className="record-date-book-main">
                      <div
                        className="record-date-book-cover"
                        style={{
                          backgroundColor: book?.coverColor ?? "#8a5a3c",
                        }}
                      >
                        {book?.thumbnail ? (
                          <img src={book.thumbnail} alt="" />
                        ) : (
                          <span
                            style={{
                              borderColor: book?.accentColor ?? "#e8c48f",
                            }}
                          />
                        )}
                      </div>
                      <div>
                        <h3>{group.bookTitle}</h3>
                        <p>
                          {group.pages}p · 세션 {group.records.length}개
                        </p>
                      </div>
                    </div>
                    <strong>
                      {formatCompactDuration(group.durationSeconds)}
                    </strong>
                  </div>

                  <div className="record-date-record-list">
                    {group.records.map((record) => (
                      <div key={record.id} className="record-date-record-item">
                        <div className="record-date-record-row">
                          <div className="record-date-record-meta">
                            <p>
                              {formatRoundLabel(record) && (
                                <>{formatRoundLabel(record)} · </>
                              )}
                              {record.startPage}p → {record.endPage}p
                            </p>
                            {formatSessionTimeRange(record) && (
                              <span>{formatSessionTimeRange(record)}</span>
                            )}
                            <time>
                              {formatCompactDuration(record.durationSeconds)}
                            </time>
                          </div>
                          <div className="record-date-record-actions">
                            <button
                              type="button"
                              onClick={() => openRecordEditor(record)}
                              aria-label="기록 수정"
                            >
                              <Icon name="edit" className="h-4 w-4" />
                            </button>
                            <button
                              type="button"
                              className="record-date-delete-button"
                              onClick={() => {
                                setRecordEditError(null);
                                setDeleteRecordId(record.id);
                              }}
                              aria-label="기록 삭제"
                            >
                              <Icon name="trash" className="h-4 w-4" />
                            </button>
                          </div>
                        </div>
                        {record.sentence && (
                          <p className="record-date-record-sentence">
                            {record.sentence}
                            {record.sentencePage && (
                              <span>{record.sentencePage}p</span>
                            )}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>

                  {group.sentenceCount > 0 && (
                    <p className="record-date-sentence-count">
                      기록 문장 {group.sentenceCount}개
                    </p>
                  )}
                </article>
              );
            })}
          </div>
        )}
      </BottomSheetModal>

      <BottomSheetModal
        isOpen={Boolean(editingRecord && recordEditDraft)}
        ariaLabel="독서 기록 수정"
        backdropClassName="modal-backdrop-top"
        panelClassName="record-edit-sheet"
      >
        {editingRecord && recordEditDraft && (
          <>
            <div className="record-edit-header">
              <div className="min-w-0">
                <h2>기록 다듬기</h2>
                <p>
                  {editingRecord.bookTitle} · {editingRecord.date}
                </p>
              </div>
              <button
                type="button"
                className="record-edit-close-button"
                onClick={closeRecordEditor}
                aria-label="닫기"
                disabled={isRecordMutating}
              >
                <Icon name="close" className="h-5 w-5" />
              </button>
            </div>

            <form className="record-edit-form" onSubmit={submitRecordEdit}>
              <section className="record-edit-section">
                <div className="grid grid-cols-2 gap-3">
                  <label className="field-label">
                    시작 페이지
                    <input
                      className="pixel-input"
                      type="text"
                      inputMode="numeric"
                      value={recordEditDraft.startPage}
                      onChange={(event) =>
                        updateRecordEditDraft({
                          startPage: parsePageInput(event.target.value),
                        })
                      }
                    />
                  </label>
                  <label className="field-label">
                    종료 페이지
                    <input
                      className="pixel-input"
                      type="text"
                      inputMode="numeric"
                      value={recordEditDraft.endPage}
                      onChange={(event) =>
                        updateRecordEditDraft({
                          endPage: parsePageInput(event.target.value),
                        })
                      }
                    />
                  </label>
                </div>

                <div className="record-edit-duration">
                  <div className="mb-2 flex items-center justify-between gap-3">
                    <p>독서 시간</p>
                  </div>
                  <div className="record-edit-duration-stepper">
                    <button
                      type="button"
                      className="mini-icon-button"
                      onClick={() =>
                        updateRecordEditDraft({
                          durationMinutes: Math.max(
                            recordEditDraft.durationMinutes - 5,
                            1,
                          ),
                        })
                      }
                      aria-label="독서 시간 5분 줄이기"
                    >
                      <Icon name="minus" className="h-4 w-4" />
                    </button>
                    <div className="record-edit-minute-input">
                      <input
                        className="pixel-input text-center"
                        type="text"
                        inputMode="numeric"
                        value={recordEditDraft.durationMinutes}
                        onChange={(event) =>
                          updateRecordEditDraft({
                            durationMinutes: Math.max(
                              parsePageInput(event.target.value),
                              1,
                            ),
                          })
                        }
                        aria-label="독서 시간"
                      />
                      <span>분</span>
                    </div>
                    <button
                      type="button"
                      className="mini-icon-button"
                      onClick={() =>
                        updateRecordEditDraft({
                          durationMinutes: recordEditDraft.durationMinutes + 5,
                        })
                      }
                      aria-label="독서 시간 5분 늘리기"
                    >
                      <Icon name="plus" className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </section>

              <section className="record-edit-section record-edit-sentence-section">
                <label className="field-label" htmlFor="record-sentence-page">
                  문장 페이지
                  <input
                    id="record-sentence-page"
                    className="pixel-input"
                    type="text"
                    inputMode="numeric"
                    value={recordEditDraft.sentencePage}
                    onChange={(event) =>
                      updateRecordEditDraft({
                        sentencePage: parsePageInput(event.target.value),
                      })
                    }
                  />
                </label>
                <textarea
                  className="record-edit-textarea"
                  value={recordEditDraft.sentence}
                  onChange={(event) =>
                    updateRecordEditDraft({ sentence: event.target.value })
                  }
                  placeholder="기록 문장"
                />
              </section>

              {recordEditError && (
                <p className="border-2 border-[#2F2A26] bg-[#F4D8CF] p-2 text-xs font-black text-[#8A3F2D]">
                  {recordEditError}
                </p>
              )}

              <div className="record-edit-actions">
                <button
                  type="button"
                  className="record-edit-cancel-button"
                  onClick={closeRecordEditor}
                  disabled={isRecordMutating}
                >
                  취소
                </button>
                <button
                  type="submit"
                  className="record-edit-save-button"
                  disabled={isRecordMutating}
                >
                  <Icon name="save" className="h-5 w-5" />
                  저장
                </button>
              </div>
            </form>
          </>
        )}
      </BottomSheetModal>

      <BottomSheetModal
        isOpen={Boolean(deleteRecord)}
        ariaLabel="독서 기록 삭제 확인"
        role="alertdialog"
        backdropClassName="modal-backdrop-top"
        panelClassName="max-w-[360px]"
      >
        {deleteRecord && (
          <>
            <div className="mb-3 flex items-center gap-2">
              <div className="grid h-10 w-10 place-items-center border-2 border-[#2F2A26] bg-[#B58A7A] text-[#FFFDF8]">
                <Icon name="trash" className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-lg font-black">기록 삭제</h2>
                <p className="text-xs font-black text-stone-500">
                  삭제한 독서 기록은 되돌릴 수 없습니다.
                </p>
              </div>
            </div>
            <div className="mb-4 border-2 border-[#2F2A26] bg-[#FCFBF7] p-3">
              <p className="truncate text-sm font-black">
                {deleteRecord.bookTitle}
              </p>
              <p className="mt-2 text-xs font-black text-stone-500">
                {deleteRecord.date} · {deleteRecord.startPage}p →{" "}
                {deleteRecord.endPage}p ·{" "}
                {formatCompactDuration(deleteRecord.durationSeconds)}
              </p>
              {deleteRecord.sentence && (
                <p className="mt-3 line-clamp-3 border-l-4 border-[#5F6D57] bg-[#F3E8D0] p-2 text-xs font-bold">
                  {deleteRecord.sentence}
                </p>
              )}
            </div>
            {recordEditError && (
              <p className="mb-3 border-2 border-[#2F2A26] bg-[#F4D8CF] p-2 text-xs font-black text-[#8A3F2D]">
                {recordEditError}
              </p>
            )}
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                className="secondary-button"
                onClick={() => setDeleteRecordId(null)}
                disabled={isRecordMutating}
              >
                취소
              </button>
              <button
                type="button"
                className="danger-button"
                onClick={confirmDeleteRecord}
                disabled={isRecordMutating}
              >
                <Icon name="trash" className="h-5 w-5" />
                삭제
              </button>
            </div>
          </>
        )}
      </BottomSheetModal>
    </div>
  );
};
