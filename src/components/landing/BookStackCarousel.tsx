import {
  animate,
  motion,
  useMotionValue,
  useTransform,
  type MotionValue,
  type MotionStyle,
  type PanInfo,
} from 'framer-motion'
import { useEffect, useMemo, useRef, useState } from 'react'
import { resolveBestBookCover } from '../../services/bookCovers'
import type { Book } from '../../types/reading'

type BookSlide = {
  id: string
  image?: string
  isbn?: string
  title: string
  description: string
  badge: string
  coverColor: string
  accentColor: string
}

type CarouselConfig = {
  distanceDivisor: number
  velocityDivisor: number
  sensitivity: number
  xMultiplier: number
  yMultiplier: number
  rotationMultiplier: number
  scaleReduction: number
}

type BookStackCarouselProps = {
  books: Book[]
}

const fallbackSlides: BookSlide[] = [
  {
    id: 'sample-iliad',
    title: 'The Iliad',
    description: 'Epic pages, steady sessions, and sentences worth keeping.',
    badge: 'Classic',
    coverColor: '#202124',
    accentColor: '#ff6b2c',
  },
  {
    id: 'sample-night',
    title: 'Reading at Night',
    description: 'A quiet shelf for every word that stayed with you.',
    badge: 'Notes',
    coverColor: '#1f2937',
    accentColor: '#93c5fd',
  },
  {
    id: 'sample-essay',
    title: 'Small Essays',
    description: 'Short thoughts become a personal archive over time.',
    badge: 'Essay',
    coverColor: '#3f3f46',
    accentColor: '#facc15',
  },
  {
    id: 'sample-words',
    title: 'Words to Keep',
    description: 'Look up unfamiliar words and save the exact context.',
    badge: 'Words',
    coverColor: '#27272a',
    accentColor: '#a7f3d0',
  },
  {
    id: 'sample-library',
    title: 'My Library',
    description: 'Books, sessions, sentences, and time in one place.',
    badge: 'Archive',
    coverColor: '#18181b',
    accentColor: '#fda4af',
  },
]

const getCarouselConfig = (width: number): CarouselConfig => {
  if (width < 640) {
    return {
      distanceDivisor: 120,
      velocityDivisor: 500,
      sensitivity: 180,
      xMultiplier: 90,
      yMultiplier: 20,
      rotationMultiplier: 8,
      scaleReduction: 0.06,
    }
  }

  if (width < 1024) {
    return {
      distanceDivisor: 160,
      velocityDivisor: 650,
      sensitivity: 220,
      xMultiplier: 130,
      yMultiplier: 30,
      rotationMultiplier: 10,
      scaleReduction: 0.09,
    }
  }

  return {
    distanceDivisor: 200,
    velocityDivisor: 800,
    sensitivity: 250,
    xMultiplier: 170,
    yMultiplier: 40,
    rotationMultiplier: 12,
    scaleReduction: 0.12,
  }
}

const formatBookDescription = (book: Book) => {
  const pageLabel = book.totalPages
    ? `${book.currentPage}/${book.totalPages} pages`
    : `${book.currentPage} pages read`
  const noteCount = book.sentences.length + book.wordNotes.length

  return `${book.author} · ${pageLabel} · ${noteCount} notes saved`
}

const createSlides = (books: Book[]): BookSlide[] => {
  const bookSlides = books.slice(0, 7).map((book) => ({
    id: book.id,
    image: book.thumbnail,
    isbn: book.isbn,
    title: book.title,
    description: formatBookDescription(book),
    badge: book.status === 'completed' ? 'Completed' : 'Reading',
    coverColor: book.coverColor,
    accentColor: book.accentColor,
  }))

  return bookSlides.length > 0 ? bookSlides : fallbackSlides
}

