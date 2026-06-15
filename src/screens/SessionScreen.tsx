import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import { AdventureScene } from "../components/adventure/AdventureScene";
import { BottomSheetModal } from "../components/BottomSheetModal";
import { Icon } from "../components/Icon";
import { PixelCard } from "../components/PixelCard";
import { SentenceOcrButton } from "../components/SentenceOcrButton";
import { useBackNavigationLayer } from "../hooks/useBackNavigationLayer";
import { useBookCoverPalette } from "../hooks/useBookCoverPalette";
import type { ReadingTimer } from "../hooks/useReadingTimer";
import { useTimerCompletionSound } from "../hooks/useTimerCompletionSound";
import { useTimerControlSound } from "../hooks/useTimerControlSound";
import type {
  Book,
  ReadingCompletionInput,
  ReadingRecord,
} from "../types/reading";
import { formatDuration } from "../utils/formatDuration";
import {
  vibratePakEject,
  vibratePakInsert,
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
  onGoLibrary: () => void;
};

type PakMotion = "idle" | "ejecting" | "out" | "inserting";

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
const pakProgressDelayMs = 300;
const pakProgressDurationMs = 720;

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

const useAnimatedPakProgress = (
  bookId: string,
  progress: number | null,
  insertionSequence: number,
) => {
  const target = progress !== null && progress > 0 ? Math.round(progress) : null;
  const [animatedProgress, setAnimatedProgress] = useState<{
    animationKey: string;
    value: number;
  } | null>(null);
  const animationKey = `${bookId}-${insertionSequence}`;
  const prefersReducedMotion =
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  useEffect(() => {
    if (target === null || prefersReducedMotion) return;

    let animationFrame = 0;
    const startTimer = window.setTimeout(() => {
      const startedAt = performance.now();
      const animate = (now: number) => {
        const elapsed = Math.min((now - startedAt) / pakProgressDurationMs, 1);
        const eased = 1 - Math.pow(1 - elapsed, 3);

        setAnimatedProgress({
          animationKey,
          value: Math.round(target * eased),
        });
        if (elapsed < 1) animationFrame = window.requestAnimationFrame(animate);
      };

      animationFrame = window.requestAnimationFrame(animate);
    }, pakProgressDelayMs);

    return () => {
      window.clearTimeout(startTimer);
      window.cancelAnimationFrame(animationFrame);
    };
  }, [animationKey, prefersReducedMotion, target]);

  if (target === null) return null;
  if (prefersReducedMotion) return target;
  return animatedProgress?.animationKey === animationKey
    ? animatedProgress.value
    : 0;
};

type BookPickerItemProps = {
  book: Book;
  isActive: boolean;
  onSelect: () => void;
};

