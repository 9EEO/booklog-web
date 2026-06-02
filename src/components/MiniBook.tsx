import type { Book } from '../types/reading'

type MiniBookProps = {
  book: Book
  compact?: boolean
}

export const MiniBook = ({ book, compact = false }: MiniBookProps) => {
  const progress = Math.round((book.currentPage / book.totalPages) * 100)
  const roundLabel = book.activeRoundNumber && book.activeRoundNumber > 1 ? `${book.activeRoundNumber}회독 · ` : ''

  return (
    <div className={`flex items-center gap-3 ${compact ? '' : 'min-w-0'}`}>
      <div
        className="book-cover shrink-0"
        style={{ backgroundColor: book.coverColor, borderColor: book.accentColor }}
      >
        {book.thumbnail ? (
          <img className="book-cover-image" src={book.thumbnail} alt="" />
        ) : (
          <span style={{ backgroundColor: book.accentColor }} />
        )}
      </div>
      <div className="min-w-0 text-left">
        <p className="truncate text-sm font-black text-stone-900">{book.title}</p>
        <p className="truncate text-xs font-bold text-stone-600">{book.author}</p>
        {!compact && (
          <p className="mt-1 text-[11px] font-black text-[#5F6D57]">
            {roundLabel}{book.currentPage}/{book.totalPages}p · {progress}%
          </p>
        )}
      </div>
    </div>
  )
}