export const BookStackCarousel = ({ books }: BookStackCarouselProps) => {
  const scrollProgress = useMotionValue(0)
  const startProgress = useRef(0)
  const [windowWidth, setWindowWidth] = useState(() =>
    typeof window === 'undefined' ? 1024 : window.innerWidth,
  )
  const [resolvedCovers, setResolvedCovers] = useState<Record<string, string | undefined>>({})
  const slides = useMemo(() => createSlides(books), [books])
  const total = slides.length

  useEffect(() => {
    const handleResize = () => setWindowWidth(window.innerWidth)

    window.addEventListener('resize', handleResize)

    return () => window.removeEventListener('resize', handleResize)
  }, [])

  useEffect(() => {
    let isActive = true

    const resolveCovers = async () => {
      const entries = await Promise.all(
        slides.map(async (slide) => [
          slide.id,
          await resolveBestBookCover({
            isbn: slide.isbn,
            fallbackThumbnail: slide.image,
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
  }, [slides])

  const config = useMemo(() => getCarouselConfig(windowWidth), [windowWidth])

  const handleDragStart = () => {
    startProgress.current = scrollProgress.get()
  }

  const handleDragEnd = (
    _: MouseEvent | TouchEvent | PointerEvent,
    info: PanInfo,
  ) => {
    const distanceShift = -info.offset.x / config.distanceDivisor
    const velocityShift = -info.velocity.x / config.velocityDivisor
    const totalShift = Math.max(-3, Math.min(3, Math.round(distanceShift + velocityShift)))
    const target = Math.round(startProgress.current) + totalShift

    animate(scrollProgress, target, {
      type: 'spring',
      stiffness: 200,
      damping: 30,
      mass: 1,
    })
  }

  return (
    <section id="book-stack" className="landing-book-stack" aria-label="책 리스트">
      <div className="landing-book-stack-copy">
        <span>BOOK LIST</span>
        <h2>Your reading shelf, stacked.</h2>
        <p>
          Drag the covers to browse books. Your recent books can become the first
          web view people meet.
        </p>
      </div>

      <div className="landing-book-stack-stage">
        <motion.div
          drag="x"
          dragConstraints={{ left: 0, right: 0 }}
          onDragStart={handleDragStart}
          onDrag={(_, info) => {
            const delta = -info.delta.x / config.sensitivity
            scrollProgress.set(scrollProgress.get() + delta)
          }}
          onDragEnd={handleDragEnd}
          className="landing-book-stack-drag"
          aria-hidden="true"
        />

        {slides.map((slide, index) => (
          <BookStackCard
            key={slide.id}
            slide={slide}
            image={resolvedCovers[slide.id] ?? slide.image}
            index={index}
            total={total}
            progress={scrollProgress}
            config={config}
          />
        ))}
      </div>
    </section>
  )
}

type BookStackCardProps = {
  slide: BookSlide
  image?: string
  index: number
  total: number
  progress: MotionValue<number>
  config: CarouselConfig
}

const BookStackCard = ({
  slide,
  image,
  index,
  total,
  progress,
  config,
}: BookStackCardProps) => {
  const [hasImageError, setHasImageError] = useState(false)
  const offset = useTransform(progress, (value) => {
    let diff = (index - value) % total
    if (diff > total / 2) diff -= total
    if (diff < -total / 2) diff += total
    return diff
  })
  const x = useTransform(offset, (value) => value * config.xMultiplier)
  const rotate = useTransform(offset, (value) =>
    Math.abs(value) < 0.05 ? 0 : value * config.rotationMultiplier,
  )
  const y = useTransform(offset, (value) => Math.abs(value) * config.yMultiplier)
  const scale = useTransform(
    offset,
    (value) => 1 - Math.abs(value) * config.scaleReduction,
  )
  const opacity = useTransform(
    offset,
    [-total / 2, -total / 2 + 0.5, 0, total / 2 - 0.5, total / 2],
    [0, 1, 1, 1, 0],
  )
  const zIndex = useTransform(offset, (value) =>
    Math.round(100 - Math.abs(value) * 10),
  )
  const overlayOpacity = useTransform(
    offset,
    [-2, -0.5, 0, 0.5, 2],
    [0.54, 0.28, 0, 0.28, 0.54],
  )
  const contentOpacity = useTransform(offset, [-0.5, 0, 0.5], [0, 1, 0])

  return (
    <motion.article
      className="landing-book-card"
      style={{
        x,
        rotate,
        y,
        scale,
        opacity,
        zIndex,
        '--book-cover': slide.coverColor,
        '--book-accent': slide.accentColor,
      } as MotionStyle}
    >
      {image && !hasImageError ? (
        <img
          src={image}
          alt={`${slide.title} 표지`}
          draggable={false}
          onError={() => setHasImageError(true)}
        />
      ) : (
        <div className="landing-book-cover-fallback" aria-hidden="true">
          <span>{slide.title}</span>
        </div>
      )}

      <motion.div
        className="landing-book-card-shade"
        style={{ opacity: overlayOpacity }}
      />
      <div className="landing-book-card-gradient" />
      <span className="landing-book-card-badge">{slide.badge}</span>

      <motion.div
        className="landing-book-card-copy"
        style={{ opacity: contentOpacity }}
      >
        <h3>{slide.title}</h3>
        <p>{slide.description}</p>
      </motion.div>
    </motion.article>
  )
}