const BookPickerItem = ({
  book,
  isActive,
  onSelect,
}: BookPickerItemProps) => {
  const progress = getBookProgress(book.currentPage, book.totalPages);
  const palette = useBookCoverPalette(
    book.id,
    book.thumbnail,
    book.coverColor,
    book.accentColor,
  );
  const bookRound =
    book.activeRoundNumber && book.activeRoundNumber > 1
      ? `${book.activeRoundNumber}회독`
      : "";

  return (
    <button
      type="button"
      className={`bookpick-item ${isActive ? "bookpick-item-active" : ""}`}
      style={
        {
          "--bookpick-top": palette.top,
          "--bookpick-bottom": palette.bottom,
        } as CSSProperties
      }
      onClick={onSelect}
    >
      {isActive && <span className="bookpick-flag">현재 읽는 책</span>}
      <span className="bookpick-body">
        <span className="bookpick-cover">
          {book.thumbnail ? (
            <img src={book.thumbnail} alt="" />
          ) : (
            <span className="bookpick-cover-empty" aria-hidden="true" />
          )}
        </span>
        <span className="bookpick-info">
          <span className="bookpick-name">{book.title}</span>
          <span className="bookpick-author">
            {book.author}
            {bookRound && <span className="bookpick-round"> · {bookRound}</span>}
          </span>
          <span className="bookpick-progress">
            <span className="bookpick-percent">
              {progress !== null ? `${progress}%` : "NEW"}
            </span>
            <span className="bookpick-bar">
              <span style={{ width: `${progress ?? 0}%` }} />
            </span>
          </span>
          <span className="bookpick-pages">
            {book.currentPage} / {book.totalPages ?? "?"} PAGES
          </span>
        </span>
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
  onGoLibrary,
}: SessionScreenProps) => {
  const [isBookModalOpen, setIsBookModalOpen] = useState(false);
  const [isCompletionOpen, setIsCompletionOpen] = useState(false);
  const [isSentenceOpen, setIsSentenceOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [pakMotion, setPakMotion] = useState<PakMotion>("idle");
  const [pakInsertionSequence, setPakInsertionSequence] = useState(0);
  const [extensionSeconds, setExtensionSeconds] = useState(
    minimumExtensionSeconds,
  );
  const pakMotionTimerRef = useRef<number | null>(null);
  const [form, setForm] = useState({
    bookId: currentBook?.id ?? "",
    endPage: currentBook?.currentPage ?? 1,
    sentence: "",
    sentencePage: currentBook?.currentPage ?? 1,
  });
  const timerCompletionSound = useTimerCompletionSound(timer.status);
  const timerControlSound = useTimerControlSound();
  const packPalette = useBookCoverPalette(
    currentBook?.id ?? "",
    currentBook?.thumbnail,
    currentBook?.coverColor ?? "#ef4548",
    currentBook?.accentColor ?? "#f2c94c",
  );

  const clearPakMotionTimer = () => {
    if (pakMotionTimerRef.current === null) return;

    window.clearTimeout(pakMotionTimerRef.current);
    pakMotionTimerRef.current = null;
  };

  const finishPakInsertion = () => {
    clearPakMotionTimer();
    vibratePakInsert();
    timerControlSound.playInsert();
    setPakMotion("inserting");
    setPakInsertionSequence((current) => current + 1);
    pakMotionTimerRef.current = window.setTimeout(() => {
      setPakMotion("idle");
      pakMotionTimerRef.current = null;
    }, 440);
  };

  const closeBookPicker = () => {
    setIsBookModalOpen(false);
    finishPakInsertion();
  };

  const openBookPicker = () => {
    if (pakMotion !== "idle") return;

    vibratePakEject();
    timerControlSound.playEject();
    clearPakMotionTimer();
    setPakMotion("ejecting");
    pakMotionTimerRef.current = window.setTimeout(() => {
      setPakMotion("out");
      setIsBookModalOpen(true);
      pakMotionTimerRef.current = null;
    }, 300);
  };

  useBackNavigationLayer(
    isBookModalOpen,
    closeBookPicker,
    "session-book-modal",
  );
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
    isSentenceOpen &&
      (isCompletionOpen ||
        (timer.status === "completed" && timer.elapsedSeconds > 0)),
    () => setIsSentenceOpen(false),
    "session-completion-sentence",
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
  const bookProgress = currentBook
    ? getBookProgress(currentBook.currentPage, currentBook.totalPages)
    : null;
  const animatedBookProgress = useAnimatedPakProgress(
    currentBook?.id ?? "",
    bookProgress,
    pakInsertionSequence,
  );

  useEffect(() => {
    return () => clearPakMotionTimer();
  }, []);

  useEffect(() => {
    if (!currentBook || !isCompletionVisible) return;

    vibrateSuccess();
  }, [currentBook, isCompletionVisible]);

  if (!currentBook) {
    return (
      <div className="session-screen space-y-4">
        <header>
          <h1 className="text-2xl font-black">독서중</h1>
        </header>
        <PixelCard className="bg-[#F3E8D0] text-center">
          <Icon name="book" className="mx-auto mb-3 h-8 w-8 text-[#5F6D57]" />
          <p className="text-lg font-black">읽을 책이 없습니다.</p>
          <p className="mt-2 text-sm font-bold leading-relaxed text-stone-600">
            서재에서 첫 책을 추가한 뒤 독서를 시작해 주세요.
          </p>
          <button
            type="button"
            className="primary-button mt-4 w-full"
            onClick={onGoLibrary}
          >
            <Icon name="plus" className="h-5 w-5" />
            서재로 이동
          </button>
        </PixelCard>
      </div>
    );
  }
  const isFormForCurrentBook = form.bookId === currentBook.id;
  const endPage = isFormForCurrentBook ? form.endPage : currentBook.currentPage;
  const sentence = isFormForCurrentBook ? form.sentence : "";
  const sentencePage = isFormForCurrentBook
    ? form.sentencePage
    : currentBook.currentPage;
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
      sentence,
      sentencePage,
      ...patch,
    }));
  };

  const openCompletion = () => {
    if (timer.elapsedSeconds === 0) return;
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
        sentence,
        sentencePage: sentence.trim() ? sentencePage : undefined,
      });
      timer.reset();
      setForm({
        bookId: currentBook.id,
        endPage,
        sentence: "",
        sentencePage: endPage,
      });
      setIsSentenceOpen(false);
      setIsCompletionOpen(false);
    } finally {
      setIsSaving(false);
    }
  };

  const closeCompletion = () => {
    setIsSentenceOpen(false);
    setIsCompletionOpen(false);
    if (timer.status === "completed") {
      timer.cancelCompletion();
    }
  };

  const continueReading = () => {
    vibrateTap();
    timerCompletionSound.prepare();
    setIsSentenceOpen(false);
    setIsCompletionOpen(false);
    timer.extendAndResume(extensionSeconds);
  };

  const resetCompletion = () => {
    vibrateWarning();
    timer.reset();
    setForm({
      bookId: currentBook.id,
      endPage: currentBook.currentPage,
      sentence: "",
      sentencePage: currentBook.currentPage,
    });
    setIsSentenceOpen(false);
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

  return (
    <div className="session-screen space-y-4">
      <section
        className={`session-focus-panel session-focus-panel-${pakMotion}`}
      >
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
                        value={endPage}
                        onChange={(event) =>
                          updateForm({
                            endPage: parsePageInput(event.target.value),
                          })
                        }
                      />
                      <span>PAGE</span>
                    </span>
                  </label>

                  <div className="session-completion-tools">
                    <button
                      type="button"
                    className="session-completion-sentence-button"
                    onClick={() => setIsSentenceOpen(true)}
                  >
                      {sentence.trim() ? "문장 수정" : "문장 남기기"}
                    </button>

                    {!isStopwatchMode && (
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
                    )}
                  </div>

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
              onStop={openCompletion}
            />
          </div>
        </div>

      </section>

      <div className={`session-book-pak-dock session-book-pak-dock-${pakMotion}`}>
        <div className="session-book-slot-rear" aria-hidden="true" />
        <section
          className="session-book-chip-panel"
          style={
            {
              "--pak-top": packPalette.top,
              "--pak-bottom": packPalette.bottom,
            } as CSSProperties
          }
        >
          <header className="session-book-chip-header">
            <span>INSERTED PAK</span>
            <button
              type="button"
              className="session-book-chip-swap"
              onClick={openBookPicker}
              disabled={pakMotion !== "idle"}
              aria-label="책 변경"
            >
              <Icon name="swap" className="h-3 w-3" />
              <span>EJECT</span>
            </button>
          </header>

          <div className="session-book-chip-body">
            <div className="session-book-chip-cover">
              {currentBook.thumbnail ? (
                <img src={currentBook.thumbnail} alt="" />
              ) : (
                <span className="session-book-chip-fallback">
                  <Icon name="book" className="h-5 w-5" />
                  <strong>{currentBook.title}</strong>
                </span>
              )}
            </div>

            <div className="session-book-chip-progress">
              <div className="session-book-chip-copy">
                <h2>{currentBook.title}</h2>
                <div className="session-book-chip-byline">
                  <small>{currentBook.author}</small>
                  {roundLabel && <span>{roundLabel}</span>}
                </div>
              </div>
              <div className="session-book-chip-progress-row">
                <strong>
                  {animatedBookProgress !== null
                    ? `${animatedBookProgress}%`
                    : "NEW"}
                </strong>
                <div className="session-book-chip-track">
                  <span
                    key={`${currentBook.id}-${pakInsertionSequence}`}
                    style={{ width: `${bookProgress ?? 0}%` }}
                  />
                </div>
              </div>
              <p>
                {currentBook.currentPage} / {currentBook.totalPages ?? "?"}{" "}
                PAGES
              </p>
            </div>
          </div>
        </section>
        <div className="session-book-slot-lip" aria-hidden="true">
          <span />
        </div>
      </div>

      <BottomSheetModal
        isOpen={isBookModalOpen}
        ariaLabel="책 변경"
        panelClassName="bookpick-sheet"
        onBackdropClick={closeBookPicker}
      >
        <div className="bookpick-header">
          <h2 className="bookpick-title">읽을 책 선택</h2>
          <button
            type="button"
            className="bookpick-close"
            onClick={closeBookPicker}
            aria-label="닫기"
          >
            <Icon name="close" className="h-5 w-5" />
          </button>
        </div>

        <div className="bookpick-list">
          {readingBooks.map((book) => {
            const isActive = book.id === currentBook.id;

            return (
              <BookPickerItem
                key={book.id}
                book={book}
                isActive={isActive}
                onSelect={() => {
                  vibrateSelect();
                  onChangeBook(book.id);
                  setIsBookModalOpen(false);
                  finishPakInsertion();
                  timer.reset();
                }}
              />
            );
          })}
        </div>
      </BottomSheetModal>

      <BottomSheetModal
        isOpen={isSentenceOpen && isCompletionVisible}
        ariaLabel="기억에 남는 문장"
        backdropClassName="modal-backdrop-top"
        panelClassName="completion-sentence-sheet"
        onBackdropClick={() => setIsSentenceOpen(false)}
      >
        <div className="completion-sheet-header">
          <div>
            <h2>기억에 남는 문장</h2>
            <p>{currentBook.title}</p>
          </div>
          <button
            type="button"
            className="completion-close-button"
            onClick={() => setIsSentenceOpen(false)}
            aria-label="닫기"
          >
            <Icon name="close" className="h-5 w-5" />
          </button>
        </div>

        <div className="completion-sentence-panel">
          <div className="completion-sentence-panel-header">
            <label className="completion-sentence-label" htmlFor="sentence">
              문장 기록
            </label>
            <label
              className="completion-sentence-page-field"
              htmlFor="sentence-page"
            >
              <span>페이지</span>
              <input
                id="sentence-page"
                type="text"
                inputMode="numeric"
                min={1}
                max={currentBook.totalPages ?? undefined}
                value={sentencePage}
                onChange={(event) =>
                  updateForm({
                    sentencePage: parsePageInput(event.target.value),
                  })
                }
              />
              <span>p</span>
            </label>
          </div>
          <SentenceOcrButton
            onRecognized={(text) =>
              updateForm({
                sentence: sentence.trim()
                  ? `${sentence.trim()}\n${text}`
                  : text,
              })
            }
            disabled={isSaving}
          />
          <textarea
            id="sentence"
            className="completion-sentence-textarea"
            placeholder="기억하고 싶은 문장을 남겨보세요."
            value={sentence}
            onChange={(event) => updateForm({ sentence: event.target.value })}
          />
        </div>

        <button
          type="button"
          className="completion-sentence-sheet-done"
          onClick={() => setIsSentenceOpen(false)}
        >
          문장 기록 완료
        </button>
      </BottomSheetModal>

    </div>
  );
};
