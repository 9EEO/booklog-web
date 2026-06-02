import { useMemo, useState, type FormEvent } from 'react'
import { BottomSheetModal } from '../components/BottomSheetModal'
import { Icon } from '../components/Icon'
import { PixelCard } from '../components/PixelCard'
import { useBackNavigationLayer } from '../hooks/useBackNavigationLayer'
import type { Book, ReadingRecord, ReadingRecordUpdateInput } from '../types/reading'
import { formatDuration } from '../utils/formatDuration'
import { parsePageInput } from '../utils/pageInput'

type RecordScreenProps = {
  books: Book[]
  records: ReadingRecord[]
  onUpdateRecord: (recordId: string, input: ReadingRecordUpdateInput) => Promise<void>
  onDeleteRecord: (recordId: string) => Promise<void>
}

type RecordView = 'records' | 'sentences' | 'calendar'
type SentenceSort = 'recent' | 'page'
type RecordSentenceFilter = 'all' | 'withSentence'

type SentenceItem = {
  id: string
  text: string
  page: number
  recordedAt: string
  bookId: string
  bookTitle: string
}

type CalendarBookPreview = Pick<Book, 'id' | 'title' | 'thumbnail' | 'coverColor' | 'accentColor'>

type RecordEditDraft = {
  startPage: number
  endPage: number
  durationMinutes: number
  sentence: string
  sentencePage: number
}

const weekdayLabels = ['일', '월', '화', '수', '목', '금', '토']

const pad2 = (value: number) => value.toString().padStart(2, '0')

const formatDateLabel = (date: Date) => `${date.getFullYear()}.${pad2(date.getMonth() + 1)}.${pad2(date.getDate())}`

const parseDateLabel = (dateLabel: string) => {
  const [year, month, day] = dateLabel.split('.').map(Number)
  const date = new Date(year, month - 1, day)

  return Number.isFinite(date.getTime()) ? date : null
}

const createMonthCursor = (date: Date) => new Date(date.getFullYear(), date.getMonth(), 1)

const isSameMonth = (date: Date, monthCursor: Date) =>
  date.getFullYear() === monthCursor.getFullYear() && date.getMonth() === monthCursor.getMonth()

const formatMonthTitle = (date: Date) => `${date.getFullYear()}년 ${date.getMonth() + 1}월`

const formatCompactDuration = (seconds: number) => {
  if (seconds <= 0) return '0분'

  const minutes = Math.max(Math.round(seconds / 60), 1)
  const hours = Math.floor(minutes / 60)
  const remainMinutes = minutes % 60

  if (hours === 0) return `${minutes}분`
  if (remainMinutes === 0) return `${hours}시간`

  return `${hours}시간 ${remainMinutes}분`
}

const formatSessionClock = (value?: string) => {
  if (!value) return ''

  const date = new Date(value)
  if (!Number.isFinite(date.getTime())) return ''

  return new Intl.DateTimeFormat('ko-KR', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date)
}

const formatSessionTimeRange = (record: ReadingRecord) => {
  const startedAt = formatSessionClock(record.startedAt)
  const endedAt = formatSessionClock(record.endedAt)

  if (startedAt && endedAt) return `${startedAt} - ${endedAt}`
  if (startedAt) return `${startedAt} 시작`
  if (endedAt) return `${endedAt} 종료`

  return ''
}

const formatRoundLabel = (record: ReadingRecord) => `${record.roundNumber ?? 1}회독`

const getCalendarDays = (monthCursor: Date) => {
  const firstDay = createMonthCursor(monthCursor)
  const gridStart = new Date(firstDay)

  gridStart.setDate(firstDay.getDate() - firstDay.getDay())

  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(gridStart)
    date.setDate(gridStart.getDate() + index)
    return date
  })
}

const createRecordEditDraft = (record: ReadingRecord): RecordEditDraft => ({
  startPage: record.startPage,
  endPage: record.endPage,
  durationMinutes: Math.max(Math.round(record.durationSeconds / 60), 1),
  sentence: record.sentence ?? '',
  sentencePage: record.sentencePage ?? record.endPage,
})

