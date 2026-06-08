import {
  lazy,
  Suspense,
  useEffect,
  useState,
  type Dispatch,
  type SetStateAction,
} from "react";
import { BottomSheetModal } from "../components/BottomSheetModal";
import { Icon } from "../components/Icon";
import { MiniBook } from "../components/MiniBook";
import { PixelCard } from "../components/PixelCard";
import { SwipeSegmentedControl } from "../components/SwipeSegmentedControl";
import { SwipeableView } from "../components/SwipeableView";
import { useBackNavigationLayer } from "../hooks/useBackNavigationLayer";
import { hasKakaoBookApiKey, searchKakaoBooks } from "../services/kakaoBooks";
import type {
  Book,
  BookSearchResult,
  NewBookInput,
  ReadingRecord,
  ReadingRound,
} from "../types/reading";
import { formatDuration } from "../utils/formatDuration";
import { parsePageInput } from "../utils/pageInput";
import {
  clampBookPage,
  formatBookPages,
  getBookProgress,
} from "../utils/bookPages";
import type { TierBoard, TierKey } from "../types/tier";

const TierMakerScreen = lazy(() =>
  import("./TierMakerScreen").then((module) => ({
    default: module.TierMakerScreen,
  })),
);

type LibraryScreenProps = {
  books: Book[];
  records: ReadingRecord[];
  tierBoard: TierBoard;
  onChangeTierBoard: Dispatch<SetStateAction<TierBoard>>;
  onAddBook: (input: NewBookInput) => Promise<string>;
  onAddSentence: (bookId: string, text: string, page: number) => Promise<void>;
  onUpdateSentence: (
    bookId: string,
    sentenceId: string,
    text: string,
    page: number,
  ) => Promise<void>;
  onDeleteSentence: (bookId: string, sentenceId: string) => Promise<void>;
  onDeleteBook: (bookId: string) => Promise<void>;
  onUpdateBookPage: (bookId: string, page: number) => Promise<void>;
  onUpdateBookTotalPages: (bookId: string, totalPages: number) => Promise<void>;
  onStartReread: (bookId: string) => Promise<void>;
  onDeleteRound: (bookId: string, roundId: string) => Promise<void>;
  shouldOpenBookForm: boolean;
  onDetailModeChange?: (isDetailMode: boolean) => void;
};

const emptyNewBook: NewBookInput = {
  title: "",
  author: "",
  totalPages: null,
  currentPage: 1,
  status: "reading",
};

type SearchStatus = "idle" | "loading" | "success" | "empty" | "error";
type BookFormStep = "search" | "details";
type ShelfTab = "reading" | "completed";
type LibraryView = "shelf" | "tier";

const shelfTabOptions: Array<{ value: ShelfTab; label: string }> = [
  { value: "reading", label: "독서중" },
  { value: "completed", label: "완독" },
];

