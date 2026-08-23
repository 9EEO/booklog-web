import { useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties } from "react";
import { AdventureScene } from "../components/adventure/AdventureScene";
import { Icon } from "../components/Icon";
import { PixelatedBookCover } from "../components/PixelatedBookCover";
import { SentenceOcrButton } from "../components/SentenceOcrButton";
import { useBackNavigationLayer } from "../hooks/useBackNavigationLayer";
import type { ReadingTimer } from "../hooks/useReadingTimer";
import { useTimerCompletionSound } from "../hooks/useTimerCompletionSound";
import { useTimerControlSound } from "../hooks/useTimerControlSound";
import { fetchBookLibraryReference } from "../services/bookLibraryReference";
import { resolveBestBookCover } from "../services/bookCovers";
import { hasKakaoBookApiKey, searchKakaoBooks } from "../services/kakaoBooks";
import {
  searchKoreanWord,
  type WordDefinition,
  type WordDictionaryResult,
} from "../services/wordDictionary";
import type {
  Book,
  BookSearchResult,
  NewBookInput,
  ReadingCompletionInput,
  ReadingRecord,
  WordNoteInput,
} from "../types/reading";
import { formatDuration } from "../utils/formatDuration";
import {
  vibrateSelect,
  vibrateSuccess,
  vibrateTap,
  vibrateTimerPause,
  vibrateTimerSelect,
  vibrateTimerStart,
  vibrateTimerStop,
  vibrateWarning,
} from "../utils/haptics";
import { parsePageInput } from "../utils/pageInput";
import { clampBookPage, getBookProgress } from "../utils/bookPages";
import { getDisplayBookDescription } from "../utils/bookDescription";

type SessionScreenProps = {
  books: Book[];
  records: ReadingRecord[];
  currentBook: Book | null;
  dailyGoalSeconds: number;
  timer: ReadingTimer;
  onChangeBook: (bookId: string) => void;
  onOpenBookDetail: (bookId: string) => void;
  onSaveRecord: (input: ReadingCompletionInput) => Promise<void>;
  onAddBook: (input: NewBookInput) => Promise<string>;
  onAddSentence: (bookId: string, text: string, page: number) => Promise<void>;
  onAddWordNote: (bookId: string, input: WordNoteInput) => Promise<void>;
  bookAddOpenRequestId: number;
  onConsumeBookAddOpenRequest: () => void;
};

type BookAddStep = "search" | "details";
type BookSearchStatus = "idle" | "loading" | "success" | "empty" | "error";
type WordSearchStatus = "idle" | "loading" | "success" | "empty" | "error";
type SelectedWordDefinition = {
  result: WordDictionaryResult;
  definition: WordDefinition;
  key: string;
};

type VisibleWordDefinition = SelectedWordDefinition;

type SessionBaseline = {
  bookId: string;
  sentenceCount: number;
  wordCount: number;
};

type SavedSessionSummary = {
  bookId: string;
  durationSeconds: number;
  startPage: number;
  endPage: number;
  totalPages: number | null;
  previousProgress: number | null;
  nextProgress: number | null;
  savedSentenceCount: number;
  savedWordCount: number;
};

const presets = [
  import.meta.env.DEV
    ? { label: "10 SEC", seconds: 10 }
    : { label: "5 MIN", seconds: 5 * 60 },
  { label: "15 MIN", seconds: 15 * 60 },
  { label: "30 MIN", seconds: 30 * 60 },
  { label: "60 MIN", seconds: 60 * 60 },
];

const extensionStepSeconds = 5 * 60;
const minimumExtensionSeconds = 5 * 60;
const maximumExtensionSeconds = 60 * 60;
const emptySessionBook: NewBookInput = {
  title: "",
  author: "",
  totalPages: null,
  currentPage: 1,
  status: "reading",
};

const formatFocusTime = (seconds: number) => {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor(seconds / 60);
  const remain = seconds % 60;

  if (hours > 0) {
    const minuteInHour = Math.floor((seconds % 3600) / 60);

    return `${hours.toString().padStart(2, "0")}:${minuteInHour.toString().padStart(2, "0")}:${remain.toString().padStart(2, "0")}`;
  }

  return `${minutes.toString().padStart(2, "0")}:${remain.toString().padStart(2, "0")}`;
};

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

const scrollItemIntoComfortableView = (
  containerElement: HTMLElement,
  itemElement: HTMLElement,
) => {
  const containerRect = containerElement.getBoundingClientRect();
  const itemRect = itemElement.getBoundingClientRect();
  const comfortableGap = Math.min(
    28,
    Math.max(12, containerElement.clientHeight * 0.12),
  );
  const targetTopEdge = containerRect.top + comfortableGap;
  const targetBottomEdge = containerRect.bottom - comfortableGap;

  if (itemRect.top < targetTopEdge) {
    containerElement.scrollTo({
      top: Math.max(
        containerElement.scrollTop + itemRect.top - targetTopEdge,
        0,
      ),
      behavior: "smooth",
    });
    return;
  }

  if (itemRect.bottom > targetBottomEdge) {
    containerElement.scrollTo({
      top: containerElement.scrollTop + itemRect.bottom - targetBottomEdge,
      behavior: "smooth",
    });
  }
};

type BookGameSelectItemProps = {
  book: Book;
  index: number;
  isActive: boolean;
  itemRef?: (node: HTMLDivElement | null) => void;
  onSelect: () => void;
  onConfirm: () => void;
};

const BookGameSelectItem = ({
  book,
  index,
  isActive,
  itemRef,
  onSelect,
  onConfirm,
}: BookGameSelectItemProps) => {
  const progress = getBookProgress(book.currentPage, book.totalPages);

  return (
    <div
      ref={itemRef}
      className={`book-game-item ${isActive ? "book-game-item-active" : ""}`}
    >
      <button
        type="button"
        className="book-game-preview"
        onClick={onSelect}
        aria-pressed={isActive}
      >
        <span className="book-game-cursor" aria-hidden="true">
          ▶
        </span>
        <span className="book-game-slot">
          {(index + 1).toString().padStart(2, "0")}
        </span>
        <span className="book-game-copy">
          <strong>{book.title}</strong>
          <small>{book.author || "작자 미상"}</small>
        </span>
      </button>
      {isActive ? (
        <button
          type="button"
          className="book-game-select-button"
          onClick={onConfirm}
        >
          선택
        </button>
      ) : (
        <span className="book-game-progress">
          {progress !== null ? `${progress}%` : "NEW"}
        </span>
      )}
    </div>
  );
};

const getReadingRecordTime = (record: ReadingRecord) => {
  const preciseDate = record.endedAt ?? record.startedAt;

  if (preciseDate) {
    const time = new Date(preciseDate).getTime();

    if (Number.isFinite(time)) return time;
  }

  const [year, month, day] = record.date.split(".").map(Number);

  if (!year || !month || !day) return 0;

  return new Date(year, month - 1, day).getTime();
};

