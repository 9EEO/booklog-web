import { useEffect, useMemo, useState } from 'react'
import type { CSSProperties } from 'react'
import { resolveBestBookCover } from '../../services/bookCovers'
import type { Book } from '../../types/reading'
import { getBookProgress } from '../../utils/bookPages'
import './BookShowcase.css'

type BookShowcaseProps = {
  books: Book[]
}

type ShowcaseBook = {
  id: string
  title: string
  meta: string
  image?: string
  isbn?: string
  coverColor: string
  accentColor: string
  progress: number
}

const fallbackBooks: ShowcaseBook[] = [
  {
    id: 'showcase-iliad',
    title: 'The Iliad',
    meta: 'Classic · 0%',
    coverColor: '#202124',
    accentColor: '#ff6b2c',
    progress: 0,
  },
  {
    id: 'showcase-night',
    title: 'Reading at Night',
    meta: 'Notes · 0%',
    coverColor: '#1f2937',
    accentColor: '#93c5fd',
    progress: 0,
  },
  {
    id: 'showcase-essay',
    title: 'Small Essays',
    meta: 'Essay · 0%',
    coverColor: '#3f3f46',
    accentColor: '#facc15',
    progress: 0,
  },
  {
    id: 'showcase-words',
    title: 'Words to Keep',
    meta: 'Words · 0%',
    coverColor: '#27272a',
    accentColor: '#a7f3d0',
    progress: 0,
  },
  {
    id: 'showcase-library',
    title: 'My Library',
    meta: 'Archive · 0%',
    coverColor: '#18181b',
    accentColor: '#fda4af',
    progress: 0,
  },
]

const createShowcaseBooks = (books: Book[]) => {
  const showcaseBooks = books.slice(0, 6).map((book) => {
    const progress = getBookProgress(book.currentPage, book.totalPages) ?? 0

    return {
      id: book.id,
      title: book.title,
      meta: `${book.author} · ${progress}%`,
      image: book.thumbnail,
      isbn: book.isbn,
      coverColor: book.coverColor,
      accentColor: book.accentColor,
      progress,
    }
  })

  return showcaseBooks.length > 0 ? showcaseBooks : fallbackBooks
}

export const BookShowcase = ({ books }: BookShowcaseProps) => {
  const [hoveredId, setHoveredId] = useState<string | null>(null)
  const [resolvedCovers, setResolvedCovers] = useState<Record<string, string | undefined>>({})
  const showcaseBooks = useMemo(() => createShowcaseBooks(books), [books])
  const columns = [
    showcaseBooks.filter((_, index) => index % 3 === 0),
    showcaseBooks.filter((_, index) => index % 3 === 1),
    showcaseBooks.filter((_, index) => index % 3 === 2),
  ]

  useEffect(() => {
    let isActive = true

    const resolveCovers = async () => {
      const entries = await Promise.all(
        showcaseBooks.map(async (book) => [
          book.id,
          await resolveBestBookCover({
            isbn: book.isbn,
            fallbackThumbnail: book.image,
          }),
        ] as const),
      )

      if (isActive) {
        setResolvedCovers(Object.fromEntries(entries))
      }
    }

    void resolveCovers()

    return () => {
      isActive = false
    }
  }, [showcaseBooks])

  return (
    <section className="landing-book-showcase" aria-label="책 쇼케이스">
      <div className="landing-book-showcase-grid">
        {columns.map((column, columnIndex) => (
          <div
            key={columnIndex}
            className={`landing-book-showcase-column landing-book-showcase-column-${columnIndex + 1}`}
          >
            {column.map((book) => (
              <BookShowcaseCover
                key={book.id}
                book={book}
                image={resolvedCovers[book.id] ?? book.image}
                hoveredId={hoveredId}
                onHover={setHoveredId}
              />
            ))}
          </div>
        ))}
      </div>

      <div className="landing-book-showcase-list">
        {showcaseBooks.map((book) => (
          <BookShowcaseRow
            key={book.id}
            book={book}
            hoveredId={hoveredId}
            onHover={setHoveredId}
          />
        ))}
      </div>
    </section>
  )
}

type BookShowcaseCoverProps = {
  book: ShowcaseBook
  image?: string
  hoveredId: string | null
  onHover: (id: string | null) => void
}

const BookShowcaseCover = ({ book, image, hoveredId, onHover }: BookShowcaseCoverProps) => {
  const isActive = hoveredId === book.id
  const isDimmed = hoveredId !== null && !isActive

  return (
    <button
      type="button"
      className={`landing-book-showcase-cover${isActive ? ' landing-book-showcase-cover-active' : ''}${isDimmed ? ' landing-book-showcase-dimmed' : ''}`}
      style={{
        '--showcase-cover': book.coverColor,
        '--showcase-accent': book.accentColor,
      } as CSSProperties}
      onMouseEnter={() => onHover(book.id)}
      onMouseLeave={() => onHover(null)}
      onFocus={() => onHover(book.id)}
      onBlur={() => onHover(null)}
    >
      {image ? (
        <img src={image} alt={`${book.title} 표지`} draggable={false} />
      ) : (
        <span>{book.title}</span>
      )}
    </button>
  )
}

type BookShowcaseRowProps = {
  book: ShowcaseBook
  hoveredId: string | null
  onHover: (id: string | null) => void
}

const BookShowcaseRow = ({ book, hoveredId, onHover }: BookShowcaseRowProps) => {
  const isActive = hoveredId === book.id
  const isDimmed = hoveredId !== null && !isActive

  return (
    <button
      type="button"
      className={`landing-book-showcase-row${isActive ? ' landing-book-showcase-row-active' : ''}${isDimmed ? ' landing-book-showcase-dimmed' : ''}`}
      onMouseEnter={() => onHover(book.id)}
      onMouseLeave={() => onHover(null)}
      onFocus={() => onHover(book.id)}
      onBlur={() => onHover(null)}
    >
      <span className="landing-book-showcase-marker" />
      <span>
        <strong>{book.title}</strong>
        <em>{book.meta}</em>
      </span>
    </button>
  )
}
