import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { AdventureScene } from "../components/adventure/AdventureScene";
import { BottomSheetModal } from "../components/BottomSheetModal";
import { Icon } from "../components/Icon";
import { PixelCard } from "../components/PixelCard";
import { SentenceOcrButton } from "../components/SentenceOcrButton";
import { useBackNavigationLayer } from "../hooks/useBackNavigationLayer";
import type { ReadingTimer } from "../hooks/useReadingTimer";
import { useTimerCompletionSound } from "../hooks/useTimerCompletionSound";
import type {
  Book,
  ReadingCompletionInput,
  ReadingRecord,
} from "../types/reading";
import { formatDuration } from "../utils/formatDuration";
import {
  vibrateSelect,
  vibrateSuccess,
  vibrateTap,
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

const presets = [
  { label: "10초", seconds: 10 },
  { label: "5 MIN", seconds: 5 * 60 },
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

const formatReadableDuration = (seconds: number) => {
  if (seconds < 60) return `${seconds}초`;

  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}분`;

  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;

  return remainingMinutes > 0
    ? `${hours}시간 ${remainingMinutes}분`
    : `${hours}시간`;
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
  const [extensionSeconds, setExtensionSeconds] = useState(
    minimumExtensionSeconds,
  );
  const endPageInputRef = useRef<HTMLInputElement | null>(null);
  const [form, setForm] = useState({
    bookId: currentBook?.id ?? "",
    endPage: currentBook?.currentPage ?? 1,
    sentence: "",
    sentencePage: currentBook?.currentPage ?? 1,
  });
  const timerCompletionSound = useTimerCompletionSound(timer.status);

  useBackNavigationLayer(
    isBookModalOpen,
    () => setIsBookModalOpen(false),
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

  const readingBooks = useMemo(
    () => books.filter((book) => book.status !== "completed"),
    [books],
  );
  const isCompletionVisible =
    isCompletionOpen ||
    (timer.status === "completed" && timer.elapsedSeconds > 0);

  useEffect(() => {
    if (!currentBook || !isCompletionVisible) return;

    vibrateSuccess();
  }, [currentBook, isCompletionVisible]);

  useEffect(() => {
    if (!isCompletionVisible) return;

    const focusTimer = window.setTimeout(() => {
      endPageInputRef.current?.focus();
      endPageInputRef.current?.select();
    }, 220);

    return () => window.clearTimeout(focusTimer);
  }, [isCompletionVisible]);

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
  const bookProgress = getBookProgress(
    currentBook.currentPage,
    currentBook.totalPages,
  );
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
  const todaySeconds = records
    .filter((record) => record.date === todayLabel())
    .reduce((sum, record) => sum + record.durationSeconds, 0);
  const completionTotalSeconds = todaySeconds + timer.elapsedSeconds;
  const willMeetDailyGoal = completionTotalSeconds >= dailyGoalSeconds;
  const pagesRead = Math.max(endPage - currentBook.currentPage, 0);

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
    vibrateWarning();
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

    vibrateSelect();
    timer.setMode(mode);
  };

  return (
    <div className="session-screen space-y-4">
      <section className="session-focus-panel">
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
              onChangeMode={changeTimerMode}
              onSelectPreset={(seconds) => {
                vibrateSelect();
                timer.setPreset(seconds);
              }}
              onStart={() => {
                vibrateTap();
                timerCompletionSound.prepare();
                timer.start();
              }}
              onPause={() => {
                vibrateTap();
                timer.pause();
              }}
              onStop={openCompletion}
            />
          </div>
        </div>

        <div className="console-body" aria-hidden="true">
          <span className="console-led" />
          <span className="console-brand">ADVENTURE</span>
          <span className="console-grille" />
          <span className="console-slot" />
        </div>

        <div className="cartridge-deck">
          <div className="session-book-card cartridge">
            <div className="cartridge-inner">
              <div className="cartridge-contacts" aria-hidden="true" />
              <div className="cartridge-header">
                <span className="cartridge-tag">INSERTED PAK</span>
                <button
                  type="button"
                  className="session-book-swap"
                  onClick={() => {
                    vibrateTap();
                    setIsBookModalOpen(true);
                  }}
                  aria-label="책 변경"
                >
                  <Icon name="swap" className="h-4 w-4" />
                </button>
              </div>

              <div className="cartridge-body">
                <div className="session-book-cover cartridge-label">
                  {currentBook.thumbnail ? (
                    <img src={currentBook.thumbnail} alt="" />
                  ) : (
                    <span aria-hidden="true" />
                  )}
                </div>

                <div className="cartridge-info">
                  <p className="cartridge-title truncate">
                    {currentBook.title}
                  </p>
                  <p className="cartridge-author truncate">
                    {currentBook.author}
                    {roundLabel && (
                      <span className="cartridge-round"> · {roundLabel}</span>
                    )}
                  </p>

                  <div className="cartridge-progress">
                    <div className="cartridge-progress-head">
                      <span>PROGRESS</span>
                      <strong>
                        {bookProgress !== null
                          ? `${Math.round(bookProgress)}%`
                          : "—"}
                      </strong>
                    </div>
                    {bookProgress !== null && (
                      <div className="session-book-progress cartridge-bar">
                        <span style={{ width: `${bookProgress}%` }} />
                      </div>
                    )}
                    <p className="cartridge-pages">
                      {currentBook.currentPage} /{" "}
                      {currentBook.totalPages ?? "?"} PAGES
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <BottomSheetModal
        isOpen={isBookModalOpen}
        ariaLabel="책 변경"
        panelClassName="bookpick-sheet"
        onBackdropClick={() => setIsBookModalOpen(false)}
      >
        <div className="bookpick-header">
          <div className="bookpick-heading">
            <span className="bookpick-kicker">
              <i className="cartridge-blink" aria-hidden="true" />
              SELECT ADVENTURE
            </span>
            <h2 className="bookpick-title">읽을 책 선택</h2>
          </div>
          <button
            type="button"
            className="bookpick-close"
            onClick={() => setIsBookModalOpen(false)}
            aria-label="닫기"
          >
            <Icon name="close" className="h-5 w-5" />
          </button>
        </div>

        <div className="bookpick-list">
          {readingBooks.map((book) => {
            const progress = getBookProgress(book.currentPage, book.totalPages);
            const isActive = book.id === currentBook.id;
            const bookRound =
              book.activeRoundNumber && book.activeRoundNumber > 1
                ? `${book.activeRoundNumber}회독`
                : "";

            return (
              <button
                key={book.id}
                type="button"
                className={`bookpick-item ${isActive ? "bookpick-item-active" : ""}`}
                onClick={() => {
                  vibrateSelect();
                  onChangeBook(book.id);
                  setIsBookModalOpen(false);
                  timer.reset();
                }}
              >
                <span className="bookpick-cursor" aria-hidden="true">
                  <Icon name="chevronRight" />
                </span>
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
                    {bookRound && (
                      <span className="bookpick-round"> · {bookRound}</span>
                    )}
                  </span>
                  <span className="bookpick-progress">
                    <span className="bookpick-bar">
                      <span style={{ width: `${progress ?? 0}%` }} />
                    </span>
                    <span className="bookpick-percent">
                      {progress !== null ? `${progress}%` : "NEW"}
                    </span>
                  </span>
                </span>
                {isActive && <span className="bookpick-flag">PLAYING</span>}
              </button>
            );
          })}
        </div>
      </BottomSheetModal>

      <BottomSheetModal
        isOpen={isCompletionVisible}
        ariaLabel="독서 완료"
        panelClassName="completion-sheet"
      >
        <div className="completion-sheet-header">
          <div>
            <h2>{isStopwatchMode ? "독서 기록" : "독서 완료"}</h2>
            <p>{currentBook.title}</p>
          </div>
          <button
            type="button"
            className="completion-close-button"
            onClick={closeCompletion}
            aria-label="닫기"
          >
            <Icon name="close" className="h-5 w-5" />
          </button>
        </div>

        <div className="completion-sheet-body">
          <div className="completion-summary-list">
            <div className="completion-summary-card">
              <span>독서 시간</span>
              <strong>{formatDuration(timer.elapsedSeconds)}</strong>
            </div>
            <div className="completion-summary-card">
              <span>읽은 페이지</span>
              <strong>{pagesRead}p</strong>
            </div>
          </div>

          <div
            className={`completion-goal-card ${willMeetDailyGoal ? "completion-goal-card-complete" : ""}`}
          >
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-black text-stone-600">오늘 목표</p>
                <p className="mt-1 text-sm font-black">
                  {formatReadableDuration(completionTotalSeconds)} /{" "}
                  {formatReadableDuration(dailyGoalSeconds)}
                </p>
              </div>
              <span>{willMeetDailyGoal ? "달성" : "진행중"}</span>
            </div>
          </div>

          <label className="completion-page-field" htmlFor="end-page">
            <span>현재 페이지</span>
            <input
              ref={endPageInputRef}
              id="end-page"
              type="text"
              inputMode="numeric"
              min={currentBook.currentPage}
              max={currentBook.totalPages ?? undefined}
              value={endPage}
              onChange={(event) =>
                updateForm({ endPage: parsePageInput(event.target.value) })
              }
            />
          </label>

          <button
            type="button"
            className={`optional-sentence-toggle ${isSentenceOpen ? "optional-sentence-toggle-active" : ""}`}
            onClick={() => setIsSentenceOpen((current) => !current)}
          >
            {isSentenceOpen ? "문장 기록 닫기" : "기억에 남는 문장 남기기"}
          </button>

          <AnimatePresence initial={false}>
            {isSentenceOpen && (
              <motion.div
                className="completion-sentence-panel"
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.18, ease: "easeOut" }}
              >
                <div className="completion-sentence-panel-header">
                  <label
                    className="completion-sentence-label"
                    htmlFor="sentence"
                  >
                    선택 기록
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
                  onChange={(event) =>
                    updateForm({ sentence: event.target.value })
                  }
                />
              </motion.div>
            )}
          </AnimatePresence>

          {!isStopwatchMode && (
            <div className="completion-extension-panel">
              <div className="mb-2 flex items-center justify-between gap-3">
                <p className="text-xs font-black text-stone-600">추가 독서</p>
                <p className="text-sm font-black text-[#5F6D57]">
                  +{Math.round(extensionSeconds / 60)}분
                </p>
              </div>
              <div className="target-stepper">
                <button
                  type="button"
                  className="target-step-button"
                  onClick={() => adjustExtension(-extensionStepSeconds)}
                  disabled={!canDecreaseExtension}
                  aria-label="추가 독서 5분 줄이기"
                >
                  <Icon name="minus" className="h-5 w-5" />
                </button>
                <div className="target-step-value" aria-live="polite">
                  <span>연장</span>
                  <strong>{Math.round(extensionSeconds / 60)}분</strong>
                </div>
                <button
                  type="button"
                  className="target-step-button"
                  onClick={() => adjustExtension(extensionStepSeconds)}
                  disabled={!canIncreaseExtension}
                  aria-label="추가 독서 5분 늘리기"
                >
                  <Icon name="plus" className="h-5 w-5" />
                </button>
              </div>
            </div>
          )}

          <div className="mt-3 grid grid-cols-2 gap-2">
            <button
              type="button"
              className="completion-secondary-action secondary-button"
              onClick={continueReading}
            >
              <Icon name="play" className="h-5 w-5" />
              {isStopwatchMode ? "이어서 측정" : "이어서 독서"}
            </button>
            <button
              type="button"
              className="completion-save-action primary-button"
              onClick={() => {
                vibrateSelect();
                void saveCompletion();
              }}
              disabled={isSaving}
            >
              <Icon name="save" className="h-5 w-5" />
              {isSaving ? "저장 중" : "저장"}
            </button>
          </div>

          <button
            type="button"
            className="completion-reset-link"
            onClick={resetCompletion}
            disabled={isSaving}
          >
            기록하지 않고 닫기
          </button>
        </div>
      </BottomSheetModal>
    </div>
  );
};