export const RecordScreen = ({ books, records, onUpdateRecord, onDeleteRecord }: RecordScreenProps) => {
  const [view, setView] = useState<RecordView>('calendar')
  const [recordBookFilter, setRecordBookFilter] = useState('all')
  const [recordSentenceFilter, setRecordSentenceFilter] = useState<RecordSentenceFilter>('all')
  const [bookFilter, setBookFilter] = useState('all')
  const [sentenceSort, setSentenceSort] = useState<SentenceSort>('recent')
  const [randomSentenceId, setRandomSentenceId] = useState<string | null>(null)
  const [monthCursor, setMonthCursor] = useState(() => createMonthCursor(new Date()))
  const [selectedDate, setSelectedDate] = useState(() => formatDateLabel(new Date()))
  const [isDateDetailOpen, setIsDateDetailOpen] = useState(false)
  const [editingRecordId, setEditingRecordId] = useState<string | null>(null)
  const [deleteRecordId, setDeleteRecordId] = useState<string | null>(null)
  const [recordEditDraft, setRecordEditDraft] = useState<RecordEditDraft | null>(null)
  const [recordEditError, setRecordEditError] = useState<string | null>(null)
  const [isRecordMutating, setIsRecordMutating] = useState(false)

  const filteredRecords = useMemo(() => {
    return records.filter((record) => {
      const matchesBook = recordBookFilter === 'all' || record.bookId === recordBookFilter
      const matchesSentence = recordSentenceFilter === 'all' || Boolean(record.sentence)

      return matchesBook && matchesSentence
    })
  }, [recordBookFilter, recordSentenceFilter, records])

  const recordGroups = useMemo(() => {
    const groups = filteredRecords.reduce<Array<{ date: string; durationSeconds: number; records: ReadingRecord[] }>>((currentGroups, record) => {
      const group = currentGroups.find((item) => item.date === record.date)

      if (group) {
        group.durationSeconds += record.durationSeconds
        group.records.push(record)
        return currentGroups
      }

      currentGroups.push({
        date: record.date,
        durationSeconds: record.durationSeconds,
        records: [record],
      })

      return currentGroups
    }, [])

    return groups.sort((left, right) => right.date.localeCompare(left.date))
  }, [filteredRecords])

  const sentenceItems = useMemo<SentenceItem[]>(
    () =>
      books.flatMap((book) =>
        book.sentences.map((sentence) => ({
          ...sentence,
          bookId: book.id,
          bookTitle: book.title,
        })),
      ),
    [books],
  )

  const visibleSentences = useMemo(() => {
    const filteredSentences = bookFilter === 'all' ? sentenceItems : sentenceItems.filter((sentence) => sentence.bookId === bookFilter)

    return [...filteredSentences].sort((left, right) => {
      if (sentenceSort === 'page') {
        return left.bookTitle.localeCompare(right.bookTitle) || left.page - right.page || right.recordedAt.localeCompare(left.recordedAt)
      }

      return right.recordedAt.localeCompare(left.recordedAt) || right.page - left.page
    })
  }, [bookFilter, sentenceItems, sentenceSort])

  const randomSentence = visibleSentences.find((sentence) => sentence.id === randomSentenceId) ?? null

  const booksById = useMemo(() => new Map(books.map((book) => [book.id, book])), [books])

  const calendarDays = useMemo(() => getCalendarDays(monthCursor), [monthCursor])

  const calendarStatsByDate = useMemo(() => {
    return records.reduce<
      Record<
        string,
        {
          durationSeconds: number
          pages: number
          records: ReadingRecord[]
        }
      >
    >((stats, record) => {
      const currentStats = stats[record.date] ?? {
        durationSeconds: 0,
        pages: 0,
        records: [],
      }

      currentStats.durationSeconds += record.durationSeconds
      currentStats.pages += Math.max(record.endPage - record.startPage, 0)
      currentStats.records.push(record)
      stats[record.date] = currentStats

      return stats
    }, {})
  }, [records])

  const selectedDateStats = calendarStatsByDate[selectedDate] ?? null

  const selectedDateRecords = useMemo(
    () => [...(selectedDateStats?.records ?? [])].sort((left, right) => right.durationSeconds - left.durationSeconds),
    [selectedDateStats],
  )

  const selectedDateBookGroups = useMemo(() => {
    return Array.from(
      selectedDateRecords
        .reduce<
          Map<
            string,
            {
              bookId: string
              bookTitle: string
              durationSeconds: number
              pages: number
              sentenceCount: number
              records: ReadingRecord[]
            }
          >
        >((groups, record) => {
          const currentGroup = groups.get(record.bookId) ?? {
            bookId: record.bookId,
            bookTitle: record.bookTitle,
            durationSeconds: 0,
            pages: 0,
            sentenceCount: 0,
            records: [],
          }

          currentGroup.durationSeconds += record.durationSeconds
          currentGroup.pages += Math.max(record.endPage - record.startPage, 0)
          currentGroup.sentenceCount += record.sentence ? 1 : 0
          currentGroup.records.push(record)
          groups.set(record.bookId, currentGroup)

          return groups
        }, new Map())
        .values(),
    ).sort((left, right) => right.durationSeconds - left.durationSeconds)
  }, [selectedDateRecords])

  const selectedDateSentenceCount = selectedDateStats?.records.filter((record) => Boolean(record.sentence)).length ?? 0

  const editingRecord = editingRecordId ? records.find((record) => record.id === editingRecordId) ?? null : null
  const deleteRecord = deleteRecordId ? records.find((record) => record.id === deleteRecordId) ?? null : null
  const editingBook = editingRecord ? booksById.get(editingRecord.bookId) ?? null : null

  const monthStats = useMemo(() => {
    return records.reduce(
      (stats, record) => {
        const date = parseDateLabel(record.date)
        if (!date || !isSameMonth(date, monthCursor)) return stats

        stats.durationSeconds += record.durationSeconds
        stats.pages += Math.max(record.endPage - record.startPage, 0)
        stats.readingDates.add(record.date)

        return stats
      },
      {
        durationSeconds: 0,
        pages: 0,
        readingDates: new Set<string>(),
      },
    )
  }, [monthCursor, records])

  const pickRandomSentence = () => {
    if (visibleSentences.length === 0) return

    const nextSentence = visibleSentences[Math.floor(Math.random() * visibleSentences.length)]
    setRandomSentenceId(nextSentence.id)
  }

  const moveMonth = (delta: number) => {
    setMonthCursor((current) => new Date(current.getFullYear(), current.getMonth() + delta, 1))
  }

  const moveToToday = () => {
    const today = new Date()

    setMonthCursor(createMonthCursor(today))
    setSelectedDate(formatDateLabel(today))
  }

  const selectCalendarDate = (date: Date) => {
    setSelectedDate(formatDateLabel(date))
    setIsDateDetailOpen(true)

    if (!isSameMonth(date, monthCursor)) {
      setMonthCursor(createMonthCursor(date))
    }
  }

  const openRecordEditor = (record: ReadingRecord) => {
    setEditingRecordId(record.id)
    setRecordEditDraft(createRecordEditDraft(record))
    setRecordEditError(null)
  }

  const closeRecordEditor = () => {
    if (isRecordMutating) return

    setEditingRecordId(null)
    setRecordEditDraft(null)
    setRecordEditError(null)
  }

  const updateRecordEditDraft = (input: Partial<RecordEditDraft>) => {
    setRecordEditDraft((current) => (current ? { ...current, ...input } : current))
  }

  const submitRecordEdit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!editingRecord || !recordEditDraft) return

    const totalPages = editingBook?.totalPages ?? Math.max(editingRecord.endPage, recordEditDraft.endPage, 1)
    const startPage = Math.min(Math.max(recordEditDraft.startPage || 1, 1), totalPages)
    const endPage = Math.min(Math.max(recordEditDraft.endPage || startPage, startPage), totalPages)
    const durationMinutes = Math.max(recordEditDraft.durationMinutes || 1, 1)
    const sentence = recordEditDraft.sentence.trim()
    const sentencePage = sentence ? Math.min(Math.max(recordEditDraft.sentencePage || endPage, 1), totalPages) : undefined

    try {
      setIsRecordMutating(true)
      setRecordEditError(null)
      await onUpdateRecord(editingRecord.id, {
        startPage,
        endPage,
        durationSeconds: durationMinutes * 60,
        sentence: sentence || undefined,
        sentencePage,
      })
      setEditingRecordId(null)
      setRecordEditDraft(null)
    } catch (error) {
      setRecordEditError(error instanceof Error ? error.message : '기록을 수정하지 못했습니다.')
    } finally {
      setIsRecordMutating(false)
    }
  }

  const confirmDeleteRecord = async () => {
    if (!deleteRecordId) return

    try {
      setIsRecordMutating(true)
      setRecordEditError(null)
      await onDeleteRecord(deleteRecordId)
      if (editingRecordId === deleteRecordId) {
        setEditingRecordId(null)
        setRecordEditDraft(null)
      }
      setDeleteRecordId(null)
    } catch (error) {
      setRecordEditError(error instanceof Error ? error.message : '기록을 삭제하지 못했습니다.')
    } finally {
      setIsRecordMutating(false)
    }
  }

  const todayDateLabel = formatDateLabel(new Date())

  useBackNavigationLayer(isDateDetailOpen && view === 'calendar', () => setIsDateDetailOpen(false), 'record-date-detail')
  useBackNavigationLayer(Boolean(editingRecord), closeRecordEditor, 'record-edit')
  useBackNavigationLayer(Boolean(deleteRecord), () => setDeleteRecordId(null), 'record-delete')

  return (
    <div className="space-y-4">
      <header>
        <p className="pixel-label">READING LOG</p>
        <h1 className="mt-1 text-2xl font-black">기록</h1>
      </header>

      <div className="grid grid-cols-3 gap-2">
        <button type="button" className={`preset-button ${view === 'calendar' ? 'preset-button-active' : ''}`} onClick={() => setView('calendar')}>
          캘린더
        </button>
        <button type="button" className={`preset-button ${view === 'records' ? 'preset-button-active' : ''}`} onClick={() => setView('records')}>
          기록
        </button>
        <button type="button" className={`preset-button ${view === 'sentences' ? 'preset-button-active' : ''}`} onClick={() => setView('sentences')}>
          문장
        </button>
      </div>

      {view === 'records' &&
        (records.length === 0 ? (
          <PixelCard className="bg-[#FCFBF7] text-center">
            <Icon name="records" className="mx-auto mb-3 h-8 w-8 text-[#87937A]" />
            <p className="font-black">아직 저장된 독서 기록이 없습니다.</p>
          </PixelCard>
        ) : (
          <div className="space-y-3">
            <PixelCard className="bg-[#F3E8D0]">
              <select
                className="min-h-10 w-full border-2 border-[#2F2A26] bg-[#FCFBF7] px-2 text-xs font-black outline-none"
                value={recordBookFilter}
                onChange={(event) => setRecordBookFilter(event.target.value)}
                aria-label="기록 책 필터"
              >
                <option value="all">전체 책</option>
                {books
                  .filter((book) => records.some((record) => record.bookId === book.id))
                  .map((book) => (
                    <option key={book.id} value={book.id}>
                      {book.title}
                    </option>
                  ))}
              </select>
              <div className="mt-3 grid grid-cols-2 gap-2">
                <button
                  type="button"
                  className={`preset-button min-h-10 ${recordSentenceFilter === 'all' ? 'preset-button-active' : ''}`}
                  onClick={() => setRecordSentenceFilter('all')}
                >
                  전체
                </button>
                <button
                  type="button"
                  className={`preset-button min-h-10 ${recordSentenceFilter === 'withSentence' ? 'preset-button-active' : ''}`}
                  onClick={() => setRecordSentenceFilter('withSentence')}
                >
                  문장 있음
                </button>
              </div>
            </PixelCard>

            {recordGroups.length === 0 ? (
              <PixelCard className="bg-[#FCFBF7] text-center">
                <Icon name="records" className="mx-auto mb-3 h-8 w-8 text-[#87937A]" />
                <p className="font-black">조건에 맞는 기록이 없습니다.</p>
              </PixelCard>
            ) : (
              recordGroups.map((group) => (
                <section key={group.date} className="space-y-2">
                  <div className="flex items-center justify-between gap-3 border-2 border-[#2F2A26] bg-[#F3E8D0] px-3 py-2 shadow-[2px_2px_0_rgba(47,42,38,0.72)]">
                    <h2 className="text-sm font-black">{group.date}</h2>
                    <p className="text-xs font-black text-[#5F6D57]">총 {formatDuration(group.durationSeconds)}</p>
                  </div>
                  <div className="space-y-3">
                    {group.records.map((record) => (
                      <PixelCard key={record.id} className="bg-[#FCFBF7]">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="truncate text-base font-black">{record.bookTitle}</p>
                            <p className="mt-1 text-xs font-black text-stone-500">
                              {formatRoundLabel(record)} · {record.startPage}p → {record.endPage}p
                            </p>
                            {formatSessionTimeRange(record) && (
                              <p className="mt-1 text-xs font-black text-[#5F6D57]">{formatSessionTimeRange(record)}</p>
                            )}
                          </div>
                          <div className="flex shrink-0 items-start gap-1">
                            <time className="border-2 border-[#2F2A26] bg-[#2F2A26] px-2 py-1 text-xs font-black leading-none text-[#FFFDF8] shadow-[2px_2px_0_rgba(47,42,38,0.8)]">
                              {formatDuration(record.durationSeconds)}
                            </time>
                            <button type="button" className="mini-icon-button" onClick={() => openRecordEditor(record)} aria-label="기록 수정">
                              <Icon name="edit" className="h-4 w-4" />
                            </button>
                            <button
                              type="button"
                              className="mini-icon-button bg-[#B58A7A] text-[#FFFDF8]"
                              onClick={() => {
                                setRecordEditError(null)
                                setDeleteRecordId(record.id)
                              }}
                              aria-label="기록 삭제"
                            >
                              <Icon name="trash" className="h-4 w-4" />
                            </button>
                          </div>
                        </div>
                        {record.sentence && (
                          <blockquote className="mt-3 border-l-4 border-[#5F6D57] bg-[#F3E8D0] p-3 text-sm font-bold leading-relaxed">
                            <Icon name="quote" className="mb-2 h-4 w-4 text-[#5F6D57]" />
                            {record.sentence}
                            {record.sentencePage && <span className="mt-2 block text-xs font-black text-stone-500">{record.sentencePage}p</span>}
                          </blockquote>
                        )}
                      </PixelCard>
                    ))}
                  </div>
                </section>
              ))
            )}
          </div>
        ))}

      {view === 'sentences' && (
        <div className="space-y-3">
          <PixelCard className="bg-[#F3E8D0]">
            <div className="grid grid-cols-[1fr_auto] gap-2">
              <select
                className="min-h-10 border-2 border-[#2F2A26] bg-[#FCFBF7] px-2 text-xs font-black outline-none"
                value={bookFilter}
                onChange={(event) => {
                  setBookFilter(event.target.value)
                  setRandomSentenceId(null)
                }}
                aria-label="책 필터"
              >
                <option value="all">전체 책</option>
                {books
                  .filter((book) => book.sentences.length > 0)
                  .map((book) => (
                    <option key={book.id} value={book.id}>
                      {book.title}
                    </option>
                  ))}
              </select>
              <button type="button" className="secondary-button min-h-10 px-3 text-xs" onClick={pickRandomSentence} disabled={visibleSentences.length === 0}>
                랜덤
              </button>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <button
                type="button"
                className={`preset-button min-h-10 ${sentenceSort === 'recent' ? 'preset-button-active' : ''}`}
                onClick={() => setSentenceSort('recent')}
              >
                등록순
              </button>
              <button
                type="button"
                className={`preset-button min-h-10 ${sentenceSort === 'page' ? 'preset-button-active' : ''}`}
                onClick={() => setSentenceSort('page')}
              >
                페이지순
              </button>
            </div>
          </PixelCard>

          {randomSentence && (
            <PixelCard className="bg-[#2F2A26] text-[#FFFDF8]">
              <div className="mb-3 flex items-center gap-2 text-[#F2C94C]">
                <Icon name="leaf" className="h-5 w-5" />
                <p className="text-xs font-black">오늘의 문장</p>
              </div>
              <p className="text-sm font-black leading-relaxed">“{randomSentence.text}”</p>
              <p className="mt-3 text-right text-xs font-black text-[#E8DFC2]">
                {randomSentence.bookTitle} · p.{randomSentence.page}
              </p>
            </PixelCard>
          )}

          {visibleSentences.length === 0 ? (
            <PixelCard className="bg-[#FCFBF7] text-center">
              <Icon name="quote" className="mx-auto mb-3 h-8 w-8 text-[#87937A]" />
              <p className="font-black">아직 모아둔 문장이 없습니다.</p>
            </PixelCard>
          ) : (
            visibleSentences.map((sentence) => (
              <PixelCard key={sentence.id} className="bg-[#FCFBF7]">
                <blockquote className="text-sm font-black leading-relaxed">“{sentence.text}”</blockquote>
                <div className="mt-3 flex items-center justify-between gap-3 text-xs font-black text-stone-500">
                  <p className="min-w-0 truncate">{sentence.bookTitle}</p>
                  <p className="shrink-0 text-[#5F6D57]">
                    p.{sentence.page} · {sentence.recordedAt}
                  </p>
                </div>
              </PixelCard>
            ))
          )}
        </div>
      )}

      {view === 'calendar' && (
        <div className="space-y-3">
          <PixelCard className="bg-[#F3E8D0]">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2 text-[#5F6D57]">
                  <Icon name="calendar" className="h-5 w-5" />
                  <p className="text-xs font-black">독서 캘린더</p>
                </div>
                <h2 className="mt-1 text-xl font-black">{formatMonthTitle(monthCursor)}</h2>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <button type="button" className="mini-icon-button" onClick={() => moveMonth(-1)} aria-label="이전 달">
                  <Icon name="chevronLeft" className="h-4 w-4" />
                </button>
                <button type="button" className="secondary-button min-h-8 px-2 py-1 text-xs" onClick={moveToToday}>
                  오늘
                </button>
                <button type="button" className="mini-icon-button" onClick={() => moveMonth(1)} aria-label="다음 달">
                  <Icon name="chevronRight" className="h-4 w-4" />
                </button>
              </div>
            </div>

            <div className="mb-4 grid grid-cols-3 gap-2">
              <div className="border-2 border-[#2F2A26] bg-[#FCFBF7] px-2 py-2">
                <p className="text-[10px] font-black text-stone-500">독서일</p>
                <p className="mt-1 text-sm font-black">{monthStats.readingDates.size}일</p>
              </div>
              <div className="border-2 border-[#2F2A26] bg-[#FCFBF7] px-2 py-2">
                <p className="text-[10px] font-black text-stone-500">독서 시간</p>
                <p className="mt-1 text-sm font-black">{formatCompactDuration(monthStats.durationSeconds)}</p>
              </div>
              <div className="border-2 border-[#2F2A26] bg-[#FCFBF7] px-2 py-2">
                <p className="text-[10px] font-black text-stone-500">페이지</p>
                <p className="mt-1 text-sm font-black">{monthStats.pages}p</p>
              </div>
            </div>

            <div className="mb-2 grid grid-cols-7 gap-1 text-center text-[10px] font-black text-stone-500">
              {weekdayLabels.map((weekday) => (
                <span key={weekday}>{weekday}</span>
              ))}
            </div>

            <div className="grid grid-cols-7 gap-1">
              {calendarDays.map((date) => {
                const dateLabel = formatDateLabel(date)
                const dayStats = calendarStatsByDate[dateLabel]
                const hasRecord = Boolean(dayStats)
                const isCurrentMonth = isSameMonth(date, monthCursor)
                const isSelected = dateLabel === selectedDate
                const isToday = dateLabel === todayDateLabel
                const dayBookPreviews = dayStats
                  ? Array.from(
                      dayStats.records
                        .reduce<Map<string, CalendarBookPreview & { durationSeconds: number }>>((bookMap, record) => {
                          const existingBook = bookMap.get(record.bookId)

                          if (existingBook) {
                            existingBook.durationSeconds += record.durationSeconds
                            return bookMap
                          }
                          const book = booksById.get(record.bookId)

                          bookMap.set(
                            record.bookId,
                            book
                              ? {
                                  id: book.id,
                                  title: book.title,
                                  thumbnail: book.thumbnail,
                                  coverColor: book.coverColor,
                                  accentColor: book.accentColor,
                                  durationSeconds: record.durationSeconds,
                                }
                              : {
                                  id: record.bookId,
                                  title: record.bookTitle,
                                  coverColor: '#8a5a3c',
                                  accentColor: '#e8c48f',
                                  durationSeconds: record.durationSeconds,
                                },
                          )

                          return bookMap
                        }, new Map())
                        .values(),
                    ).sort((left, right) => right.durationSeconds - left.durationSeconds)
                  : []
                const primaryBookPreview = dayBookPreviews[0]
                const hiddenBookCount = Math.max(dayBookPreviews.length - 1, 0)

                return (
                  <button
                    key={dateLabel}
                    type="button"
                    className={`calendar-day-card ${hasRecord ? 'calendar-day-card-record' : 'calendar-day-card-empty'} ${
                      isSelected ? 'calendar-day-card-selected' : ''
                    } ${isCurrentMonth ? '' : 'calendar-day-card-muted'}`}
                    onClick={() => selectCalendarDate(date)}
                    aria-label={`${dateLabel} 독서 기록 보기`}
                  >
                    {hasRecord && primaryBookPreview ? (
                      <>
                        <span className={`calendar-day-header ${isToday ? 'calendar-day-header-today' : ''}`}>
                          {date.getDate()}
                          {hiddenBookCount > 0 && (
                            <span className="calendar-day-count">
                              +{hiddenBookCount}
                            </span>
                          )}
                        </span>
                        <span className="calendar-day-cover" style={{ backgroundColor: primaryBookPreview.coverColor }}>
                          {primaryBookPreview.thumbnail ? (
                            <img src={primaryBookPreview.thumbnail} alt="" />
                          ) : (
                            <span className="calendar-day-cover-fallback" style={{ backgroundColor: primaryBookPreview.accentColor }} />
                          )}
                        </span>
                      </>
                    ) : (
                      <span className={`calendar-day-empty-date ${isToday ? 'calendar-day-empty-date-today' : ''}`}>{date.getDate()}</span>
                    )}
                  </button>
                )
              })}
            </div>
          </PixelCard>

        </div>
      )}

      <BottomSheetModal
        isOpen={view === 'calendar' && isDateDetailOpen}
        ariaLabel="날짜별 독서 기록"
        onBackdropClick={() => setIsDateDetailOpen(false)}
      >
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-black text-stone-500">선택한 날짜</p>
            <h2 className="mt-1 text-lg font-black">{selectedDate}</h2>
          </div>
          <button type="button" className="icon-button" onClick={() => setIsDateDetailOpen(false)} aria-label="닫기">
            <Icon name="close" className="h-5 w-5" />
          </button>
        </div>

        {!selectedDateStats ? (
          <div className="border-2 border-dashed border-stone-300 bg-[#F8F8F5] p-4 text-center">
            <Icon name="calendar" className="mx-auto mb-2 h-7 w-7 text-[#87937A]" />
            <p className="text-sm font-black text-stone-600">이 날의 독서 기록이 없습니다.</p>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="grid grid-cols-4 gap-2">
              <div className="border-2 border-[#2F2A26] bg-[#F3E8D0] px-2 py-2">
                <p className="text-[10px] font-black text-stone-500">시간</p>
                <p className="mt-1 text-xs font-black">{formatCompactDuration(selectedDateStats.durationSeconds)}</p>
              </div>
              <div className="border-2 border-[#2F2A26] bg-[#F3E8D0] px-2 py-2">
                <p className="text-[10px] font-black text-stone-500">페이지</p>
                <p className="mt-1 text-xs font-black">{selectedDateStats.pages}p</p>
              </div>
              <div className="border-2 border-[#2F2A26] bg-[#F3E8D0] px-2 py-2">
                <p className="text-[10px] font-black text-stone-500">세션</p>
                <p className="mt-1 text-xs font-black">{selectedDateStats.records.length}개</p>
              </div>
              <div className="border-2 border-[#2F2A26] bg-[#F3E8D0] px-2 py-2">
                <p className="text-[10px] font-black text-stone-500">문장</p>
                <p className="mt-1 text-xs font-black">{selectedDateSentenceCount}개</p>
              </div>
            </div>

            {selectedDateBookGroups.map((group) => {
              const book = booksById.get(group.bookId)

              return (
                <div key={group.bookId} className="border-2 border-[#2F2A26] bg-[#FCFBF7] p-3 shadow-[2px_2px_0_rgba(47,42,38,0.58)]">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 items-start gap-2">
                      <div
                        className="h-12 w-9 shrink-0 overflow-hidden border-2 border-[#2F2A26] bg-[#F3E8D0] shadow-[1px_1px_0_rgba(47,42,38,0.58)]"
                        style={{ backgroundColor: book?.coverColor ?? '#8a5a3c' }}
                      >
                        {book?.thumbnail ? (
                          <img src={book.thumbnail} alt="" className="h-full w-full object-cover" />
                        ) : (
                          <span className="block h-full w-full border-l-4" style={{ borderColor: book?.accentColor ?? '#e8c48f' }} />
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-black">{group.bookTitle}</p>
                        <p className="mt-1 text-xs font-black text-stone-500">{group.pages}p · 세션 {group.records.length}개</p>
                      </div>
                    </div>
                    <p className="shrink-0 text-xs font-black text-[#5F6D57]">{formatDuration(group.durationSeconds)}</p>
                  </div>

                  <div className="mt-3 divide-y-2 divide-[#2F2A26] border-2 border-[#2F2A26] bg-[#F8F8F5]">
                    {group.records.map((record) => (
                      <div key={record.id} className="px-2 py-2">
                        <div className="flex items-center justify-between gap-2">
                          <div className="min-w-0">
                            <p className="text-xs font-black text-stone-600">
                              {formatRoundLabel(record)} · {record.startPage}p → {record.endPage}p
                            </p>
                            {formatSessionTimeRange(record) && (
                              <p className="mt-1 text-[11px] font-black text-stone-500">{formatSessionTimeRange(record)}</p>
                            )}
                          </div>
                          <div className="flex shrink-0 items-center gap-1">
                            <p className="text-[11px] font-black text-[#5F6D57]">{formatDuration(record.durationSeconds)}</p>
                            <button type="button" className="mini-icon-button" onClick={() => openRecordEditor(record)} aria-label="기록 수정">
                              <Icon name="edit" className="h-4 w-4" />
                            </button>
                            <button
                              type="button"
                              className="mini-icon-button bg-[#B58A7A] text-[#FFFDF8]"
                              onClick={() => {
                                setRecordEditError(null)
                                setDeleteRecordId(record.id)
                              }}
                              aria-label="기록 삭제"
                            >
                              <Icon name="trash" className="h-4 w-4" />
                            </button>
                          </div>
                        </div>
                        {record.sentence && (
                          <p className="mt-2 line-clamp-2 border-l-4 border-[#5F6D57] bg-[#F3E8D0] p-2 text-xs font-bold leading-relaxed">
                            {record.sentence}
                            {record.sentencePage && <span className="ml-1 text-[10px] font-black text-stone-500">{record.sentencePage}p</span>}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>

                  {group.sentenceCount > 0 && (
                    <p className="mt-2 text-right text-[11px] font-black text-stone-500">
                      기록 문장 {group.sentenceCount}개
                    </p>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </BottomSheetModal>

      <BottomSheetModal isOpen={Boolean(editingRecord && recordEditDraft)} ariaLabel="독서 기록 수정" backdropClassName="modal-backdrop-top">
        {editingRecord && recordEditDraft && (
          <>
            <div className="mb-4 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="pixel-label">EDIT RECORD</p>
                <h2 className="mt-1 truncate text-xl font-black">{editingRecord.bookTitle}</h2>
                <p className="mt-1 text-xs font-black text-stone-500">{editingRecord.date}</p>
              </div>
              <button type="button" className="icon-button" onClick={closeRecordEditor} aria-label="닫기" disabled={isRecordMutating}>
                <Icon name="close" className="h-5 w-5" />
              </button>
            </div>

            <form className="space-y-4" onSubmit={submitRecordEdit}>
              <div className="grid grid-cols-2 gap-3">
                <label className="field-label">
                  시작 페이지
                  <input
                    className="pixel-input"
                    type="text"
                    inputMode="numeric"
                    value={recordEditDraft.startPage}
                    onChange={(event) => updateRecordEditDraft({ startPage: parsePageInput(event.target.value) })}
                  />
                </label>
                <label className="field-label">
                  종료 페이지
                  <input
                    className="pixel-input"
                    type="text"
                    inputMode="numeric"
                    value={recordEditDraft.endPage}
                    onChange={(event) => updateRecordEditDraft({ endPage: parsePageInput(event.target.value) })}
                  />
                </label>
              </div>

              <div className="border-2 border-[#2F2A26] bg-[#F3E8D0] p-3">
                <div className="mb-2 flex items-center justify-between gap-3">
                  <p className="text-xs font-black text-stone-600">독서 시간</p>
                  <p className="text-sm font-black">{recordEditDraft.durationMinutes}분</p>
                </div>
                <div className="grid grid-cols-[auto_1fr_auto] items-center gap-2">
                  <button
                    type="button"
                    className="mini-icon-button"
                    onClick={() => updateRecordEditDraft({ durationMinutes: Math.max(recordEditDraft.durationMinutes - 5, 1) })}
                    aria-label="독서 시간 5분 줄이기"
                  >
                    <Icon name="minus" className="h-4 w-4" />
                  </button>
                  <input
                    className="pixel-input text-center"
                    type="text"
                    inputMode="numeric"
                    value={recordEditDraft.durationMinutes}
                    onChange={(event) => updateRecordEditDraft({ durationMinutes: Math.max(parsePageInput(event.target.value), 1) })}
                    aria-label="독서 시간"
                  />
                  <button
                    type="button"
                    className="mini-icon-button"
                    onClick={() => updateRecordEditDraft({ durationMinutes: recordEditDraft.durationMinutes + 5 })}
                    aria-label="독서 시간 5분 늘리기"
                  >
                    <Icon name="plus" className="h-4 w-4" />
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                <label className="field-label" htmlFor="record-sentence-page">
                  문장 페이지
                  <input
                    id="record-sentence-page"
                    className="pixel-input"
                    type="text"
                    inputMode="numeric"
                    value={recordEditDraft.sentencePage}
                    onChange={(event) => updateRecordEditDraft({ sentencePage: parsePageInput(event.target.value) })}
                  />
                </label>
                <textarea
                  className="min-h-28 w-full resize-none border-2 border-[#2F2A26] bg-[#FCFBF7] p-3 text-sm font-bold leading-relaxed outline-none focus:bg-[#FCFBF7]"
                  value={recordEditDraft.sentence}
                  onChange={(event) => updateRecordEditDraft({ sentence: event.target.value })}
                  placeholder="기록 문장"
                />
              </div>

              {recordEditError && <p className="border-2 border-[#2F2A26] bg-[#F4D8CF] p-2 text-xs font-black text-[#8A3F2D]">{recordEditError}</p>}

              <div className="grid grid-cols-2 gap-2">
                <button type="button" className="secondary-button min-h-11" onClick={closeRecordEditor} disabled={isRecordMutating}>
                  취소
                </button>
                <button type="submit" className="primary-button min-h-11" disabled={isRecordMutating}>
                  <Icon name="save" className="h-5 w-5" />
                  저장
                </button>
              </div>
            </form>
          </>
        )}
      </BottomSheetModal>

      <BottomSheetModal
        isOpen={Boolean(deleteRecord)}
        ariaLabel="독서 기록 삭제 확인"
        role="alertdialog"
        backdropClassName="modal-backdrop-top"
        panelClassName="max-w-[360px]"
      >
        {deleteRecord && (
          <>
            <div className="mb-3 flex items-center gap-2">
              <div className="grid h-10 w-10 place-items-center border-2 border-[#2F2A26] bg-[#B58A7A] text-[#FFFDF8]">
                <Icon name="trash" className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-lg font-black">기록 삭제</h2>
                <p className="text-xs font-black text-stone-500">삭제한 독서 기록은 되돌릴 수 없습니다.</p>
              </div>
            </div>
            <div className="mb-4 border-2 border-[#2F2A26] bg-[#FCFBF7] p-3">
              <p className="truncate text-sm font-black">{deleteRecord.bookTitle}</p>
              <p className="mt-2 text-xs font-black text-stone-500">
                {deleteRecord.date} · {deleteRecord.startPage}p → {deleteRecord.endPage}p · {formatDuration(deleteRecord.durationSeconds)}
              </p>
              {deleteRecord.sentence && <p className="mt-3 line-clamp-3 border-l-4 border-[#5F6D57] bg-[#F3E8D0] p-2 text-xs font-bold">{deleteRecord.sentence}</p>}
            </div>
            {recordEditError && <p className="mb-3 border-2 border-[#2F2A26] bg-[#F4D8CF] p-2 text-xs font-black text-[#8A3F2D]">{recordEditError}</p>}
            <div className="grid grid-cols-2 gap-2">
              <button type="button" className="secondary-button" onClick={() => setDeleteRecordId(null)} disabled={isRecordMutating}>
                취소
              </button>
              <button type="button" className="danger-button" onClick={confirmDeleteRecord} disabled={isRecordMutating}>
                <Icon name="trash" className="h-5 w-5" />
                삭제
              </button>
            </div>
          </>
        )}
      </BottomSheetModal>
    </div>
  )
}
