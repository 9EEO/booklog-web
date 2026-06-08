import { BookCarousel } from "../components/BookCarousel";
import { Icon } from "../components/Icon";
import { MiniBook } from "../components/MiniBook";
import type { Book, ReadingRecord } from "../types/reading";
import { getBookProgress } from "../utils/bookPages";

type HomeScreenProps = {
  books: Book[];
  records: ReadingRecord[];
  currentBook: Book | null;
  dailyGoalSeconds: number;
  weeklyGoalDays: number;
  onStart: () => void;
  onSelectBook: (bookId: string) => void;
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

const isSameDateLabel = (dateLabel: string, targetLabel: string) =>
  dateLabel === targetLabel;

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
  onStart,
  onSelectBook,
  onAddFirstBook,
}: HomeScreenProps) => {
  const today = todayLabel();
  const readingBooks = books.filter((book) => book.status === "reading");
  const activeReadingBook =
    readingBooks.find((book) => book.id === currentBook?.id) ??
    readingBooks[0] ??
    currentBook;
  const todaySeconds = records
    .filter((record) => isSameDateLabel(record.date, today))
    .reduce((sum, record) => sum + record.durationSeconds, 0);
  const currentProgress = currentBook
    ? getBookProgress(currentBook.currentPage, currentBook.totalPages)
    : null;
  const currentRoundLabel =
    currentBook?.activeRoundNumber && currentBook.activeRoundNumber > 1
      ? `${currentBook.activeRoundNumber}회독`
      : "";
  const currentRemainingPages = currentBook
    ? Math.max(
        (currentBook.totalPages ?? currentBook.currentPage) -
          currentBook.currentPage,
        0,
      )
    : 0;
  const dailyGoalProgress = Math.min(
    Math.round((todaySeconds / dailyGoalSeconds) * 100),
    100,
  );
  const remainingDailyGoalSeconds = Math.max(
    dailyGoalSeconds - todaySeconds,
    0,
  );
  const openBook = (bookId: string) => {
    onSelectBook(bookId);
    onStart();
  };

  if (books.length === 0) {
    return (
      <div className="home-empty-screen">
        <header className="home-empty-header">
          <h1>어떤 책과 함께 시작해 볼까요?</h1>
          <p>읽고 싶은 책을 더하고, 나만의 편안한 독서 시간을 만들어보세요.</p>
        </header>

        <div className="home-empty-action">
          <button
            type="button"
            className="home-empty-add-button"
            onClick={onAddFirstBook}
          >
            시작하기
          </button>

          <p className="home-empty-search-hint">
            책 제목이나 작가 이름으로 쉽게 찾을 수 있어요.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="home-dashboard">
      {readingBooks.length > 1 && activeReadingBook ? (
        <BookCarousel
          books={readingBooks}
          activeBookId={activeReadingBook.id}
          onSelectBook={onSelectBook}
          onOpenBook={openBook}
        />
      ) : (
        currentBook && (
          <section className="home-current-panel">
            <div className="home-current-heading">
              <div>
                <h1>오늘도 한 장 넘겨볼까요?</h1>
              </div>
              <span>
                {currentRoundLabel ? `${currentRoundLabel} · ` : ""}
                {currentRemainingPages === 0
                  ? "완독 가까이"
                  : `완독까지 ${currentRemainingPages}P`}
              </span>
            </div>

            <div className="home-current-book">
              <MiniBook book={currentBook} />
            </div>

            {currentProgress !== null && (
              <div
                className="home-current-progress"
                aria-label={`책 진행률 ${currentProgress}%`}
              >
                <span style={{ width: `${currentProgress}%` }} />
              </div>
            )}

            <button
              type="button"
              className="home-start-button"
              onClick={() => openBook(currentBook.id)}
            >
              <Icon name="play" className="h-5 w-5" />책 펼치기
            </button>
          </section>
        )
      )}

      <section className="home-today-panel">
        <header className="home-today-heading">
          <div>
            <p>TODAY</p>
            <h2>오늘 책과 함께한 시간</h2>
          </div>
          <strong>{formatShortDuration(todaySeconds)}</strong>
        </header>

        <div className="home-goal-row">
          <div className="home-goal-copy">
            <span>
              {remainingDailyGoalSeconds === 0
                ? "오늘도 잘하고 있어요"
                : "가벼운 마음으로 시작해 보세요"}
            </span>
            <strong>{dailyGoalProgress}%</strong>
          </div>
          <div className="home-goal-progress">
            <span style={{ width: `${dailyGoalProgress}%` }} />
          </div>
          <p>
            {remainingDailyGoalSeconds === 0
              ? "오늘의 독서가 충분히 쌓였어요"
              : todaySeconds === 0
                ? "하루 10분만 함께해도 충분해요"
                : `${formatShortDuration(remainingDailyGoalSeconds)}만 더 함께하면 목표에 가까워져요`}
          </p>
        </div>
      </section>
    </div>
  );
};
