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
  onStartReread: (bookId: string) => Promise<void>;
  onDeleteRound: (bookId: string, roundId: string) => Promise<void>;
  shouldOpenBookForm: boolean;
  onDetailModeChange?: (isDetailMode: boolean) => void;
};

const emptyNewBook: NewBookInput = {
  title: "",
  author: "",
  totalPages: 240,
  currentPage: 1,
  status: "reading",
};

type SearchStatus = "idle" | "loading" | "success" | "empty" | "error";
type BookFormStep = "search" | "details";
type ShelfTab = "reading" | "completed";
type LibraryView = "shelf" | "tier";

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

const hasCompletedRound = (book: Book) =>
  book.status === "completed" ||
  Boolean(book.rounds?.some((round) => round.status === "completed"));

const getActiveRoundLabel = (book: Book) =>
  book.activeRoundNumber && book.activeRoundNumber > 1
    ? `${book.activeRoundNumber}회독`
    : "1회독";

const getNextRoundNumber = (book: Book) =>
  Math.max(0, ...(book.rounds ?? []).map((round) => round.roundNumber)) + 1;

const tierBadgeStyles: Record<TierKey, { backgroundColor: string; color: string }> = {
  S: { backgroundColor: "#F08A82", color: "#2F2A26" },
  A: { backgroundColor: "#F4B86E", color: "#2F2A26" },
  B: { backgroundColor: "#F2D86B", color: "#2F2A26" },
  C: { backgroundColor: "#A8D982", color: "#2F2A26" },
  D: { backgroundColor: "#8FC7F2", color: "#2F2A26" },
};

const getBookTier = (tierBoard: TierBoard, bookId: string) =>
  (Object.entries(tierBoard) as Array<[TierKey, string[]]>).find(([, bookIds]) =>
    bookIds.includes(bookId),
  )?.[0] ?? null;

const getRoundRecords = (
  records: ReadingRecord[],
  round: ReadingRound,
) =>
  records.filter((record) =>
    record.roundId
      ? record.roundId === round.id
      : round.roundNumber === 1 && (record.roundNumber ?? 1) === 1,
  );

