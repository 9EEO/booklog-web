export type TabKey = 'home' | 'session' | 'records' | 'library' | 'profile'

export type BookStatus = 'reading' | 'completed'

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
}

export type ReadingRecord = {
  id: string
  bookId: string
  bookTitle: string
  date: string
  durationSeconds: number
  startPage: number
  endPage: number
  sentence?: string
  sentencePage?: number
}

export type ReadingCompletionInput = {
  durationSeconds: number
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
