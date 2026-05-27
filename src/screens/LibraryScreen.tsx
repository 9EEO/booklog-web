import { useMemo, useState } from 'react'
import { Icon } from '../components/Icon'
import { MiniBook } from '../components/MiniBook'
import { PixelCard } from '../components/PixelCard'
import { hasKakaoBookApiKey, searchKakaoBooks } from '../services/kakaoBooks'
import type { Book, BookSearchResult, NewBookInput, ReadingRecord } from '../types/reading'
import { formatDuration } from '../utils/formatDuration'
import { parsePageInput } from '../utils/pageInput'

type LibraryScreenProps = {
  books: Book[]
  records: ReadingRecord[]
  onAddBook: (input: NewBookInput) => Promise<string>
  onAddSentence: (bookId: string, text: string, page: number) => Promise<void>
  onUpdateSentence: (bookId: string, sentenceId: string, text: string, page: number) => Promise<void>
  onDeleteSentence: (bookId: string, sentenceId: string) => Promise<void>
  onDeleteBook: (bookId: string) => Promise<void>
  onUpdateBookPage: (bookId: string, page: number) => Promise<void>
  shouldOpenBookForm: boolean
}

const emptyNewBook: NewBookInput = {
  title: '',
  author: '',
  totalPages: 240,
  currentPage: 1,
  status: 'reading',
}

type SearchStatus = 'idle' | 'loading' | 'success' | 'empty' | 'error'

