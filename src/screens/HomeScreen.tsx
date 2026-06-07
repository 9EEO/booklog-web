import { DigitalTimer } from "../components/DigitalTimer";
import { Icon } from "../components/Icon";
import { MiniBook } from "../components/MiniBook";
import type { Book, ReadingRecord } from "../types/reading";
import { getBookProgress } from "../utils/bookPages";
import { formatDuration } from "../utils/formatDuration";

type HomeScreenProps = {
  books: Book[];
  records: ReadingRecord[];
  currentBook: Book | null;
  dailyGoalSeconds: number;
  weeklyGoalDays: number;
  onStart: () => void;
  onAddFirstBook: () => void;
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

const parseDateLabel = (dateLabel: string) => {
  const [year, month, day] = dateLabel.split(".").map(Number);

  return new Date(year, month - 1, day);
};

const isSameDateLabel = (dateLabel: string, targetLabel: string) =>
  dateLabel === targetLabel;

const isThisWeek = (dateLabel: string) => {
  const target = parseDateLabel(dateLabel);
  const today = new Date();
  const startOfWeek = new Date(today);
  const day = today.getDay();
  const mondayOffset = day === 0 ? -6 : 1 - day;

  startOfWeek.setDate(today.getDate() + mondayOffset);
  startOfWeek.setHours(0, 0, 0, 0);

  const endOfWeek = new Date(startOfWeek);
  endOfWeek.setDate(startOfWeek.getDate() + 7);

  return target >= startOfWeek && target < endOfWeek;
};

const isThisMonth = (dateLabel: string) => {
  const target = parseDateLabel(dateLabel);
  const today = new Date();

  return (
    target.getFullYear() === today.getFullYear() &&
    target.getMonth() === today.getMonth()
  );
};

const addDays = (date: Date, days: number) => {
  const next = new Date(date);

  next.setDate(date.getDate() + days);

  return next;
};

const getReadingStreakDays = (dateLabels: Set<string>) => {
  let cursor = new Date();
  let streak = 0;

  while (dateLabels.has(formatDateLabel(cursor))) {
    streak += 1;
    cursor = addDays(cursor, -1);
  }

  return streak;
};

const formatDateLabel = (date: Date) =>
  new Intl.DateTimeFormat("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  })
    .format(date)
    .replace(/\.\s?/g, ".")
    .replace(/\.$/, "");

const formatShortDuration = (seconds: number) => {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);

  if (hours === 0) return `${minutes}분`;
  if (minutes === 0) return `${hours}시간`;

  return `${hours}시간 ${minutes}분`;
};

export const HomeScreen = ({
  books,
  records,
  currentBook,
  dailyGoalSeconds,
  weeklyGoalDays,
  onStart,
  onAddFirstBook,
}: HomeScreenProps) => {
  const today = todayLabel();
  const todaySeconds = records
    .filter((record) => isSameDateLabel(record.date, today))
    .reduce((sum, record) => sum + record.durationSeconds, 0);
  const weekSeconds = records
    .filter((record) => isThisWeek(record.date))
    .reduce((sum, record) => sum + record.durationSeconds, 0);
  const weeklyReadingDays = new Set(
    records
      .filter((record) => isThisWeek(record.date))
      .map((record) => record.date),
  ).size;
  const readingDateLabels = new Set(records.map((record) => record.date));
  const readingStreakDays = getReadingStreakDays(readingDateLabels);
  const monthlyReadingDays = new Set(
    records
      .filter((record) => isThisMonth(record.date))
      .map((record) => record.date),
  ).size;
  const monthSeconds = records
    .filter((record) => isThisMonth(record.date))
    .reduce((sum, record) => sum + record.durationSeconds, 0);
  const completedBooks = books.filter(
    (book) =>
      book.status === "completed" ||
      Boolean(book.rounds?.some((round) => round.status === "completed")),
  ).length;
  const currentProgress = currentBook
    ? getBookProgress(currentBook.currentPage, currentBook.totalPages)
    : null;
  const currentRoundLabel =
    currentBook?.activeRoundNumber && currentBook.activeRoundNumber > 1
      ? `${currentBook.activeRoundNumber}회독`
      : "";
  const dailyGoalProgress = Math.min(
    Math.round((todaySeconds / dailyGoalSeconds) * 100),
    100,
  );
  const remainingDailyGoalSeconds = Math.max(
    dailyGoalSeconds - todaySeconds,
    0,
  );
  const weeklyGoalFilledDays = Math.min(weeklyReadingDays, weeklyGoalDays);
  const totalReadingSeconds = books.reduce(
    (sum, book) => sum + book.accumulatedSeconds,
    0,
  );
  const recentSentence = books
    .flatMap((book) =>
      book.sentences.map((sentence) => ({
        ...sentence,
        bookTitle: book.title,
      })),
    )
    .sort((a, b) => b.recordedAt.localeCompare(a.recordedAt))[0];

  if (books.length === 0) {
    return (
      <div className="home-empty-screen">
        <header className="home-empty-header">
          <h1>읽을 책을 등록해 주세요</h1>
          <p>책을 등록하면 독서 타이머를 시작할 수 있습니다.</p>
        </header>

        <div className="home-empty-action">
          <button
            type="button"
            className="home-empty-add-button"
            onClick={onAddFirstBook}
          >
            <Icon name="plus" className="h-5 w-5" />
            첫 책 등록하기
          </button>

          <p className="home-empty-search-hint">
            제목이나 저자로 검색해 빠르게 등록할 수 있어요.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="home-dashboard">
      {currentBook && (
        <section className="home-current-panel">
          <div className="home-current-heading">
            <div>
              <p>NOW READING</p>
              <h1>오늘도 이어서 읽어요</h1>
            </div>
            <span>
              {currentRoundLabel ? `${currentRoundLabel} · ` : ""}
              {currentProgress !== null ? `${currentProgress}%` : `${currentBook.currentPage}p`}
            </span>
          </div>

          <div className="home-current-book">
            <MiniBook book={currentBook} />
          </div>

          {currentProgress !== null && (
            <div className="home-current-progress" aria-label={`책 진행률 ${currentProgress}%`}>
              <span style={{ width: `${currentProgress}%` }} />
            </div>
          )}

          <button type="button" className="home-start-button" onClick={onStart}>
            <Icon name="play" className="h-5 w-5" />
            독서 시작
          </button>
        </section>
      )}

      <section className="home-summary-panel">
        <header className="home-section-heading">
          <div>
            <p>READING FLOW</p>
            <h2>독서 흐름</h2>
          </div>
          <Icon name="records" className="h-5 w-5" />
        </header>

        <div className="home-summary-stats">
          <div><span>오늘</span><strong>{formatShortDuration(todaySeconds)}</strong></div>
          <div><span>이번 주</span><strong>{formatShortDuration(weekSeconds)}</strong></div>
          <div><span>연속 독서</span><strong>{readingStreakDays}일</strong></div>
          <div><span>이번 달</span><strong>{monthlyReadingDays}일</strong></div>
        </div>

        <div className="home-goal-row">
          <div className="home-goal-copy">
            <span>오늘 목표</span>
            <strong>{dailyGoalProgress}%</strong>
          </div>
          <div className="home-goal-progress">
            <span style={{ width: `${dailyGoalProgress}%` }} />
          </div>
          <p>
            {remainingDailyGoalSeconds === 0
              ? "오늘 목표 달성"
              : `${formatShortDuration(remainingDailyGoalSeconds)} 남음`}
          </p>
        </div>

        <div className="home-weekly-row">
          <div className="home-goal-copy">
            <span>주간 루틴</span>
            <strong>{weeklyReadingDays}/{weeklyGoalDays}일</strong>
          </div>
          <div
            className="home-weekly-track"
            style={{
              gridTemplateColumns: `repeat(${weeklyGoalDays}, minmax(0, 1fr))`,
            }}
          >
            {Array.from({ length: weeklyGoalDays }, (_, index) => (
              <span
                key={index}
                className={index < weeklyGoalFilledDays ? "home-weekly-day-active" : ""}
                aria-hidden="true"
              />
            ))}
          </div>
        </div>

        <footer className="home-summary-footer">
          <span>누적 {formatDuration(totalReadingSeconds)}</span>
          <span>완독 {completedBooks}권</span>
          <span>이번 달 {formatShortDuration(monthSeconds)}</span>
        </footer>
      </section>

      <section className="home-highlight-panel">
        {recentSentence ? (
          <>
            <div className="home-highlight-label">
              <Icon name="quote" className="h-4 w-4" />
              <p>최근 문장</p>
            </div>
            <blockquote>
              “{recentSentence.text}”
            </blockquote>
            <p className="home-highlight-source">
              {recentSentence.bookTitle} · p.{recentSentence.page}
            </p>
          </>
        ) : (
          <div className="home-today-time">
            <p>오늘 독서 시간</p>
            <DigitalTimer seconds={todaySeconds} />
          </div>
        )}
      </section>
    </div>
  );
};
