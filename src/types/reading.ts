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
  totalPages: number
  currentPage: number
  startedAt: string
  completedAt?: string
  accumulatedSeconds: number
  status: BookStatus
  coverColor: string
  accentColor: string
  thumbnail?: string
  sentences: Highlight[]
  rounds?: ReadingRound[]
  activeRoundId?: string
  activeRoundNumber?: number
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
  totalPages: number
  currentPage: number
  status: BookStatus
  startedAt?: string
  completedAt?: string
  thumbnail?: string
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
