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
import { getDisplayBookDescription } from "../utils/bookDescription";

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
  const [bookDescriptionLineClamp, setBookDescriptionLineClamp] = useState(4);
  const [timerStartCountdownKey, setTimerStartCountdownKey] = useState(0);
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
  const bookDescriptionRef = useRef<HTMLParagraphElement | null>(null);
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
    getDisplayBookDescription(selectedBookPreview);
  const bookDescriptionStyle = {
    "--book-description-lines": bookDescriptionLineClamp,
  } as CSSProperties;

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

      setBookDescriptionLineClamp((currentLineClamp) =>
        currentLineClamp === nextLineClamp ? currentLineClamp : nextLineClamp,
      );
    };

    updateDescriptionLineClamp();

    const resizeObserver = new ResizeObserver(updateDescriptionLineClamp);
    resizeObserver.observe(descriptionElement);

    return () => {
      resizeObserver.disconnect();
    };
  }, [selectedBookDescription, selectedBookPreview]);

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
    }, 360);
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
                  <p
                    key={`${selectedBookPreview.id}-${selectedBookDescription}`}
                    ref={bookDescriptionRef}
                    className="session-book-preview-description"
                    style={bookDescriptionStyle}
                  >
                    <span className="session-book-preview-description-text">
                      {selectedBookDescription}
                    </span>
                  </p>
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

  const selectTimerPreset = (seconds: number) => {
    vibrateTimerSelect();
    timerControlSound.playSelect();
    timer.setPreset(seconds);
  };

  const startTimer = () => {
    vibrateTimerStart();
    timerControlSound.playStart();
    timerCompletionSound.prepare();
    timer.start();
  };

  const pauseTimer = () => {
    vibrateTimerPause();
    timerControlSound.playPause();
    timer.pause();
  };

  const requestTimerStart = () => {
    setTimerStartCountdownKey((current) => current + 1);
  };

  const openSessionBookSelection = () => {
    vibrateTap();
    timerControlSound.playSelect();
    setPreviewBookId(currentBook?.id ?? null);
    setHasSelectedSessionBook(false);
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
      {canChangeTimerMode ? (
        <section className="session-book-select-stage session-ready-stage">
          <div className="session-book-select-console session-ready-console">
            <div className="focus-timer-card session-ready-scene-card">
              <div className="relative z-10 session-ready-scene-shell">
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
                  useExternalPrepareControls
                  startCountdownKey={timerStartCountdownKey}
                  onChangeMode={changeTimerMode}
                  onSelectPreset={selectTimerPreset}
                  onStart={startTimer}
                  onPause={() => undefined}
                  onStop={() => undefined}
                />
                <div className="session-ready-scene-title">
                  {currentBook.title}
                </div>
              </div>
            </div>

            <div className="session-ready-controls">
              <div className="session-ready-preset-grid" role="list">
                {presets.map((preset, index) => {
                  const isActive =
                    timer.mode === "countdown" &&
                    timer.targetSeconds === preset.seconds;

                  return (
                    <button
                      key={preset.seconds}
                      type="button"
                      className={`session-ready-preset-button ${
                        isActive ? "session-ready-preset-button-active" : ""
                      }`}
                      onClick={() => selectTimerPreset(preset.seconds)}
                    >
                      <Icon name="chevronRight" />
                      <strong>{preset.label}</strong>
                      <span>STAGE {index + 1}</span>
                    </button>
                  );
                })}
                <button
                  type="button"
                  className={`session-ready-preset-button ${
                    timer.mode === "stopwatch"
                      ? "session-ready-preset-button-active"
                      : ""
                  }`}
                  onClick={() => changeTimerMode("stopwatch")}
                >
                  <Icon name="chevronRight" />
                  <strong>FREE JOURNEY</strong>
                  <span>STOPWATCH</span>
                </button>
              </div>

              <div className="session-ready-action-row">
                <button
                  type="button"
                  className="session-ready-book-change"
                  onClick={openSessionBookSelection}
                >
                  책 변경
                </button>
                <button
                  type="button"
                  className="session-ready-start-button"
                  onClick={requestTimerStart}
                >
                  독서 시작
                </button>
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

            <div className="session-reading-controls" role="group" aria-label="독서 타이머 조작">
              <button
                type="button"
                className="session-reading-control-button"
                onClick={timer.status === "running" ? pauseTimer : startTimer}
                disabled={timer.status === "paused" && isTimerInteractionPanelOpen}
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
                <Icon name="stop" />
                <span>정지</span>
              </button>
              <button
                type="button"
                className="session-reading-control-button"
                onClick={openWordSearch}
                aria-pressed={isWordSearchOpen}
              >
                <Icon name="search" />
                <span>단어검색</span>
              </button>
              <button
                type="button"
                className="session-reading-control-button"
                onClick={openSentenceNote}
                aria-pressed={isSentenceNoteOpen}
              >
                <Icon name="edit" />
                <span>문장저장</span>
              </button>
            </div>
          </div>
        </section>
      )}
    </div>
  );
};
