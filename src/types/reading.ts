export type TabKey = 'home' | 'session' | 'records' | 'library' | 'profile'

export type BookStatus = 'reading' | 'completed'

export type ReadingRound = {
  id: string
  bookId: string
  roundNumber: number
  status: BookStatus
  currentPage: number
  startedAt: string
  completedAt?: string
  accumulatedSeconds: number
}

export type Highlight = {
  id: string
  text: string
  page: number
  recordedAt: string
}

export type Book = {
  id: string
  title: string
  author: string
  totalPages: number | null
  currentPage: number
  startedAt: string
  completedAt?: string
  accumulatedSeconds: number
  status: BookStatus
  coverColor: string
  accentColor: string
  thumbnail?: string
  isbn?: string
  publisher?: string
  contents?: string
  libraryReference?: BookLibraryReference
  sentences: Highlight[]
  rounds?: ReadingRound[]
  activeRoundId?: string
  activeRoundNumber?: number
}

export type BookLibraryReference = {
  source: string
  title?: string
  summary: string
  contents?: string
  recommendedBooks: Array<{
    title: string
    author?: string
  }>
  nationalLibrary?: {
    source?: string
    title?: string
    author?: string
    isbn?: string
    setIsbn?: string
    publisher?: string
    edition?: string
    page?: string
    bookSize?: string
    form?: string
    subject?: string
    ebookYn?: string
    cipYn?: string
    coverUrl?: string
    tocUrl?: string
    introductionUrl?: string
    summaryUrl?: string
    inputDate?: string
    updateDate?: string
    syncedAt?: string
  }
  data4LibraryCheckedAt?: string
  nationalLibraryCheckedAt?: string
  syncedAt: string
}

export type ReadingRecord = {
  id: string
  bookId: string
  roundId?: string
  roundNumber?: number
  bookTitle: string
  date: string
  startedAt?: string
  endedAt?: string
  durationSeconds: number
  startPage: number
  endPage: number
  sentence?: string
  sentencePage?: number
}

export type ReadingCompletionInput = {
  durationSeconds: number
  startedAt?: string
  endedAt?: string
  endPage: number
  sentence?: string
  sentencePage?: number
}

export type ReadingRecordUpdateInput = {
  durationSeconds: number
  startPage: number
  endPage: number
  sentence?: string
  sentencePage?: number
}

export type NewBookInput = {
  title: string
  author: string
  totalPages: number | null
  currentPage: number
  status: BookStatus
  startedAt?: string
  completedAt?: string
  thumbnail?: string
  isbn?: string
  publisher?: string
  contents?: string
  libraryReference?: BookLibraryReference
}

export type BookSearchResult = {
  id: string
  title: string
  authors: string[]
  publisher: string
  isbn: string
  thumbnail?: string
  contents: string
}
