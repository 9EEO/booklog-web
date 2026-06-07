import {
  type CSSProperties,
  type MouseEvent as ReactMouseEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { AnimatePresence, motion } from "framer-motion";
import { BottomSheetModal } from "../components/BottomSheetModal";
import { Icon } from "../components/Icon";
import { MiniBook } from "../components/MiniBook";
import { PixelCard } from "../components/PixelCard";
import focusSprout from "../assets/focus-sprout.gif";
import focusSproutStill from "../assets/focus-sprout-still.png";
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
import { formatBookPages, getBookProgress } from "../utils/bookPages";

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
  { label: "5분", seconds: 5 * 60 },
  { label: "15분", seconds: 15 * 60 },
  { label: "30분", seconds: 30 * 60 },
  { label: "60분", seconds: 60 * 60 },
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
  const bookProgress = getBookProgress(currentBook.currentPage, currentBook.totalPages);
  const roundLabel =
    currentBook.activeRoundNumber && currentBook.activeRoundNumber > 1
      ? `${currentBook.activeRoundNumber}회독`
      : "";
  const isStopwatchMode = timer.mode === "stopwatch";
  const isReading = timer.status === "running";
  const readingActionLabel = timer.status === "paused" ? "다시 시작" : "시작";
  const targetMinutes = Math.round(timer.targetSeconds / 60);
  const displaySeconds = isStopwatchMode
    ? timer.elapsedSeconds
    : timer.remainingSeconds;
  const minimumTargetSeconds =
    timer.status === "paused"
      ? Math.min(Math.max(timer.elapsedSeconds, 5 * 60), 120 * 60)
      : 5 * 60;
  const canDecreaseTarget = timer.targetSeconds > minimumTargetSeconds;
  const canIncreaseTarget = targetMinutes < 120;
  const canDecreaseExtension = extensionSeconds > minimumExtensionSeconds;
  const canIncreaseExtension = extensionSeconds < maximumExtensionSeconds;
  const canChangeTimerMode = !isReading && timer.elapsedSeconds === 0;
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

  const handleTimerModeSwitchClick = (
    event: ReactMouseEvent<HTMLDivElement>,
  ) => {
    if (!canChangeTimerMode) return;

    const rect = event.currentTarget.getBoundingClientRect();
    const nextMode =
      event.clientX - rect.left < rect.width / 2 ? "countdown" : "stopwatch";

    changeTimerMode(nextMode);
  };

  return (
    <div className="session-screen space-y-4">
      <header className="session-reading-header">
        <div
          className={`session-timer-mode-grid ${isStopwatchMode ? "session-timer-mode-grid-stopwatch" : ""} ${!canChangeTimerMode ? "session-timer-mode-grid-disabled" : ""}`}
          role="tablist"
          aria-label="독서 시간 측정 방식"
          onClick={handleTimerModeSwitchClick}
        >
          <button
            type="button"
            className={`session-timer-mode-option ${!isStopwatchMode ? "session-timer-mode-option-active" : ""}`}
            onClick={(event) => {
              event.stopPropagation();
              changeTimerMode("countdown");
            }}
            disabled={!canChangeTimerMode}
            role="tab"
            aria-selected={!isStopwatchMode}
          >
            <Icon name="timer" className="h-4 w-4" />
            TIMER
          </button>
          <button
            type="button"
            className={`session-timer-mode-option ${isStopwatchMode ? "session-timer-mode-option-active" : ""}`}
            onClick={(event) => {
              event.stopPropagation();
              changeTimerMode("stopwatch");
            }}
            disabled={!canChangeTimerMode}
            role="tab"
            aria-selected={isStopwatchMode}
          >
            <Icon name="clock" className="h-4 w-4" />
            STOPWATCH
          </button>
        </div>
      </header>

      <section className="session-focus-panel">
        <div className="session-book-card">
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <div
                className="session-book-cover"
                style={{
                  backgroundColor: currentBook.coverColor,
                  borderColor: currentBook.accentColor,
                }}
              >
                {currentBook.thumbnail ? (
                  <img src={currentBook.thumbnail} alt="" />
                ) : (
                  <span style={{ backgroundColor: currentBook.accentColor }} />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center">
                  <p className="session-book-title truncate text-sm font-black">
                    {currentBook.title}
                  </p>
                </div>
                <p className="session-book-author mt-1 truncate text-xs font-bold">
                  {currentBook.author}
                  {roundLabel && (
                    <span className="session-book-round"> · {roundLabel}</span>
                  )}
                </p>
              </div>
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
            <div>
              {bookProgress !== null && (
                <div className="session-book-progress">
                  <span style={{ width: `${bookProgress}%` }} />
                </div>
              )}
              <p className="session-page-count mt-1 text-right text-[11px] font-black">
                {formatBookPages(currentBook.currentPage, currentBook.totalPages)}
              </p>
            </div>
          </div>
        </div>

        <div className="focus-timer-card">
          <div className="relative z-10">
            <div className="focus-ring-wrap">
              <div
                className={`focus-ring ${isStopwatchMode ? "focus-ring-stopwatch" : ""} ${isStopwatchMode && isReading ? "focus-ring-stopwatch-active" : ""}`}
                style={{ "--progress": `${timer.progress}%` } as CSSProperties}
              >
                <div className="focus-ring-inner">
                  <img
                    className="focus-character"
                    src={
                      timer.status === "running"
                        ? focusSprout
                        : focusSproutStill
                    }
                    alt=""
                  />
                  <div className="focus-time">
                    {formatFocusTime(displaySeconds)}
                  </div>
                </div>
              </div>
            </div>

            <div className="focus-controls grid grid-cols-[1fr_1fr_auto] gap-2">
              <button
                type="button"
                className="session-control-button primary-button"
                onClick={() => {
                  vibrateTap();
                  timerCompletionSound.prepare();
                  timer.start();
                }}
                disabled={isReading}
                aria-label={readingActionLabel}
              >
                <Icon name="play" className="h-7 w-7" />
              </button>
              <button
                type="button"
                className="session-control-button secondary-button"
                onClick={() => {
                  vibrateTap();
                  timer.pause();
                }}
                disabled={!isReading}
                aria-label="일시정지"
              >
                <Icon name="pause" className="h-7 w-7" />
              </button>
              <button
                type="button"
                className="session-control-button session-stop-button danger-button"
                onClick={openCompletion}
                disabled={timer.elapsedSeconds === 0}
                aria-label="독서 종료"
              >
                <Icon name="stop" className="h-7 w-7" />
              </button>
            </div>
          </div>
        </div>
      </section>

      {!isStopwatchMode && (
        <div className="session-time-controls">
          <div className="target-stepper session-target-stepper">
            <button
              type="button"
              className="target-step-button"
              onClick={() => {
                vibrateTap();
                timer.adjustTarget(-5 * 60);
              }}
              disabled={isReading || !canDecreaseTarget}
              aria-label="목표 시간 5분 줄이기"
            >
              <Icon name="minus" className="h-5 w-5" />
            </button>
            <div className="target-step-value" aria-live="polite">
              <span>TARGET</span>
              <strong>{targetMinutes}분</strong>
            </div>
            <button
              type="button"
              className="target-step-button"
              onClick={() => {
                vibrateTap();
                timer.adjustTarget(5 * 60);
              }}
              disabled={isReading || !canIncreaseTarget}
              aria-label="목표 시간 5분 늘리기"
            >
              <Icon name="plus" className="h-5 w-5" />
            </button>
          </div>

          <div className="session-preset-grid">
            {presets.map((preset) => (
              <button
                key={preset.seconds}
                type="button"
                className={`preset-button ${timer.targetSeconds === preset.seconds ? "preset-button-active" : ""}`}
                onClick={() => {
                  vibrateSelect();
                  timer.setPreset(preset.seconds);
                }}
                disabled={isReading}
              >
                {preset.label}
              </button>
            ))}
          </div>
        </div>
      )}

      <BottomSheetModal
        isOpen={isBookModalOpen}
        ariaLabel="책 변경"
        onBackdropClick={() => setIsBookModalOpen(false)}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xl font-black">읽을 책 선택</h2>
          <button
            type="button"
            className="icon-button"
            onClick={() => setIsBookModalOpen(false)}
            aria-label="닫기"
          >
            <Icon name="close" className="h-5 w-5" />
          </button>
        </div>
        <div className="space-y-2">
          {readingBooks.map((book) => (
            <button
              key={book.id}
              type="button"
              className="w-full border-2 border-[#2F2A26] bg-[#FCFBF7] p-3 shadow-pixel transition-transform active:translate-x-1 active:translate-y-1 active:shadow-none"
              onClick={() => {
                vibrateSelect();
                onChangeBook(book.id);
                setIsBookModalOpen(false);
                timer.reset();
              }}
            >
              <MiniBook book={book} />
            </button>
          ))}
        </div>
      </BottomSheetModal>

      <BottomSheetModal isOpen={isCompletionVisible} ariaLabel="독서 완료">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xl font-black">
            {isStopwatchMode ? "독서 기록" : "독서 완료"}
          </h2>
          <button
            type="button"
            className="icon-button"
            onClick={closeCompletion}
            aria-label="닫기"
          >
            <Icon name="close" className="h-5 w-5" />
          </button>
        </div>

        <div className="mb-4 grid grid-cols-2 gap-2">
          <div className="completion-summary-card bg-[#2F2A26] text-[#FFFDF8]">
            <span>독서 시간</span>
            <strong>{formatDuration(timer.elapsedSeconds)}</strong>
          </div>
          <div className="completion-summary-card bg-[#FCFBF7] text-[#2F2A26]">
            <span>읽은 페이지</span>
            <strong>{pagesRead}p</strong>
          </div>
        </div>

        <div
          className={`mb-4 border-2 border-[#2F2A26] p-3 ${willMeetDailyGoal ? "bg-[#DCE3D2]" : "bg-[#F3E8D0]"}`}
        >
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-black text-stone-600">오늘 목표</p>
              <p className="mt-1 text-sm font-black">
                {formatDuration(completionTotalSeconds)} /{" "}
                {formatDuration(dailyGoalSeconds)}
              </p>
            </div>
            <span className="border-2 border-[#2F2A26] bg-[#FCFBF7] px-2 py-1 text-xs font-black text-[#5F6D57]">
              {willMeetDailyGoal ? "달성" : "진행중"}
            </span>
          </div>
        </div>

        <label className="field-label" htmlFor="end-page">
          현재 페이지
        </label>
        <input
          ref={endPageInputRef}
          id="end-page"
          className="pixel-input"
          type="text"
          inputMode="numeric"
          min={currentBook.currentPage}
          max={currentBook.totalPages ?? undefined}
          value={endPage}
          onChange={(event) =>
            updateForm({ endPage: parsePageInput(event.target.value) })
          }
        />

        <button
          type="button"
          className={`optional-sentence-toggle mt-4 ${isSentenceOpen ? "optional-sentence-toggle-active" : ""}`}
          onClick={() => setIsSentenceOpen((current) => !current)}
        >
          <Icon name="quote" className="h-4 w-4" />
          {isSentenceOpen ? "문장 기록 닫기" : "기억에 남는 문장 남기기"}
        </button>

        <AnimatePresence initial={false}>
          {isSentenceOpen && (
            <motion.div
              className="mt-3 overflow-hidden border-2 border-[#2F2A26] bg-[#FCFBF7]"
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.18, ease: "easeOut" }}
            >
              <div className="flex items-center justify-between gap-3 border-b-2 border-[#2F2A26] bg-[#F3E8D0] px-3 py-2">
                <label
                  className="text-xs font-black text-[#2F2A26]"
                  htmlFor="sentence"
                >
                  선택 기록
                </label>
                <label
                  className="flex shrink-0 items-center gap-1 text-xs font-black text-[#2F2A26]"
                  htmlFor="sentence-page"
                >
                  <span>페이지</span>
                  <input
                    id="sentence-page"
                    className="w-16 border-2 border-[#2F2A26] bg-[#FCFBF7] px-2 py-1 text-right font-black text-stone-900 outline-none focus:bg-[#FCFBF7]"
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
              <textarea
                id="sentence"
                className="min-h-28 w-full resize-none bg-[#FCFBF7] p-3 text-sm font-bold leading-relaxed text-stone-900 outline-none focus:bg-[#FCFBF7]"
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
          <div className="mt-4 border-2 border-[#2F2A26] bg-[#FCFBF7] p-3">
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
            className="secondary-button"
            onClick={continueReading}
          >
            <Icon name="play" className="h-5 w-5" />
            {isStopwatchMode ? "이어서 측정" : "이어서 독서"}
          </button>
          <button
            type="button"
            className="primary-button"
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
          className="danger-button mt-2 w-full"
          onClick={resetCompletion}
          disabled={isSaving}
        >
          <Icon name="trash" className="h-5 w-5" />
          기록하지 않고 초기화
        </button>
      </BottomSheetModal>
    </div>
  );
};