const todayLabel = () =>
  new Intl.DateTimeFormat('ko-KR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
    .format(new Date())
    .replace(/\.\s?/g, '.')
    .replace(/\.$/, '')

const parseReadingDate = (value: string) => {
  const matched = value.trim().match(/^(\d{4})(?:[.-]?)(\d{2})(?:[.-]?)(\d{2})$/)

  if (!matched) return null

  const [, yearText, monthText, dayText] = matched
  const year = Number(yearText)
  const month = Number(monthText)
  const day = Number(dayText)
  const date = new Date(year, month - 1, day)
  const isValid = date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day

  if (!isValid) return null

  return `${yearText}.${monthText}.${dayText}`
}

const toDateInputValue = (value: string) => parseReadingDate(value)?.replace(/\./g, '-') ?? ''

const toDateTime = (dateLabel: string) => {
  const [year, month, day] = dateLabel.split('.').map(Number)

  return new Date(year, month - 1, day).getTime()
}

export const LibraryScreen = ({ books, records, onAddBook, onAddSentence, onUpdateSentence, onDeleteSentence, onDeleteBook, onUpdateBookPage, shouldOpenBookForm }: LibraryScreenProps) => {
  const [selectedBookId, setSelectedBookId] = useState<string | null>(null)
  const [editingSentenceId, setEditingSentenceId] = useState<string | null>(null)
  const [isAddingSentence, setIsAddingSentence] = useState(false)
  const [isBookFormOpen, setIsBookFormOpen] = useState(shouldOpenBookForm)
  const [deleteSentenceId, setDeleteSentenceId] = useState<string | null>(null)
  const [deleteBookId, setDeleteBookId] = useState<string | null>(null)
  const [sentenceSort, setSentenceSort] = useState<'created' | 'page'>('created')
  const [draftSentence, setDraftSentence] = useState('')
  const [draftPage, setDraftPage] = useState(1)
  const [currentPageDraft, setCurrentPageDraft] = useState(1)
  const [newBook, setNewBook] = useState<NewBookInput>(emptyNewBook)
  const [bookSearchQuery, setBookSearchQuery] = useState('')
  const [bookSearchStatus, setBookSearchStatus] = useState<SearchStatus>('idle')
  const [bookSearchMessage, setBookSearchMessage] = useState('')
  const [bookSearchResults, setBookSearchResults] = useState<BookSearchResult[]>([])
  const [bookDateError, setBookDateError] = useState('')
  const [isMutating, setIsMutating] = useState(false)
  const selectedBook = selectedBookId ? books.find((book) => book.id === selectedBookId) : null
  const deleteSentence = selectedBook?.sentences.find((sentence) => sentence.id === deleteSentenceId)
  const deleteBook = deleteBookId ? books.find((book) => book.id === deleteBookId) : null
  const readingBooks = books.filter((book) => book.status === 'reading')
  const completedBooks = books.filter((book) => book.status === 'completed')
  const selectedBookRecords = useMemo(() => {
    if (!selectedBook) return []

    return records.filter((record) => record.bookId === selectedBook.id)
  }, [records, selectedBook])
  const selectedBookStats = useMemo(() => {
    if (!selectedBook) {
      return {
        progress: 0,
        remainingPages: 0,
        recordedPages: 0,
        recordedSeconds: 0,
        averagePagesPerHour: 0,
        estimatedSecondsLeft: 0,
      }
    }

    const progress = Math.round((selectedBook.currentPage / selectedBook.totalPages) * 100)
    const remainingPages = Math.max(selectedBook.totalPages - selectedBook.currentPage, 0)
    const recordedPages = selectedBookRecords.reduce((sum, record) => sum + Math.max(record.endPage - record.startPage, 0), 0)
    const recordedSeconds = selectedBookRecords.reduce((sum, record) => sum + record.durationSeconds, 0)
    const averagePagesPerHour = recordedSeconds > 0 ? Math.round((recordedPages / recordedSeconds) * 3600) : 0
    const estimatedSecondsLeft = averagePagesPerHour > 0 ? Math.round((remainingPages / averagePagesPerHour) * 3600) : 0

    return {
      progress,
      remainingPages,
      recordedPages,
      recordedSeconds,
      averagePagesPerHour,
      estimatedSecondsLeft,
    }
  }, [selectedBook, selectedBookRecords])
  const recentBookRecords = useMemo(() => selectedBookRecords.slice(0, 3), [selectedBookRecords])
  const sortedSentences = useMemo(() => {
    if (!selectedBook) return []

    if (sentenceSort === 'created') {
      return selectedBook.sentences
    }

    return selectedBook.sentences
      .map((sentence, index) => ({ sentence, index }))
      .sort((left, right) => left.sentence.page - right.sentence.page || left.index - right.index)
      .map(({ sentence }) => sentence)
  }, [selectedBook, sentenceSort])

  const selectBook = (bookId: string) => {
    const book = books.find((item) => item.id === bookId)

    setSelectedBookId(bookId)
    setCurrentPageDraft(book?.currentPage ?? 1)
  }

  const closeDetail = () => {
    setSelectedBookId(null)
    setEditingSentenceId(null)
    setIsAddingSentence(false)
    setDeleteSentenceId(null)
    setDeleteBookId(null)
  }

  const startEdit = (sentenceId: string, text: string, page: number) => {
    setIsAddingSentence(false)
    setEditingSentenceId(sentenceId)
    setDraftSentence(text)
    setDraftPage(page)
  }

  const startAdd = () => {
    if (!selectedBook) return

    setEditingSentenceId(null)
    setIsAddingSentence(true)
    setDraftSentence('')
    setDraftPage(selectedBook.currentPage)
  }

  const cancelDraft = () => {
    setEditingSentenceId(null)
    setIsAddingSentence(false)
    setDraftSentence('')
  }

  const saveEdit = async () => {
    if (!selectedBook || !editingSentenceId || draftSentence.trim().length === 0) return
    if (isMutating) return

    setIsMutating(true)

    try {
      await onUpdateSentence(selectedBook.id, editingSentenceId, draftSentence, draftPage)
      setEditingSentenceId(null)
    } finally {
      setIsMutating(false)
    }
  }

  const saveAdd = async () => {
    if (!selectedBook || draftSentence.trim().length === 0) return
    if (isMutating) return

    setIsMutating(true)

    try {
      await onAddSentence(selectedBook.id, draftSentence, draftPage)
      setIsAddingSentence(false)
      setDraftSentence('')
    } finally {
      setIsMutating(false)
    }
  }

  const saveCurrentPage = async () => {
    if (!selectedBook) return
    if (isMutating) return

    const nextPage = Math.min(Math.max(Math.floor(currentPageDraft) || 1, 1), selectedBook.totalPages)

    setIsMutating(true)

    try {
      setCurrentPageDraft(nextPage)
      await onUpdateBookPage(selectedBook.id, nextPage)
    } finally {
      setIsMutating(false)
    }
  }

  const confirmDelete = async () => {
    if (!selectedBook || !deleteSentenceId) return
    if (isMutating) return

    setIsMutating(true)

    try {
      await onDeleteSentence(selectedBook.id, deleteSentenceId)
      setDeleteSentenceId(null)
      if (editingSentenceId === deleteSentenceId) {
        setEditingSentenceId(null)
      }
    } finally {
      setIsMutating(false)
    }
  }

  const confirmDeleteBook = async () => {
    if (!deleteBookId) return
    if (isMutating) return

    setIsMutating(true)

    try {
      await onDeleteBook(deleteBookId)
      setDeleteBookId(null)
      setSelectedBookId(null)
      setEditingSentenceId(null)
      setIsAddingSentence(false)
    } finally {
      setIsMutating(false)
    }
  }

  const closeBookForm = () => {
    setIsBookFormOpen(false)
    setNewBook(emptyNewBook)
    setBookSearchQuery('')
    setBookSearchStatus('idle')
    setBookSearchMessage('')
    setBookSearchResults([])
    setBookDateError('')
  }

  const saveBook = async () => {
    if (newBook.title.trim().length === 0) return
    if (isMutating) return

    const totalPages = Math.max(Math.floor(newBook.totalPages) || 1, 1)
    const currentPage = newBook.status === 'completed' ? totalPages : Math.min(Math.max(Math.floor(newBook.currentPage) || 1, 1), totalPages)
    const startedAt = newBook.startedAt?.trim() ? parseReadingDate(newBook.startedAt) : undefined
    const completedAt = newBook.status === 'completed' ? parseReadingDate(newBook.completedAt?.trim() || todayLabel()) : undefined

    if (newBook.startedAt?.trim() && !startedAt) {
      setBookDateError('시작일을 올바른 날짜로 선택해 주세요.')
      return
    }

    if (newBook.status === 'completed' && !completedAt) {
      setBookDateError('완독일을 올바른 날짜로 선택해 주세요.')
      return
    }

    if (startedAt && completedAt && toDateTime(startedAt) > toDateTime(completedAt)) {
      setBookDateError('시작일은 완독일보다 늦을 수 없습니다.')
      return
    }

    setIsMutating(true)

    try {
      const newBookId = await onAddBook({
        ...newBook,
        totalPages,
        currentPage,
        startedAt: startedAt ?? undefined,
        completedAt: completedAt ?? undefined,
      })

      setSelectedBookId(newBookId)
      setCurrentPageDraft(currentPage)
      closeBookForm()
    } finally {
      setIsMutating(false)
    }
  }

  const submitBookSearch = async () => {
    if (!hasKakaoBookApiKey) {
      setBookSearchStatus('error')
      setBookSearchMessage('.env에 VITE_KAKAO_REST_API_KEY를 설정하면 검색을 사용할 수 있습니다.')
      return
    }

    if (bookSearchQuery.trim().length === 0) {
      setBookSearchStatus('error')
      setBookSearchMessage('검색어를 입력해 주세요.')
      return
    }

    setBookSearchStatus('loading')
    setBookSearchMessage('')

    try {
      const results = await searchKakaoBooks(bookSearchQuery)
      setBookSearchResults(results)
      setBookSearchStatus(results.length > 0 ? 'success' : 'empty')
      setBookSearchMessage(results.length > 0 ? '' : '검색 결과가 없습니다.')
    } catch {
      setBookSearchResults([])
      setBookSearchStatus('error')
      setBookSearchMessage('책 검색에 실패했습니다. 잠시 후 다시 시도해 주세요.')
    }
  }

  const selectSearchResult = (book: BookSearchResult) => {
    setNewBook((current) => ({
      ...current,
      title: book.title,
      author: book.authors.join(', ') || current.author,
      thumbnail: book.thumbnail,
    }))
  }

  return (
    <div className="space-y-4">
      <header className="flex items-center justify-between gap-3">
        <div>
          <p className="pixel-label">MY LIBRARY</p>
          <h1 className="mt-1 text-2xl font-black">서재</h1>
        </div>
        <button type="button" className="icon-button" onClick={() => setIsBookFormOpen(true)} aria-label="새 책 추가">
          <Icon name="plus" className="h-5 w-5" />
        </button>
      </header>

      <div className="space-y-5">
        <BookShelfSection title="독서중인 책" count={readingBooks.length} tone="reading" books={readingBooks} onSelectBook={selectBook} />
        <BookShelfSection title="완독한 책" count={completedBooks.length} tone="completed" books={completedBooks} onSelectBook={selectBook} />
      </div>

      {selectedBook && (
        <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label="책 상세">
          <div className="modal-panel book-detail-panel">
            <div className="book-detail-header flex items-center justify-between gap-3">
              <MiniBook book={selectedBook} />
              <button type="button" className="icon-button" onClick={closeDetail} aria-label="닫기">
                <Icon name="close" className="h-5 w-5" />
              </button>
            </div>

            <div className="book-detail-body">
              <div className="mb-4 border-2 border-[#2F2A26] bg-[#F3E8D0] p-3">
              <div className="mb-2 flex items-center justify-between gap-3">
                <p className="text-xs font-black text-stone-600">현재 페이지</p>
                <p className="text-xs font-black text-[#5F6D57]">
                  {selectedBook.currentPage}/{selectedBook.totalPages}p
                </p>
              </div>
              <div className="grid grid-cols-[1fr_auto] gap-2">
                <input
                  className="pixel-input"
                  type="text"
                  inputMode="numeric"
                  min={1}
                  max={selectedBook.totalPages}
                  value={currentPageDraft}
                  onChange={(event) => setCurrentPageDraft(parsePageInput(event.target.value))}
                  aria-label="현재 페이지"
                />
                <button type="button" className="primary-button px-3" onClick={saveCurrentPage} disabled={currentPageDraft === selectedBook.currentPage}>
                  저장
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 text-sm font-black">
              <div className="detail-box">
                <span>진행률</span>
                <strong>{selectedBookStats.progress}%</strong>
              </div>
              <div className="detail-box">
                <span>누적 시간</span>
                <strong>{formatDuration(selectedBook.accumulatedSeconds)}</strong>
              </div>
              <div className="detail-box">
                <span>남은 페이지</span>
                <strong>{selectedBookStats.remainingPages}p</strong>
              </div>
              <div className="detail-box">
                <span>평균 속도</span>
                <strong>{selectedBookStats.averagePagesPerHour > 0 ? `${selectedBookStats.averagePagesPerHour}p/h` : '-'}</strong>
              </div>
              <div className="detail-box">
                <span>예상 남은 시간</span>
                <strong>{selectedBookStats.estimatedSecondsLeft > 0 ? formatDuration(selectedBookStats.estimatedSecondsLeft) : '-'}</strong>
              </div>
              <div className="detail-box">
                <span>독서 기록</span>
                <strong>{selectedBookRecords.length}회</strong>
              </div>
            </div>

            <div className="mt-3 grid grid-cols-2 gap-2 text-sm font-black">
              <div className="detail-box">
                <span>시작일</span>
                <strong>{selectedBook.startedAt}</strong>
              </div>
              <div className="detail-box">
                <span>완독일</span>
                <strong>{selectedBook.completedAt ?? '-'}</strong>
              </div>
            </div>

            <div className="mt-5">
              <div className="mb-3 flex items-center justify-between gap-3">
                <h2 className="text-lg font-black">최근 독서 기록</h2>
                <span className="text-xs font-black text-stone-500">{selectedBookStats.recordedPages}p 기록</span>
              </div>
              {recentBookRecords.length === 0 ? (
                <p className="border-2 border-[#2F2A26] bg-[#F3E8D0] p-3 text-sm font-black text-stone-600">아직 이 책의 독서 기록이 없습니다.</p>
              ) : (
                <div className="space-y-2">
                  {recentBookRecords.map((record) => (
                    <div key={record.id} className="border-2 border-[#2F2A26] bg-[#FCFBF7] p-3">
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-sm font-black">{record.date}</p>
                        <span className="border-2 border-[#2F2A26] bg-[#2F2A26] px-2 py-1 text-xs font-black leading-none text-[#FFFDF8]">
                          {formatDuration(record.durationSeconds)}
                        </span>
                      </div>
                      <p className="mt-2 text-xs font-black text-stone-500">
                        {record.startPage}p → {record.endPage}p
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="mt-5 flex items-center justify-between gap-3">
              <h2 className="text-lg font-black">기록한 문장</h2>
              <button type="button" className="mini-icon-button" onClick={startAdd} aria-label="문장 추가">
                <Icon name="plus" className="h-4 w-4" />
              </button>
            </div>
            {selectedBook.sentences.length > 1 && (
              <div className="mt-3 grid grid-cols-2 border-2 border-[#2F2A26] bg-[#FCFBF7] text-xs font-black">
                <button
                  type="button"
                  className={`px-3 py-2 ${sentenceSort === 'created' ? 'bg-[#87937A] text-[#FFFDF8]' : 'bg-[#FCFBF7] text-stone-700'}`}
                  onClick={() => setSentenceSort('created')}
                >
                  등록순
                </button>
                <button
                  type="button"
                  className={`border-l-2 border-[#2F2A26] px-3 py-2 ${sentenceSort === 'page' ? 'bg-[#87937A] text-[#FFFDF8]' : 'bg-[#FCFBF7] text-stone-700'}`}
                  onClick={() => setSentenceSort('page')}
                >
                  페이지순
                </button>
              </div>
            )}
            <div className="mt-3 space-y-2">
              {isAddingSentence && (
                <div className="border-2 border-[#2F2A26] bg-[#FCFBF7] p-3">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between gap-2">
                      <label className="text-xs font-black text-stone-600" htmlFor="new-sentence-page">
                        페이지
                      </label>
                      <input
                        id="new-sentence-page"
                        className="w-20 border-2 border-[#2F2A26] bg-[#F3E8D0] px-2 py-1 text-right text-sm font-black outline-none focus:bg-[#FCFBF7]"
                        type="text"
                        inputMode="numeric"
                        min={1}
                        max={selectedBook.totalPages}
                        value={draftPage}
                        onChange={(event) => setDraftPage(parsePageInput(event.target.value))}
                      />
                    </div>
                    <textarea
                      className="min-h-24 w-full resize-none border-2 border-[#2F2A26] bg-[#FCFBF7] p-2 text-sm font-bold leading-relaxed outline-none focus:bg-[#FCFBF7]"
                      placeholder="기억에 남는 문장을 남겨보세요."
                      value={draftSentence}
                      onChange={(event) => setDraftSentence(event.target.value)}
                    />
                    <div className="grid grid-cols-2 gap-2">
                      <button type="button" className="secondary-button min-h-10 text-xs" onClick={cancelDraft}>
                        취소
                      </button>
                      <button type="button" className="primary-button min-h-10 text-xs" onClick={saveAdd} disabled={draftSentence.trim().length === 0}>
                        <Icon name="save" className="h-4 w-4" />
                        추가
                      </button>
                    </div>
                  </div>
                </div>
              )}
              {selectedBook.sentences.length === 0 && !isAddingSentence ? (
                <p className="border-2 border-[#2F2A26] bg-[#F3E8D0] p-3 text-sm font-black text-stone-600">아직 기록한 문장이 없습니다.</p>
              ) : (
                sortedSentences.map((sentence) => {
                  const isEditing = editingSentenceId === sentence.id

                  return (
                    <div key={sentence.id} className="border-2 border-[#2F2A26] bg-[#FCFBF7] p-3">
                      {isEditing ? (
                        <div className="space-y-3">
                          <div className="flex items-center justify-between gap-2">
                            <label className="text-xs font-black text-stone-600" htmlFor={`sentence-page-${sentence.id}`}>
                              페이지
                            </label>
                            <input
                              id={`sentence-page-${sentence.id}`}
                              className="w-20 border-2 border-[#2F2A26] bg-[#F3E8D0] px-2 py-1 text-right text-sm font-black outline-none focus:bg-[#FCFBF7]"
                              type="text"
                              inputMode="numeric"
                              min={1}
                              max={selectedBook.totalPages}
                              value={draftPage}
                              onChange={(event) => setDraftPage(parsePageInput(event.target.value))}
                            />
                          </div>
                          <textarea
                            className="min-h-24 w-full resize-none border-2 border-[#2F2A26] bg-[#FCFBF7] p-2 text-sm font-bold leading-relaxed outline-none focus:bg-[#FCFBF7]"
                            value={draftSentence}
                            onChange={(event) => setDraftSentence(event.target.value)}
                          />
                          <div className="grid grid-cols-2 gap-2">
                            <button type="button" className="secondary-button min-h-10 text-xs" onClick={cancelDraft}>
                              취소
                            </button>
                            <button type="button" className="primary-button min-h-10 text-xs" onClick={saveEdit} disabled={draftSentence.trim().length === 0}>
                              <Icon name="save" className="h-4 w-4" />
                              저장
                            </button>
                          </div>
                        </div>
                      ) : (
                        <>
                          <div className="mb-2 flex items-start justify-between gap-2">
                            <span className="border-2 border-[#2F2A26] bg-[#DCE3D2] px-2 py-1 text-xs font-black text-stone-900">{sentence.page}p</span>
                            <div className="flex shrink-0 gap-1">
                              <button type="button" className="mini-icon-button" onClick={() => startEdit(sentence.id, sentence.text, sentence.page)} aria-label="문장 수정">
                                <Icon name="edit" className="h-4 w-4" />
                              </button>
                              <button type="button" className="mini-icon-button bg-[#B58A7A] text-[#FFFDF8]" onClick={() => setDeleteSentenceId(sentence.id)} aria-label="문장 삭제">
                                <Icon name="trash" className="h-4 w-4" />
                              </button>
                            </div>
                          </div>
                          <blockquote className="text-sm font-bold leading-relaxed">
                            {sentence.text}
                            <span className="mt-2 block text-xs font-black text-stone-500">{sentence.recordedAt}</span>
                          </blockquote>
                        </>
                      )}
                    </div>
                  )
                })
              )}
            </div>
              <div className="mt-6 flex flex-col items-end gap-2 border-t-2 border-dashed border-stone-400 pt-4">
                <button
                  type="button"
                  className="inline-flex min-h-9 items-center gap-1 border-2 border-[#2F2A26] bg-[#FCFBF7] px-3 py-2 text-xs font-black text-[#9D6655] shadow-[2px_2px_0_rgba(47,42,38,0.7)] disabled:cursor-not-allowed disabled:opacity-50"
                  onClick={() => setDeleteBookId(selectedBook.id)}
                  disabled={books.length <= 1}
                >
                  <Icon name="trash" className="h-4 w-4" />
                  책 삭제
                </button>
                {books.length <= 1 && <p className="text-right text-xs font-black text-stone-500">서재에는 최소 1권의 책이 필요합니다.</p>}
              </div>
            </div>
          </div>
        </div>
      )}

      {selectedBook && deleteSentence && (
        <div className="modal-backdrop modal-backdrop-top" role="alertdialog" aria-modal="true" aria-label="문장 삭제 확인">
          <div className="w-full max-w-[360px] border-2 border-[#2F2A26] bg-[#FCFBF7] p-4 shadow-[4px_4px_0_rgba(47,42,38,0.82)]">
            <div className="mb-3 flex items-center gap-2">
              <div className="grid h-10 w-10 place-items-center border-2 border-[#2F2A26] bg-[#B58A7A] text-[#FFFDF8]">
                <Icon name="trash" className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-lg font-black">문장 삭제</h2>
                <p className="text-xs font-black text-stone-500">삭제한 문장은 되돌릴 수 없습니다.</p>
              </div>
            </div>
            <blockquote className="mb-4 max-h-28 overflow-y-auto border-2 border-[#2F2A26] bg-[#FCFBF7] p-3 text-sm font-bold leading-relaxed">
              {deleteSentence.text}
              <span className="mt-2 block text-xs font-black text-stone-500">{deleteSentence.page}p</span>
            </blockquote>
            <div className="grid grid-cols-2 gap-2">
              <button type="button" className="secondary-button" onClick={() => setDeleteSentenceId(null)}>
                취소
              </button>
              <button type="button" className="danger-button" onClick={confirmDelete}>
                <Icon name="trash" className="h-5 w-5" />
                삭제
              </button>
            </div>
          </div>
        </div>
      )}

      {deleteBook && (
        <div className="modal-backdrop modal-backdrop-top" role="alertdialog" aria-modal="true" aria-label="책 삭제 확인">
          <div className="w-full max-w-[360px] border-2 border-[#2F2A26] bg-[#FCFBF7] p-4 shadow-[4px_4px_0_rgba(47,42,38,0.82)]">
            <div className="mb-3 flex items-center gap-2">
              <div className="grid h-10 w-10 place-items-center border-2 border-[#2F2A26] bg-[#B58A7A] text-[#FFFDF8]">
                <Icon name="trash" className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-lg font-black">책 삭제</h2>
                <p className="text-xs font-black text-stone-500">서재와 기록한 문장에서 제거됩니다.</p>
              </div>
            </div>
            <div className="mb-4 border-2 border-[#2F2A26] bg-[#FCFBF7] p-3">
              <MiniBook book={deleteBook} />
              <p className="mt-3 text-xs font-black leading-relaxed text-[#B58A7A]">독서 세션 기록은 기록 탭에 그대로 남습니다.</p>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button type="button" className="secondary-button" onClick={() => setDeleteBookId(null)}>
                취소
              </button>
              <button type="button" className="danger-button" onClick={confirmDeleteBook}>
                <Icon name="trash" className="h-5 w-5" />
                삭제
              </button>
            </div>
          </div>
        </div>
      )}

      {isBookFormOpen && (
        <div className="modal-backdrop modal-backdrop-top" role="dialog" aria-modal="true" aria-label="새 책 추가">
          <div className="modal-panel">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <p className="pixel-label">NEW BOOK</p>
                <h2 className="mt-1 text-xl font-black">새 책 추가</h2>
              </div>
              <button type="button" className="icon-button" onClick={closeBookForm} aria-label="닫기">
                <Icon name="close" className="h-5 w-5" />
              </button>
            </div>

            <form
              className="mb-4 border-2 border-[#2F2A26] bg-[#FCFBF7] p-3"
              onSubmit={(event) => {
                event.preventDefault()
                void submitBookSearch()
              }}
            >
              <label className="field-label" htmlFor="book-search-query">
                카카오 책 검색
              </label>
              <div className="grid grid-cols-[1fr_auto] gap-2">
                <input
                  id="book-search-query"
                  className="pixel-input"
                  placeholder="제목, 저자, ISBN"
                  value={bookSearchQuery}
                  onChange={(event) => setBookSearchQuery(event.target.value)}
                />
                <button type="submit" className="primary-button px-3" disabled={bookSearchStatus === 'loading'}>
                  검색
                </button>
              </div>
              {!hasKakaoBookApiKey && (
                <p className="mt-2 text-xs font-black leading-relaxed text-[#B58A7A]">`.env`에 `VITE_KAKAO_REST_API_KEY`를 추가하면 검색을 사용할 수 있습니다.</p>
              )}
              {bookSearchMessage && <p className="mt-2 text-xs font-black leading-relaxed text-stone-600">{bookSearchMessage}</p>}
              {bookSearchResults.length > 0 && (
                <div className="mt-3 max-h-56 space-y-2 overflow-y-auto">
                  {bookSearchResults.map((book) => (
                    <button
                      key={book.id}
                      type="button"
                      className="w-full border-2 border-[#2F2A26] bg-[#F3E8D0] p-2 text-left"
                      onClick={() => selectSearchResult(book)}
                    >
                      <div className="flex gap-3">
                        {book.thumbnail ? (
                          <img className="h-16 w-11 shrink-0 border-2 border-[#2F2A26] object-cover" src={book.thumbnail} alt="" />
                        ) : (
                          <div className="h-16 w-11 shrink-0 border-2 border-[#2F2A26] bg-[#A97B5B]" />
                        )}
                        <div className="min-w-0">
                          <p className="truncate text-sm font-black text-stone-900">{book.title}</p>
                          <p className="mt-1 truncate text-xs font-bold text-stone-600">{book.authors.join(', ') || '저자 정보 없음'}</p>
                          <p className="mt-1 truncate text-[11px] font-black text-stone-500">{book.publisher || '출판사 정보 없음'}</p>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </form>

            <label className="field-label" htmlFor="new-book-title">
              책 제목
            </label>
            <input
              id="new-book-title"
              className="pixel-input"
              value={newBook.title}
              onChange={(event) => setNewBook((current) => ({ ...current, title: event.target.value }))}
            />

            <label className="field-label mt-3" htmlFor="new-book-author">
              저자
            </label>
            <input
              id="new-book-author"
              className="pixel-input"
              value={newBook.author}
              onChange={(event) => setNewBook((current) => ({ ...current, author: event.target.value }))}
            />

            <div className="mt-3">
              <p className="field-label">등록 상태</p>
              <div className="grid grid-cols-2 gap-2">
                {(['reading', 'completed'] as const).map((status) => (
                  <button
                    key={status}
                    type="button"
                    className={`border-2 border-[#2F2A26] px-3 py-2 text-sm font-black shadow-[3px_3px_0_rgba(47,42,38,0.82)] ${
                      newBook.status === status ? 'bg-[#87937A] text-[#FFFDF8]' : 'bg-[#FCFBF7] text-[#2F2A26]'
                    }`}
                    onClick={() => {
                      setNewBook((current) => ({
                        ...current,
                        status,
                        currentPage: status === 'completed' ? current.totalPages : Math.min(current.currentPage, current.totalPages),
                        startedAt: status === 'completed' ? current.startedAt : undefined,
                        completedAt: status === 'completed' ? current.completedAt ?? toDateInputValue(todayLabel()) : undefined,
                      }))
                      setBookDateError('')
                    }}
                  >
                    {status === 'reading' ? '읽는 중' : '완독함'}
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-3 grid grid-cols-2 gap-2">
              <div>
                <label className="field-label" htmlFor="new-book-total">
                  전체 페이지
                </label>
                <input
                  id="new-book-total"
                  className="pixel-input"
                  type="text"
                  inputMode="numeric"
                  min={1}
                  value={newBook.totalPages}
                  onChange={(event) =>
                    setNewBook((current) => {
                      const totalPages = parsePageInput(event.target.value)

                      return {
                        ...current,
                        totalPages,
                        currentPage: current.status === 'completed' ? totalPages : Math.min(current.currentPage, Math.max(totalPages, 1)),
                      }
                    })
                  }
                />
              </div>
              {newBook.status === 'reading' ? (
                <div>
                  <label className="field-label" htmlFor="new-book-current">
                    현재 페이지
                  </label>
                  <input
                    id="new-book-current"
                    className="pixel-input"
                    type="text"
                    inputMode="numeric"
                    min={1}
                    max={Math.max(newBook.totalPages, 1)}
                    value={newBook.currentPage}
                    onChange={(event) => setNewBook((current) => ({ ...current, currentPage: parsePageInput(event.target.value) }))}
                  />
                </div>
              ) : (
                <div>
                  <label className="field-label" htmlFor="new-book-completed-at">
                    완독일
                  </label>
                  <input
                    id="new-book-completed-at"
                    className="pixel-input"
                    type="date"
                    value={toDateInputValue(newBook.completedAt ?? todayLabel())}
                    onChange={(event) => {
                      setBookDateError('')
                      setNewBook((current) => ({ ...current, completedAt: event.target.value }))
                    }}
                  />
                </div>
              )}
            </div>

            {newBook.status === 'completed' && (
              <div className="mt-3 space-y-3">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="field-label" htmlFor="new-book-started-at">
                      시작일 선택
                    </label>
                    <input
                      id="new-book-started-at"
                      className="pixel-input"
                      type="date"
                      value={toDateInputValue(newBook.startedAt ?? '')}
                      onChange={(event) => {
                        setBookDateError('')
                        setNewBook((current) => ({ ...current, startedAt: event.target.value }))
                      }}
                    />
                  </div>
                  <div className="border-2 border-[#2F2A26] bg-[#FCFBF7] p-3 text-xs font-black leading-relaxed text-stone-600">
                    달력에서 날짜를 고를 수 있습니다. 시작일은 비워도 됩니다.
                  </div>
                </div>
                {bookDateError && <div className="border-2 border-[#2F2A26] bg-[#F4D8CF] p-3 text-xs font-black leading-relaxed text-[#8A3F2D]">{bookDateError}</div>}
                <div className="border-2 border-[#2F2A26] bg-[#F3E8D0] p-3 text-xs font-black leading-relaxed text-stone-700">
                  완독한 책은 현재 페이지가 전체 페이지로 저장되고, 독서중 책 선택 목록에서는 제외됩니다.
                </div>
              </div>
            )}

            <div className="mt-4 grid grid-cols-2 gap-2">
              <button type="button" className="secondary-button" onClick={closeBookForm}>
                취소
              </button>
              <button type="button" className="primary-button" onClick={saveBook} disabled={newBook.title.trim().length === 0}>
                <Icon name="save" className="h-5 w-5" />
                추가
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

type BookShelfSectionProps = {
  title: string
  count: number
  tone: 'reading' | 'completed'
  books: Book[]
  onSelectBook: (bookId: string) => void
}

const BookShelfSection = ({ title, count, tone, books, onSelectBook }: BookShelfSectionProps) => (
  <section className="space-y-3">
    <div className="flex items-center justify-between border-2 border-[#2F2A26] bg-[#F3E8D0] px-3 py-2 shadow-pixel">
      <div className="flex items-center gap-2">
        <span className={`grid h-7 w-7 place-items-center border-2 border-[#2F2A26] ${tone === 'reading' ? 'bg-[#87937A] text-[#FFFDF8]' : 'bg-[#2F2A26] text-[#FFFDF8]'}`}>
          <Icon name={tone === 'reading' ? 'book' : 'check'} className="h-4 w-4" />
        </span>
        <h2 className="text-base font-black">{title}</h2>
      </div>
      <span className="border-2 border-[#2F2A26] bg-[#FCFBF7] px-2 py-1 text-xs font-black">{count}권</span>
    </div>

    {books.length === 0 ? (
      <div className="border-2 border-dashed border-stone-500 bg-[#F3E8D0] p-4 text-center text-sm font-black text-stone-600">
        {tone === 'reading' ? '읽는 중인 책이 없습니다.' : '완독한 책이 없습니다.'}
      </div>
    ) : (
      <div className="grid gap-3">
        {books.map((book) => {
          const progress = Math.round((book.currentPage / book.totalPages) * 100)

          return (
            <button key={book.id} type="button" className="text-left" onClick={() => onSelectBook(book.id)}>
              <PixelCard className={tone === 'reading' ? 'bg-[#FCFBF7]' : 'bg-[#F3E8D0]'}>
                <div className="flex items-center justify-between gap-3">
                  <MiniBook book={book} />
                  <span className={`shrink-0 border-2 border-[#2F2A26] px-2 py-1 text-sm font-black ${tone === 'reading' ? 'bg-[#DCE3D2] text-[#5F6D57]' : 'bg-[#2F2A26] text-[#FFFDF8]'}`}>
                    {progress}%
                  </span>
                </div>
                <div className="mt-3 h-3 rounded-full border-2 border-[#2F2A26] bg-[#F3E8D0]">
                  <div className={tone === 'reading' ? 'h-full rounded-full bg-[#5F6D57]' : 'h-full rounded-full bg-[#2F2A26]'} style={{ width: `${progress}%` }} />
                </div>
              </PixelCard>
            </button>
          )
        })}
      </div>
    )}
  </section>
)
