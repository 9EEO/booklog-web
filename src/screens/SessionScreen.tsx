import { useEffect, useMemo, useRef, useState } from "react";
import { AdventureScene } from "../components/adventure/AdventureScene";
import { Icon } from "../components/Icon";
import { SentenceOcrButton } from "../components/SentenceOcrButton";
import { useBackNavigationLayer } from "../hooks/useBackNavigationLayer";
import type { ReadingTimer } from "../hooks/useReadingTimer";
import { useTimerCompletionSound } from "../hooks/useTimerCompletionSound";
import { useTimerControlSound } from "../hooks/useTimerControlSound";
import {
  searchKoreanWord,
  type WordDefinition,
  type WordDictionaryResult,
} from "../services/wordDictionary";
import type {
  Book,
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
import { getBookProgress } from "../utils/bookPages";

type SessionScreenProps = {
  books: Book[];
  records: ReadingRecord[];
  currentBook: Book | null;
  dailyGoalSeconds: number;
  timer: ReadingTimer;
  onChangeBook: (bookId: string) => void;
  onSaveRecord: (input: ReadingCompletionInput) => Promise<void>;
  onAddSentence: (bookId: string, text: string, page: number) => Promise<void>;
  onAddWordNote: (bookId: string, input: WordNoteInput) => Promise<void>;
  onAddFirstBook: () => void;
};

type WordSearchStatus = "idle" | "loading" | "success" | "empty" | "error";
type SelectedWordDefinition = {
  result: WordDictionaryResult;
  definition: WordDefinition;
  key: string;
};

type VisibleWordDefinition = SelectedWordDefinition;

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

const toDateStart = (dateLabel: string) => {
  const [year, month, day] = dateLabel.split(".").map(Number);
  const date = new Date(year, month - 1, day);

  return Number.isFinite(date.getTime()) ? date.getTime() : null;
};

const getDaysSinceLastReading = (book: Book, records: ReadingRecord[]) => {
  const activeRoundId = book.activeRoundId;
  const lastReadAt = records.reduce<number | null>((latest, record) => {
    if (record.bookId !== book.id) return latest;
    if (activeRoundId && record.roundId && record.roundId !== activeRoundId) {
      return latest;
    }

    const recordDate = toDateStart(record.date);
    if (recordDate === null) return latest;

    return latest === null ? recordDate : Math.max(latest, recordDate);
  }, null);

  if (lastReadAt === null) return null;

  const today = toDateStart(todayLabel());
  if (today === null) return null;

  return Math.floor((today - lastReadAt) / 86_400_000);
};

type BookGameSelectItemProps = {
  book: Book;
  index: number;
  isActive: boolean;
  onSelect: () => void;
};

const BookGameSelectItem = ({
  book,
  index,
  isActive,
  onSelect,
}: BookGameSelectItemProps) => {
  const progress = getBookProgress(book.currentPage, book.totalPages);

  return (
    <button
      type="button"
      className={`book-game-item ${isActive ? "book-game-item-active" : ""}`}
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
      <span className="book-game-progress">
        {progress !== null ? `${progress}%` : "NEW"}
      </span>
    </button>
  );
};

export const SessionScreen = ({
  books,
  records,
  currentBook,
  dailyGoalSeconds,
  timer,
  onChangeBook,
  onSaveRecord,
  onAddSentence,
  onAddWordNote,
  onAddFirstBook,
}: SessionScreenProps) => {
  const [hasSelectedSessionBook, setHasSelectedSessionBook] = useState(false);
  const [previewBookId, setPreviewBookId] = useState<string | null>(null);
  const [isBookPreviewGlitching, setIsBookPreviewGlitching] = useState(false);
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
  const [extensionSeconds, setExtensionSeconds] = useState(
    minimumExtensionSeconds,
  );
  const [form, setForm] = useState({
    bookId: currentBook?.id ?? "",
    endPage: 0,
  });
  const bookPreviewGlitchTimerRef = useRef<number | null>(null);
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
    () => books.filter((book) => book.status !== "completed"),
    [books],
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
  const daysSinceLastReading = currentBook
    ? getDaysSinceLastReading(currentBook, records)
    : null;
  const shouldShowReadingGapBanner =
    daysSinceLastReading !== null && daysSinceLastReading > 0;

  useEffect(() => {
    if (!currentBook || !isCompletionVisible) return;

    vibrateSuccess();
  }, [currentBook, isCompletionVisible]);

  useEffect(
    () => () => {
      if (bookPreviewGlitchTimerRef.current === null) return;

      window.clearTimeout(bookPreviewGlitchTimerRef.current);
    },
    [],
  );

  const canShowBookSelectScreen =
    readingBooks.length > 0 &&
    (!currentBook ||
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
    selectedBookPreview?.libraryReference?.contents?.trim() ||
    selectedBookPreview?.libraryReference?.summary?.trim() ||
    selectedBookPreview?.contents?.trim() ||
    "아직 책 소개 문구가 없습니다.";

  const selectSessionBook = (bookId: string) => {
    vibrateSelect();
    onChangeBook(bookId);
    setPreviewBookId(bookId);
    setHasSelectedSessionBook(true);
    timer.reset();
  };

  const previewSessionBook = (bookId: string) => {
    if (bookId === selectedBookPreview?.id) return;

    vibrateSelect();
    if (bookPreviewGlitchTimerRef.current !== null) {
      window.clearTimeout(bookPreviewGlitchTimerRef.current);
    }
    setIsBookPreviewGlitching(true);
    setPreviewBookId(bookId);
    bookPreviewGlitchTimerRef.current = window.setTimeout(() => {
      setIsBookPreviewGlitching(false);
      bookPreviewGlitchTimerRef.current = null;
    }, 260);
  };

  if (canShowBookSelectScreen) {
    return (
      <div className="session-screen space-y-4">
        <section className="session-book-select-stage">
          <div className="session-book-select-console">
            {selectedBookPreview && (
              <aside className="session-book-preview-panel">
                <div className="session-book-preview-screen">
                  <div
                    className={`session-book-preview-cover ${
                      isBookPreviewGlitching
                        ? "session-book-preview-cover-glitching"
                        : ""
                    }`}
                  >
                    {selectedBookPreview.thumbnail ? (
                      <img src={selectedBookPreview.thumbnail} alt="" />
                    ) : (
                      <Icon name="book" className="h-9 w-9" />
                    )}
                  </div>
                </div>
                <div className="session-book-preview-copy">
                  <h2>
                    {selectedBookPreview.title}
                    <span>{selectedBookPreview.author || "작자 미상"}</span>
                  </h2>
                  <p>{selectedBookDescription}</p>
                </div>
                <div className="session-book-preview-stats">
                  <span>
                    PAGE {selectedBookPreview.currentPage}/
                    {selectedBookPreview.totalPages ?? "?"}
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

            <div className="session-book-select-list" role="list">
              {readingBooks.map((book, index) => (
                <BookGameSelectItem
                  key={book.id}
                  book={book}
                  index={index}
                  isActive={book.id === selectedBookPreview?.id}
                  onSelect={() => previewSessionBook(book.id)}
                />
              ))}
            </div>

            {selectedBookPreview && (
              <div className="session-book-select-actions">
                <button
                  type="button"
                  className="session-book-preview-select"
                  onClick={() => selectSessionBook(selectedBookPreview.id)}
                >
                  선택
                </button>
              </div>
            )}
          </div>
        </section>
      </div>
    );
  }

  if (!currentBook) {
    return (
      <div className="session-screen space-y-4">
        <section className="session-focus-panel session-focus-panel-expanded">
          <div className="focus-timer-card">
            <div className="relative z-10">
              <AdventureScene
                status="idle"
                mode={timer.mode}
                displayTime={formatFocusTime(timer.remainingSeconds)}
                progress={0}
                goalApproachProgress={null}
                showStartBanner={false}
                presets={presets}
                targetSeconds={timer.targetSeconds}
                memoryLogs={[]}
                memorySeed="empty-book"
                emptyState={{
                  title: "첫 책을 추가해볼까요?",
                  description:
                    "읽고 있는 책을 등록하면 바로 독서 시간을 기록할 수 있어요.",
                  actionLabel: "첫 책 추가하기",
                  onAction: onAddFirstBook,
                }}
                onChangeMode={() => undefined}
                onSelectPreset={() => undefined}
                onStart={() => undefined}
                onPause={() => undefined}
                onStop={() => undefined}
              />
            </div>
          </div>
        </section>
      </div>
    );
  }
  const isFormForCurrentBook = form.bookId === currentBook.id;
  const endPage = isFormForCurrentBook ? form.endPage : 0;
  const roundLabel =
    currentBook.activeRoundNumber && currentBook.activeRoundNumber > 1
      ? `${currentBook.activeRoundNumber}회독`
      : "";
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
  const canChangeTimerMode =
    timer.status === "idle" && timer.elapsedSeconds === 0;
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

  const closeCompletion = () => {
    setIsCompletionOpen(false);
    if (timer.status === "completed") {
      timer.cancelCompletion();
    }
  };

  const continueReading = () => {
    vibrateTap();
    timerCompletionSound.prepare();
    setIsCompletionOpen(false);
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
    timer.setMode(mode);
  };

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
      clearSelectedWordNoteDraft();
      closeWordSearchAndResume();
    } catch (error) {
      timerControlSound.playError();
      setWordSaveMessage(
        error instanceof Error ? error.message : "단어를 저장하지 못했습니다.",
      );
    } finally {
      setIsSavingWordNote(false);
    }
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
      <div className="session-sentence-panel-header">
        <strong>문장 추가</strong>
        <button type="button" onClick={closeSentenceNote} aria-label="닫기">
          <Icon name="close" className="h-3 w-3" />
        </button>
      </div>

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

        <SentenceOcrButton
          disabled={isSavingSentenceNote}
          onRecognized={(text) =>
            setSentenceNoteText((current) =>
              current.trim() ? `${current.trim()}\n${text}` : text,
            )
          }
        />

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

      <div className="session-sentence-panel-actions">
        <button type="button" onClick={closeSentenceNote}>
          닫기
        </button>
        <button
          type="submit"
          disabled={!sentenceNoteText.trim() || isSavingSentenceNote}
        >
          {isSavingSentenceNote ? "저장 중" : "저장"}
        </button>
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
          disabled={
            wordSearchQuery.trim().length === 0 ||
            wordSearchStatus === "loading"
          }
        >
          {wordSearchStatus === "loading" ? "..." : "GO"}
        </button>
        <button
          type="button"
          className="session-word-close-button"
          onClick={closeWordSearch}
          aria-label="검색 닫기"
        >
          <Icon name="close" className="h-3 w-3" />
        </button>
      </div>

      <div className="session-word-search-results" aria-live="polite">
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

                  {isSelected && (
                    <button
                      type="button"
                      className="session-word-item-save-button"
                      onClick={() => void saveSelectedWordDefinition()}
                      disabled={isSavingWordNote}
                    >
                      {isSavingWordNote ? "..." : "SAVE"}
                    </button>
                  )}
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
                      <SentenceOcrButton
                        disabled={isSavingWordNote}
                        onRecognized={(text) =>
                          setWordNoteSentence((current) =>
                            current.trim() ? `${current.trim()}\n${text}` : text,
                          )
                        }
                      />
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

  return (
    <div className="session-screen space-y-4">
      {shouldShowReadingGapBanner && (
        <div className="session-reading-gap-banner" role="status">
          <Icon name="timer" className="h-4 w-4" />
          <span>
            마지막 독서일로부터 {daysSinceLastReading}일이 지났어요
          </span>
        </div>
      )}

      <section className="session-focus-panel session-focus-panel-expanded">
        {canChangeTimerMode && (
          <header className="session-timer-book-bar">
            <div className="session-timer-book-cover" aria-hidden="true">
              {currentBook.thumbnail ? (
                <img src={currentBook.thumbnail} alt="" />
              ) : (
                <Icon name="book" className="h-4 w-4" />
              )}
            </div>
            <div className="session-timer-book-info">
              <span>NOW READING</span>
              <strong>{currentBook.title}</strong>
              <small>
                {currentBook.author}
                {roundLabel && ` · ${roundLabel}`}
              </small>
            </div>
            <button
              type="button"
              className="session-timer-book-change"
              onClick={() => {
                vibrateTap();
                timerControlSound.playSelect();
                setPreviewBookId(currentBook.id);
                setHasSelectedSessionBook(false);
              }}
            >
              책 변경
            </button>
          </header>
        )}

        <div className="focus-timer-card">
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
              completionContent={
                isCompletionVisible ? (
                  <div className="session-completion-hud">
                    <div className="session-completion-time">
                      <span>SESSION CLEAR</span>
                      <strong>{formatDuration(timer.elapsedSeconds)}</strong>
                    </div>
                  <button
                    type="button"
                    className="session-completion-close"
                    onClick={closeCompletion}
                    aria-label="닫기"
                  >
                    <Icon name="close" className="h-4 w-4" />
                  </button>

                  <label
                    className="session-completion-page-field"
                    htmlFor="end-page"
                  >
                    <span>현재 페이지</span>
                    <span className="session-completion-page-input">
                      <input
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

                  {!isStopwatchMode && (
                    <div className="session-completion-tools">
                      <div className="session-completion-extension">
                        <button
                          type="button"
                          onClick={() =>
                            adjustExtension(-extensionStepSeconds)
                          }
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
                          onClick={() =>
                            adjustExtension(extensionStepSeconds)
                          }
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
                ) : undefined
              }
              onChangeMode={changeTimerMode}
              onSelectPreset={(seconds) => {
                vibrateTimerSelect();
                timerControlSound.playSelect();
                timer.setPreset(seconds);
              }}
              onStart={() => {
                vibrateTimerStart();
                timerControlSound.playStart();
                timerCompletionSound.prepare();
                timer.start();
              }}
              onPause={() => {
                vibrateTimerPause();
                timerControlSound.playPause();
                timer.pause();
              }}
              onSearch={openWordSearch}
              onSearchCountdownComplete={() => {
                vibrateTimerStart();
                timerControlSound.playStart();
                timerCompletionSound.prepare();
                timer.start();
              }}
              onSentence={openSentenceNote}
              onSentenceCountdownComplete={() => {
                vibrateTimerStart();
                timerControlSound.playStart();
                timerCompletionSound.prepare();
                timer.start();
              }}
              onStop={openCompletion}
            />
          </div>
        </div>
      </section>
    </div>
  );
};
