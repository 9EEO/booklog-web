import { useMemo, useState } from 'react'
import { Icon } from '../components/Icon'
import { PixelCard } from '../components/PixelCard'
import type { Book, ReadingRecord } from '../types/reading'
import { formatDuration } from '../utils/formatDuration'

type RecordScreenProps = {
  books: Book[]
  records: ReadingRecord[]
}

type RecordView = 'records' | 'sentences'
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

export const RecordScreen = ({ books, records }: RecordScreenProps) => {
  const [view, setView] = useState<RecordView>('records')
  const [recordBookFilter, setRecordBookFilter] = useState('all')
  const [recordSentenceFilter, setRecordSentenceFilter] = useState<RecordSentenceFilter>('all')
  const [bookFilter, setBookFilter] = useState('all')
  const [sentenceSort, setSentenceSort] = useState<SentenceSort>('recent')
  const [randomSentenceId, setRandomSentenceId] = useState<string | null>(null)

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

  const pickRandomSentence = () => {
    if (visibleSentences.length === 0) return

    const nextSentence = visibleSentences[Math.floor(Math.random() * visibleSentences.length)]
    setRandomSentenceId(nextSentence.id)
  }

  return (
    <div className="space-y-4">
      <header>
        <p className="pixel-label">READING LOG</p>
        <h1 className="mt-1 text-2xl font-black">기록</h1>
      </header>

      <div className="grid grid-cols-2 gap-2">
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
                              {record.startPage}p → {record.endPage}p
                            </p>
                          </div>
                          <time className="shrink-0 border-2 border-[#2F2A26] bg-[#2F2A26] px-2 py-1 text-xs font-black leading-none text-[#FFFDF8] shadow-[2px_2px_0_rgba(47,42,38,0.8)]">
                            {formatDuration(record.durationSeconds)}
                          </time>
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
    </div>
  )
}
