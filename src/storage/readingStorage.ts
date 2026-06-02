import type { Book, ReadingRecord, ReadingRound, TabKey } from '../types/reading'
import type { TimerStatus } from '../hooks/useReadingTimer'
import { createEmptyTierBoard, normalizeTierBoard, type TierBoard } from '../types/tier'

export type StoredReadingTimer = {
  elapsedSeconds: number
  targetSeconds: number
  status: TimerStatus
  startedAt?: number
  sessionStartedAt?: number
  baseElapsedSeconds?: number
}

export type ReadingStorageSnapshot = {
  books: Book[]
  records: ReadingRecord[]
  currentBookId: string
  dailyGoalSeconds: number
  weeklyGoalDays: number
  tierBoard: TierBoard
  readingTimer: StoredReadingTimer
}

export const defaultDailyGoalSeconds = 20 * 60
export const defaultWeeklyGoalDays = 5

export const readingStorageKeys = {
  activeTab: 'booklog-active-tab',
  dataOwnerUserId: 'booklog-data-owner-user-id',
  books: 'booklog-books',
  records: 'booklog-records',
  currentBookId: 'booklog-current-book-id',
  dailyGoalSeconds: 'booklog-daily-goal-seconds',
  weeklyGoalDays: 'booklog-weekly-goal-days',
  tierBoard: 'booklog-tier-board',
  readingTimer: 'booklog-reading-timer',
} as const

const tabKeys: TabKey[] = ['home', 'session', 'records', 'library', 'profile']

const readLocalStorage = <T,>(key: string, fallback: T): T => {
  if (typeof window === 'undefined') return fallback

  try {
    const storedValue = window.localStorage.getItem(key)

    return storedValue ? (JSON.parse(storedValue) as T) : fallback
  } catch {
    return fallback
  }
}

const writeLocalStorage = (key: string, value: unknown) => {
  try {
    window.localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // Storage can fail in private browsing or quota-limited environments.
  }
}

const normalizeStoredBook = (book: Book): Book => {
  const storedRounds = Array.isArray(book.rounds) ? book.rounds : []
  const fallbackRound: ReadingRound = {
    id: book.activeRoundId || `${book.id}-round-1`,
    bookId: book.id,
    roundNumber: book.activeRoundNumber ?? 1,
    status: book.status,
    currentPage: book.currentPage,
    startedAt: book.startedAt,
    completedAt: book.completedAt,
    accumulatedSeconds: book.accumulatedSeconds,
  }
  const rounds = storedRounds.length > 0 ? storedRounds : [fallbackRound]
  const activeRound =
    rounds.find((round) => round.id === book.activeRoundId) ??
    rounds.find((round) => round.status === 'reading') ??
    [...rounds].sort((left, right) => right.roundNumber - left.roundNumber)[0] ??
    fallbackRound

  return {
    ...book,
    currentPage: activeRound.currentPage,
    status: activeRound.status,
    accumulatedSeconds: activeRound.accumulatedSeconds,
    completedAt: activeRound.completedAt ?? book.completedAt,
    rounds,
    activeRoundId: activeRound.id,
    activeRoundNumber: activeRound.roundNumber,
  }
}

const normalizeStoredRecord = (record: ReadingRecord): ReadingRecord => ({
  ...record,
  roundNumber: record.roundNumber ?? 1,
})

export const getInitialActiveTab = (): TabKey => {
  if (typeof window === 'undefined') return 'home'

  const storedTab = window.sessionStorage.getItem(readingStorageKeys.activeTab)

  return tabKeys.includes(storedTab as TabKey) ? (storedTab as TabKey) : 'home'
}

export const saveActiveTab = (tab: TabKey) => {
  try {
    window.sessionStorage.setItem(readingStorageKeys.activeTab, tab)
  } catch {
    // Storage can fail in private browsing or quota-limited environments.
  }
}

export const getStoredDataOwnerUserId = () => {
  if (typeof window === 'undefined') return ''

  try {
    return window.localStorage.getItem(readingStorageKeys.dataOwnerUserId) ?? ''
  } catch {
    return ''
  }
}

export const saveDataOwnerUserId = (userId: string) => {
  try {
    window.localStorage.setItem(readingStorageKeys.dataOwnerUserId, userId)
  } catch {
    // Storage can fail in private browsing or quota-limited environments.
  }
}

export const getInitialBooks = () => {
  const storedBooks = readLocalStorage<Book[]>(readingStorageKeys.books, [])

  return Array.isArray(storedBooks) ? storedBooks.map(normalizeStoredBook) : []
}

export const saveBooks = (books: Book[]) => {
  writeLocalStorage(readingStorageKeys.books, books)
}

export const getInitialRecords = () => {
  const storedRecords = readLocalStorage<ReadingRecord[]>(readingStorageKeys.records, [])

  return Array.isArray(storedRecords) ? storedRecords.map(normalizeStoredRecord) : []
}

export const saveRecords = (records: ReadingRecord[]) => {
  writeLocalStorage(readingStorageKeys.records, records)
}

export const getInitialCurrentBookId = (books: Book[]) => {
  if (books.length === 0) return ''
  if (typeof window === 'undefined') return books.find((book) => book.status === 'reading')?.id ?? books[0].id

  const storedBookId = window.localStorage.getItem(readingStorageKeys.currentBookId)
  const fallbackBookId = books.find((book) => book.status === 'reading')?.id ?? books[0].id

  return storedBookId && books.some((book) => book.id === storedBookId) ? storedBookId : fallbackBookId
}

export const saveCurrentBookId = (bookId: string) => {
  try {
    window.localStorage.setItem(readingStorageKeys.currentBookId, bookId)
  } catch {
    // Storage can fail in private browsing or quota-limited environments.
  }
}

export const getInitialDailyGoalSeconds = () => {
  const storedGoal = readLocalStorage<number>(readingStorageKeys.dailyGoalSeconds, defaultDailyGoalSeconds)

  return Math.min(Math.max(Math.floor(storedGoal) || defaultDailyGoalSeconds, 5 * 60), 180 * 60)
}

export const saveDailyGoalSeconds = (seconds: number) => {
  writeLocalStorage(readingStorageKeys.dailyGoalSeconds, seconds)
}

export const getInitialWeeklyGoalDays = () => {
  const storedGoal = readLocalStorage<number>(readingStorageKeys.weeklyGoalDays, defaultWeeklyGoalDays)

  return Math.min(Math.max(Math.floor(storedGoal) || defaultWeeklyGoalDays, 1), 7)
}

export const saveWeeklyGoalDays = (days: number) => {
  writeLocalStorage(readingStorageKeys.weeklyGoalDays, days)
}

export const getInitialTierBoard = () => {
  return normalizeTierBoard(readLocalStorage<unknown>(readingStorageKeys.tierBoard, createEmptyTierBoard()))
}

export const saveTierBoard = (tierBoard: TierBoard) => {
  writeLocalStorage(readingStorageKeys.tierBoard, normalizeTierBoard(tierBoard))
}

export const getStoredReadingTimer = (initialTargetSeconds: number): StoredReadingTimer => {
  return readLocalStorage<StoredReadingTimer>(readingStorageKeys.readingTimer, {
    elapsedSeconds: 0,
    targetSeconds: initialTargetSeconds,
    status: 'idle',
  })
}

export const saveReadingTimer = (timer: StoredReadingTimer) => {
  writeLocalStorage(readingStorageKeys.readingTimer, timer)
}