const todayLabel = () =>
  new Intl.DateTimeFormat("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  })
    .format(new Date())
    .replace(/\.\s?/g, ".")
    .replace(/\.$/, "");

const parseReadingDate = (value: string) => {
  const matched = value
    .trim()
    .match(/^(\d{4})(?:[.-]?)(\d{2})(?:[.-]?)(\d{2})$/);

  if (!matched) return null;

  const [, yearText, monthText, dayText] = matched;
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const date = new Date(year, month - 1, day);
  const isValid =
    date.getFullYear() === year &&
    date.getMonth() === month - 1 &&
    date.getDate() === day;

  if (!isValid) return null;

  return `${yearText}.${monthText}.${dayText}`;
};

const toDateInputValue = (value: string) =>
  parseReadingDate(value)?.replace(/\./g, "-") ?? "";

const toDateTime = (dateLabel: string) => {
  const [year, month, day] = dateLabel.split(".").map(Number);

  return new Date(year, month - 1, day).getTime();
};

const formatDateWithWeekday = (dateLabel: string) => {
  const [year, month, day] = dateLabel.split(".").map(Number);
  const date = new Date(year, month - 1, day);

  if (
    !Number.isFinite(date.getTime()) ||
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return dateLabel;
  }

  return `${dateLabel}(${["일", "월", "화", "수", "목", "금", "토"][date.getDay()]})`;
};

const hasCompletedRound = (book: Book) =>
  book.status === "completed" ||
  Boolean(book.rounds?.some((round) => round.status === "completed"));

const getActiveRoundLabel = (book: Book) =>
  book.activeRoundNumber && book.activeRoundNumber > 1
    ? `${book.activeRoundNumber}회독`
    : "1회독";

const getNextRoundNumber = (book: Book) =>
  Math.max(0, ...(book.rounds ?? []).map((round) => round.roundNumber)) + 1;

const tierBadgeStyles: Record<
  TierKey,
  { backgroundColor: string; color: string }
> = {
  S: { backgroundColor: "#F08A82", color: "#2F2A26" },
  A: { backgroundColor: "#F4B86E", color: "#2F2A26" },
  B: { backgroundColor: "#F2D86B", color: "#2F2A26" },
  C: { backgroundColor: "#A8D982", color: "#2F2A26" },
  D: { backgroundColor: "#8FC7F2", color: "#2F2A26" },
};

const getBookTier = (tierBoard: TierBoard, bookId: string) =>
  (Object.entries(tierBoard) as Array<[TierKey, string[]]>).find(
    ([, bookIds]) => bookIds.includes(bookId),
  )?.[0] ?? null;

const getRoundRecords = (records: ReadingRecord[], round: ReadingRound) =>
  records.filter((record) =>
    record.roundId
      ? record.roundId === round.id
      : round.roundNumber === 1 && (record.roundNumber ?? 1) === 1,
  );

const getRoundDateRange = (round: ReadingRound, records: ReadingRecord[]) => {
  const dates = records.map((record) => record.date).sort();
  const startedAt = dates[0] ?? round.startedAt;
  const endedAt = round.completedAt ?? dates.at(-1) ?? "";

  return endedAt && endedAt !== startedAt
    ? `${startedAt} - ${endedAt}`
    : startedAt;
};

export const LibraryScreen = ({
  books,
  records,
  tierBoard,
  onChangeTierBoard,
  onAddBook,
  onAddSentence,
  onUpdateSentence,
  onDeleteSentence,
  onDeleteBook,
  onUpdateBookPage,
  onUpdateBookTotalPages,
  onStartReread,
  onDeleteRound,
  shouldOpenBookForm,
  onDetailModeChange,
}: LibraryScreenProps) => {
  const [selectedBookId, setSelectedBookId] = useState<string | null>(null);
  const [editingSentenceId, setEditingSentenceId] = useState<string | null>(
    null,
  );
  const [isAddingSentence, setIsAddingSentence] = useState(false);
  const [isBookFormOpen, setIsBookFormOpen] = useState(shouldOpenBookForm);
  const [deleteSentenceId, setDeleteSentenceId] = useState<string | null>(null);
  const [deleteBookId, setDeleteBookId] = useState<string | null>(null);
  const [deleteRoundId, setDeleteRoundId] = useState<string | null>(null);
  const [selectedRoundId, setSelectedRoundId] = useState<string | null>(null);
  const [sentenceSort, setSentenceSort] = useState<"created" | "page">(
    "created",
  );
  const [draftSentence, setDraftSentence] = useState("");
  const [draftPage, setDraftPage] = useState(1);
  const [currentPageDraft, setCurrentPageDraft] = useState(1);
  const [totalPagesDraft, setTotalPagesDraft] = useState(1);
  const [newBook, setNewBook] = useState<NewBookInput>(emptyNewBook);
  const [bookFormStep, setBookFormStep] = useState<BookFormStep>("search");
  const [bookSearchQuery, setBookSearchQuery] = useState("");
  const [bookSearchStatus, setBookSearchStatus] =
    useState<SearchStatus>("idle");
  const [bookSearchMessage, setBookSearchMessage] = useState("");
  const [bookSearchResults, setBookSearchResults] = useState<
    BookSearchResult[]
  >([]);
  const [bookDateError, setBookDateError] = useState("");
  const [isMutating, setIsMutating] = useState(false);
  const [activeShelfTab, setActiveShelfTab] = useState<ShelfTab>("reading");
  const [libraryView, setLibraryView] = useState<LibraryView>("shelf");
  const selectedBook = selectedBookId
    ? books.find((book) => book.id === selectedBookId)
    : null;
  const deleteSentence = selectedBook?.sentences.find(
    (sentence) => sentence.id === deleteSentenceId,
  );
  const deleteBook = deleteBookId
    ? books.find((book) => book.id === deleteBookId)
    : null;
  const deleteRound =
    selectedBook && deleteRoundId
      ? selectedBook.rounds?.find((round) => round.id === deleteRoundId)
      : null;
  const selectedRound =
    selectedBook && selectedRoundId
      ? selectedBook.rounds?.find((round) => round.id === selectedRoundId)
      : null;
  const readingBooks = books.filter((book) => book.status === "reading");
  const completedBooks = books.filter(hasCompletedRound);
  const activeShelfBooks =
    activeShelfTab === "reading" ? readingBooks : completedBooks;
  const selectedBookRecords = selectedBook
    ? records.filter((record) => record.bookId === selectedBook.id)
    : [];
  const selectedBookProgress = selectedBook
    ? getBookProgress(selectedBook.currentPage, selectedBook.totalPages)
    : null;
  const selectedBookRemainingPages = selectedBook?.totalPages
    ? Math.max(selectedBook.totalPages - selectedBook.currentPage, 0)
    : null;
  const selectedBookRecordedPages = selectedBookRecords.reduce(
    (sum, record) => sum + Math.max(record.endPage - record.startPage, 0),
    0,
  );
  const selectedBookRecordedSeconds = selectedBookRecords.reduce(
    (sum, record) => sum + record.durationSeconds,
    0,
  );
  const selectedBookAveragePagesPerHour =
    selectedBookRecordedSeconds > 0
      ? Math.round(
          (selectedBookRecordedPages / selectedBookRecordedSeconds) * 3600,
        )
      : 0;
  const selectedBookEstimatedSecondsLeft =
    selectedBookAveragePagesPerHour > 0 && selectedBookRemainingPages !== null
      ? Math.round(
          (selectedBookRemainingPages / selectedBookAveragePagesPerHour) * 3600,
        )
      : 0;
  const selectedBookStats = {
    progress: selectedBookProgress,
    remainingPages: selectedBookRemainingPages,
    recordedPages: selectedBookRecordedPages,
    recordedSeconds: selectedBookRecordedSeconds,
    averagePagesPerHour: selectedBookAveragePagesPerHour,
    estimatedSecondsLeft: selectedBookEstimatedSecondsLeft,
  };
  const recentBookRecords = selectedBookRecords.slice(0, 3);
  const selectedBookRounds = selectedBook
    ? [...(selectedBook.rounds ?? [])].sort(
        (left, right) => left.roundNumber - right.roundNumber,
      )
    : [];
  const selectedRoundRecords = selectedRound
    ? getRoundRecords(selectedBookRecords, selectedRound).sort(
        (left, right) =>
          right.date.localeCompare(left.date) ||
          right.id.localeCompare(left.id),
      )
    : [];
  const selectedRoundPages = selectedRoundRecords.reduce(
    (sum, record) => sum + Math.max(record.endPage - record.startPage, 0),
    0,
  );
  const selectedRoundSeconds = selectedRoundRecords.reduce(
    (sum, record) => sum + record.durationSeconds,
    0,
  );
  const selectedRoundSentences = selectedRoundRecords.filter((record) =>
    Boolean(record.sentence),
  );
  const sortedSentences =
    selectedBook && sentenceSort === "page"
      ? selectedBook.sentences
          .map((sentence, index) => ({ sentence, index }))
          .sort(
            (left, right) =>
              left.sentence.page - right.sentence.page ||
              left.index - right.index,
          )
          .map(({ sentence }) => sentence)
      : (selectedBook?.sentences ?? []);

  useEffect(() => {
    onDetailModeChange?.(Boolean(selectedBook));
  }, [onDetailModeChange, selectedBook]);

  useEffect(() => {
    return () => {
      onDetailModeChange?.(false);
    };
  }, [onDetailModeChange]);

  const selectBook = (bookId: string) => {
    const book = books.find((item) => item.id === bookId);

    setSelectedBookId(bookId);
    setCurrentPageDraft(book?.currentPage ?? 1);
    setTotalPagesDraft(book?.totalPages ?? book?.currentPage ?? 1);
  };

  const closeDetail = () => {
    setSelectedBookId(null);
    setEditingSentenceId(null);
    setIsAddingSentence(false);
    setDeleteSentenceId(null);
    setDeleteBookId(null);
    setDeleteRoundId(null);
    setSelectedRoundId(null);
  };

  const startEdit = (sentenceId: string, text: string, page: number) => {
    setIsAddingSentence(false);
    setEditingSentenceId(sentenceId);
    setDraftSentence(text);
    setDraftPage(page);
  };

  const startAdd = () => {
    if (!selectedBook) return;

    setEditingSentenceId(null);
    setIsAddingSentence(true);
    setDraftSentence("");
    setDraftPage(selectedBook.currentPage);
  };

  const cancelDraft = () => {
    setEditingSentenceId(null);
    setIsAddingSentence(false);
    setDraftSentence("");
  };

  const saveEdit = async () => {
    if (
      !selectedBook ||
      !editingSentenceId ||
      draftSentence.trim().length === 0
    )
      return;
    if (isMutating) return;

    setIsMutating(true);

    try {
      await onUpdateSentence(
        selectedBook.id,
        editingSentenceId,
        draftSentence,
        draftPage,
      );
      setEditingSentenceId(null);
    } finally {
      setIsMutating(false);
    }
  };

  const saveAdd = async () => {
    if (!selectedBook || draftSentence.trim().length === 0) return;
    if (isMutating) return;

    setIsMutating(true);

    try {
      await onAddSentence(selectedBook.id, draftSentence, draftPage);
      setIsAddingSentence(false);
      setDraftSentence("");
    } finally {
      setIsMutating(false);
    }
  };

  const saveCurrentPage = async () => {
    if (!selectedBook) return;
    if (isMutating) return;

    const nextPage = clampBookPage(currentPageDraft, selectedBook.totalPages);

    setIsMutating(true);

    try {
      setCurrentPageDraft(nextPage);
      await onUpdateBookPage(selectedBook.id, nextPage);
    } finally {
      setIsMutating(false);
    }
  };

  const saveTotalPages = async () => {
    if (!selectedBook || selectedBook.totalPages !== null || isMutating) return;

    const nextTotalPages = Math.max(
      totalPagesDraft,
      selectedBook.currentPage,
      1,
    );
    setIsMutating(true);

    try {
      setTotalPagesDraft(nextTotalPages);
      await onUpdateBookTotalPages(selectedBook.id, nextTotalPages);
    } finally {
      setIsMutating(false);
    }
  };

  const startReread = async () => {
    if (!selectedBook || isMutating) return;

    setIsMutating(true);

    try {
      await onStartReread(selectedBook.id);
      setSelectedBookId(null);
    } finally {
      setIsMutating(false);
    }
  };

  const confirmDeleteRound = async () => {
    if (!selectedBook || !deleteRound || deleteRound.roundNumber <= 1) return;
    if (isMutating) return;

    setIsMutating(true);

    try {
      await onDeleteRound(selectedBook.id, deleteRound.id);
      setDeleteRoundId(null);
    } finally {
      setIsMutating(false);
    }
  };

  const confirmDelete = async () => {
    if (!selectedBook || !deleteSentenceId) return;
    if (isMutating) return;

    setIsMutating(true);

    try {
      await onDeleteSentence(selectedBook.id, deleteSentenceId);
      setDeleteSentenceId(null);
      if (editingSentenceId === deleteSentenceId) {
        setEditingSentenceId(null);
      }
    } finally {
      setIsMutating(false);
    }
  };

  const confirmDeleteBook = async () => {
    if (!deleteBookId) return;
    if (isMutating) return;

    setIsMutating(true);

    try {
      await onDeleteBook(deleteBookId);
      setDeleteBookId(null);
      setSelectedBookId(null);
      setEditingSentenceId(null);
      setIsAddingSentence(false);
    } finally {
      setIsMutating(false);
    }
  };

  const closeBookForm = () => {
    setIsBookFormOpen(false);
    setBookFormStep("search");
    setNewBook(emptyNewBook);
    setBookSearchQuery("");
    setBookSearchStatus("idle");
    setBookSearchMessage("");
    setBookSearchResults([]);
    setBookDateError("");
  };

  const openBookSearchStep = () => {
    setBookFormStep("search");
    setBookDateError("");
  };

  const startManualBookEntry = () => {
    setNewBook({
      ...emptyNewBook,
      title: bookSearchQuery.trim(),
    });
    setBookDateError("");
    setBookFormStep("details");
  };

  const saveBook = async () => {
    if (newBook.title.trim().length === 0) return;
    if (isMutating) return;

    const totalPages = newBook.totalPages
      ? Math.max(Math.floor(newBook.totalPages), 1)
      : null;
    const currentPage =
      newBook.status === "completed" && totalPages
        ? totalPages
        : clampBookPage(newBook.currentPage, totalPages);
    const startedAt = newBook.startedAt?.trim()
      ? parseReadingDate(newBook.startedAt)
      : undefined;
    const completedAt =
      newBook.status === "completed"
        ? parseReadingDate(newBook.completedAt?.trim() || todayLabel())
        : undefined;

    if (newBook.startedAt?.trim() && !startedAt) {
      setBookDateError("시작일을 올바른 날짜로 선택해 주세요.");
      return;
    }

    if (newBook.status === "completed" && !completedAt) {
      setBookDateError("완독일을 올바른 날짜로 선택해 주세요.");
      return;
    }

    if (
      startedAt &&
      completedAt &&
      toDateTime(startedAt) > toDateTime(completedAt)
    ) {
      setBookDateError("시작일은 완독일보다 늦을 수 없습니다.");
      return;
    }

    setIsMutating(true);

    try {
      const newBookId = await onAddBook({
        ...newBook,
        totalPages,
        currentPage,
        startedAt: startedAt ?? undefined,
        completedAt: completedAt ?? undefined,
      });

      setSelectedBookId(newBookId);
      setCurrentPageDraft(currentPage);
      closeBookForm();
    } finally {
      setIsMutating(false);
    }
  };

  const submitBookSearch = async () => {
    if (!hasKakaoBookApiKey) {
      setBookSearchStatus("error");
      setBookSearchMessage(
        ".env에 VITE_KAKAO_REST_API_KEY를 설정하면 검색을 사용할 수 있습니다.",
      );
      return;
    }

    if (bookSearchQuery.trim().length === 0) {
      setBookSearchStatus("error");
      setBookSearchMessage("검색어를 입력해 주세요.");
      return;
    }

    setBookSearchStatus("loading");
    setBookSearchMessage("");

    try {
      const results = await searchKakaoBooks(bookSearchQuery);
      setBookSearchResults(results);
      setBookSearchStatus(results.length > 0 ? "success" : "empty");
      setBookSearchMessage(results.length > 0 ? "" : "검색 결과가 없습니다.");
    } catch {
      setBookSearchResults([]);
      setBookSearchStatus("error");
      setBookSearchMessage(
        "책 검색에 실패했습니다. 잠시 후 다시 시도해 주세요.",
      );
    }
  };

  const selectSearchResult = (book: BookSearchResult) => {
    setNewBook((current) => ({
      ...current,
      title: book.title,
      author: book.authors.join(", ") || current.author,
      thumbnail: book.thumbnail,
    }));
    setBookDateError("");
    setBookFormStep("details");
  };

  useBackNavigationLayer(
    libraryView === "tier",
    () => setLibraryView("shelf"),
    "library-tier",
  );
  useBackNavigationLayer(Boolean(selectedBook), closeDetail, "library-detail");
  useBackNavigationLayer(
    Boolean(selectedBook && deleteSentence),
    () => setDeleteSentenceId(null),
    "library-delete-sentence",
  );
  useBackNavigationLayer(
    Boolean(selectedBook && isAddingSentence),
    cancelDraft,
    "library-add-sentence",
  );
  useBackNavigationLayer(
    Boolean(deleteBook),
    () => setDeleteBookId(null),
    "library-delete-book",
  );
  useBackNavigationLayer(
    Boolean(deleteRound),
    () => setDeleteRoundId(null),
    "library-delete-round",
  );
  useBackNavigationLayer(
    Boolean(selectedRound),
    () => setSelectedRoundId(null),
    "library-round-detail",
  );
  useBackNavigationLayer(
    isBookFormOpen,
    () => {
      if (bookFormStep === "details") {
        openBookSearchStep();
        return;
      }

      closeBookForm();
    },
    "library-book-form",
  );

  return (
    <div className="library-page">
      {!selectedBook && (
        <>
          <header className="library-page-header">
            <div>
              <h1>{libraryView === "tier" ? "완독 책 티어" : "서재"}</h1>
              <p>
                {libraryView === "tier"
                  ? "완독한 책을 나만의 기준으로 정리해요."
                  : "읽는 책과 완독한 책을 한곳에서 관리해요."}
              </p>
            </div>
            <div className="library-page-actions">
              {libraryView === "tier" ? (
                <button
                  type="button"
                  className="library-text-button"
                  onClick={() => setLibraryView("shelf")}
                >
                  서재로
                </button>
              ) : (
                <>
                  <button
                    type="button"
                    className="library-icon-button"
                    onClick={() => setLibraryView("tier")}
                    aria-label="티어메이커"
                  >
                    <Icon name="tier" className="h-5 w-5" />
                  </button>
                  <button
                    type="button"
                    className="library-icon-button library-icon-button-primary"
                    onClick={() => setIsBookFormOpen(true)}
                    aria-label="새 책 추가"
                  >
                    <Icon name="plus" className="h-5 w-5" />
                  </button>
                </>
              )}
            </div>
          </header>

          {libraryView === "tier" ? (
            <Suspense
              fallback={
                <PixelCard className="bg-[#F3E8D0] text-center">
                  <p className="text-sm font-black text-stone-700">
                    티어메이커를 준비하고 있습니다.
                  </p>
                </PixelCard>
              }
            >
              <TierMakerScreen
                books={completedBooks}
                board={tierBoard}
                onChangeBoard={onChangeTierBoard}
              />
            </Suspense>
          ) : (
            <div className="library-shelf-view">
              <SwipeSegmentedControl
                options={shelfTabOptions}
                value={activeShelfTab}
                onChange={setActiveShelfTab}
                ariaLabel="서재 보기 방식"
                className="library-shelf-tabs"
                renderOption={(tab, isActive) => {
                  const count =
                    tab.value === "reading"
                      ? readingBooks.length
                      : completedBooks.length;

                  return (
                    <>
                      <span>{tab.label}</span>
                      <span
                        className={`library-shelf-tab-count ${
                          isActive ? "library-shelf-tab-count-active" : ""
                        }`}
                      >
                        {count}
                      </span>
                    </>
                  );
                }}
              />
              <SwipeableView
                key={activeShelfTab}
                options={shelfTabOptions}
                value={activeShelfTab}
                onChange={setActiveShelfTab}
                className="library-shelf-content"
                ariaLabel="서재 목록 본문"
              >
                <BookShelfSection
                  tone={activeShelfTab}
                  books={activeShelfBooks}
                  tierBoard={tierBoard}
                  onSelectBook={selectBook}
                />
              </SwipeableView>
            </div>
          )}
        </>
      )}

      {selectedBook && (
        <section className="book-detail-page" aria-label="책 상세">
          <header className="book-detail-page-header">
            <button
              type="button"
              className="icon-button"
              onClick={() => {
                if (selectedRound) {
                  setSelectedRoundId(null);
                  return;
                }

                closeDetail();
              }}
              aria-label={
                selectedRound ? "책 상세로 돌아가기" : "서재로 돌아가기"
              }
            >
              <Icon name="chevronLeft" className="h-5 w-5" />
            </button>
            <h1 className="truncate text-xl font-black">
              {selectedBook.title}
            </h1>
          </header>

          {selectedBook && selectedRound ? (
            <>
              <div className="book-detail-header book-round-detail-header">
                <div className="book-round-detail-title">
                  <p className="pixel-label">ROUND DETAIL</p>
                  <h2>
                    {selectedBook.title} · {selectedRound.roundNumber}회독
                  </h2>
                  <p>
                    {getRoundDateRange(selectedRound, selectedRoundRecords)}
                  </p>
                </div>
              </div>

              <div className="book-detail-body">
                <div className="book-round-summary">
                  <div className="book-round-stat book-round-stat-status">
                    <span>상태</span>
                    <strong>
                      {selectedRound.status === "completed"
                        ? "완독"
                        : "읽는 중"}
                    </strong>
                  </div>
                  <div className="book-round-stat">
                    <span>읽은 시간</span>
                    <strong>
                      {formatDuration(
                        selectedRoundSeconds ||
                          selectedRound.accumulatedSeconds,
                      )}
                    </strong>
                  </div>
                  <div className="book-round-stat">
                    <span>읽은 페이지</span>
                    <strong>{selectedRoundPages}p</strong>
                  </div>
                  <div className="book-round-stat">
                    <span>현재 위치</span>
                    <strong>
                      {formatBookPages(
                        selectedRound.currentPage,
                        selectedBook.totalPages,
                      )}
                    </strong>
                  </div>
                  <div className="book-round-stat">
                    <span>독서 기록</span>
                    <strong>{selectedRoundRecords.length}개</strong>
                  </div>
                  <div className="book-round-stat">
                    <span>기록한 문장</span>
                    <strong>{selectedRoundSentences.length}개</strong>
                  </div>
                </div>

                <section className="book-detail-section book-round-section">
                  <div className="book-detail-section-heading">
                    <h3>독서 기록</h3>
                    <span>{selectedRoundRecords.length}개</span>
                  </div>
                  {selectedRoundRecords.length === 0 ? (
                    <p className="book-detail-empty-state">
                      이 회차의 독서 기록이 없습니다.
                    </p>
                  ) : (
                    <div className="book-round-record-list">
                      {selectedRoundRecords.map((record) => (
                        <div key={record.id} className="book-round-record-item">
                          <div className="book-round-record-meta">
                            <div>
                              <strong>{record.date}</strong>
                              <span>
                                {record.startPage}p → {record.endPage}p
                              </span>
                            </div>
                            <em>{formatDuration(record.durationSeconds)}</em>
                          </div>
                          {record.sentence && (
                            <p className="book-round-record-sentence">
                              {record.sentence}
                              {record.sentencePage && (
                                <span>{record.sentencePage}p</span>
                              )}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </section>

                {selectedRoundSentences.length > 0 && (
                  <section className="book-detail-section book-round-section">
                    <div className="book-detail-section-heading">
                      <h3>기록한 문장</h3>
                      <span>{selectedRoundSentences.length}개</span>
                    </div>
                    <div className="book-round-quote-list">
                      {selectedRoundSentences.map((record) => (
                        <blockquote
                          key={`${record.id}-sentence`}
                          className="book-round-quote"
                        >
                          {record.sentence}
                          <span>
                            {record.date}
                            {record.sentencePage
                              ? ` · ${record.sentencePage}p`
                              : ""}
                          </span>
                        </blockquote>
                      ))}
                    </div>
                  </section>
                )}
              </div>
            </>
          ) : selectedBook ? (
            <>
              <div className="book-detail-header">
                <div className="book-detail-hero">
                  <div
                    className="book-detail-cover"
                    style={{
                      backgroundColor: selectedBook.coverColor,
                      borderColor: selectedBook.accentColor,
                    }}
                  >
                    {selectedBook.thumbnail ? (
                      <img src={selectedBook.thumbnail} alt="" />
                    ) : (
                      <span
                        style={{ backgroundColor: selectedBook.accentColor }}
                      />
                    )}
                  </div>
                  <div className="book-detail-hero-copy">
                    <div className="book-detail-hero-meta">
                      <span className="book-detail-status-badge">
                        {selectedBook.status === "completed"
                          ? "완독"
                          : "읽는 중"}
                      </span>
                      {(selectedBook.activeRoundNumber ?? 1) > 1 && (
                        <span className="book-detail-round-label">
                          {selectedBook.activeRoundNumber}회차
                        </span>
                      )}
                    </div>
                    <h2>{selectedBook.title}</h2>
                    <p>{selectedBook.author}</p>
                  </div>
                  <div
                    className="book-detail-hero-progress"
                    aria-label="독서 진행률"
                  >
                    <div className="book-detail-hero-progress-label">
                      <span>진행률</span>
                      <strong>
                        {selectedBookStats.progress !== null
                          ? `${selectedBookStats.progress}%`
                          : "페이지 미설정"}
                      </strong>
                    </div>
                    <div className="book-detail-progress-track">
                      <span
                        style={{ width: `${selectedBookStats.progress ?? 0}%` }}
                      />
                    </div>
                    <div className="book-detail-hero-progress-meta">
                      <span>현재 페이지</span>
                      <strong>
                        {formatBookPages(
                          selectedBook.currentPage,
                          selectedBook.totalPages,
                        )}
                      </strong>
                    </div>
                  </div>
                </div>
              </div>

              <div className="book-detail-body">
                {selectedBookRounds.length > 1 && (
                  <div className="book-detail-active-round">
                    <span className="text-xs font-black text-stone-500">
                      현재 회차
                    </span>
                    <strong className="text-sm font-black text-[#5F6D57]">
                      {getActiveRoundLabel(selectedBook)}
                    </strong>
                  </div>
                )}

                {selectedBookRounds.length > 1 && (
                  <div className="book-detail-rounds">
                    <div className="mb-2 flex items-center justify-between gap-3">
                      <h2 className="text-sm font-black">회차 관리</h2>
                      <span className="text-[11px] font-black text-stone-500">
                        {selectedBookRounds.length}개
                      </span>
                    </div>
                    <div className="space-y-2">
                      {selectedBookRounds.map((round) => {
                        const roundRecords = getRoundRecords(
                          selectedBookRecords,
                          round,
                        );
                        const roundDurationSeconds = roundRecords.reduce(
                          (sum, record) => sum + record.durationSeconds,
                          0,
                        );
                        const isActiveRound =
                          round.id === selectedBook.activeRoundId;
                        const canDeleteRound = round.roundNumber > 1;

                        return (
                          <div
                            key={round.id}
                            className="book-detail-round-item"
                          >
                            <button
                              type="button"
                              className="min-w-0 text-left"
                              onClick={() => setSelectedRoundId(round.id)}
                            >
                              <div className="flex items-center gap-2">
                                <p className="text-sm font-black">
                                  {round.roundNumber}회독
                                </p>
                                {isActiveRound && (
                                  <span className="book-detail-round-badge book-detail-round-badge-active">
                                    현재
                                  </span>
                                )}
                                <span className="book-detail-round-badge">
                                  {round.status === "completed"
                                    ? "완독"
                                    : "읽는 중"}
                                </span>
                              </div>
                              <p className="mt-1 truncate text-[11px] font-black text-stone-500">
                                {formatBookPages(
                                  round.currentPage,
                                  selectedBook.totalPages,
                                )}{" "}
                                · 기록 {roundRecords.length}개 ·{" "}
                                {formatDuration(
                                  roundDurationSeconds ||
                                    round.accumulatedSeconds,
                                )}
                              </p>
                            </button>
                            <button
                              type="button"
                              className="mini-icon-button bg-[#B58A7A] text-[#FFFDF8] disabled:cursor-not-allowed disabled:opacity-40"
                              onClick={() => setDeleteRoundId(round.id)}
                              disabled={!canDeleteRound || isMutating}
                              aria-label={`${round.roundNumber}회독 삭제`}
                            >
                              <Icon name="trash" className="h-4 w-4" />
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                <section className="book-detail-progress-section">
                  <div className="book-detail-section-title">
                    <h2>독서 진행</h2>
                  </div>

                  <div className="book-detail-page-control">
                    <div className="book-detail-page-control-heading">
                      <label htmlFor="book-current-page">현재 페이지</label>
                      <strong>
                        {formatBookPages(
                          selectedBook.currentPage,
                          selectedBook.totalPages,
                        )}
                      </strong>
                    </div>
                    <div className="book-detail-inline-form">
                      <input
                        id="book-current-page"
                        className="pixel-input"
                        type="text"
                        inputMode="numeric"
                        min={1}
                        max={selectedBook.totalPages ?? undefined}
                        value={currentPageDraft}
                        onChange={(event) =>
                          setCurrentPageDraft(
                            parsePageInput(event.target.value),
                          )
                        }
                      />
                      <button
                        type="button"
                        className="primary-button px-3"
                        onClick={saveCurrentPage}
                        disabled={currentPageDraft === selectedBook.currentPage}
                      >
                        저장
                      </button>
                    </div>
                  </div>

                  {selectedBook.totalPages === null && (
                    <div className="book-detail-page-control book-detail-total-pages-control">
                      <div className="book-detail-page-control-heading">
                        <div>
                          <label htmlFor="book-total-pages">전체 페이지</label>
                          <p>입력하면 진행률과 남은 시간을 계산합니다.</p>
                        </div>
                      </div>
                      <div className="book-detail-inline-form">
                        <input
                          id="book-total-pages"
                          className="pixel-input"
                          type="text"
                          inputMode="numeric"
                          min={selectedBook.currentPage}
                          value={totalPagesDraft}
                          onChange={(event) =>
                            setTotalPagesDraft(
                              parsePageInput(event.target.value),
                            )
                          }
                        />
                        <button
                          type="button"
                          className="primary-button px-3"
                          onClick={saveTotalPages}
                          disabled={
                            totalPagesDraft < selectedBook.currentPage ||
                            isMutating
                          }
                        >
                          추가
                        </button>
                      </div>
                    </div>
                  )}

                  <div className="book-detail-progress-list">
                    <div className="book-detail-progress-item">
                      <span>남은 페이지</span>
                      <strong>
                        {selectedBookStats.remainingPages !== null
                          ? `${selectedBookStats.remainingPages}p`
                          : "-"}
                      </strong>
                    </div>
                    <div className="book-detail-progress-item">
                      <span>예상 남은 시간</span>
                      <strong>
                        {selectedBookStats.estimatedSecondsLeft !== null &&
                        selectedBookStats.estimatedSecondsLeft > 0
                          ? formatDuration(
                              selectedBookStats.estimatedSecondsLeft,
                            )
                          : "-"}
                      </strong>
                    </div>
                    <div className="book-detail-progress-item">
                      <span>누적 시간</span>
                      <strong>
                        {formatDuration(selectedBook.accumulatedSeconds)}
                      </strong>
                    </div>
                    <div className="book-detail-progress-item">
                      <span>평균 속도</span>
                      <strong>
                        {selectedBookStats.averagePagesPerHour > 0
                          ? `${selectedBookStats.averagePagesPerHour}p/h`
                          : "-"}
                      </strong>
                    </div>
                  </div>

                  <div className="book-detail-meta-list">
                    <div className="book-detail-meta-item">
                      <span>시작일</span>
                      <strong>{selectedBook.startedAt}</strong>
                    </div>
                    <div className="book-detail-meta-item">
                      <span>완독일</span>
                      <strong>{selectedBook.completedAt ?? "-"}</strong>
                    </div>
                    <div className="book-detail-meta-item">
                      <span>독서 기록</span>
                      <strong>{selectedBookRecords.length}회</strong>
                    </div>
                  </div>
                </section>

                <section className="book-detail-records-section">
                  <div className="book-detail-section-title">
                    <h2>최근 독서 기록</h2>
                    <strong>{selectedBookStats.recordedPages}p</strong>
                  </div>
                  {recentBookRecords.length === 0 ? (
                    <p className="book-detail-empty-state">
                      아직 이 책의 독서 기록이 없습니다.
                    </p>
                  ) : (
                    <div className="book-detail-record-list">
                      {recentBookRecords.map((record) => (
                        <div
                          key={record.id}
                          className="book-detail-record-item"
                        >
                          <span className="book-detail-record-marker" />
                          <div>
                            <p>{formatDateWithWeekday(record.date)}</p>
                            <span>
                              {record.roundNumber ?? 1}회독 · {record.startPage}
                              p → {record.endPage}p
                            </span>
                          </div>
                          <strong>
                            {formatDuration(record.durationSeconds)}
                          </strong>
                        </div>
                      ))}
                    </div>
                  )}
                </section>

                <section className="book-detail-sentence-section">
                  <div className="book-detail-section-title">
                    <h2>기록한 문장</h2>
                    <button
                      type="button"
                      className="book-detail-add-sentence"
                      onClick={startAdd}
                      aria-label="문장 추가"
                    >
                      <Icon name="plus" className="h-4 w-4" />
                    </button>
                  </div>
                  {selectedBook.sentences.length > 1 && (
                    <div className="book-detail-sort-switch">
                      <button
                        type="button"
                        className={
                          sentenceSort === "created"
                            ? "book-detail-sort-option book-detail-sort-option-active"
                            : "book-detail-sort-option"
                        }
                        onClick={() => setSentenceSort("created")}
                      >
                        등록순
                      </button>
                      <button
                        type="button"
                        className={
                          sentenceSort === "page"
                            ? "book-detail-sort-option book-detail-sort-option-active"
                            : "book-detail-sort-option"
                        }
                        onClick={() => setSentenceSort("page")}
                      >
                        페이지순
                      </button>
                    </div>
                  )}
                  <div className="book-detail-sentence-list">
                    {selectedBook.sentences.length === 0 ? (
                      <p className="book-detail-empty-state">
                        아직 기록한 문장이 없습니다.
                      </p>
                    ) : (
                      sortedSentences.map((sentence) => {
                        const isEditing = editingSentenceId === sentence.id;

                        return (
                          <div
                            key={sentence.id}
                            className="book-detail-sentence-item"
                          >
                            {isEditing ? (
                              <div className="book-detail-sentence-editor">
                                <div className="book-detail-sentence-editor-page">
                                  <label
                                    htmlFor={`sentence-page-${sentence.id}`}
                                  >
                                    페이지
                                  </label>
                                  <input
                                    id={`sentence-page-${sentence.id}`}
                                    className="book-detail-sentence-page-input"
                                    type="text"
                                    inputMode="numeric"
                                    min={1}
                                    max={selectedBook.totalPages ?? undefined}
                                    value={draftPage}
                                    onChange={(event) =>
                                      setDraftPage(
                                        parsePageInput(event.target.value),
                                      )
                                    }
                                  />
                                </div>
                                <textarea
                                  className="book-detail-sentence-textarea"
                                  value={draftSentence}
                                  onChange={(event) =>
                                    setDraftSentence(event.target.value)
                                  }
                                />
                                <div className="book-detail-editor-actions">
                                  <button
                                    type="button"
                                    className="book-detail-editor-cancel"
                                    onClick={cancelDraft}
                                  >
                                    취소
                                  </button>
                                  <button
                                    type="button"
                                    className="book-detail-editor-save"
                                    onClick={saveEdit}
                                    disabled={draftSentence.trim().length === 0}
                                  >
                                    <Icon name="save" className="h-4 w-4" />
                                    저장
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <>
                                <div className="book-detail-sentence-item-header">
                                  <span className="book-detail-sentence-page">
                                    {sentence.page}p
                                  </span>
                                  <div className="book-detail-sentence-actions">
                                    <button
                                      type="button"
                                      className="mini-icon-button"
                                      onClick={() =>
                                        startEdit(
                                          sentence.id,
                                          sentence.text,
                                          sentence.page,
                                        )
                                      }
                                      aria-label="문장 수정"
                                    >
                                      <Icon name="edit" className="h-4 w-4" />
                                    </button>
                                    <button
                                      type="button"
                                      className="mini-icon-button"
                                      onClick={() =>
                                        setDeleteSentenceId(sentence.id)
                                      }
                                      aria-label="문장 삭제"
                                    >
                                      <Icon name="trash" className="h-4 w-4" />
                                    </button>
                                  </div>
                                </div>
                                <blockquote className="book-detail-sentence-quote">
                                  {sentence.text}
                                  <span>{sentence.recordedAt}</span>
                                </blockquote>
                              </>
                            )}
                          </div>
                        );
                      })
                    )}
                  </div>
                </section>

                {hasCompletedRound(selectedBook) &&
                  selectedBook.status === "completed" && (
                    <div className="book-detail-reread">
                      <div className="mb-3 flex items-center justify-between gap-3">
                        <div>
                          <p className="text-sm font-black">재독</p>
                          <p className="mt-1 text-xs font-black text-stone-600">
                            새 회차를 1페이지부터 시작합니다.
                          </p>
                        </div>
                        <span className="book-detail-reread-badge">
                          {getNextRoundNumber(selectedBook)}회독
                        </span>
                      </div>
                      <button
                        type="button"
                        className="primary-button min-h-10 w-full"
                        onClick={startReread}
                        disabled={isMutating}
                      >
                        <Icon name="play" className="h-5 w-5" />
                        재독 시작
                      </button>
                    </div>
                  )}

                <div className="book-detail-danger-zone">
                  <button
                    type="button"
                    className="book-detail-delete-button"
                    onClick={() => setDeleteBookId(selectedBook.id)}
                  >
                    <Icon name="trash" className="h-4 w-4" />책 삭제
                  </button>
                </div>
              </div>
            </>
          ) : null}
        </section>
      )}

      <BottomSheetModal
        isOpen={Boolean(selectedBook && isAddingSentence)}
        ariaLabel="문장 추가"
        backdropClassName="modal-backdrop-top"
        panelClassName="book-sentence-sheet"
        onBackdropClick={cancelDraft}
      >
        {selectedBook && (
          <>
            <div className="book-sentence-sheet-header">
              <div>
                <h2>기록할 문장</h2>
                <p>{selectedBook.title}</p>
              </div>
              <button
                type="button"
                className="book-sentence-sheet-close"
                onClick={cancelDraft}
                aria-label="문장 추가 닫기"
              >
                <Icon name="close" className="h-4 w-4" />
              </button>
            </div>

            <div className="book-detail-sentence-editor book-sentence-sheet-form">
              <div className="book-detail-sentence-editor-page">
                <label htmlFor="new-sentence-page">페이지</label>
                <input
                  id="new-sentence-page"
                  className="book-detail-sentence-page-input"
                  type="text"
                  inputMode="numeric"
                  min={1}
                  max={selectedBook.totalPages ?? undefined}
                  value={draftPage}
                  onChange={(event) =>
                    setDraftPage(parsePageInput(event.target.value))
                  }
                />
              </div>
              <textarea
                className="book-detail-sentence-textarea"
                placeholder="기억에 남는 문장을 남겨보세요."
                value={draftSentence}
                onChange={(event) => setDraftSentence(event.target.value)}
                autoFocus
              />
              <div className="book-detail-editor-actions">
                <button
                  type="button"
                  className="book-detail-editor-cancel"
                  onClick={cancelDraft}
                >
                  취소
                </button>
                <button
                  type="button"
                  className="book-detail-editor-save"
                  onClick={saveAdd}
                  disabled={draftSentence.trim().length === 0 || isMutating}
                >
                  <Icon name="save" className="h-4 w-4" />
                  추가
                </button>
              </div>
            </div>
          </>
        )}
      </BottomSheetModal>

      <BottomSheetModal
        isOpen={Boolean(selectedBook && deleteSentence)}
        ariaLabel="문장 삭제 확인"
        role="alertdialog"
        backdropClassName="modal-backdrop-top"
        panelClassName="max-w-[360px]"
      >
        {deleteSentence && (
          <>
            <div className="mb-3 flex items-center gap-2">
              <div className="grid h-10 w-10 place-items-center border-2 border-[#2F2A26] bg-[#B58A7A] text-[#FFFDF8]">
                <Icon name="trash" className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-lg font-black">문장 삭제</h2>
                <p className="text-xs font-black text-stone-500">
                  삭제한 문장은 되돌릴 수 없습니다.
                </p>
              </div>
            </div>
            <blockquote className="mb-4 max-h-28 overflow-y-auto border-2 border-[#2F2A26] bg-[#FCFBF7] p-3 text-sm font-bold leading-relaxed">
              {deleteSentence.text}
              <span className="mt-2 block text-xs font-black text-stone-500">
                {deleteSentence.page}p
              </span>
            </blockquote>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                className="secondary-button"
                onClick={() => setDeleteSentenceId(null)}
              >
                취소
              </button>
              <button
                type="button"
                className="danger-button"
                onClick={confirmDelete}
              >
                <Icon name="trash" className="h-5 w-5" />
                삭제
              </button>
            </div>
          </>
        )}
      </BottomSheetModal>

      <BottomSheetModal
        isOpen={Boolean(selectedBook && deleteRound)}
        ariaLabel="회차 삭제 확인"
        role="alertdialog"
        backdropClassName="modal-backdrop-top"
        panelClassName="max-w-[360px]"
      >
        {selectedBook && deleteRound && (
          <>
            <div className="mb-3 flex items-center gap-2">
              <div className="grid h-10 w-10 place-items-center border-2 border-[#2F2A26] bg-[#B58A7A] text-[#FFFDF8]">
                <Icon name="trash" className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-lg font-black">
                  {deleteRound.roundNumber}회독 삭제
                </h2>
                <p className="text-xs font-black text-stone-500">
                  이 회차의 독서 기록도 함께 삭제됩니다.
                </p>
              </div>
            </div>
            <div className="mb-4 border-2 border-[#2F2A26] bg-[#FCFBF7] p-3">
              <MiniBook book={selectedBook} compact />
              <div className="mt-3 grid grid-cols-2 gap-2 text-xs font-black">
                <div className="border-2 border-[#2F2A26] bg-[#F3E8D0] px-2 py-2">
                  <p className="text-[10px] text-stone-500">회차</p>
                  <p className="mt-1">{deleteRound.roundNumber}회독</p>
                </div>
                <div className="border-2 border-[#2F2A26] bg-[#F3E8D0] px-2 py-2">
                  <p className="text-[10px] text-stone-500">기록</p>
                  <p className="mt-1">
                    {getRoundRecords(selectedBookRecords, deleteRound).length}개
                  </p>
                </div>
              </div>
              <p className="mt-3 text-xs font-black leading-relaxed text-[#B58A7A]">
                책과 다른 회차 기록은 그대로 유지됩니다.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                className="secondary-button"
                onClick={() => setDeleteRoundId(null)}
                disabled={isMutating}
              >
                취소
              </button>
              <button
                type="button"
                className="danger-button"
                onClick={confirmDeleteRound}
                disabled={isMutating || deleteRound.roundNumber <= 1}
              >
                <Icon name="trash" className="h-5 w-5" />
                삭제
              </button>
            </div>
          </>
        )}
      </BottomSheetModal>

      <BottomSheetModal
        isOpen={Boolean(deleteBook)}
        ariaLabel="책 삭제 확인"
        role="alertdialog"
        backdropClassName="modal-backdrop-top"
        panelClassName="max-w-[360px]"
      >
        {deleteBook && (
          <>
            <div className="mb-3 flex items-center gap-2">
              <div className="grid h-10 w-10 place-items-center border-2 border-[#2F2A26] bg-[#B58A7A] text-[#FFFDF8]">
                <Icon name="trash" className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-lg font-black">책 삭제</h2>
                <p className="text-xs font-black text-stone-500">
                  서재와 기록한 문장에서 제거됩니다.
                </p>
              </div>
            </div>
            <div className="mb-4 border-2 border-[#2F2A26] bg-[#FCFBF7] p-3">
              <MiniBook book={deleteBook} />
              <p className="mt-3 text-xs font-black leading-relaxed text-[#B58A7A]">
                독서 세션 기록은 기록 탭에 그대로 남습니다.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                className="secondary-button"
                onClick={() => setDeleteBookId(null)}
              >
                취소
              </button>
              <button
                type="button"
                className="danger-button"
                onClick={confirmDeleteBook}
              >
                <Icon name="trash" className="h-5 w-5" />
                삭제
              </button>
            </div>
          </>
        )}
      </BottomSheetModal>

      <BottomSheetModal
        isOpen={isBookFormOpen}
        ariaLabel="새 책 추가"
        backdropClassName="modal-backdrop-top"
        panelClassName="book-form-panel"
      >
        <div className="book-form-header">
          <div className="flex min-w-0 items-center gap-2">
            {bookFormStep === "details" && (
              <button
                type="button"
                className="book-form-back-button"
                onClick={openBookSearchStep}
                aria-label="책 검색으로 돌아가기"
              >
                <Icon name="chevronLeft" className="h-7 w-7" />
              </button>
            )}
            <div className="min-w-0">
              <p className="book-form-eyebrow">
                {bookFormStep === "search" ? "BOOK SEARCH" : "BOOK DETAIL"}
              </p>
              <h2>{bookFormStep === "search" ? "책 검색" : "상세정보 입력"}</h2>
            </div>
          </div>
          <button
            type="button"
            className="book-form-close-button"
            onClick={closeBookForm}
            aria-label="닫기"
          >
            <Icon name="close" className="h-5 w-5" />
          </button>
        </div>

        {bookFormStep === "search" ? (
          <div className="book-search-step">
            <form
              className="book-search-form"
              onSubmit={(event) => {
                event.preventDefault();
                void submitBookSearch();
              }}
            >
              <label className="book-form-label" htmlFor="book-search-query">
                읽을 책을 찾아보세요
              </label>
              <div className="book-search-input-wrap">
                <Icon name="book" className="h-5 w-5" />
                <input
                  id="book-search-query"
                  placeholder="제목, 저자, ISBN"
                  value={bookSearchQuery}
                  onChange={(event) => setBookSearchQuery(event.target.value)}
                />
                <button
                  type="submit"
                  className="book-search-submit"
                  disabled={bookSearchStatus === "loading"}
                >
                  {bookSearchStatus === "loading" ? "검색 중" : "검색"}
                </button>
              </div>
              {!hasKakaoBookApiKey && (
                <p className="mt-2 text-xs font-black leading-relaxed text-[#B58A7A]">
                  `.env`에 `VITE_KAKAO_REST_API_KEY`를 추가하면 검색을 사용할 수
                  있습니다.
                </p>
              )}
              {bookSearchMessage && (
                <p className="mt-2 text-xs font-black leading-relaxed text-stone-600">
                  {bookSearchMessage}
                </p>
              )}
              {bookSearchResults.length > 0 && (
                <div className="book-search-results">
                  {bookSearchResults.map((book) => (
                    <button
                      key={book.id}
                      type="button"
                      className="book-search-result"
                      onClick={() => selectSearchResult(book)}
                    >
                      <div className="flex gap-3">
                        {book.thumbnail ? (
                          <img
                            className="book-search-result-cover"
                            src={book.thumbnail}
                            alt=""
                          />
                        ) : (
                          <div className="book-search-result-cover book-search-result-cover-empty">
                            <Icon name="book" className="h-5 w-5" />
                          </div>
                        )}
                        <div className="min-w-0 self-center">
                          <p className="truncate text-sm font-black text-stone-900">
                            {book.title}
                          </p>
                          <p className="mt-1 truncate text-xs font-bold text-stone-600">
                            {book.authors.join(", ") || "저자 정보 없음"}
                          </p>
                          <p className="mt-1 truncate text-[11px] font-black text-stone-500">
                            {book.publisher || "출판사 정보 없음"}
                          </p>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </form>
            <button
              type="button"
              className="book-manual-entry"
              onClick={startManualBookEntry}
            >
              <Icon name="plus" className="h-5 w-5" />
              직접 입력
            </button>
          </div>
        ) : (
          <>
            <div className="book-form-preview">
              {newBook.thumbnail ? (
                <img
                  className="book-form-preview-cover"
                  src={newBook.thumbnail}
                  alt=""
                />
              ) : (
                <div className="book-form-preview-cover book-form-preview-cover-empty">
                  <Icon name="book" className="h-6 w-6" />
                </div>
              )}
              <div className="min-w-0 self-center">
                <p className="truncate text-sm font-black text-stone-900">
                  {newBook.title.trim() || "책 제목을 입력해 주세요"}
                </p>
                <p className="mt-1 truncate text-xs font-bold text-stone-600">
                  {newBook.author.trim() || "저자 정보 없음"}
                </p>
                <button
                  type="button"
                  className="book-form-research-button"
                  onClick={openBookSearchStep}
                >
                  다시 검색
                </button>
              </div>
            </div>

            <div className="book-form-fields">
              <label className="book-form-label" htmlFor="new-book-title">
                책 제목
              </label>
              <input
                id="new-book-title"
                className="book-form-input"
                value={newBook.title}
                onChange={(event) =>
                  setNewBook((current) => ({
                    ...current,
                    title: event.target.value,
                  }))
                }
              />

              <label className="book-form-label" htmlFor="new-book-author">
                저자
              </label>
              <input
                id="new-book-author"
                className="book-form-input"
                value={newBook.author}
                onChange={(event) =>
                  setNewBook((current) => ({
                    ...current,
                    author: event.target.value,
                  }))
                }
              />

              <div>
                <p className="book-form-label">등록 상태</p>
                <div className="book-status-switch">
                  {(["reading", "completed"] as const).map((status) => (
                    <button
                      key={status}
                      type="button"
                      className={
                        newBook.status === status
                          ? "book-status-option book-status-option-active"
                          : "book-status-option"
                      }
                      onClick={() => {
                        setNewBook((current) => ({
                          ...current,
                          status,
                          currentPage:
                            status === "completed" && current.totalPages
                              ? current.totalPages
                              : clampBookPage(
                                  current.currentPage,
                                  current.totalPages,
                                ),
                          startedAt:
                            status === "completed"
                              ? current.startedAt
                              : undefined,
                          completedAt:
                            status === "completed"
                              ? (current.completedAt ??
                                toDateInputValue(todayLabel()))
                              : undefined,
                        }));
                        setBookDateError("");
                      }}
                    >
                      {status === "reading" ? "읽는 중" : "완독함"}
                    </button>
                  ))}
                </div>
              </div>

              <div className="book-form-pages-fields">
                <div className="book-total-pages-section">
                  <p className="book-form-label">분량 정보</p>
                  <div
                    className="book-total-pages-mode"
                    role="group"
                    aria-label="전체 페이지 입력 방식"
                  >
                    <button
                      type="button"
                      className={
                        newBook.totalPages !== null
                          ? "book-total-pages-mode-option book-total-pages-mode-option-active"
                          : "book-total-pages-mode-option"
                      }
                      onClick={() =>
                        setNewBook((current) => ({
                          ...current,
                          totalPages: current.totalPages ?? 240,
                          currentPage: clampBookPage(
                            current.currentPage,
                            current.totalPages ?? 240,
                          ),
                        }))
                      }
                    >
                      페이지 수 입력
                    </button>
                    <button
                      type="button"
                      className={
                        newBook.totalPages === null
                          ? "book-total-pages-mode-option book-total-pages-mode-option-active"
                          : "book-total-pages-mode-option"
                      }
                      onClick={() =>
                        setNewBook((current) => ({
                          ...current,
                          totalPages: null,
                        }))
                      }
                    >
                      나중에 입력
                    </button>
                  </div>
                  {newBook.totalPages !== null ? (
                    <div className="book-total-pages-input">
                      <label
                        className="book-form-label"
                        htmlFor="new-book-total"
                      >
                        전체 페이지
                      </label>
                      <input
                        id="new-book-total"
                        className="book-form-input"
                        type="text"
                        inputMode="numeric"
                        min={1}
                        value={newBook.totalPages}
                        onChange={(event) =>
                          setNewBook((current) => {
                            const totalPages = Math.max(
                              parsePageInput(event.target.value),
                              1,
                            );

                            return {
                              ...current,
                              totalPages,
                              currentPage:
                                current.status === "completed"
                                  ? totalPages
                                  : Math.min(current.currentPage, totalPages),
                            };
                          })
                        }
                      />
                    </div>
                  ) : (
                    <p className="book-total-pages-hint">
                      책 상세에서 언제든 전체 페이지를 추가할 수 있어요.
                    </p>
                  )}
                </div>
                {newBook.status === "reading" ? (
                  <div>
                    <label
                      className="book-form-label"
                      htmlFor="new-book-current"
                    >
                      현재 페이지
                    </label>
                    <input
                      id="new-book-current"
                      className="book-form-input"
                      type="text"
                      inputMode="numeric"
                      min={1}
                      max={newBook.totalPages ?? undefined}
                      value={newBook.currentPage}
                      onChange={(event) =>
                        setNewBook((current) => ({
                          ...current,
                          currentPage: parsePageInput(event.target.value),
                        }))
                      }
                    />
                  </div>
                ) : (
                  <div>
                    <label
                      className="book-form-label"
                      htmlFor="new-book-completed-at"
                    >
                      완독일
                    </label>
                    <input
                      id="new-book-completed-at"
                      className="book-form-input"
                      type="date"
                      value={toDateInputValue(
                        newBook.completedAt ?? todayLabel(),
                      )}
                      onChange={(event) => {
                        setBookDateError("");
                        setNewBook((current) => ({
                          ...current,
                          completedAt: event.target.value,
                        }));
                      }}
                    />
                  </div>
                )}
              </div>

              {newBook.status === "completed" && (
                <div className="book-completed-date-field">
                  <label
                    className="book-form-label"
                    htmlFor="new-book-started-at"
                  >
                    시작일 <span>선택</span>
                  </label>
                  <input
                    id="new-book-started-at"
                    className="book-form-input"
                    type="date"
                    value={toDateInputValue(newBook.startedAt ?? "")}
                    onChange={(event) => {
                      setBookDateError("");
                      setNewBook((current) => ({
                        ...current,
                        startedAt: event.target.value,
                      }));
                    }}
                  />
                  {bookDateError && (
                    <p className="book-form-error">{bookDateError}</p>
                  )}
                </div>
              )}
            </div>

            <div className="book-form-actions">
              <button
                type="button"
                className="book-form-secondary-action"
                onClick={openBookSearchStep}
              >
                이전
              </button>
              <button
                type="button"
                className="book-form-primary-action"
                onClick={saveBook}
                disabled={newBook.title.trim().length === 0}
              >
                <Icon name="save" className="h-5 w-5" />
                추가
              </button>
            </div>
          </>
        )}
      </BottomSheetModal>
    </div>
  );
};

type BookShelfSectionProps = {
  tone: "reading" | "completed";
  books: Book[];
  tierBoard: TierBoard;
  onSelectBook: (bookId: string) => void;
};

const BookShelfSection = ({
  tone,
  books,
  tierBoard,
  onSelectBook,
}: BookShelfSectionProps) => {
  const completedPages = books.reduce(
    (sum, book) => sum + (book.totalPages ?? book.currentPage),
    0,
  );

  return (
    <section className="library-shelf-section">
      {books.length === 0 ? (
        <div className="library-empty-state">
          {tone === "reading"
            ? "읽는 중인 책이 없습니다."
            : "완독한 책이 없습니다."}
        </div>
      ) : tone === "completed" ? (
        <div className="completed-library-layout">
          <div className="completed-library-hero">
            <div>
              <h2>완독 컬렉션</h2>
              <p>읽어낸 책들이 쌓이고 있어요.</p>
            </div>
            <div className="completed-library-summary">
              <strong>{books.length}권</strong>
              <span>총 {completedPages.toLocaleString()}p</span>
            </div>
          </div>
          <div className="completed-library-grid">
            {books.map((book, index) => {
              const bookTier = getBookTier(tierBoard, book.id);

              return (
                <button
                  key={book.id}
                  type="button"
                  className="completed-book-button"
                  onClick={() => onSelectBook(book.id)}
                >
                  <div className="completed-book-card">
                    <div className="completed-book-card-inner">
                      <div
                        className="completed-book-cover"
                        style={{ backgroundColor: book.coverColor }}
                      >
                        <span className="completed-book-badge completed-book-rank-badge">
                          #{index + 1}
                        </span>
                        {bookTier && (
                          <span
                            className="completed-book-badge completed-book-tier-badge"
                            style={tierBadgeStyles[bookTier]}
                          >
                            {bookTier}
                          </span>
                        )}
                        {book.thumbnail ? (
                          <img src={book.thumbnail} alt="" />
                        ) : (
                          <div
                            className="h-full w-full"
                            style={{ backgroundColor: book.accentColor }}
                          />
                        )}
                      </div>
                      <div className="completed-book-title-bar">
                        <p className="completed-book-title">{book.title}</p>
                      </div>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="library-reading-list">
          {books.map((book) => {
            const progress = getBookProgress(book.currentPage, book.totalPages);

            return (
              <button
                key={book.id}
                type="button"
                className="library-book-card"
                onClick={() => onSelectBook(book.id)}
              >
                <div className="library-book-card-main">
                  <MiniBook book={book} />
                  <span className="library-book-progress-badge">
                    {progress !== null
                      ? `${progress}%`
                      : `${book.currentPage}p`}
                  </span>
                </div>
                {progress !== null && (
                  <div className="library-book-progress-track">
                    <div
                      className="library-book-progress-fill"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                )}
              </button>
            );
          })}
        </div>
      )}
    </section>
  );
};