const getRoundDateRange = (round: ReadingRound, records: ReadingRecord[]) => {
  const dates = records.map((record) => record.date).sort();
  const startedAt = dates[0] ?? round.startedAt;
  const endedAt = round.completedAt ?? dates.at(-1) ?? "";

  return endedAt && endedAt !== startedAt ? `${startedAt} - ${endedAt}` : startedAt;
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
    ? Math.round((selectedBook.currentPage / selectedBook.totalPages) * 100)
    : 0;
  const selectedBookRemainingPages = selectedBook
    ? Math.max(selectedBook.totalPages - selectedBook.currentPage, 0)
    : 0;
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
      ? Math.round((selectedBookRecordedPages / selectedBookRecordedSeconds) * 3600)
      : 0;
  const selectedBookEstimatedSecondsLeft =
    selectedBookAveragePagesPerHour > 0
      ? Math.round((selectedBookRemainingPages / selectedBookAveragePagesPerHour) * 3600)
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
          right.date.localeCompare(left.date) || right.id.localeCompare(left.id),
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
              left.sentence.page - right.sentence.page || left.index - right.index,
          )
          .map(({ sentence }) => sentence)
      : selectedBook?.sentences ?? [];

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

    const nextPage = Math.min(
      Math.max(Math.floor(currentPageDraft) || 1, 1),
      selectedBook.totalPages,
    );

    setIsMutating(true);

    try {
      setCurrentPageDraft(nextPage);
      await onUpdateBookPage(selectedBook.id, nextPage);
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

    const totalPages = Math.max(Math.floor(newBook.totalPages) || 1, 1);
    const currentPage =
      newBook.status === "completed"
        ? totalPages
        : Math.min(
            Math.max(Math.floor(newBook.currentPage) || 1, 1),
            totalPages,
          );
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
    <div className="space-y-4">
      {!selectedBook && (
        <>
      <header className="flex items-center justify-between gap-3">
        <div>
          <p className="pixel-label">
            {libraryView === "tier" ? "TIER MAKER" : "MY LIBRARY"}
          </p>
          <h1 className="mt-1 text-2xl font-black">
            {libraryView === "tier" ? "완독 책 티어" : "서재"}
          </h1>
        </div>
        <div className="flex items-center gap-2">
          {libraryView === "tier" ? (
            <button
              type="button"
              className="secondary-button px-3 py-2 text-xs"
              onClick={() => setLibraryView("shelf")}
            >
              서재로
            </button>
          ) : (
            <>
              <button
                type="button"
                className="icon-button"
                onClick={() => setLibraryView("tier")}
                aria-label="티어메이커"
              >
                <Icon name="tier" className="h-5 w-5" />
              </button>
              <button
                type="button"
                className="icon-button"
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
        <div className="space-y-3">
        <div className="library-shelf-tabs grid grid-cols-2 gap-2 border-2 border-[#2F2A26] bg-[#E8DFC2] p-1 shadow-pixel">
          {[
            { id: "reading" as const, label: "독서중", count: readingBooks.length },
            { id: "completed" as const, label: "완독", count: completedBooks.length },
          ].map((tab) => {
            const isActive = activeShelfTab === tab.id;

            return (
              <button
                key={tab.id}
                type="button"
                className={`library-shelf-tab flex items-center justify-center gap-2 border-2 border-[#2F2A26] px-3 py-2 text-sm font-black transition ${
                  isActive
                    ? "library-shelf-tab-active bg-[#87937A] text-[#FFFDF8] shadow-[2px_2px_0_rgba(47,42,38,0.78)]"
                    : "bg-[#FCFBF7] text-[#2F2A26]"
                }`}
                onClick={() => setActiveShelfTab(tab.id)}
                aria-pressed={isActive}
              >
                <span>{tab.label}</span>
                <span
                  className={`library-shelf-tab-count min-w-6 border-2 px-1 text-xs ${
                    isActive
                      ? "library-shelf-tab-count-active border-[#FFFDF8] bg-[#5F6D57] text-[#FFFDF8]"
                      : "border-[#2F2A26] bg-[#F3E8D0] text-[#2F2A26]"
                  }`}
                >
                  {tab.count}
                </span>
              </button>
            );
          })}
        </div>
        <BookShelfSection
          tone={activeShelfTab}
          books={activeShelfBooks}
          tierBoard={tierBoard}
          onSelectBook={selectBook}
        />
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
              onClick={closeDetail}
              aria-label="서재로 돌아가기"
            >
              <Icon name="chevronLeft" className="h-5 w-5" />
            </button>
            <h1 className="truncate text-xl font-black">{selectedBook.title}</h1>
          </header>

        {selectedBook && selectedRound ? (
          <>
            <div className="book-detail-header flex items-center justify-between gap-3">
              <button
                type="button"
                className="icon-button shrink-0"
                onClick={() => setSelectedRoundId(null)}
                aria-label="책 상세로 돌아가기"
              >
                <Icon name="chevronLeft" className="h-7 w-7" />
              </button>
              <div className="min-w-0 flex-1 text-center">
                <p className="pixel-label">ROUND DETAIL</p>
                <h2 className="mt-1 truncate text-xl font-black">
                  {selectedBook.title} · {selectedRound.roundNumber}회독
                </h2>
                <p className="mt-1 text-xs font-black text-stone-500">
                  {getRoundDateRange(selectedRound, selectedRoundRecords)}
                </p>
              </div>
              <button
                type="button"
                className="icon-button shrink-0"
                onClick={closeDetail}
                aria-label="닫기"
              >
                <Icon name="close" className="h-5 w-5" />
              </button>
            </div>

            <div className="book-detail-body">
              <div className="mb-4 grid grid-cols-3 gap-2">
                <div className="border-2 border-[#2F2A26] bg-[#F3E8D0] px-2 py-2">
                  <p className="text-[10px] font-black text-stone-500">상태</p>
                  <p className="mt-1 text-xs font-black">
                    {selectedRound.status === "completed" ? "완독" : "읽는 중"}
                  </p>
                </div>
                <div className="border-2 border-[#2F2A26] bg-[#F3E8D0] px-2 py-2">
                  <p className="text-[10px] font-black text-stone-500">시간</p>
                  <p className="mt-1 text-xs font-black">
                    {formatDuration(selectedRoundSeconds || selectedRound.accumulatedSeconds)}
                  </p>
                </div>
                <div className="border-2 border-[#2F2A26] bg-[#F3E8D0] px-2 py-2">
                  <p className="text-[10px] font-black text-stone-500">페이지</p>
                  <p className="mt-1 text-xs font-black">
                    {selectedRoundPages}p
                  </p>
                </div>
              </div>

              <div className="mb-4 grid grid-cols-3 gap-2">
                <div className="border-2 border-[#2F2A26] bg-[#FCFBF7] px-2 py-2">
                  <p className="text-[10px] font-black text-stone-500">진행</p>
                  <p className="mt-1 text-xs font-black">
                    {selectedRound.currentPage}/{selectedBook.totalPages}p
                  </p>
                </div>
                <div className="border-2 border-[#2F2A26] bg-[#FCFBF7] px-2 py-2">
                  <p className="text-[10px] font-black text-stone-500">기록</p>
                  <p className="mt-1 text-xs font-black">
                    {selectedRoundRecords.length}개
                  </p>
                </div>
                <div className="border-2 border-[#2F2A26] bg-[#FCFBF7] px-2 py-2">
                  <p className="text-[10px] font-black text-stone-500">문장</p>
                  <p className="mt-1 text-xs font-black">
                    {selectedRoundSentences.length}개
                  </p>
                </div>
              </div>

              <div>
                <div className="mb-2 flex items-center justify-between gap-3">
                  <h3 className="text-base font-black">독서 기록</h3>
                  <span className="text-[11px] font-black text-stone-500">
                    {selectedRoundRecords.length}개
                  </span>
                </div>
                {selectedRoundRecords.length === 0 ? (
                  <p className="border-2 border-dashed border-stone-400 bg-[#F3E8D0] px-3 py-3 text-center text-xs font-black text-stone-600">
                    이 회차의 독서 기록이 없습니다.
                  </p>
                ) : (
                  <div className="divide-y-2 divide-[#2F2A26] border-2 border-[#2F2A26] bg-[#FCFBF7]">
                    {selectedRoundRecords.map((record) => (
                      <div key={record.id} className="px-3 py-2">
                        <div className="flex items-center justify-between gap-3">
                          <div className="min-w-0">
                            <p className="text-xs font-black text-stone-800">
                              {record.date}
                            </p>
                            <p className="mt-1 text-[11px] font-black text-stone-500">
                              {record.startPage}p → {record.endPage}p
                            </p>
                          </div>
                          <span className="shrink-0 text-xs font-black text-[#5F6D57]">
                            {formatDuration(record.durationSeconds)}
                          </span>
                        </div>
                        {record.sentence && (
                          <p className="mt-2 line-clamp-3 border-l-4 border-[#5F6D57] bg-[#F3E8D0] p-2 text-xs font-bold leading-relaxed">
                            {record.sentence}
                            {record.sentencePage && (
                              <span className="ml-1 text-[10px] font-black text-stone-500">
                                {record.sentencePage}p
                              </span>
                            )}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {selectedRoundSentences.length > 0 && (
                <div className="mt-4">
                  <h3 className="mb-2 text-base font-black">기록한 문장</h3>
                  <div className="space-y-2">
                    {selectedRoundSentences.map((record) => (
                      <blockquote
                        key={`${record.id}-sentence`}
                        className="border-2 border-[#2F2A26] bg-[#FCFBF7] p-3 text-sm font-bold leading-relaxed"
                      >
                        {record.sentence}
                        <span className="mt-2 block text-xs font-black text-stone-500">
                          {record.date}
                          {record.sentencePage ? ` · ${record.sentencePage}p` : ""}
                        </span>
                      </blockquote>
                    ))}
                  </div>
                </div>
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
                    <span style={{ backgroundColor: selectedBook.accentColor }} />
                  )}
                </div>
                <div className="book-detail-hero-copy">
                  <p className="pixel-label">{getActiveRoundLabel(selectedBook)}</p>
                  <h2>{selectedBook.title}</h2>
                  <p>{selectedBook.author}</p>
                </div>
                <div className="book-detail-hero-progress">
                  <div>
                    <span>진행률</span>
                    <strong>{selectedBookStats.progress}%</strong>
                  </div>
                  <div>
                    <span>현재 페이지</span>
                    <strong>
                      {selectedBook.currentPage}/{selectedBook.totalPages}p
                    </strong>
                  </div>
                </div>
              </div>
            </div>

            <div className="book-detail-body">
              {selectedBookRounds.length > 1 && (
                <div className="mb-3 flex items-center justify-between gap-3 border-2 border-[#2F2A26] bg-[#FCFBF7] px-3 py-2">
                  <span className="text-xs font-black text-stone-500">현재 회차</span>
                  <strong className="text-sm font-black text-[#5F6D57]">
                    {getActiveRoundLabel(selectedBook)}
                  </strong>
                </div>
              )}

              {selectedBookRounds.length > 1 && (
                <div className="mb-4 border-2 border-[#2F2A26] bg-[#FCFBF7] p-3">
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
                      const isActiveRound = round.id === selectedBook.activeRoundId;
                      const canDeleteRound = round.roundNumber > 1;

                      return (
                        <div
                          key={round.id}
                          className="grid grid-cols-[1fr_auto] items-center gap-2 border-2 border-[#2F2A26] bg-[#F8F8F5] px-2 py-2"
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
                                <span className="border-2 border-[#2F2A26] bg-[#DCE3D2] px-1.5 py-0.5 text-[10px] font-black text-[#5F6D57]">
                                  현재
                                </span>
                              )}
                              <span className="border-2 border-[#2F2A26] bg-[#FCFBF7] px-1.5 py-0.5 text-[10px] font-black text-stone-600">
                                {round.status === "completed" ? "완독" : "읽는 중"}
                              </span>
                            </div>
                            <p className="mt-1 truncate text-[11px] font-black text-stone-500">
                              {round.currentPage}/{selectedBook.totalPages}p · 기록 {roundRecords.length}개 · {formatDuration(roundDurationSeconds || round.accumulatedSeconds)}
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

              <div className="mb-4 border-2 border-[#2F2A26] bg-[#F3E8D0] p-3">
                <div className="mb-2 flex items-center justify-between gap-3">
                  <p className="text-xs font-black text-stone-600">
                    현재 페이지
                  </p>
                  <p className="text-xs font-black text-[#5F6D57]">
                    {selectedBook.currentPage}/{selectedBook.totalPages}p
                  </p>
                </div>
                <div className="grid grid-cols-[1fr_auto] gap-2">
                  <input
                    className="pixel-input"
                    type="text"
                    inputMode="numeric"
                    min={1}
                    max={selectedBook.totalPages}
                    value={currentPageDraft}
                    onChange={(event) =>
                      setCurrentPageDraft(parsePageInput(event.target.value))
                    }
                    aria-label="현재 페이지"
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

              <div className="grid grid-cols-2 gap-2 text-sm font-black">
                <div className="detail-box">
                  <span>진행률</span>
                  <strong>{selectedBookStats.progress}%</strong>
                </div>
                <div className="detail-box">
                  <span>누적 시간</span>
                  <strong>
                    {formatDuration(selectedBook.accumulatedSeconds)}
                  </strong>
                </div>
                <div className="detail-box">
                  <span>남은 페이지</span>
                  <strong>{selectedBookStats.remainingPages}p</strong>
                </div>
                <div className="detail-box">
                  <span>평균 속도</span>
                  <strong>
                    {selectedBookStats.averagePagesPerHour > 0
                      ? `${selectedBookStats.averagePagesPerHour}p/h`
                      : "-"}
                  </strong>
                </div>
                <div className="detail-box">
                  <span>예상 남은 시간</span>
                  <strong>
                    {selectedBookStats.estimatedSecondsLeft > 0
                      ? formatDuration(selectedBookStats.estimatedSecondsLeft)
                      : "-"}
                  </strong>
                </div>
                <div className="detail-box">
                  <span>독서 기록</span>
                  <strong>{selectedBookRecords.length}회</strong>
                </div>
              </div>

              <div className="mt-3 grid grid-cols-2 gap-2 text-sm font-black">
                <div className="detail-box">
                  <span>시작일</span>
                  <strong>{selectedBook.startedAt}</strong>
                </div>
                <div className="detail-box">
                  <span>완독일</span>
                  <strong>{selectedBook.completedAt ?? "-"}</strong>
                </div>
              </div>

              <div className="mt-4">
                <div className="mb-2 flex items-center justify-between gap-3">
                  <h2 className="text-base font-black">최근 독서 기록</h2>
                  <span className="text-[11px] font-black text-stone-500">
                    {selectedBookStats.recordedPages}p 기록
                  </span>
                </div>
                {recentBookRecords.length === 0 ? (
                  <p className="border-2 border-dashed border-stone-500 bg-[#F3E8D0] px-3 py-2 text-xs font-black text-stone-600">
                    아직 이 책의 독서 기록이 없습니다.
                  </p>
                ) : (
                  <div className="divide-y-2 divide-[#2F2A26] border-2 border-[#2F2A26] bg-[#FCFBF7]">
                    {recentBookRecords.map((record) => (
                      <div
                        key={record.id}
                        className="grid grid-cols-[1fr_auto] items-center gap-2 px-2 py-1.5"
                      >
                        <p className="truncate text-xs font-black text-stone-800">
                          {record.date}
                          <span className="ml-2 text-stone-500">
                            {record.roundNumber ?? 1}회독 · {record.startPage}p → {record.endPage}p
                          </span>
                        </p>
                        <span className="text-[11px] font-black text-[#5F6D57]">
                          {formatDuration(record.durationSeconds)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="mt-5 flex items-center justify-between gap-3">
                <h2 className="text-lg font-black">기록한 문장</h2>
                <button
                  type="button"
                  className="mini-icon-button"
                  onClick={startAdd}
                  aria-label="문장 추가"
                >
                  <Icon name="plus" className="h-4 w-4" />
                </button>
              </div>
              {selectedBook.sentences.length > 1 && (
                <div className="mt-3 grid grid-cols-2 border-2 border-[#2F2A26] bg-[#FCFBF7] text-xs font-black">
                  <button
                    type="button"
                    className={`px-3 py-2 ${sentenceSort === "created" ? "bg-[#87937A] text-[#FFFDF8]" : "bg-[#FCFBF7] text-stone-700"}`}
                    onClick={() => setSentenceSort("created")}
                  >
                    등록순
                  </button>
                  <button
                    type="button"
                    className={`border-l-2 border-[#2F2A26] px-3 py-2 ${sentenceSort === "page" ? "bg-[#87937A] text-[#FFFDF8]" : "bg-[#FCFBF7] text-stone-700"}`}
                    onClick={() => setSentenceSort("page")}
                  >
                    페이지순
                  </button>
                </div>
              )}
              <div className="mt-3 space-y-2">
                {isAddingSentence && (
                  <div className="border-2 border-[#2F2A26] bg-[#FCFBF7] p-3">
                    <div className="space-y-3">
                      <div className="flex items-center justify-between gap-2">
                        <label
                          className="text-xs font-black text-stone-600"
                          htmlFor="new-sentence-page"
                        >
                          페이지
                        </label>
                        <input
                          id="new-sentence-page"
                          className="w-20 border-2 border-[#2F2A26] bg-[#F3E8D0] px-2 py-1 text-right text-sm font-black outline-none focus:bg-[#FCFBF7]"
                          type="text"
                          inputMode="numeric"
                          min={1}
                          max={selectedBook.totalPages}
                          value={draftPage}
                          onChange={(event) =>
                            setDraftPage(parsePageInput(event.target.value))
                          }
                        />
                      </div>
                      <textarea
                        className="min-h-24 w-full resize-none border-2 border-[#2F2A26] bg-[#FCFBF7] p-2 text-sm font-bold leading-relaxed outline-none focus:bg-[#FCFBF7]"
                        placeholder="기억에 남는 문장을 남겨보세요."
                        value={draftSentence}
                        onChange={(event) =>
                          setDraftSentence(event.target.value)
                        }
                      />
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          className="secondary-button min-h-10 text-xs"
                          onClick={cancelDraft}
                        >
                          취소
                        </button>
                        <button
                          type="button"
                          className="primary-button min-h-10 text-xs"
                          onClick={saveAdd}
                          disabled={draftSentence.trim().length === 0}
                        >
                          <Icon name="save" className="h-4 w-4" />
                          추가
                        </button>
                      </div>
                    </div>
                  </div>
                )}
                {selectedBook.sentences.length === 0 && !isAddingSentence ? (
                  <p className="border-2 border-[#2F2A26] bg-[#F3E8D0] p-3 text-sm font-black text-stone-600">
                    아직 기록한 문장이 없습니다.
                  </p>
                ) : (
                  sortedSentences.map((sentence) => {
                    const isEditing = editingSentenceId === sentence.id;

                    return (
                      <div
                        key={sentence.id}
                        className="border-2 border-[#2F2A26] bg-[#FCFBF7] p-3"
                      >
                        {isEditing ? (
                          <div className="space-y-3">
                            <div className="flex items-center justify-between gap-2">
                              <label
                                className="text-xs font-black text-stone-600"
                                htmlFor={`sentence-page-${sentence.id}`}
                              >
                                페이지
                              </label>
                              <input
                                id={`sentence-page-${sentence.id}`}
                                className="w-20 border-2 border-[#2F2A26] bg-[#F3E8D0] px-2 py-1 text-right text-sm font-black outline-none focus:bg-[#FCFBF7]"
                                type="text"
                                inputMode="numeric"
                                min={1}
                                max={selectedBook.totalPages}
                                value={draftPage}
                                onChange={(event) =>
                                  setDraftPage(
                                    parsePageInput(event.target.value),
                                  )
                                }
                              />
                            </div>
                            <textarea
                              className="min-h-24 w-full resize-none border-2 border-[#2F2A26] bg-[#FCFBF7] p-2 text-sm font-bold leading-relaxed outline-none focus:bg-[#FCFBF7]"
                              value={draftSentence}
                              onChange={(event) =>
                                setDraftSentence(event.target.value)
                              }
                            />
                            <div className="grid grid-cols-2 gap-2">
                              <button
                                type="button"
                                className="secondary-button min-h-10 text-xs"
                                onClick={cancelDraft}
                              >
                                취소
                              </button>
                              <button
                                type="button"
                                className="primary-button min-h-10 text-xs"
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
                            <div className="mb-2 flex items-start justify-between gap-2">
                              <span className="border-2 border-[#2F2A26] bg-[#DCE3D2] px-2 py-1 text-xs font-black text-stone-900">
                                {sentence.page}p
                              </span>
                              <div className="flex shrink-0 gap-1">
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
                                  className="mini-icon-button bg-[#B58A7A] text-[#FFFDF8]"
                                  onClick={() =>
                                    setDeleteSentenceId(sentence.id)
                                  }
                                  aria-label="문장 삭제"
                                >
                                  <Icon name="trash" className="h-4 w-4" />
                                </button>
                              </div>
                            </div>
                            <blockquote className="text-sm font-bold leading-relaxed">
                              {sentence.text}
                              <span className="mt-2 block text-xs font-black text-stone-500">
                                {sentence.recordedAt}
                              </span>
                            </blockquote>
                          </>
                        )}
                      </div>
                    );
                  })
                )}
              </div>

              {hasCompletedRound(selectedBook) && selectedBook.status === "completed" && (
                <div className="mt-6 border-2 border-[#2F2A26] bg-[#DCE3D2] p-3">
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-black">재독</p>
                      <p className="mt-1 text-xs font-black text-stone-600">
                        새 회차를 1페이지부터 시작합니다.
                      </p>
                    </div>
                    <span className="shrink-0 border-2 border-[#2F2A26] bg-[#FCFBF7] px-2 py-1 text-xs font-black text-[#5F6D57]">
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

              <div className="mt-6 flex flex-col items-end gap-2 border-t-2 border-dashed border-stone-400 pt-4">
                <button
                  type="button"
                  className="inline-flex min-h-9 items-center gap-1 border-2 border-[#2F2A26] bg-[#FCFBF7] px-3 py-2 text-xs font-black text-[#9D6655] shadow-[2px_2px_0_rgba(47,42,38,0.7)] disabled:cursor-not-allowed disabled:opacity-50"
                  onClick={() => setDeleteBookId(selectedBook.id)}
                  disabled={books.length <= 1}
                >
                  <Icon name="trash" className="h-4 w-4" />책 삭제
                </button>
                {books.length <= 1 && (
                  <p className="text-right text-xs font-black text-stone-500">
                    서재에는 최소 1권의 책이 필요합니다.
                  </p>
                )}
              </div>
            </div>
          </>
        ) : null}
        </section>
      )}

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
      >
        <div className="mb-4 flex items-center justify-between gap-3">
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
              <p className="pixel-label">
                {bookFormStep === "search" ? "BOOK SEARCH" : "BOOK DETAIL"}
              </p>
              <h2 className="mt-1 truncate text-xl font-black">
                {bookFormStep === "search" ? "책 검색" : "상세정보 입력"}
              </h2>
            </div>
          </div>
          <button
            type="button"
            className="icon-button"
            onClick={closeBookForm}
            aria-label="닫기"
          >
            <Icon name="close" className="h-5 w-5" />
          </button>
        </div>

        {bookFormStep === "search" ? (
          <div className="space-y-3">
            <form
              className="border-2 border-[#2F2A26] bg-[#FCFBF7] p-3"
              onSubmit={(event) => {
                event.preventDefault();
                void submitBookSearch();
              }}
            >
              <label className="field-label" htmlFor="book-search-query">
                카카오 책 검색
              </label>
              <div className="grid grid-cols-[1fr_auto] gap-2">
                <input
                  id="book-search-query"
                  className="pixel-input"
                  placeholder="제목, 저자, ISBN"
                  value={bookSearchQuery}
                  onChange={(event) => setBookSearchQuery(event.target.value)}
                />
                <button
                  type="submit"
                  className="primary-button px-3"
                  disabled={bookSearchStatus === "loading"}
                >
                  검색
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
                <div className="mt-3 max-h-[52svh] space-y-2 overflow-y-auto">
                  {bookSearchResults.map((book) => (
                    <button
                      key={book.id}
                      type="button"
                      className="w-full border-2 border-[#2F2A26] bg-[#F3E8D0] p-2 text-left"
                      onClick={() => selectSearchResult(book)}
                    >
                      <div className="flex gap-3">
                        {book.thumbnail ? (
                          <img
                            className="h-20 w-14 shrink-0 border-2 border-[#2F2A26] object-cover"
                            src={book.thumbnail}
                            alt=""
                          />
                        ) : (
                          <div className="h-20 w-14 shrink-0 border-2 border-[#2F2A26] bg-[#A97B5B]" />
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
              className="secondary-button w-full"
              onClick={startManualBookEntry}
            >
              <Icon name="plus" className="h-5 w-5" />
              직접 입력
            </button>
          </div>
        ) : (
          <>
            <div className="mb-4 grid grid-cols-[4.25rem_1fr] gap-3 border-2 border-[#2F2A26] bg-[#F3E8D0] p-3">
              {newBook.thumbnail ? (
                <img
                  className="h-24 w-16 border-2 border-[#2F2A26] object-cover"
                  src={newBook.thumbnail}
                  alt=""
                />
              ) : (
                <div className="flex h-24 w-16 items-center justify-center border-2 border-[#2F2A26] bg-[#A97B5B] text-[10px] font-black text-[#FFFDF8]">
                  직접 입력
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
                  className="mt-3 text-xs font-black text-[#2563EB] underline underline-offset-4"
                  onClick={openBookSearchStep}
                >
                  다시 검색
                </button>
              </div>
            </div>

            <label className="field-label" htmlFor="new-book-title">
              책 제목
            </label>
            <input
              id="new-book-title"
              className="pixel-input"
              value={newBook.title}
              onChange={(event) =>
                setNewBook((current) => ({
                  ...current,
                  title: event.target.value,
                }))
              }
            />

            <label className="field-label mt-3" htmlFor="new-book-author">
              저자
            </label>
            <input
              id="new-book-author"
              className="pixel-input"
              value={newBook.author}
              onChange={(event) =>
                setNewBook((current) => ({
                  ...current,
                  author: event.target.value,
                }))
              }
            />

            <div className="mt-3">
              <p className="field-label">등록 상태</p>
              <div className="grid grid-cols-2 gap-2">
                {(["reading", "completed"] as const).map((status) => (
                  <button
                    key={status}
                    type="button"
                    className={`border-2 border-[#2F2A26] px-3 py-2 text-sm font-black shadow-[3px_3px_0_rgba(47,42,38,0.82)] ${
                      newBook.status === status
                        ? "bg-[#87937A] text-[#FFFDF8]"
                        : "bg-[#FCFBF7] text-[#2F2A26]"
                    }`}
                    onClick={() => {
                      setNewBook((current) => ({
                        ...current,
                        status,
                        currentPage:
                          status === "completed"
                            ? current.totalPages
                            : Math.min(current.currentPage, current.totalPages),
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

            <div className="mt-3 grid grid-cols-2 gap-2">
              <div>
                <label className="field-label" htmlFor="new-book-total">
                  전체 페이지
                </label>
                <input
                  id="new-book-total"
                  className="pixel-input"
                  type="text"
                  inputMode="numeric"
                  min={1}
                  value={newBook.totalPages}
                  onChange={(event) =>
                    setNewBook((current) => {
                      const totalPages = parsePageInput(event.target.value);

                      return {
                        ...current,
                        totalPages,
                        currentPage:
                          current.status === "completed"
                            ? totalPages
                            : Math.min(
                                current.currentPage,
                                Math.max(totalPages, 1),
                              ),
                      };
                    })
                  }
                />
              </div>
              {newBook.status === "reading" ? (
                <div>
                  <label className="field-label" htmlFor="new-book-current">
                    현재 페이지
                  </label>
                  <input
                    id="new-book-current"
                    className="pixel-input"
                    type="text"
                    inputMode="numeric"
                    min={1}
                    max={Math.max(newBook.totalPages, 1)}
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
                    className="field-label"
                    htmlFor="new-book-completed-at"
                  >
                    완독일
                  </label>
                  <input
                    id="new-book-completed-at"
                    className="pixel-input"
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
              <div className="mt-3 space-y-3">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label
                      className="field-label"
                      htmlFor="new-book-started-at"
                    >
                      시작일 선택
                    </label>
                    <input
                      id="new-book-started-at"
                      className="pixel-input"
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
                  </div>
                  <div className="border-2 border-[#2F2A26] bg-[#FCFBF7] p-3 text-xs font-black leading-relaxed text-stone-600">
                    달력에서 날짜를 고를 수 있습니다. 시작일은 비워도 됩니다.
                  </div>
                </div>
                {bookDateError && (
                  <div className="border-2 border-[#2F2A26] bg-[#F4D8CF] p-3 text-xs font-black leading-relaxed text-[#8A3F2D]">
                    {bookDateError}
                  </div>
                )}
                <div className="border-2 border-[#2F2A26] bg-[#F3E8D0] p-3 text-xs font-black leading-relaxed text-stone-700">
                  완독한 책은 현재 페이지가 전체 페이지로 저장되고, 독서중 책
                  선택 목록에서는 제외됩니다.
                </div>
              </div>
            )}

            <div className="mt-4 grid grid-cols-2 gap-2">
              <button
                type="button"
                className="secondary-button"
                onClick={openBookSearchStep}
              >
                이전
              </button>
              <button
                type="button"
                className="primary-button"
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
  const completedPages = books.reduce((sum, book) => sum + book.totalPages, 0);

  return (
    <section>
      {books.length === 0 ? (
        <div className="border-2 border-dashed border-stone-500 bg-[#F3E8D0] p-4 text-center text-sm font-black text-stone-600">
          {tone === "reading"
            ? "읽는 중인 책이 없습니다."
            : "완독한 책이 없습니다."}
        </div>
      ) : tone === "completed" ? (
        <div className="space-y-3">
          <div className="completed-library-hero">
            <div>
              <h2 className="text-lg font-black">완독 컬렉션</h2>
              <p className="mt-1 text-xs font-black text-stone-500">
                읽어낸 책들이 쌓이고 있어요.
              </p>
            </div>
            <div className="text-right">
              <p className="text-sm font-black">{books.length}권</p>
              <p className="mt-1 text-xs font-black text-stone-500">
                총 {completedPages.toLocaleString()}p
              </p>
            </div>
          </div>
          <div className="completed-library-grid">
            {books.map((book, index) => {
              const bookTier = getBookTier(tierBoard, book.id);

              return (
                <button
                  key={book.id}
                  type="button"
                  className="h-full w-full text-left"
                  onClick={() => onSelectBook(book.id)}
                >
                  <PixelCard className="completed-book-card h-full bg-[#FCFBF7]">
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
                  </PixelCard>
                </button>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="grid gap-3">
          {books.map((book) => {
            const progress = Math.round(
              (book.currentPage / book.totalPages) * 100,
            );

            return (
              <button
                key={book.id}
                type="button"
                className="text-left"
                onClick={() => onSelectBook(book.id)}
              >
                <PixelCard
                  className={
                    tone === "reading" ? "bg-[#FCFBF7]" : "bg-[#F3E8D0]"
                  }
                >
                  <div className="flex items-center justify-between gap-3">
                    <MiniBook book={book} />
                    <span
                      className={`shrink-0 border-2 border-[#2F2A26] px-2 py-1 text-sm font-black ${tone === "reading" ? "bg-[#DCE3D2] text-[#5F6D57]" : "bg-[#2F2A26] text-[#FFFDF8]"}`}
                    >
                      {progress}%
                    </span>
                  </div>
                  <div className="mt-3 h-3 rounded-full border-2 border-[#2F2A26] bg-[#F3E8D0]">
                    <div
                      className={
                        tone === "reading"
                          ? "h-full rounded-full bg-[#5F6D57]"
                          : "h-full rounded-full bg-[#2F2A26]"
                      }
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                </PixelCard>
              </button>
            );
          })}
        </div>
      )}
    </section>
  );
};
