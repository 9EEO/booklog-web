import { Icon } from "./Icon";
import { MiniBook } from "./MiniBook";
import { SwipeableView } from "./SwipeableView";
import type { Book } from "../types/reading";
import { getBookProgress } from "../utils/bookPages";

type BookCarouselProps = {
  books: Book[];
  activeBookId: string;
  onSelectBook: (bookId: string) => void;
  onOpenBook: (bookId: string) => void;
};

const getBookStatusLabel = (book: Book) => {
  const roundLabel =
    book.activeRoundNumber && book.activeRoundNumber > 1
      ? `${book.activeRoundNumber}회독 · `
      : "";
  const remainingPages = Math.max(
    (book.totalPages ?? book.currentPage) - book.currentPage,
    0,
  );

  return `${roundLabel}${
    remainingPages === 0 ? "완독 가까이" : `완독까지 ${remainingPages}P`
  }`;
};

export const BookCarousel = ({
  books,
  activeBookId,
  onSelectBook,
  onOpenBook,
}: BookCarouselProps) => {
  const activeIndex = Math.max(
    books.findIndex((book) => book.id === activeBookId),
    0,
  );
  const activeBook = books[activeIndex] ?? books[0];
  const activeProgress = activeBook
    ? getBookProgress(activeBook.currentPage, activeBook.totalPages)
    : null;

  if (!activeBook) return null;

  const moveToIndex = (index: number) => {
    const nextBook = books[index];
    if (!nextBook) return;

    onSelectBook(nextBook.id);
  };

  return (
    <section
      className="home-book-carousel"
      aria-roledescription="carousel"
      aria-label="독서중인 책"
    >
      <div className="home-current-heading">
        <div>
          <h1>오늘도 한 장 넘겨볼까요?</h1>
        </div>
      </div>

      <SwipeableView
        key={activeBook.id}
        options={books.map((book) => ({ value: book.id }))}
        value={activeBook.id}
        onChange={onSelectBook}
        className="home-book-carousel-view"
        ariaLabel="독서중인 책 캐러셀"
      >
        <article
          className="home-book-carousel-slide"
          aria-label={`${activeIndex + 1}번째 책, ${activeBook.title}`}
        >
          <div className="home-current-book">
            <MiniBook book={activeBook} />
          </div>

          <div className="home-carousel-meta">
            <span>{getBookStatusLabel(activeBook)}</span>
            {activeProgress !== null && <strong>{activeProgress}%</strong>}
          </div>

          {activeProgress !== null && (
            <div
              className="home-current-progress"
              aria-label={`책 진행률 ${activeProgress}%`}
            >
              <span style={{ width: `${activeProgress}%` }} />
            </div>
          )}
        </article>
      </SwipeableView>

      <div className="home-carousel-controls" data-swipe-ignore="true">
        <div className="home-carousel-dots" aria-label="책 선택">
          {books.map((book, index) => (
            <button
              key={book.id}
              type="button"
              className={`home-carousel-dot ${
                index === activeIndex ? "home-carousel-dot-active" : ""
              }`}
              onClick={() => moveToIndex(index)}
              aria-label={`${index + 1}번째 책 보기`}
              aria-current={index === activeIndex}
            />
          ))}
        </div>
      </div>

      <button
        type="button"
        className="home-start-button home-carousel-start-button"
        onClick={() => onOpenBook(activeBook.id)}
      >
        <Icon name="play" className="h-5 w-5" />책 펼치기
      </button>
    </section>
  );
};