export const SessionScreen = ({
  books,
  records,
  currentBook,
  dailyGoalSeconds,
  timer,
  onChangeBook,
  onOpenBookDetail,
  onSaveRecord,
  onAddBook,
  onAddSentence,
  onAddWordNote,
  bookAddOpenRequestId,
  onConsumeBookAddOpenRequest,
}: SessionScreenProps) => {
  const [hasSelectedSessionBook, setHasSelectedSessionBook] = useState(false);
  const [previewBookId, setPreviewBookId] = useState<string | null>(null);
  const [isBookAddListItemActive, setIsBookAddListItemActive] = useState(false);
  const [isBookChangeTimeItemActive, setIsBookChangeTimeItemActive] =
    useState(false);
  const [isBookAddOpen, setIsBookAddOpen] = useState(false);
  const [bookAddStep, setBookAddStep] = useState<BookAddStep>("search");
  const [bookSearchQuery, setBookSearchQuery] = useState("");
  const [bookSearchStatus, setBookSearchStatus] =
    useState<BookSearchStatus>("idle");
  const [bookSearchMessage, setBookSearchMessage] = useState("");
  const [bookSearchResults, setBookSearchResults] = useState<
    BookSearchResult[]
  >([]);
  const [selectedBookSearchResult, setSelectedBookSearchResult] =
    useState<BookSearchResult | null>(null);
  const [newBook, setNewBook] = useState<NewBookInput>(emptySessionBook);
  const [bookDateError, setBookDateError] = useState("");
  const [isManualBookEntry, setIsManualBookEntry] = useState(false);
  const [isSavingBook, setIsSavingBook] = useState(false);
  const [isBookPreviewGlitching, setIsBookPreviewGlitching] = useState(false);
  const [bookDescriptionLineClamp, setBookDescriptionLineClamp] = useState(4);
  const [expandedBookDescriptionKey, setExpandedBookDescriptionKey] =
    useState<string | null>(null);
  const [bookDescriptionExpandable, setBookDescriptionExpandable] = useState({
    key: "",
    value: false,
  });
  const [bookDescriptionTyping, setBookDescriptionTyping] = useState({
    key: "",
    visibleLength: 0,
  });
  const [isCompletionOpen, setIsCompletionOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isWordSearchOpen, setIsWordSearchOpen] = useState(false);
  const [wordSearchResumeCountdownKey, setWordSearchResumeCountdownKey] =
    useState(0);
  const [isSentenceNoteOpen, setIsSentenceNoteOpen] = useState(false);
  const [sentenceNoteResumeCountdownKey, setSentenceNoteResumeCountdownKey] =
    useState(0);
  const [sentenceNoteText, setSentenceNoteText] = useState("");
  const [sentenceNotePageInput, setSentenceNotePageInput] = useState("");
  const [isSavingSentenceNote, setIsSavingSentenceNote] = useState(false);
  const [sentenceNoteMessage, setSentenceNoteMessage] = useState("");
  const [wordSearchQuery, setWordSearchQuery] = useState("");
  const [wordSearchStatus, setWordSearchStatus] =
    useState<WordSearchStatus>("idle");
  const [wordSearchError, setWordSearchError] = useState("");
  const [wordSearchResults, setWordSearchResults] = useState<
    WordDictionaryResult[]
  >([]);
  const [selectedWordDefinition, setSelectedWordDefinition] =
    useState<SelectedWordDefinition | null>(null);
  const [wordNotePageInput, setWordNotePageInput] = useState("");
  const [wordNoteSentence, setWordNoteSentence] = useState("");
  const [isSavingWordNote, setIsSavingWordNote] = useState(false);
  const [wordSaveMessage, setWordSaveMessage] = useState("");
  const [timerToastMessage, setTimerToastMessage] = useState("");
  const [sessionBaseline, setSessionBaseline] =
    useState<SessionBaseline | null>(null);
  const [savedSessionSummary, setSavedSessionSummary] =
    useState<SavedSessionSummary | null>(null);
  const [extensionSeconds, setExtensionSeconds] = useState(
    minimumExtensionSeconds,
  );
  const [form, setForm] = useState({
    bookId: currentBook?.id ?? "",
    endPage: 0,
  });
  const bookPreviewGlitchTimerRef = useRef<number | null>(null);
  const bookDescriptionTypingTimerRef = useRef<number | null>(null);
  const bookDescriptionRef = useRef<HTMLButtonElement | null>(null);
  const bookSelectListRef = useRef<HTMLDivElement | null>(null);
  const bookSelectItemRefs = useRef(new Map<string, HTMLDivElement>());
  const timerPresetListRef = useRef<HTMLDivElement | null>(null);
  const timerPresetItemRefs = useRef(new Map<string, HTMLDivElement>());
  const wordResultListRef = useRef<HTMLDivElement | null>(null);
  const wordResultItemRefs = useRef(new Map<string, HTMLElement>());
  const completionPageInputRef = useRef<HTMLInputElement | null>(null);
  const isBookAddOpeningRef = useRef(false);
  const timerCompletionSound = useTimerCompletionSound(timer.status);
  const timerControlSound = useTimerControlSound();

  const clearSentenceNoteDraft = () => {
    setSentenceNoteText("");
    setSentenceNotePageInput("");
  };

  const closeSentenceNoteAndResume = () => {
    setIsSentenceNoteOpen(false);
    setSentenceNoteMessage("");
    clearSentenceNoteDraft();
    if (timer.status === "paused" && timer.elapsedSeconds > 0) {
      setSentenceNoteResumeCountdownKey((current) => current + 1);
    }
  };

  const closeSentenceNote = () => {
    vibrateTap();
    timerControlSound.playSelect();
    closeSentenceNoteAndResume();
  };

  const openSentenceNote = () => {
    vibrateTimerPause();
    timerControlSound.playPause();
    if (timer.status === "running") {
      timer.pause();
    }
    setIsWordSearchOpen(false);
    setSentenceNoteMessage("");
    clearSentenceNoteDraft();
    setIsSentenceNoteOpen(true);
  };

  useEffect(() => {
    if (!timerToastMessage) return;

    const timeoutId = window.setTimeout(() => setTimerToastMessage(""), 2000);
    return () => window.clearTimeout(timeoutId);
  }, [timerToastMessage]);

  const showTimerToast = (message: string) => {
    setTimerToastMessage(message);
  };

  useBackNavigationLayer(
    isCompletionOpen ||
      (timer.status === "completed" && timer.elapsedSeconds > 0),
    () => {
      setIsCompletionOpen(false);
      if (timer.status === "completed") {
        timer.cancelCompletion();
      }
    },
    "session-completion",
  );
  useBackNavigationLayer(
    isSentenceNoteOpen,
    () => closeSentenceNote(),
    "session-sentence-note",
  );

  const readingBooks = useMemo(
    () => {
      const latestRecordTimeByBookId = records.reduce<Record<string, number>>(
        (latestTimes, record) => {
          const recordTime = getReadingRecordTime(record);

          latestTimes[record.bookId] = Math.max(
            latestTimes[record.bookId] ?? 0,
            recordTime,
          );

          return latestTimes;
        },
        {},
      );

      return books
        .map((book, index) => ({ book, index }))
        .filter(({ book }) => book.status !== "completed")
        .sort((left, right) => {
          const leftTime = latestRecordTimeByBookId[left.book.id] ?? 0;
          const rightTime = latestRecordTimeByBookId[right.book.id] ?? 0;

          return rightTime - leftTime || left.index - right.index;
        })
        .map(({ book }) => book);
    },
    [books, records],
  );
  const memoryLogs = useMemo(() => {
    const bookHighlights = books.flatMap((book) =>
      book.sentences.map((sentence) => ({
        id: sentence.id,
        text: sentence.text,
        bookTitle: book.title,
        page: sentence.page,
        isCurrentBook: book.id === currentBook?.id,
      })),
    );
    const recordLogs = records.flatMap((record) => {
      const text = record.sentence?.trim();
      if (!text) return [];

      return [
        {
          id: `record-${record.id}`,
          text,
          bookTitle: record.bookTitle,
          page: record.sentencePage ?? record.endPage,
          isCurrentBook: record.bookId === currentBook?.id,
        },
      ];
    });
    const orderedLogs = [
      ...bookHighlights.filter((log) => log.isCurrentBook),
      ...recordLogs.filter((log) => log.isCurrentBook),
      ...bookHighlights.filter((log) => !log.isCurrentBook),
      ...recordLogs.filter((log) => !log.isCurrentBook),
    ];
    const seen = new Set<string>();

    return orderedLogs.filter((log) => {
      const key = `${log.bookTitle}-${log.page}-${log.text}`;
      if (seen.has(key)) return false;

      seen.add(key);
      return true;
    });
  }, [books, currentBook?.id, records]);
  const isCompletionVisible =
    isCompletionOpen ||
    (timer.status === "completed" && timer.elapsedSeconds > 0);
  const canChangeTimerMode =
    timer.status === "idle" && timer.elapsedSeconds === 0;
  useEffect(() => {
    if (!currentBook || !isCompletionVisible) return;

    vibrateSuccess();
  }, [currentBook, isCompletionVisible]);

  useEffect(() => {
    if (!isCompletionVisible) return undefined;

    const focusFrame = window.requestAnimationFrame(() => {
      completionPageInputRef.current?.focus();
      completionPageInputRef.current?.select();
    });

    return () => {
      window.cancelAnimationFrame(focusFrame);
    };
  }, [isCompletionVisible]);

  useEffect(
    () => () => {
      if (bookPreviewGlitchTimerRef.current === null) return;

      window.clearTimeout(bookPreviewGlitchTimerRef.current);
    },
    [],
  );

  const closeBookAddFlow = () => {
    isBookAddOpeningRef.current = false;
    setIsBookAddOpen(false);
    setBookAddStep("search");
    setBookSearchQuery("");
    setBookSearchStatus("idle");
    setBookSearchMessage("");
    setBookSearchResults([]);
    setSelectedBookSearchResult(null);
    setNewBook(emptySessionBook);
    setBookDateError("");
    setIsManualBookEntry(false);
  };

  const openBookAddFlow = () => {
    if (isBookAddOpen || isBookAddOpeningRef.current) return;

    isBookAddOpeningRef.current = true;
    timerControlSound.playSelect();
    setSavedSessionSummary(null);
    setIsBookAddOpen(true);
    setBookAddStep("search");
  };

  const openBookSearchStep = () => {
    setBookAddStep("search");
  };

  useEffect(() => {
    if (bookAddOpenRequestId === 0) return;

    onConsumeBookAddOpenRequest();
    const animationFrame = window.requestAnimationFrame(() => {
      timerControlSound.playSelect();
      setSavedSessionSummary(null);
      setIsBookAddOpen(true);
      setBookAddStep("search");
    });

    return () => {
      window.cancelAnimationFrame(animationFrame);
    };
  }, [bookAddOpenRequestId, onConsumeBookAddOpenRequest, timerControlSound]);

  const startManualBookEntry = () => {
    timerControlSound.playSelect();
    setSelectedBookSearchResult(null);
    setIsManualBookEntry(true);
    setNewBook({
      ...emptySessionBook,
      title: bookSearchQuery.trim(),
    });
    setBookDateError("");
    setBookAddStep("details");
  };

  const submitBookSearch = async () => {
    setSelectedBookSearchResult(null);

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

  const resetBookSearch = () => {
    timerControlSound.playSelect();
    setBookSearchQuery("");
    setBookSearchStatus("idle");
    setBookSearchMessage("");
    setBookSearchResults([]);
    setSelectedBookSearchResult(null);
  };

  const selectSearchResult = (book: BookSearchResult) => {
    timerControlSound.playSelect();
    setSelectedBookSearchResult(book);
  };

  const continueWithSelectedSearchResult = () => {
    if (!selectedBookSearchResult) return;

    const book = selectedBookSearchResult;

    timerControlSound.playSelect();
    setIsManualBookEntry(false);
    setNewBook((current) => ({
      ...current,
      title: book.title,
      author: book.authors.join(", ") || current.author,
      thumbnail: book.thumbnail,
      isbn: book.isbn,
      publisher: book.publisher,
      contents: book.contents,
      status: "reading",
    }));
    setBookDateError("");
    setBookAddStep("details");

    void resolveBestBookCover({
      isbn: book.isbn,
      fallbackThumbnail: book.thumbnail,
    }).then((resolvedThumbnail) => {
      if (!resolvedThumbnail || resolvedThumbnail === book.thumbnail) return;

      setNewBook((current) => {
        if (current.isbn !== book.isbn) return current;

        return {
          ...current,
          thumbnail: resolvedThumbnail,
        };
      });
    });
  };

  const saveBook = async () => {
    if (newBook.title.trim().length === 0) return;
    if (isSavingBook) return;

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
        ? parseReadingDate(newBook.completedAt?.trim() ?? "")
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

    setIsSavingBook(true);

    try {
      const [resolvedThumbnail, libraryReference] = await Promise.all([
        resolveBestBookCover({
          isbn: newBook.isbn,
          fallbackThumbnail: newBook.thumbnail,
        }),
        fetchBookLibraryReference(newBook.isbn, newBook.title),
      ]);
      const newBookId = await onAddBook({
        ...newBook,
        totalPages,
        currentPage,
        startedAt: startedAt ?? undefined,
        completedAt: completedAt ?? undefined,
        thumbnail: resolvedThumbnail,
        libraryReference,
      });

      if (newBook.status === "completed") {
        const nextReadingBook = readingBooks[0] ?? null;

        onChangeBook(nextReadingBook?.id ?? "");
        setPreviewBookId(nextReadingBook?.id ?? null);
        setIsBookAddListItemActive(false);
        setHasSelectedSessionBook(false);
      } else {
        onChangeBook(newBookId);
        setHasSelectedSessionBook(true);
      }

      timer.reset();
      closeBookAddFlow();
      timerControlSound.playConfirm();
    } finally {
      setIsSavingBook(false);
    }
  };

  useBackNavigationLayer(
    isBookAddOpen,
    () => {
      if (bookAddStep === "details") {
        openBookSearchStep();
        return;
      }

      closeBookAddFlow();
    },
    "session-book-add",
  );

  const canShowBookSelectScreen =
    !isBookAddOpen &&
    !savedSessionSummary &&
    readingBooks.length > 0 &&
    (!currentBook ||
      currentBook.status === "completed" ||
      (!hasSelectedSessionBook &&
        timer.status === "idle" &&
        timer.elapsedSeconds === 0));
  const selectedBookPreview =
    readingBooks.find((book) => book.id === previewBookId) ??
    readingBooks.find((book) => book.id === currentBook?.id) ??
    readingBooks[0];
  const selectedBookProgress = selectedBookPreview
    ? getBookProgress(
        selectedBookPreview.currentPage,
        selectedBookPreview.totalPages,
      )
    : null;
  const selectedBookDescription =
    getDisplayBookDescription(selectedBookPreview);
  const selectedBookDescriptionKey = `${selectedBookPreview?.id ?? ""}-${selectedBookDescription}`;
  const selectedBookDescriptionCharacters = useMemo(
    () => Array.from(selectedBookDescription),
    [selectedBookDescription],
  );
  const isBookDescriptionExpanded =
    expandedBookDescriptionKey === selectedBookDescriptionKey;
  const visibleBookDescriptionLength =
    isBookDescriptionExpanded
      ? selectedBookDescriptionCharacters.length
      : bookDescriptionTyping.key === selectedBookDescriptionKey
      ? bookDescriptionTyping.visibleLength
      : 0;
  const visibleBookDescription = selectedBookDescriptionCharacters
    .slice(0, visibleBookDescriptionLength)
    .join("");
  const isBookDescriptionTyping =
    !isBookDescriptionExpanded &&
    visibleBookDescriptionLength < selectedBookDescriptionCharacters.length;
  const isBookDescriptionExpandable =
    bookDescriptionExpandable.key === selectedBookDescriptionKey &&
    bookDescriptionExpandable.value;
  const canToggleBookDescription =
    isBookDescriptionExpanded || isBookDescriptionExpandable;

  useEffect(() => {
    if (!canShowBookSelectScreen || !previewBookId) return undefined;

    const listElement = bookSelectListRef.current;
    const itemElement = bookSelectItemRefs.current.get(previewBookId);
    if (!listElement || !itemElement) return undefined;

    const animationFrame = window.requestAnimationFrame(() => {
      scrollItemIntoComfortableView(listElement, itemElement);
    });

    return () => {
      window.cancelAnimationFrame(animationFrame);
    };
  }, [canShowBookSelectScreen, previewBookId]);

  const activeTimerOptionKey =
    isBookChangeTimeItemActive
      ? "change-book"
      : timer.mode === "stopwatch"
        ? "stopwatch"
        : `preset-${timer.targetSeconds}`;

  useEffect(() => {
    if (!canChangeTimerMode) return undefined;

    const listElement = timerPresetListRef.current;
    const itemElement = timerPresetItemRefs.current.get(activeTimerOptionKey);
    if (!listElement || !itemElement) return undefined;

    const animationFrame = window.requestAnimationFrame(() => {
      scrollItemIntoComfortableView(listElement, itemElement);
    });

    return () => {
      window.cancelAnimationFrame(animationFrame);
    };
  }, [activeTimerOptionKey, canChangeTimerMode]);

  useEffect(() => {
    const selectedKey = selectedWordDefinition?.key;
    if (!isWordSearchOpen || !selectedKey) return undefined;

    const listElement = wordResultListRef.current;
    const itemElement = wordResultItemRefs.current.get(selectedKey);
    if (!listElement || !itemElement) return undefined;

    const animationFrame = window.requestAnimationFrame(() => {
      scrollItemIntoComfortableView(listElement, itemElement);
    });

    return () => {
      window.cancelAnimationFrame(animationFrame);
    };
  }, [isWordSearchOpen, selectedWordDefinition?.key]);
  const bookDescriptionStyle = {
    "--book-description-lines": isBookDescriptionExpanded
      ? 8
      : bookDescriptionLineClamp,
  } as CSSProperties;

  useEffect(() => {
    if (bookDescriptionTypingTimerRef.current !== null) {
      window.clearInterval(bookDescriptionTypingTimerRef.current);
      window.clearTimeout(bookDescriptionTypingTimerRef.current);
      bookDescriptionTypingTimerRef.current = null;
    }

    const nextDescriptionLength = selectedBookDescriptionCharacters.length;

    if (nextDescriptionLength === 0) {
      return undefined;
    }

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      const reduceMotionTimer = window.setTimeout(() => {
        setBookDescriptionTyping({
          key: selectedBookDescriptionKey,
          visibleLength: nextDescriptionLength,
        });
        bookDescriptionTypingTimerRef.current = null;
      }, 0);
      bookDescriptionTypingTimerRef.current = reduceMotionTimer;

      return () => {
        if (bookDescriptionTypingTimerRef.current !== null) {
          window.clearInterval(bookDescriptionTypingTimerRef.current);
          window.clearTimeout(bookDescriptionTypingTimerRef.current);
          bookDescriptionTypingTimerRef.current = null;
        }
      };
    }

    let nextVisibleLength = 0;
    const typingTimer = window.setInterval(() => {
      nextVisibleLength += 1;
      setBookDescriptionTyping({
        key: selectedBookDescriptionKey,
        visibleLength: nextVisibleLength,
      });

      if (nextVisibleLength >= nextDescriptionLength) {
        window.clearInterval(typingTimer);
        bookDescriptionTypingTimerRef.current = null;
      }
    }, 24);
    bookDescriptionTypingTimerRef.current = typingTimer;

    return () => {
      if (bookDescriptionTypingTimerRef.current !== null) {
        window.clearInterval(bookDescriptionTypingTimerRef.current);
        window.clearTimeout(bookDescriptionTypingTimerRef.current);
        bookDescriptionTypingTimerRef.current = null;
      }
    };
  }, [selectedBookDescriptionCharacters, selectedBookDescriptionKey]);

  useEffect(() => {
    const descriptionElement = bookDescriptionRef.current;

    if (!descriptionElement || !selectedBookPreview) {
      return undefined;
    }

    const updateDescriptionLineClamp = () => {
      const computedStyle = window.getComputedStyle(descriptionElement);
      const lineHeight = Number.parseFloat(computedStyle.lineHeight);
      const paddingTop = Number.parseFloat(computedStyle.paddingTop) || 0;
      const paddingBottom = Number.parseFloat(computedStyle.paddingBottom) || 0;

      if (!Number.isFinite(lineHeight) || lineHeight <= 0) {
        return;
      }

      const availableHeight =
        descriptionElement.clientHeight - paddingTop - paddingBottom;
      const nextLineClamp = Math.max(1, Math.floor(availableHeight / lineHeight));
      const textElement = descriptionElement.querySelector<HTMLElement>(
        ".session-book-preview-description-text",
      );

      setBookDescriptionLineClamp((currentLineClamp) =>
        currentLineClamp === nextLineClamp ? currentLineClamp : nextLineClamp,
      );

      if (!textElement || isBookDescriptionTyping || isBookDescriptionExpanded) {
        return;
      }

      const nextExpandable =
        textElement.scrollHeight > textElement.clientHeight + 1;

      setBookDescriptionExpandable((current) => {
        if (current.key !== selectedBookDescriptionKey) {
          return { key: selectedBookDescriptionKey, value: nextExpandable };
        }

        const nextValue = current.value || nextExpandable;

        return current.value === nextValue
          ? current
          : { key: selectedBookDescriptionKey, value: nextValue };
      });
    };

    updateDescriptionLineClamp();

    const resizeObserver = new ResizeObserver(updateDescriptionLineClamp);
    resizeObserver.observe(descriptionElement);

    return () => {
      resizeObserver.disconnect();
    };
  }, [
    isBookDescriptionExpanded,
    isBookDescriptionTyping,
    selectedBookDescription,
    selectedBookDescriptionKey,
    selectedBookPreview,
  ]);

  useEffect(() => {
    if (!isBookDescriptionExpanded) return undefined;

    const animationFrame = window.requestAnimationFrame(() => {
      bookDescriptionRef.current?.scrollIntoView({
        block: "nearest",
        behavior: "smooth",
      });
    });

    return () => {
      window.cancelAnimationFrame(animationFrame);
    };
  }, [isBookDescriptionExpanded]);

  const toggleBookDescription = () => {
    if (!canToggleBookDescription && !isBookDescriptionTyping) return;

    if (isBookDescriptionTyping) {
      if (bookDescriptionTypingTimerRef.current !== null) {
        window.clearInterval(bookDescriptionTypingTimerRef.current);
        window.clearTimeout(bookDescriptionTypingTimerRef.current);
        bookDescriptionTypingTimerRef.current = null;
      }

      setBookDescriptionTyping({
        key: selectedBookDescriptionKey,
        visibleLength: selectedBookDescriptionCharacters.length,
      });
      setBookDescriptionExpandable({
        key: selectedBookDescriptionKey,
        value: true,
      });
      setExpandedBookDescriptionKey(selectedBookDescriptionKey);
      return;
    }

    setExpandedBookDescriptionKey((currentKey) =>
      currentKey === selectedBookDescriptionKey
        ? null
        : selectedBookDescriptionKey,
    );
  };

  const selectSessionBook = (bookId: string) => {
    vibrateSelect();
    timerControlSound.playConfirm();
    onChangeBook(bookId);
    setPreviewBookId(bookId);
    setIsBookAddListItemActive(false);
    setHasSelectedSessionBook(true);
    timer.reset();
  };

  const previewSessionBook = (bookId: string) => {
    if (!isBookAddListItemActive && bookId === selectedBookPreview?.id) return;

    vibrateSelect();
    timerControlSound.playSelect();
    setIsBookAddListItemActive(false);
    if (bookPreviewGlitchTimerRef.current !== null) {
      window.clearTimeout(bookPreviewGlitchTimerRef.current);
    }
    setIsBookPreviewGlitching(true);
    setPreviewBookId(bookId);
    bookPreviewGlitchTimerRef.current = window.setTimeout(() => {
      setIsBookPreviewGlitching(false);
      bookPreviewGlitchTimerRef.current = null;
    }, 360);
  };

  const previewBookAddListItem = () => {
    if (isBookAddListItemActive) return;

    vibrateSelect();
    timerControlSound.playSelect();
    setIsBookAddListItemActive(true);
  };

  if (isBookAddOpen) {
    return (
      <div className="session-screen space-y-4">
        <section className="session-book-select-stage session-ready-stage session-book-add-stage">
          <div className="session-book-select-console session-ready-console session-book-add-console">
            <div className="focus-timer-card session-ready-scene-card">
              <div className="relative z-10 session-ready-scene-shell">
                <div
                  className={
                    bookAddStep === "search"
                      ? "session-book-add-panel session-book-add-panel-search"
                      : "session-book-add-panel session-book-add-panel-details"
                  }
                >
                  {bookAddStep === "search" ? (
                    <form
                      className="session-book-add-search"
                      onSubmit={(event) => {
                        event.preventDefault();
                        void submitBookSearch();
                      }}
                    >
                      <div className="session-word-search-form session-book-add-search-form">
                        <input
                          type="search"
                          id="session-book-search-query"
                          aria-label="책 검색어"
                          placeholder="제목, 저자, ISBN으로 검색"
                          value={bookSearchQuery}
                          onChange={(event) => {
                            setBookSearchQuery(event.target.value);
                            setSelectedBookSearchResult(null);
                          }}
                        />
                        <button
                          type="submit"
                          className="session-word-go-button"
                          aria-label="책 검색"
                          disabled={bookSearchStatus === "loading"}
                        >
                          {bookSearchStatus === "loading" ? (
                            "..."
                          ) : (
                            <Icon name="search" />
                          )}
                        </button>
                      </div>
                      <div className="session-book-add-search-messages">
                        {!hasKakaoBookApiKey && (
                          <p className="session-book-add-message">
                            `.env`에 `VITE_KAKAO_REST_API_KEY`를 추가하면 검색을
                            사용할 수 있습니다.
                          </p>
                        )}
                        {bookSearchMessage && (
                          <p className="session-book-add-message">
                            {bookSearchMessage}
                          </p>
                        )}
                      </div>
                      {bookSearchResults.length > 0 && (
                        <div
                          className="session-book-add-results"
                          role="list"
                        >
                          {bookSearchResults.map((book, index) => (
                            <button
                              key={book.id}
                              type="button"
                              className={
                                selectedBookSearchResult?.id === book.id
                                  ? "session-book-search-card session-book-search-card-active"
                                  : "session-book-search-card"
                              }
                              aria-pressed={
                                selectedBookSearchResult?.id === book.id
                              }
                              onClick={() => selectSearchResult(book)}
                            >
                              <span className="session-book-search-index">
                                {(index + 1).toString().padStart(2, "0")}
                              </span>
                              {book.thumbnail ? (
                                <img
                                  className="session-book-search-cover"
                                  src={book.thumbnail}
                                  alt=""
                                />
                              ) : (
                                <span className="session-book-search-cover session-book-search-cover-empty">
                                  <Icon name="book" className="h-5 w-5" />
                                </span>
                              )}
                              <span className="session-book-search-copy">
                                <strong>{book.title}</strong>
                                <small>
                                  {book.authors.join(", ") || "저자 정보 없음"}
                                </small>
                                <em>{book.publisher || "출판사 정보 없음"}</em>
                              </span>
                            </button>
                          ))}
                        </div>
                      )}
                    </form>
                  ) : (
                    <div className="session-book-add-details">
                      <div className="session-book-search-card session-book-add-preview">
                        <span className="session-book-search-index">01</span>
                        {newBook.thumbnail ? (
                          <img
                            className="session-book-search-cover"
                            src={newBook.thumbnail}
                            alt=""
                          />
                        ) : (
                          <div className="session-book-search-cover session-book-search-cover-empty">
                            <Icon name="book" className="h-6 w-6" />
                          </div>
                        )}
                        <span className="session-book-search-copy">
                          <strong>
                            {newBook.title.trim() || "책 제목을 입력해 주세요"}
                          </strong>
                          <small>{newBook.author.trim() || "저자 정보 없음"}</small>
                          <em>{newBook.publisher || "출판사 정보 없음"}</em>
                        </span>
                      </div>

                      <div className="book-form-fields session-book-add-fields">
                        {isManualBookEntry && (
                          <>
                            <label
                              className="book-form-label"
                              htmlFor="session-new-book-title"
                            >
                              책 제목
                            </label>
                            <input
                              id="session-new-book-title"
                              className="book-form-input"
                              value={newBook.title}
                              onChange={(event) =>
                                setNewBook((current) => ({
                                  ...current,
                                  title: event.target.value,
                                }))
                              }
                            />

                            <label
                              className="book-form-label"
                              htmlFor="session-new-book-author"
                            >
                              저자
                            </label>
                            <input
                              id="session-new-book-author"
                              className="book-form-input"
                              value={newBook.author}
                              onChange={(event) =>
                                setNewBook((current) => ({
                                  ...current,
                                  author: event.target.value,
                                }))
                              }
                            />
                          </>
                        )}

                        <div
                          className="session-book-add-status-switch"
                          role="group"
                          aria-label="등록 상태"
                        >
                          {(["reading", "completed"] as const).map(
                            (status) => (
                              <button
                                key={status}
                                type="button"
                                className={
                                  newBook.status === status
                                    ? "session-book-add-status-option session-book-add-status-option-active"
                                    : "session-book-add-status-option"
                                }
                                aria-pressed={newBook.status === status}
                                onClick={() => {
                                  timerControlSound.playSelect();
                                  setBookDateError("");
                                  setNewBook((current) => ({
                                    ...current,
                                    status,
                                    currentPage:
                                      status === "completed" &&
                                      current.totalPages
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
                                        ? current.completedAt
                                        : undefined,
                                  }));
                                }}
                              >
                                <span>
                                  {status === "reading" ? "미완독" : "완독"}
                                </span>
                              </button>
                            ),
                          )}
                        </div>

                        <div className="book-form-pages-fields">
                          {newBook.status === "reading" ? (
                            <>
                              <div className="session-book-add-page-row">
                                <div>
                                  <label
                                    className="book-form-label"
                                    htmlFor="session-new-book-current"
                                  >
                                    현재 페이지
                                  </label>
                                  <input
                                    id="session-new-book-current"
                                    className="book-form-input"
                                    type="text"
                                    inputMode="numeric"
                                    min={1}
                                    max={newBook.totalPages ?? undefined}
                                    value={newBook.currentPage}
                                    onChange={(event) =>
                                      setNewBook((current) => ({
                                        ...current,
                                        currentPage: parsePageInput(
                                          event.target.value,
                                        ),
                                      }))
                                    }
                                  />
                                </div>
                                <div className="book-total-pages-section">
                                  <label
                                    className="book-form-label"
                                    htmlFor="session-new-book-total"
                                  >
                                    전체 페이지
                                  </label>
                                  <input
                                    id="session-new-book-total"
                                    className="book-form-input"
                                    type="text"
                                    inputMode="numeric"
                                    min={1}
                                    placeholder="선택 사항"
                                    value={newBook.totalPages ?? ""}
                                    onChange={(event) =>
                                      setNewBook((current) => {
                                        const rawValue =
                                          event.target.value.trim();
                                        if (rawValue.length === 0) {
                                          return {
                                            ...current,
                                            totalPages: null,
                                          };
                                        }

                                        const totalPages = Math.max(
                                          parsePageInput(rawValue),
                                          1,
                                        );

                                        return {
                                          ...current,
                                          totalPages,
                                        };
                                      })
                                    }
                                    onBlur={() =>
                                      setNewBook((current) =>
                                        current.totalPages
                                          ? {
                                              ...current,
                                              currentPage: clampBookPage(
                                                current.currentPage,
                                                current.totalPages,
                                              ),
                                            }
                                          : current,
                                      )
                                    }
                                  />
                                </div>
                              </div>
                              <p className="book-total-pages-hint">
                                책 상세에서 나중에 입력할 수 있어요.
                              </p>
                            </>
                          ) : (
                            <div className="book-total-pages-section">
                              <label
                                className="book-form-label"
                                htmlFor="session-new-book-total"
                              >
                                전체 페이지
                              </label>
                              <input
                                id="session-new-book-total"
                                className="book-form-input"
                                type="text"
                                inputMode="numeric"
                                min={1}
                                placeholder="선택 사항"
                                value={newBook.totalPages ?? ""}
                                onChange={(event) =>
                                  setNewBook((current) => {
                                    const rawValue = event.target.value.trim();
                                    if (rawValue.length === 0) {
                                      return {
                                        ...current,
                                        totalPages: null,
                                      };
                                    }

                                    const totalPages = Math.max(
                                      parsePageInput(rawValue),
                                      1,
                                    );

                                    return {
                                      ...current,
                                      totalPages,
                                      currentPage: totalPages,
                                    };
                                  })
                                }
                              />
                              <p className="book-total-pages-hint">
                                책 상세에서 나중에 입력할 수 있어요.
                              </p>
                            </div>
                          )}

                          {newBook.status === "completed" && (
                            <>
                              <div className="session-book-add-date-row">
                                <div>
                                  <label
                                    className="book-form-label"
                                    htmlFor="session-new-book-started-at"
                                  >
                                    시작일
                                  </label>
                                  <input
                                    id="session-new-book-started-at"
                                    className="book-form-input"
                                    type="date"
                                    value={toDateInputValue(
                                      newBook.startedAt ?? "",
                                    )}
                                    onChange={(event) => {
                                      setBookDateError("");
                                      setNewBook((current) => ({
                                        ...current,
                                        startedAt: event.target.value,
                                      }));
                                    }}
                                  />
                                </div>
                                <div>
                                  <label
                                    className="book-form-label"
                                    htmlFor="session-new-book-completed-at"
                                  >
                                    완독일
                                  </label>
                                  <input
                                    id="session-new-book-completed-at"
                                    className="book-form-input"
                                    type="date"
                                    value={toDateInputValue(
                                      newBook.completedAt ?? "",
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
                              </div>
                              {bookDateError && (
                                <p className="book-form-error">
                                  {bookDateError}
                                </p>
                              )}
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="session-ready-controls session-book-add-controls">
              {bookAddStep === "search" ? (
                <div className="session-book-add-simple-actions">
                  {selectedBookSearchResult ? (
                    <>
                      <button
                        type="button"
                        className="session-book-add-action session-book-add-action-primary"
                        onClick={continueWithSelectedSearchResult}
                      >
                        선택
                      </button>
                      <button
                        type="button"
                        className="session-book-add-action"
                        onClick={resetBookSearch}
                      >
                        초기화
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        type="button"
                        className="session-book-add-action"
                        onClick={startManualBookEntry}
                      >
                        직접 입력
                      </button>
                    </>
                  )}
                  <button
                    type="button"
                    className="session-book-add-action"
                    onClick={closeBookAddFlow}
                  >
                    이전
                  </button>
                </div>
              ) : (
                <div className="session-book-add-simple-actions">
                  <button
                    type="button"
                    className="session-book-add-action session-book-add-action-primary"
                    onClick={() => void saveBook()}
                    disabled={isSavingBook || newBook.title.trim().length === 0}
                  >
                    {isSavingBook ? "저장 중" : "추가하기"}
                  </button>
                  <button
                    type="button"
                    className="session-book-add-action"
                    onClick={openBookSearchStep}
                  >
                    이전
                  </button>
                </div>
              )}
            </div>
          </div>
        </section>
      </div>
    );
  }

  if (canShowBookSelectScreen) {
    return (
      <div className="session-screen space-y-4">
        <section className="session-book-select-stage">
          <div className="session-book-select-console">
            {selectedBookPreview && (
              <aside
                className={`session-book-preview-panel ${
                  isBookDescriptionExpanded
                    ? "session-book-preview-panel-description-expanded"
                    : ""
                }`}
              >
                <div className="session-book-preview-screen">
                  <div
                    className={`session-book-preview-cover ${
                      isBookPreviewGlitching
                        ? "session-book-preview-cover-glitching"
                        : ""
                    }`}
                  >
                    {selectedBookPreview.thumbnail ? (
                      <PixelatedBookCover
                        src={selectedBookPreview.thumbnail}
                        alt=""
                        className="session-book-preview-pixel-cover"
                      />
                    ) : (
                      <Icon name="book" className="h-9 w-9" />
                    )}
                  </div>
                </div>
                <div className="session-book-preview-copy">
                  <h2>{selectedBookPreview.title}</h2>
                  <p className="session-book-preview-author">
                    {selectedBookPreview.author || "작자 미상"}
                  </p>
                  <button
                    key={`${selectedBookPreview.id}-${selectedBookDescription}`}
                    type="button"
                    ref={bookDescriptionRef}
                    className={`session-book-preview-description ${
                      isBookDescriptionExpanded
                        ? "session-book-preview-description-expanded"
                        : ""
                    } ${
                      canToggleBookDescription
                        ? "session-book-preview-description-toggleable"
                        : ""
                    }`}
                    style={bookDescriptionStyle}
                    onClick={toggleBookDescription}
                    aria-expanded={
                      canToggleBookDescription
                        ? isBookDescriptionExpanded
                        : undefined
                    }
                    aria-label={selectedBookDescription}
                  >
                    <span
                      className="session-book-preview-description-text"
                    >
                      {visibleBookDescription}
                      {isBookDescriptionTyping && (
                        <span
                          className="session-book-preview-description-cursor"
                          aria-hidden="true"
                        />
                      )}
                    </span>
                  </button>
                </div>
                <div className="session-book-preview-stats">
                  <span>
                    PAGE {selectedBookPreview.currentPage}
                    {selectedBookPreview.totalPages
                      ? `/${selectedBookPreview.totalPages}`
                      : ""}
                  </span>
                  <span className="session-book-preview-progress">
                    <span
                      key={selectedBookPreview.id}
                      style={{ width: `${selectedBookProgress ?? 0}%` }}
                    />
                  </span>
                  <strong>
                    {selectedBookProgress !== null
                      ? `${selectedBookProgress}%`
                      : "NEW"}
                  </strong>
                </div>
              </aside>
            )}

            <div className="session-book-select-library">
              <div
                ref={bookSelectListRef}
                className="session-book-select-list"
                role="list"
              >
                <div
                  className={
                    isBookAddListItemActive
                      ? "book-game-item book-game-item-active"
                      : "book-game-item"
                  }
                >
                  <button
                    type="button"
                    className="book-game-preview"
                    aria-pressed={isBookAddListItemActive}
                    onClick={previewBookAddListItem}
                  >
                    <span className="book-game-cursor" aria-hidden="true">
                      ▶
                    </span>
                    <span className="book-game-slot">00</span>
                    <span className="book-game-copy">
                      <strong>책 추가하기</strong>
                      <small>새로운 독서 시작</small>
                    </span>
                  </button>
                  {isBookAddListItemActive ? (
                    <button
                      type="button"
                      className="book-game-select-button"
                      onClick={openBookAddFlow}
                    >
                      선택
                    </button>
                  ) : (
                    <span className="book-game-progress">NEW</span>
                  )}
                </div>
                {readingBooks.map((book, index) => (
                  <BookGameSelectItem
                    key={book.id}
                    book={book}
                    index={index}
                    isActive={
                      !isBookAddListItemActive &&
                      book.id === selectedBookPreview?.id
                    }
                    itemRef={(node) => {
                      if (node) {
                        bookSelectItemRefs.current.set(book.id, node);
                        return;
                      }

                      bookSelectItemRefs.current.delete(book.id);
                    }}
                    onSelect={() => previewSessionBook(book.id)}
                    onConfirm={() => selectSessionBook(book.id)}
                  />
                ))}
              </div>
            </div>
          </div>
        </section>
      </div>
    );
  }

  if (!currentBook || currentBook.status === "completed") {
    return (
      <div className="session-screen space-y-4">
        <section className="session-book-select-stage session-ready-stage session-empty-book-stage">
          <div className="session-book-select-console session-ready-console session-empty-book-console">
            <div className="focus-timer-card session-ready-scene-card">
              <div className="relative z-10 session-ready-scene-shell">
                <div className="session-ready-info session-empty-book-info">
                  <div className="session-ready-continue session-empty-book-copy">
                    <strong className="session-empty-book-title">
                      첫 책을 추가해볼까요?
                    </strong>
                  </div>
                </div>
              </div>
            </div>

            <div className="session-ready-controls session-empty-book-controls">
              <button
                type="button"
                className="session-empty-book-primary"
                onClick={openBookAddFlow}
              >
                첫 책 추가하기
              </button>
            </div>
          </div>
        </section>
      </div>
    );
  }
  const isFormForCurrentBook = form.bookId === currentBook.id;
  const endPage = isFormForCurrentBook ? form.endPage : 0;
  const isStopwatchMode = timer.mode === "stopwatch";
  const isReading = timer.status === "running";
  const displaySeconds = isStopwatchMode
    ? timer.elapsedSeconds
    : timer.remainingSeconds;
  const adventureProgress = isStopwatchMode
    ? Math.min(
        (timer.elapsedSeconds / Math.max(dailyGoalSeconds, 1)) * 100,
        100,
      )
    : timer.progress;
  const canDecreaseExtension = extensionSeconds > minimumExtensionSeconds;
  const canIncreaseExtension = extensionSeconds < maximumExtensionSeconds;
  const readyBookProgress = getBookProgress(
    currentBook.currentPage,
    currentBook.totalPages,
  );
  const updateForm = (patch: Partial<typeof form>) => {
    setForm((current) => ({
      ...current,
      bookId: currentBook.id,
      endPage,
      ...patch,
    }));
  };

  const openCompletion = () => {
    if (timer.elapsedSeconds === 0) return;
    setIsWordSearchOpen(false);
    setIsSentenceNoteOpen(false);
    vibrateTimerStop();
    timerControlSound.playStop();
    timerCompletionSound.suppressNextCompletionSound();
    timer.complete();
    setIsCompletionOpen(true);
  };

  const saveCompletion = async () => {
    if (isSaving) return;

    setIsSaving(true);

    try {
      const savedEndPage = clampBookPage(
        endPage,
        currentBook.totalPages,
        currentBook.currentPage,
      );
      const baseline =
        sessionBaseline?.bookId === currentBook.id ? sessionBaseline : null;
      const summary: SavedSessionSummary = {
        bookId: currentBook.id,
        durationSeconds: Math.max(timer.elapsedSeconds, 1),
        startPage: currentBook.currentPage,
        endPage: savedEndPage,
        totalPages: currentBook.totalPages,
        previousProgress: getBookProgress(
          currentBook.currentPage,
          currentBook.totalPages,
        ),
        nextProgress: getBookProgress(savedEndPage, currentBook.totalPages),
        savedSentenceCount: Math.max(
          currentBook.sentences.length -
            (baseline?.sentenceCount ?? currentBook.sentences.length),
          0,
        ),
        savedWordCount: Math.max(
          currentBook.wordNotes.length -
            (baseline?.wordCount ?? currentBook.wordNotes.length),
          0,
        ),
      };
      const endedAt = new Date();
      const startedAt = new Date(
        timer.sessionStartedAt ??
          endedAt.getTime() - Math.max(timer.elapsedSeconds, 1) * 1000,
      );

      await onSaveRecord({
        durationSeconds: Math.max(timer.elapsedSeconds, 1),
        startedAt: startedAt.toISOString(),
        endedAt: endedAt.toISOString(),
        endPage,
      });
      setSavedSessionSummary(summary);
      setSessionBaseline(null);
      timer.reset();
      setForm({
        bookId: currentBook.id,
        endPage: 0,
      });
      setIsCompletionOpen(false);
    } finally {
      setIsSaving(false);
    }
  };

  const continueReading = () => {
    vibrateTap();
    timerCompletionSound.prepare();
    setIsCompletionOpen(false);
    setSavedSessionSummary(null);
    timer.extendAndResume(extensionSeconds);
  };

  const resetCompletion = () => {
    vibrateWarning();
    timer.reset();
    setForm({
      bookId: currentBook.id,
      endPage: 0,
    });
    setIsCompletionOpen(false);
    setSavedSessionSummary(null);
    setSessionBaseline(null);
  };

  const adjustExtension = (deltaSeconds: number) => {
    vibrateSelect();
    setExtensionSeconds((current) =>
      Math.min(
        Math.max(current + deltaSeconds, minimumExtensionSeconds),
        maximumExtensionSeconds,
      ),
    );
  };

  const changeTimerMode = (mode: ReadingTimer["mode"]) => {
    if (!canChangeTimerMode || timer.mode === mode) return;

    vibrateTimerSelect();
    timerControlSound.playSelect();
    setIsBookChangeTimeItemActive(false);
    timer.setMode(mode);
  };

  const selectTimerPreset = (seconds: number) => {
    vibrateTimerSelect();
    timerControlSound.playSelect();
    setIsBookChangeTimeItemActive(false);
    timer.setPreset(seconds);
  };

  const selectBookChangeTimeItem = () => {
    if (isBookChangeTimeItemActive) return;

    vibrateTimerSelect();
    timerControlSound.playSelect();
    setIsBookChangeTimeItemActive(true);
  };

  const startTimer = () => {
    vibrateTimerStart();
    timerControlSound.playStart();
    timerCompletionSound.prepare();
    setSavedSessionSummary(null);
    setSessionBaseline((current) => {
      if (
        current?.bookId === currentBook.id &&
        timer.elapsedSeconds > 0
      ) {
        return current;
      }

      return {
        bookId: currentBook.id,
        sentenceCount: currentBook.sentences.length,
        wordCount: currentBook.wordNotes.length,
      };
    });
    timer.start();
  };

  const pauseTimer = () => {
    vibrateTimerPause();
    timerControlSound.playPause();
    timer.pause();
  };

  const openSessionBookSelection = () => {
    vibrateTap();
    timerControlSound.playSelect();
    setSavedSessionSummary(null);
    setPreviewBookId(currentBook?.id ?? null);
    setHasSelectedSessionBook(false);
  };
  const closeSavedSessionSummary = () => {
    vibrateTap();
    timerControlSound.playSelect();
    setSavedSessionSummary(null);
  };
  const openSavedSessionDetail = () => {
    if (!savedSessionSummary) return;

    vibrateSelect();
    timerControlSound.playConfirm();
    setSavedSessionSummary(null);
    onOpenBookDetail(savedSessionSummary.bookId);
  };
  const isTimerInteractionPanelOpen = isWordSearchOpen || isSentenceNoteOpen;

  const openWordSearch = () => {
    vibrateTimerPause();
    timerControlSound.playPause();
    if (timer.status === "running") {
      timer.pause();
    }
    setIsSentenceNoteOpen(false);
    setIsWordSearchOpen(true);
    setWordSaveMessage("");
  };

  const clearSelectedWordNoteDraft = () => {
    setSelectedWordDefinition(null);
    setWordNotePageInput("");
    setWordNoteSentence("");
  };

  const closeWordSearchAndResume = () => {
    setIsWordSearchOpen(false);
    setWordSaveMessage("");
    clearSelectedWordNoteDraft();
    if (timer.status === "paused" && timer.elapsedSeconds > 0) {
      setWordSearchResumeCountdownKey((current) => current + 1);
    }
  };

  const closeWordSearch = () => {
    vibrateTap();
    timerControlSound.playSelect();
    closeWordSearchAndResume();
  };

  const getWordDefinitionKey = (
    result: WordDictionaryResult,
    definition: WordDefinition,
    index: number,
    resultIndex = 0,
  ) =>
    `${resultIndex}-${result.word}-${definition.targetCode ?? ""}-${definition.senseNo ?? ""}-${index}`;

  const visibleWordDefinitions = wordSearchResults.flatMap(
    (result, resultIndex): VisibleWordDefinition[] =>
      result.definitions
        .map((definition, index) => ({
          result,
          definition,
          key: getWordDefinitionKey(result, definition, index, resultIndex),
        }))
        .filter(
          (item) =>
            item.result.word.trim().length > 0 &&
            item.definition.definition.trim().length > 0,
        ),
  );

  const searchWord = async () => {
    const query = wordSearchQuery.trim();
    if (!query || wordSearchStatus === "loading") return;

    vibrateSelect();
    timerControlSound.playSearch();
    setWordSearchStatus("loading");
    setWordSearchError("");
    setWordSaveMessage("");
    clearSelectedWordNoteDraft();

    try {
      const response = await searchKoreanWord(query, {
        method: "include",
        limit: 10,
      });

      const hasVisibleResults = response.results.some(
        (result) =>
          result.word.trim().length > 0 &&
          result.definitions.some(
            (definition) => definition.definition.trim().length > 0,
          ),
      );

      setWordSearchResults(response.results);
      setWordSearchStatus(hasVisibleResults ? "success" : "empty");
      if (!hasVisibleResults) {
        timerControlSound.playError();
      }
    } catch (error) {
      setWordSearchResults([]);
      setWordSearchStatus("error");
      timerControlSound.playError();
      setWordSearchError(
        error instanceof Error
          ? error.message
          : "단어를 검색하지 못했습니다.",
      );
    }
  };

  const selectWordDefinition = (selection: VisibleWordDefinition) => {
    if (selectedWordDefinition?.key === selection.key) return;

    vibrateSelect();
    timerControlSound.playSelect();
    setSelectedWordDefinition(selection);
    setWordNotePageInput("");
    setWordNoteSentence("");
    setWordSaveMessage("");
  };

  const saveSelectedWordDefinition = async () => {
    if (isSavingWordNote || !selectedWordDefinition) return;

    setIsSavingWordNote(true);
    setWordSaveMessage("");

    try {
      const { result, definition } = selectedWordDefinition;
      const savedWord = result.word.trim().toLowerCase();
      const savedDefinition = definition.definition.trim().toLowerCase();
      if (
        currentBook.wordNotes.some(
          (note) =>
            note.word.trim().toLowerCase() === savedWord &&
            note.definition.trim().toLowerCase() === savedDefinition,
        )
      ) {
        showTimerToast("이미 저장된 단어예요");
        timerControlSound.playSelect();
        return;
      }

      const hasPageInput = /\d/.test(wordNotePageInput);
      const page = hasPageInput
        ? parsePageInput(wordNotePageInput)
        : undefined;
      const contextSentence = wordNoteSentence.trim();

      await onAddWordNote(currentBook.id, {
        word: result.word,
        definition: definition.definition,
        page,
        contextSentence: contextSentence || undefined,
        source: result.source,
        sourceName: result.sourceName,
        sourceUrl: definition.link ?? result.sourceUrl,
        license: result.license,
        pos: definition.pos,
        category: definition.category,
        origin: definition.origin,
      });
      vibrateSuccess();
      timerControlSound.playConfirm();
      showTimerToast("단어를 저장했어요");
      clearSelectedWordNoteDraft();
      closeWordSearchAndResume();
    } catch (error) {
      timerControlSound.playError();
      const message =
        error instanceof Error ? error.message : "단어를 저장하지 못했습니다.";
      if (message.includes("이미 저장된 단어")) {
        showTimerToast("이미 저장된 단어예요");
        return;
      }

      setWordSaveMessage(
        message,
      );
    } finally {
      setIsSavingWordNote(false);
    }
  };

  const appendWordNoteSentence = (text: string) => {
    setWordNoteSentence((current) =>
      current.trim() ? `${current.trim()}\n${text}` : text,
    );
  };

  const appendSentenceNoteText = (text: string) => {
    setSentenceNoteText((current) =>
      current.trim() ? `${current.trim()}\n${text}` : text,
    );
    setSentenceNoteMessage("");
  };

  const saveSentenceNote = async () => {
    const text = sentenceNoteText.trim();
    if (isSavingSentenceNote || !text) return;

    setIsSavingSentenceNote(true);
    setSentenceNoteMessage("");

    try {
      const parsedPage = parsePageInput(sentenceNotePageInput);
      const page = parsedPage > 0 ? parsedPage : currentBook.currentPage;

      await onAddSentence(currentBook.id, text, page);
      vibrateSuccess();
      timerControlSound.playConfirm();
      showTimerToast("문장을 저장했어요");
      closeSentenceNoteAndResume();
    } catch (error) {
      timerControlSound.playError();
      setSentenceNoteMessage(
        error instanceof Error ? error.message : "문장을 저장하지 못했습니다.",
      );
    } finally {
      setIsSavingSentenceNote(false);
    }
  };

  const sentenceNotePanel = (
    <form
      className="session-sentence-panel"
      onSubmit={(event) => {
        event.preventDefault();
        void saveSentenceNote();
      }}
    >
      <div className="session-sentence-panel-body">
        <label className="session-sentence-page-field">
          <span>페이지</span>
          <input
            type="text"
            inputMode="numeric"
            value={sentenceNotePageInput}
            onChange={(event) => setSentenceNotePageInput(event.target.value)}
            placeholder="비워둘 수 있어요"
            aria-label="문장이 나온 페이지"
          />
        </label>

        <label className="session-sentence-text-field">
          <span>문장</span>
          <textarea
            value={sentenceNoteText}
            onChange={(event) => {
              setSentenceNoteText(event.target.value);
              setSentenceNoteMessage("");
            }}
            placeholder="읽다가 붙잡고 싶은 문장을 남겨보세요."
            aria-label="저장할 문장"
          />
        </label>
      </div>

      <div className="session-sentence-panel-footer" aria-live="polite">
        <span>책 상세 문장 기록에 저장됩니다.</span>
        {sentenceNoteMessage && <strong>{sentenceNoteMessage}</strong>}
      </div>
    </form>
  );

  const wordSearchPanel = (
    <form
      className="session-word-search-panel"
      onSubmit={(event) => {
        event.preventDefault();
        void searchWord();
      }}
    >
      <div className="session-word-search-form">
        <input
          type="search"
          value={wordSearchQuery}
          onFocus={() => {
            if (wordSearchStatus === "loading") return;

            setWordSearchStatus("idle");
            setWordSearchError("");
            setWordSearchResults([]);
            clearSelectedWordNoteDraft();
            setWordSaveMessage("");
          }}
          onChange={(event) => {
            setWordSearchQuery(event.target.value);
            clearSelectedWordNoteDraft();
            setWordSaveMessage("");
          }}
          placeholder="단어를 검색해보세요"
          aria-label="검색할 단어"
        />
        <button
          type="submit"
          className="session-word-go-button"
          aria-label="단어 검색"
          disabled={
            wordSearchQuery.trim().length === 0 ||
            wordSearchStatus === "loading"
          }
        >
          {wordSearchStatus === "loading" ? "..." : <Icon name="search" />}
        </button>
      </div>

      <div
        ref={wordResultListRef}
        className="session-word-search-results"
        aria-live="polite"
      >
        {wordSearchStatus === "idle" && (
          <p className="session-word-search-empty">
            모르는 단어를 검색하면 독서 시간은 잠시 멈춰요.
          </p>
        )}
        {wordSearchStatus === "loading" && (
          <p className="session-word-search-empty">검색 중...</p>
        )}
        {wordSearchStatus === "empty" && (
          <p className="session-word-search-empty">검색 결과가 없습니다.</p>
        )}
        {wordSearchStatus === "error" && (
          <p className="session-word-search-error">{wordSearchError}</p>
        )}
        {wordSearchStatus === "success" &&
          visibleWordDefinitions.map(({ result, definition, key }) => {
            const isSelected = selectedWordDefinition?.key === key;
            const selection = { result, definition, key };

            return (
              <article
                ref={(node) => {
                  if (node) {
                    wordResultItemRefs.current.set(key, node);
                    return;
                  }

                  wordResultItemRefs.current.delete(key);
                }}
                key={key}
                className={`session-word-result-group ${
                  isSelected ? "session-word-result-group-selected" : ""
                }`}
                aria-selected={isSelected}
              >
                <div className="session-word-result-row">
                  <button
                    type="button"
                    className="session-word-result"
                    onClick={() => selectWordDefinition(selection)}
                    aria-expanded={isSelected}
                    aria-pressed={isSelected}
                  >
                    <span className="session-word-result-header">
                      <span>
                        <strong>{result.word}</strong>
                        {definition.pos && <em>{definition.pos}</em>}
                      </span>
                    </span>
                    <span className="session-word-result-definition">
                      {definition.definition}
                    </span>
                  </button>

                </div>

                {isSelected && (
                  <section className="session-word-note-draft">
                    <label>
                      <span>페이지</span>
                      <input
                        type="text"
                        inputMode="numeric"
                        value={wordNotePageInput}
                        onChange={(event) =>
                          setWordNotePageInput(event.target.value)
                        }
                        placeholder="비워둘 수 있어요"
                        aria-label="단어가 나온 페이지"
                      />
                    </label>
                    <label>
                      <span>문장</span>
                      <textarea
                        value={wordNoteSentence}
                        onChange={(event) =>
                          setWordNoteSentence(event.target.value)
                        }
                        placeholder="단어가 나온 문장을 남겨보세요."
                        aria-label="단어가 나온 문장"
                      />
                    </label>
                  </section>
                )}
              </article>
            );
          })}
      </div>

      <div className="session-word-search-footer">
        <span>우리말샘</span>
        {wordSaveMessage && <strong>{wordSaveMessage}</strong>}
      </div>
    </form>
  );
  const savedSummaryProgressLabel =
    savedSessionSummary?.previousProgress !== null &&
    savedSessionSummary?.previousProgress !== undefined &&
    savedSessionSummary?.nextProgress !== null &&
    savedSessionSummary?.nextProgress !== undefined
      ? `${savedSessionSummary.previousProgress}% → ${savedSessionSummary.nextProgress}%`
      : "총 페이지 필요";

  return (
    <div className="session-screen space-y-4">
      {savedSessionSummary ? (
        <section className="session-book-select-stage session-completion-stage">
          <div className="session-book-select-console session-completion-console">
            <div className="focus-timer-card session-ready-scene-card session-completion-scene-card">
              <div className="relative z-10">
                <AdventureScene
                  status="completed"
                  mode={timer.mode}
                  displayTime={formatFocusTime(savedSessionSummary.durationSeconds)}
                  progress={savedSessionSummary.nextProgress ?? adventureProgress}
                  goalApproachProgress={null}
                  showStartBanner={false}
                  presets={presets}
                  targetSeconds={timer.targetSeconds}
                  memoryLogs={memoryLogs}
                  memorySeed={`${todayLabel()}-${savedSessionSummary.bookId}-saved`}
                  completionContent={
                    <div className="session-completion-hud session-saved-summary-hud">
                      <div className="session-completion-time">
                        <span>RECORD SAVED</span>
                        <strong>{formatDuration(savedSessionSummary.durationSeconds)}</strong>
                      </div>

                      <div className="session-saved-summary-list">
                        <div>
                          <span>페이지</span>
                          <strong>
                            {savedSessionSummary.startPage}p →{" "}
                            {savedSessionSummary.endPage}p
                          </strong>
                        </div>
                        <div>
                          <span>진행률</span>
                          <strong>{savedSummaryProgressLabel}</strong>
                        </div>
                        <div>
                          <span>단어</span>
                          <strong>
                            {savedSessionSummary.savedWordCount}개
                          </strong>
                        </div>
                        <div>
                          <span>문장</span>
                          <strong>
                            {savedSessionSummary.savedSentenceCount}개
                          </strong>
                        </div>
                      </div>
                    </div>
                  }
                  useExternalActionControls
                  onChangeMode={changeTimerMode}
                  onSelectPreset={selectTimerPreset}
                  onStart={startTimer}
                  onPause={pauseTimer}
                  onStop={openCompletion}
                />
              </div>
            </div>

            <div className="session-completion-controls">
              <div className="session-completion-actions">
                <button
                  type="button"
                  className="completion-secondary-action"
                  onClick={openSavedSessionDetail}
                >
                  상세로 가기
                </button>
                <button
                  type="button"
                  className="completion-save-action"
                  onClick={closeSavedSessionSummary}
                >
                  닫기
                </button>
              </div>
            </div>
          </div>
        </section>
      ) : canChangeTimerMode ? (
        <section className="session-book-select-stage session-ready-stage">
          <div className="session-book-select-console session-ready-console">
            <aside
              className={`session-book-preview-panel ${
                isBookDescriptionExpanded
                  ? "session-book-preview-panel-description-expanded"
                  : ""
              }`}
            >
              <div className="session-book-preview-screen">
                <div className="session-book-preview-cover">
                  {currentBook.thumbnail ? (
                    <PixelatedBookCover
                      src={currentBook.thumbnail}
                      alt=""
                      className="session-book-preview-pixel-cover"
                    />
                  ) : (
                    <Icon name="book" className="h-9 w-9" />
                  )}
                </div>
              </div>
              <div className="session-book-preview-copy">
                <h2>{currentBook.title}</h2>
                <p className="session-book-preview-author">
                  {currentBook.author || "작자 미상"}
                </p>
                <button
                  key={`${currentBook.id}-${selectedBookDescription}`}
                  type="button"
                  ref={bookDescriptionRef}
                  className={`session-book-preview-description ${
                    isBookDescriptionExpanded
                      ? "session-book-preview-description-expanded"
                      : ""
                  } ${
                    canToggleBookDescription
                      ? "session-book-preview-description-toggleable"
                      : ""
                  }`}
                  style={bookDescriptionStyle}
                  onClick={toggleBookDescription}
                  aria-expanded={
                    canToggleBookDescription
                      ? isBookDescriptionExpanded
                      : undefined
                  }
                  aria-label={selectedBookDescription}
                >
                  <span
                    className="session-book-preview-description-text"
                  >
                    {visibleBookDescription}
                    {isBookDescriptionTyping && (
                      <span
                        className="session-book-preview-description-cursor"
                        aria-hidden="true"
                      />
                    )}
                  </span>
                </button>
              </div>
              <div className="session-book-preview-stats">
                <span>
                  PAGE {currentBook.currentPage}
                  {currentBook.totalPages ? `/${currentBook.totalPages}` : ""}
                </span>
                <span className="session-book-preview-progress">
                  <span
                    key={currentBook.id}
                    style={{ width: `${readyBookProgress ?? 0}%` }}
                  />
                </span>
                <strong>
                  {readyBookProgress !== null ? `${readyBookProgress}%` : "NEW"}
                </strong>
              </div>
            </aside>

            <div className="session-ready-controls">
              <div
                ref={timerPresetListRef}
                className="session-ready-preset-grid"
                role="list"
              >
                <div
                  ref={(node) => {
                    if (node) {
                      timerPresetItemRefs.current.set("change-book", node);
                      return;
                    }

                    timerPresetItemRefs.current.delete("change-book");
                  }}
                  className={`book-game-item session-ready-time-item ${
                    isBookChangeTimeItemActive ? "book-game-item-active" : ""
                  }`}
                >
                  <button
                    type="button"
                    className="book-game-preview"
                    onClick={selectBookChangeTimeItem}
                    aria-pressed={isBookChangeTimeItemActive}
                  >
                    <span className="book-game-cursor" aria-hidden="true">
                      ▶
                    </span>
                    <span className="book-game-slot">00</span>
                    <span className="book-game-copy">
                      <strong>책 변경하기</strong>
                    </span>
                  </button>
                  {isBookChangeTimeItemActive ? (
                    <button
                      type="button"
                      className="book-game-select-button"
                      onClick={openSessionBookSelection}
                    >
                      확인
                    </button>
                  ) : (
                    <span
                      className="book-game-progress book-game-progress-empty"
                      aria-hidden="true"
                    />
                  )}
                </div>
                {presets.map((preset, index) => {
                  const isActive =
                    !isBookChangeTimeItemActive &&
                    timer.mode === "countdown" &&
                    timer.targetSeconds === preset.seconds;
                  const presetKey = `preset-${preset.seconds}`;

                  return (
                    <div
                      ref={(node) => {
                        if (node) {
                          timerPresetItemRefs.current.set(presetKey, node);
                          return;
                        }

                        timerPresetItemRefs.current.delete(presetKey);
                      }}
                      key={preset.seconds}
                      className={`book-game-item session-ready-time-item ${
                        isActive ? "book-game-item-active" : ""
                      }`}
                    >
                      <button
                        type="button"
                        className="book-game-preview"
                        onClick={() => selectTimerPreset(preset.seconds)}
                        aria-pressed={isActive}
                      >
                        <span className="book-game-cursor" aria-hidden="true">
                          ▶
                        </span>
                        <span className="book-game-slot">
                          {(index + 1).toString().padStart(2, "0")}
                        </span>
                        <span className="book-game-copy">
                          <strong>{preset.label}</strong>
                        </span>
                      </button>
                      {isActive ? (
                        <button
                          type="button"
                          className="book-game-select-button"
                          onClick={startTimer}
                        >
                          시작
                        </button>
                      ) : (
                        <span
                          className="book-game-progress book-game-progress-empty"
                          aria-hidden="true"
                        />
                      )}
                    </div>
                  );
                })}
                <div
                  ref={(node) => {
                    if (node) {
                      timerPresetItemRefs.current.set("stopwatch", node);
                      return;
                    }

                    timerPresetItemRefs.current.delete("stopwatch");
                  }}
                  className={`book-game-item session-ready-time-item ${
                    !isBookChangeTimeItemActive && timer.mode === "stopwatch"
                      ? "book-game-item-active"
                      : ""
                  }`}
                >
                  <button
                    type="button"
                    className="book-game-preview"
                    onClick={() => changeTimerMode("stopwatch")}
                    aria-pressed={
                      !isBookChangeTimeItemActive && timer.mode === "stopwatch"
                    }
                  >
                    <span className="book-game-cursor" aria-hidden="true">
                      ▶
                    </span>
                    <span className="book-game-slot">
                      {(presets.length + 1).toString().padStart(2, "0")}
                    </span>
                    <span className="book-game-copy">
                      <strong>FREE MODE</strong>
                    </span>
                  </button>
                  {!isBookChangeTimeItemActive &&
                  timer.mode === "stopwatch" ? (
                    <button
                      type="button"
                      className="book-game-select-button"
                      onClick={startTimer}
                    >
                      시작
                    </button>
                  ) : (
                    <span
                      className="book-game-progress book-game-progress-empty"
                      aria-hidden="true"
                    />
                  )}
                </div>
              </div>
            </div>
          </div>
        </section>
      ) : isCompletionVisible ? (
        <section className="session-book-select-stage session-completion-stage">
          <div className="session-book-select-console session-completion-console">
            <div className="focus-timer-card session-ready-scene-card session-completion-scene-card">
              <div className="relative z-10">
                <AdventureScene
                  status={timer.status}
                  mode={timer.mode}
                  displayTime={formatFocusTime(displaySeconds)}
                  progress={adventureProgress}
                  goalApproachProgress={null}
                  showStartBanner={false}
                  presets={presets}
                  targetSeconds={timer.targetSeconds}
                  memoryLogs={memoryLogs}
                  memorySeed={`${todayLabel()}-${currentBook.id}`}
                  completionContent={
                    <div className="session-completion-hud session-completion-hud-summary">
                      <div className="session-completion-time">
                        <span>SESSION CLEAR</span>
                        <strong>{formatDuration(timer.elapsedSeconds)}</strong>
                      </div>

                      <label
                        className="session-completion-page-field"
                        htmlFor="end-page"
                      >
                        <span>현재 페이지</span>
                        <span className="session-completion-page-input">
                          <input
                            ref={completionPageInputRef}
                            id="end-page"
                            type="text"
                            inputMode="numeric"
                            min={currentBook.currentPage}
                            max={currentBook.totalPages ?? undefined}
                            value={endPage > 0 ? endPage : ""}
                            onChange={(event) =>
                              updateForm({
                                endPage: parsePageInput(event.target.value),
                              })
                            }
                          />
                          <span>PAGE</span>
                        </span>
                      </label>
                    </div>
                  }
                  useExternalActionControls
                  onChangeMode={changeTimerMode}
                  onSelectPreset={selectTimerPreset}
                  onStart={startTimer}
                  onPause={pauseTimer}
                  onStop={openCompletion}
                />
              </div>
            </div>

            <div className="session-completion-controls">
              {!isStopwatchMode && (
                <div className="session-completion-tools">
                  <div className="session-completion-extension">
                    <button
                      type="button"
                      onClick={() => adjustExtension(-extensionStepSeconds)}
                      disabled={!canDecreaseExtension}
                      aria-label="추가 독서 5분 줄이기"
                    >
                      -
                    </button>
                    <strong aria-live="polite">
                      +{Math.round(extensionSeconds / 60)}분
                    </strong>
                    <button
                      type="button"
                      onClick={() => adjustExtension(extensionStepSeconds)}
                      disabled={!canIncreaseExtension}
                      aria-label="추가 독서 5분 늘리기"
                    >
                      +
                    </button>
                  </div>
                </div>
              )}

              <div className="session-completion-actions">
                <button
                  type="button"
                  className="completion-secondary-action"
                  onClick={continueReading}
                >
                  {isStopwatchMode ? "이어서 측정" : "이어서 독서"}
                </button>
                <button
                  type="button"
                  className="completion-save-action"
                  onClick={() => {
                    vibrateSelect();
                    void saveCompletion();
                  }}
                  disabled={isSaving}
                >
                  {isSaving ? "저장 중" : "기록 저장"}
                </button>
              </div>

              <button
                type="button"
                className="session-completion-reset"
                onClick={resetCompletion}
                disabled={isSaving}
              >
                기록하지 않고 닫기
              </button>
            </div>
          </div>
        </section>
      ) : (
        <section className="session-book-select-stage session-reading-stage">
          <div className="session-book-select-console session-reading-console">
            <div className="focus-timer-card session-ready-scene-card session-reading-scene-card">
              <div className="relative z-10">
                <AdventureScene
                  status={timer.status}
                  mode={timer.mode}
                  displayTime={formatFocusTime(displaySeconds)}
                  progress={adventureProgress}
                  goalApproachProgress={
                    !isStopwatchMode &&
                    timer.elapsedSeconds > 0 &&
                    timer.remainingSeconds <= 10
                      ? (10 - timer.remainingSeconds) / 10
                      : null
                  }
                  showStartBanner={isReading && timer.elapsedSeconds < 1}
                  presets={presets}
                  targetSeconds={timer.targetSeconds}
                  memoryLogs={memoryLogs}
                  memorySeed={`${todayLabel()}-${currentBook.id}`}
                  searchPanelContent={wordSearchPanel}
                  isSearchPanelOpen={isWordSearchOpen}
                  searchCountdownKey={wordSearchResumeCountdownKey}
                  sentencePanelContent={sentenceNotePanel}
                  isSentencePanelOpen={isSentenceNoteOpen}
                  sentenceCountdownKey={sentenceNoteResumeCountdownKey}
                  useExternalActionControls
                  onChangeMode={changeTimerMode}
                  onSelectPreset={selectTimerPreset}
                  onStart={startTimer}
                  onPause={pauseTimer}
                  onSearch={openWordSearch}
                  onSearchCountdownComplete={startTimer}
                  onSentence={openSentenceNote}
                  onSentenceCountdownComplete={startTimer}
                  onStop={openCompletion}
                />
              </div>
            </div>

            {timerToastMessage && (
              <div className="session-timer-toast" role="status">
                <Icon name="check" />
                <span>{timerToastMessage}</span>
              </div>
            )}

            {isWordSearchOpen ? (
              <div
                className="session-reading-controls"
                role="group"
                aria-label="단어 검색 조작"
              >
                <SentenceOcrButton
                  disabled={!selectedWordDefinition || isSavingWordNote}
                  label="사진으로담기"
                  buttonClassName="session-reading-control-button"
                  onRecognized={appendWordNoteSentence}
                />
                <button
                  type="button"
                  className="session-reading-control-button"
                  onClick={() => void saveSelectedWordDefinition()}
                  disabled={!selectedWordDefinition || isSavingWordNote}
                >
                  <Icon name="save" />
                  <span>
                    {isSavingWordNote ? "저장 중" : "선택된 단어 저장"}
                  </span>
                </button>
                <button
                  type="button"
                  className="session-reading-control-button session-reading-control-button-danger"
                  onClick={closeWordSearch}
                >
                  <Icon name="close" />
                  <span>나가기</span>
                </button>
              </div>
            ) : isSentenceNoteOpen ? (
              <div
                className="session-reading-controls"
                role="group"
                aria-label="문장 추가 조작"
              >
                <SentenceOcrButton
                  disabled={isSavingSentenceNote}
                  label="사진으로담기"
                  buttonClassName="session-reading-control-button"
                  onRecognized={appendSentenceNoteText}
                />
                <button
                  type="button"
                  className="session-reading-control-button"
                  onClick={() => void saveSentenceNote()}
                  disabled={!sentenceNoteText.trim() || isSavingSentenceNote}
                >
                  <Icon name="save" />
                  <span>{isSavingSentenceNote ? "저장 중" : "문장 저장"}</span>
                </button>
                <button
                  type="button"
                  className="session-reading-control-button session-reading-control-button-danger"
                  onClick={closeSentenceNote}
                >
                  <Icon name="close" />
                  <span>나가기</span>
                </button>
              </div>
            ) : (
              <div
                className="session-reading-controls session-reading-controls-grid"
                role="group"
                aria-label="독서 타이머 조작"
              >
                <button
                  type="button"
                  className="session-reading-control-button"
                  onClick={timer.status === "running" ? pauseTimer : startTimer}
                  disabled={
                    timer.status === "paused" && isTimerInteractionPanelOpen
                  }
                >
                  <Icon
                    name={
                      timer.status === "running" || isTimerInteractionPanelOpen
                        ? "pause"
                        : "play"
                    }
                  />
                  <span>
                    {timer.status === "running" || isTimerInteractionPanelOpen
                      ? "일시정지"
                      : "재생"}
                  </span>
                </button>
                <button
                  type="button"
                  className="session-reading-control-button session-reading-control-button-danger"
                  onClick={openCompletion}
                >
                  <Icon name="power" />
                  <span>종료</span>
                </button>
                <button
                  type="button"
                  className="session-reading-control-button session-reading-control-button-tool"
                  onClick={openWordSearch}
                  aria-pressed={isWordSearchOpen}
                >
                  <Icon name="search" />
                  <span>단어검색</span>
                </button>
                <button
                  type="button"
                  className="session-reading-control-button session-reading-control-button-tool"
                  onClick={openSentenceNote}
                  aria-pressed={isSentenceNoteOpen}
                >
                  <Icon name="edit" />
                  <span>문장저장</span>
                </button>
              </div>
            )}
          </div>
        </section>
      )}
    </div>
  );
};
