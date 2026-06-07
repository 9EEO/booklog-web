import { useEffect, useMemo, useState, type SetStateAction } from 'react'
import type { User } from '@supabase/supabase-js'
import { BottomTabs } from './components/BottomTabs'
import { useAuth } from './hooks/useAuth'
import { useReadingTimer } from './hooks/useReadingTimer'
import { AuthScreen } from './screens/AuthScreen'
import { HomeScreen } from './screens/HomeScreen'
import { LibraryScreen } from './screens/LibraryScreen'
import { ProfileScreen } from './screens/ProfileScreen'
import { RecordScreen } from './screens/RecordScreen'
import { SessionScreen } from './screens/SessionScreen'
import {
  createRemoteBook,
  createRemoteHighlight,
  createRemoteReadingRound,
  createRemoteRecord,
  deleteRemoteBook,
  deleteRemoteHighlight,
  deleteRemoteReadingRound,
  deleteRemoteRecord,
  deleteRemoteRecordsByRound,
  fetchReadingSnapshot,
  migrateLocalSnapshotToSupabase,
  saveReadingSettings,
  updateRemoteBook,
  updateRemoteHighlight,
  updateRemoteReadingRound,
  updateRemoteRecord,
} from './services/readingSync'
import {
  defaultDailyGoalSeconds,
  defaultWeeklyGoalDays,
  getInitialBooks,
  getInitialCurrentBookId,
  getInitialDailyGoalSeconds,
  getInitialRecords,
  getInitialTierBoard,
  getInitialWeeklyGoalDays,
  getStoredDataOwnerUserId,
  saveActiveTab,
  saveDataOwnerUserId,
  saveBooks,
  saveCurrentBookId,
  saveDailyGoalSeconds,
  saveRecords,
  saveTierBoard,
  saveWeeklyGoalDays,
} from './storage/readingStorage'
import type { Book, BookStatus, NewBookInput, ReadingCompletionInput, ReadingRecord, ReadingRecordUpdateInput, ReadingRound, TabKey } from './types/reading'
import { createEmptyTierBoard, normalizeTierBoard, type TierBoard } from './types/tier'
import { clampBookPage, isBookCompletedByPage } from './utils/bookPages'

const todayLabel = () =>
  new Intl.DateTimeFormat('ko-KR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
    .format(new Date())
    .replace(/\.\s?/g, '.')
    .replace(/\.$/, '')

const bookPalettes = [
  { coverColor: '#8a5a3c', accentColor: '#e8c48f' },
  { coverColor: '#6f7b45', accentColor: '#f2d7a0' },
  { coverColor: '#a76f4d', accentColor: '#f3c6a0' },
  { coverColor: '#b5895a', accentColor: '#f5e3bd' },
  { coverColor: '#5f6f52', accentColor: '#d7e09d' },
]

const clampNumber = (value: number, min: number, max: number) => Math.min(Math.max(Math.floor(value) || min, min), max)

const getErrorMessage = (error: unknown, fallbackMessage: string) => {
  if (error instanceof Error) return error.message
  if (typeof error === 'object' && error !== null && 'message' in error && typeof error.message === 'string') {
    return error.message
  }

  return fallbackMessage
}

const sortRecordsByRecent = (nextRecords: ReadingRecord[]) =>
  [...nextRecords].sort((left, right) => right.date.localeCompare(left.date) || right.id.localeCompare(left.id))

const addSecondsToIsoDate = (isoDate: string | undefined, seconds: number) => {
  if (!isoDate) return undefined

  const startedAt = new Date(isoDate)
  if (!Number.isFinite(startedAt.getTime())) return undefined

  return new Date(startedAt.getTime() + seconds * 1000).toISOString()
}

const findHighlightForRecord = (book: Book, record: ReadingRecord) => {
  if (!record.sentence) return undefined

  const sentencePage = record.sentencePage ?? record.endPage

  return book.sentences.find(
    (sentence) => sentence.text === record.sentence && sentence.page === sentencePage && sentence.recordedAt === record.date,
  )
}

const getBookRounds = (book: Book) => book.rounds ?? []

const getActiveRound = (book: Book) =>
  getBookRounds(book).find((round) => round.id === book.activeRoundId) ??
  getBookRounds(book).find((round) => round.status === 'reading') ??
  [...getBookRounds(book)].sort((left, right) => right.roundNumber - left.roundNumber)[0]

const getNextRoundNumber = (book: Book) => Math.max(0, ...getBookRounds(book).map((round) => round.roundNumber)) + 1

const applyActiveRoundToBook = (book: Book, round: ReadingRound): Book => {
  const rounds = getBookRounds(book).map((item) => (item.id === round.id ? round : item))
  const nextRounds = rounds.some((item) => item.id === round.id) ? rounds : [...rounds, round]
  const latestCompletedAt =
    [...nextRounds]
      .reverse()
      .find((item) => item.completedAt)?.completedAt ?? book.completedAt

  return {
    ...book,
    currentPage: round.currentPage,
    accumulatedSeconds: round.accumulatedSeconds,
    status: round.status,
    completedAt: round.completedAt ?? latestCompletedAt,
    rounds: nextRounds.sort((left, right) => left.roundNumber - right.roundNumber),
    activeRoundId: round.id,
    activeRoundNumber: round.roundNumber,
  }
}

const replaceBookRound = (book: Book, round: ReadingRound): Book => ({
  ...book,
  rounds: getBookRounds(book)
    .map((item) => (item.id === round.id ? round : item))
    .sort((left, right) => left.roundNumber - right.roundNumber),
})

const removeBookRound = (book: Book, roundId: string, nextActiveRound: ReadingRound): Book => {
  const nextRounds = getBookRounds(book).filter((round) => round.id !== roundId)
  const latestCompletedAt =
    [...nextRounds]
      .reverse()
      .find((round) => round.completedAt)?.completedAt ?? book.completedAt

  return {
    ...book,
    currentPage: nextActiveRound.currentPage,
    accumulatedSeconds: nextActiveRound.accumulatedSeconds,
    status: nextActiveRound.status,
    completedAt: nextActiveRound.completedAt ?? latestCompletedAt,
    rounds: nextRounds.sort((left, right) => left.roundNumber - right.roundNumber),
    activeRoundId: nextActiveRound.id,
    activeRoundNumber: nextActiveRound.roundNumber,
  }
}

function AuthenticatedApp({ user, onSignOut }: { user: User; onSignOut: () => Promise<void> }) {
  const [activeTab, setActiveTab] = useState<TabKey>('home')
  const [books, setBooks] = useState<Book[]>(getInitialBooks)
  const [records, setRecords] = useState<ReadingRecord[]>(getInitialRecords)
  const [currentBookId, setCurrentBookId] = useState(() => getInitialCurrentBookId(getInitialBooks()))
  const [dailyGoalSeconds, setDailyGoalSeconds] = useState(getInitialDailyGoalSeconds)
  const [weeklyGoalDays, setWeeklyGoalDays] = useState(getInitialWeeklyGoalDays)
  const [tierBoard, setTierBoard] = useState<TierBoard>(getInitialTierBoard)
  const [bookFormOpenRequest, setBookFormOpenRequest] = useState(0)
  const [isLibraryDetailMode, setIsLibraryDetailMode] = useState(false)
  const [isDataLoading, setIsDataLoading] = useState(true)
  const [syncError, setSyncError] = useState<string | null>(null)
  const readingTimer = useReadingTimer(15 * 60)
  const resetReadingTimer = readingTimer.reset

  const currentBook = useMemo(
    () => books.find((book) => book.id === currentBookId) ?? books[0] ?? null,
    [books, currentBookId],
  )

  const handleSyncFailure = (error: unknown, fallbackMessage: string) => {
    const message = getErrorMessage(error, fallbackMessage)
    setSyncError(message)
    throw new Error(message)
  }

  useEffect(() => {
    saveActiveTab(activeTab)
  }, [activeTab])

  useEffect(() => {
    let isMounted = true

    const loadSnapshot = async () => {
      setIsDataLoading(true)
      setSyncError(null)
      const localDataOwnerUserId = getStoredDataOwnerUserId()
      const isDifferentDataOwner = localDataOwnerUserId !== user.id

      if (isDifferentDataOwner) {
        resetReadingTimer()
      }

      try {
        const remoteSnapshot = await fetchReadingSnapshot(user.id)
        const localSnapshot = {
          books: getInitialBooks(),
          records: getInitialRecords(),
          currentBookId: getInitialCurrentBookId(getInitialBooks()),
          dailyGoalSeconds: getInitialDailyGoalSeconds(),
          weeklyGoalDays: getInitialWeeklyGoalDays(),
          tierBoard: getInitialTierBoard(),
        }

        const hasRemoteData =
          remoteSnapshot.books.length > 0 ||
          remoteSnapshot.records.length > 0 ||
          remoteSnapshot.currentBookId.length > 0 ||
          remoteSnapshot.dailyGoalSeconds !== defaultDailyGoalSeconds ||
          remoteSnapshot.weeklyGoalDays !== defaultWeeklyGoalDays ||
          Object.values(remoteSnapshot.tierBoard).some((bookIds) => bookIds.length > 0)

        const hasLocalData =
          localSnapshot.books.length > 0 ||
          localSnapshot.records.length > 0 ||
          localSnapshot.currentBookId.length > 0 ||
          localSnapshot.dailyGoalSeconds !== defaultDailyGoalSeconds ||
          localSnapshot.weeklyGoalDays !== defaultWeeklyGoalDays ||
          Object.values(localSnapshot.tierBoard).some((bookIds) => bookIds.length > 0)

        const nextSnapshot =
          !hasRemoteData && hasLocalData && localDataOwnerUserId === user.id
            ? await migrateLocalSnapshotToSupabase(user.id, localSnapshot, bookPalettes)
            : remoteSnapshot

        if (!isMounted) return

        setBooks(nextSnapshot.books)
        setRecords(nextSnapshot.records)
        setCurrentBookId(nextSnapshot.currentBookId || getInitialCurrentBookId(nextSnapshot.books))
        setDailyGoalSeconds(nextSnapshot.dailyGoalSeconds)
        setWeeklyGoalDays(nextSnapshot.weeklyGoalDays)
        setTierBoard(nextSnapshot.tierBoard)
        saveDataOwnerUserId(user.id)
      } catch (error) {
        if (!isMounted) return

        if (isDifferentDataOwner) {
          setBooks([])
          setRecords([])
          setCurrentBookId('')
          setDailyGoalSeconds(defaultDailyGoalSeconds)
          setWeeklyGoalDays(defaultWeeklyGoalDays)
          setTierBoard(createEmptyTierBoard())
        }
        setSyncError(getErrorMessage(error, '데이터를 불러오지 못했습니다.'))
      } finally {
        if (isMounted) {
          setIsDataLoading(false)
        }
      }
    }

    void loadSnapshot()

    return () => {
      isMounted = false
    }
  }, [resetReadingTimer, user.id])

  useEffect(() => {
    if (isDataLoading) return
    saveBooks(books)
  }, [books, isDataLoading])

  useEffect(() => {
    if (isDataLoading) return
    saveRecords(records)
  }, [isDataLoading, records])

  useEffect(() => {
    if (isDataLoading) return
    saveCurrentBookId(currentBookId)
  }, [currentBookId, isDataLoading])

  useEffect(() => {
    if (isDataLoading) return
    saveDailyGoalSeconds(dailyGoalSeconds)
  }, [dailyGoalSeconds, isDataLoading])

  useEffect(() => {
    if (isDataLoading) return
    saveWeeklyGoalDays(weeklyGoalDays)
  }, [isDataLoading, weeklyGoalDays])

  useEffect(() => {
    if (isDataLoading) return
    saveTierBoard(tierBoard)
  }, [isDataLoading, tierBoard])

  useEffect(() => {
    if (isDataLoading) return

    void saveReadingSettings(user.id, {
      currentBookId,
      dailyGoalSeconds,
      weeklyGoalDays,
      tierBoard,
    }).catch((error) => {
      setSyncError(getErrorMessage(error, '설정을 저장하지 못했습니다.'))
    })
  }, [currentBookId, dailyGoalSeconds, weeklyGoalDays, isDataLoading, tierBoard, user.id])

  const handleAdjustDailyGoal = (deltaSeconds: number) => {
    setDailyGoalSeconds((current) => Math.min(Math.max(current + deltaSeconds, 5 * 60), 180 * 60))
  }

  const handleAdjustWeeklyGoal = (deltaDays: number) => {
    setWeeklyGoalDays((current) => Math.min(Math.max(current + deltaDays, 1), 7))
  }

  const openBookFormFromHome = () => {
    setActiveTab('library')
    setBookFormOpenRequest((current) => current + 1)
  }

  const handleChangeTierBoard = (nextTierBoard: SetStateAction<TierBoard>) => {
    setTierBoard((current) => {
      const next = typeof nextTierBoard === 'function' ? nextTierBoard(current) : nextTierBoard

      return normalizeTierBoard(next)
    })
  }

  const handleSaveRecord = async (input: ReadingCompletionInput) => {
    if (!currentBook) return
    try {
      setSyncError(null)
      const activeRound = getActiveRound(currentBook)
      const date = todayLabel()
      const startPage = currentBook.currentPage
      const endPage = clampBookPage(input.endPage, currentBook.totalPages, startPage)
      const sentence = input.sentence?.trim()
      const sentencePage = input.sentencePage ? clampBookPage(input.sentencePage, currentBook.totalPages) : undefined

      const newRecord = await createRemoteRecord(user.id, {
        bookId: currentBook.id,
        roundId: activeRound?.id,
        roundNumber: activeRound?.roundNumber,
        bookTitle: currentBook.title,
        date,
        startedAt: input.startedAt,
        endedAt: input.endedAt,
        durationSeconds: input.durationSeconds,
        startPage,
        endPage,
        sentence: sentence || undefined,
        sentencePage,
      })

      const isCompleted = isBookCompletedByPage(endPage, currentBook.totalPages)
      const nextRoundStatus: BookStatus = isCompleted ? 'completed' : 'reading'
      const nextRound = activeRound
        ? {
            ...activeRound,
            currentPage: endPage,
            accumulatedSeconds: activeRound.accumulatedSeconds + input.durationSeconds,
            status: nextRoundStatus,
            completedAt: isCompleted ? date : activeRound.completedAt,
          }
        : null

      if (nextRound && !nextRound.id.includes('-round-')) {
        await updateRemoteReadingRound(nextRound.id, {
          currentPage: nextRound.currentPage,
          accumulatedSeconds: nextRound.accumulatedSeconds,
          status: nextRound.status,
          completedAt: nextRound.status === 'completed' ? nextRound.completedAt ?? date : null,
        })
      }

      await updateRemoteBook(currentBook.id, {
        currentPage: endPage,
        accumulatedSeconds: nextRound?.accumulatedSeconds ?? currentBook.accumulatedSeconds + input.durationSeconds,
        status: isCompleted ? 'completed' : 'reading',
        completedAt: isCompleted ? date : currentBook.completedAt ?? null,
      })

      const newHighlight = sentence
        ? await createRemoteHighlight(user.id, {
            bookId: currentBook.id,
            text: sentence,
            page: sentencePage ?? endPage,
            recordedAt: date,
          })
        : null

      setRecords((current) => [newRecord, ...current])
      setBooks((current) =>
        current.map((book) => {
          if (book.id !== currentBook.id) return book
          const nextBook = nextRound ? applyActiveRoundToBook(book, nextRound) : book

          return {
            ...nextBook,
            currentPage: endPage,
            accumulatedSeconds: nextRound?.accumulatedSeconds ?? book.accumulatedSeconds + input.durationSeconds,
            status: isCompleted ? 'completed' : 'reading',
            completedAt: isCompleted ? date : nextBook.completedAt,
            sentences: newHighlight ? [newHighlight, ...book.sentences] : book.sentences,
          }
        }),
      )

      setActiveTab('records')
    } catch (error) {
      handleSyncFailure(error, '독서 기록을 저장하지 못했습니다.')
    }
  }

  const handleUpdateRecord = async (recordId: string, input: ReadingRecordUpdateInput) => {
    const targetRecord = records.find((record) => record.id === recordId)
    if (!targetRecord) return

    const targetBook = books.find((book) => book.id === targetRecord.bookId)
    const targetRound =
      targetBook && targetRecord.roundId
        ? getBookRounds(targetBook).find((round) => round.id === targetRecord.roundId)
        : targetBook
          ? getBookRounds(targetBook).find((round) => round.roundNumber === (targetRecord.roundNumber ?? 1)) ?? getActiveRound(targetBook)
          : undefined
    const totalPages = targetBook?.totalPages ?? Math.max(targetRecord.endPage, input.endPage, 1)
    const startPage = clampNumber(input.startPage, 1, totalPages)
    const endPage = clampNumber(input.endPage, startPage, totalPages)
    const durationSeconds = Math.max(Math.floor(input.durationSeconds) || 60, 60)
    const sentence = input.sentence?.trim()
    const sentencePage = sentence ? clampNumber(input.sentencePage ?? endPage, 1, totalPages) : undefined
    const recalculatedEndedAt = addSecondsToIsoDate(targetRecord.startedAt, durationSeconds)

    try {
      setSyncError(null)
      const updatedRecord = await updateRemoteRecord(recordId, {
        startedAt: targetRecord.startedAt ?? null,
        endedAt: recalculatedEndedAt ?? targetRecord.endedAt ?? null,
        roundId: targetRecord.roundId ?? targetRound?.id ?? null,
        roundNumber: targetRecord.roundNumber ?? targetRound?.roundNumber ?? 1,
        durationSeconds,
        startPage,
        endPage,
        sentence: sentence || null,
        sentencePage: sentence ? sentencePage ?? endPage : null,
      })

      const targetHighlight = targetBook ? findHighlightForRecord(targetBook, targetRecord) : undefined
      const updatedHighlight =
        targetBook && sentence
          ? targetHighlight
            ? {
                ...targetHighlight,
                text: sentence,
                page: sentencePage ?? endPage,
              }
            : await createRemoteHighlight(user.id, {
                bookId: targetBook.id,
                text: sentence,
                page: sentencePage ?? endPage,
                recordedAt: updatedRecord.date,
              })
          : null
      const deletedHighlightId = !sentence && targetHighlight ? targetHighlight.id : null

      if (targetHighlight && sentence) {
        await updateRemoteHighlight(targetHighlight.id, {
          text: sentence,
          page: sentencePage ?? endPage,
        })
      }

      if (deletedHighlightId) {
        await deleteRemoteHighlight(deletedHighlightId)
      }

      const nextRecords = sortRecordsByRecent(records.map((record) => (record.id === recordId ? updatedRecord : record)))

      if (targetBook) {
        const durationDelta = updatedRecord.durationSeconds - targetRecord.durationSeconds
        const roundRecordFilter = (record: ReadingRecord) =>
          record.bookId === targetBook.id &&
          (targetRound?.id ? record.roundId === targetRound.id : (record.roundNumber ?? 1) === (targetRound?.roundNumber ?? updatedRecord.roundNumber ?? 1))
        const roundRecords = nextRecords.filter(roundRecordFilter)
        const maxRecordedPage = Math.max(updatedRecord.endPage, ...roundRecords.map((record) => record.endPage))
        const isActiveRound = Boolean(targetRound && targetRound.id === targetBook.activeRoundId)
        const nextRoundCurrentPage =
          targetRound && targetRound.currentPage === targetRecord.endPage
            ? clampBookPage(maxRecordedPage, targetBook.totalPages)
            : clampBookPage(Math.max(targetRound?.currentPage ?? targetBook.currentPage, updatedRecord.endPage), targetBook.totalPages)
        const nextCurrentPage = isActiveRound ? nextRoundCurrentPage : targetBook.currentPage
        const nextAccumulatedSeconds = Math.max((targetRound?.accumulatedSeconds ?? targetBook.accumulatedSeconds) + durationDelta, 0)
        const isCompleted = isBookCompletedByPage(nextCurrentPage, targetBook.totalPages)
        const nextRoundCompleted = isBookCompletedByPage(nextRoundCurrentPage, targetBook.totalPages)
        const nextRoundStatus: BookStatus = nextRoundCompleted ? 'completed' : 'reading'
        const nextRound = targetRound
          ? {
              ...targetRound,
              currentPage: nextRoundCurrentPage,
              accumulatedSeconds: nextAccumulatedSeconds,
              status: nextRoundStatus,
              completedAt: nextRoundCompleted ? targetRound.completedAt ?? updatedRecord.date : undefined,
            }
          : null

        if (nextRound && !nextRound.id.includes('-round-')) {
          await updateRemoteReadingRound(nextRound.id, {
            currentPage: nextRound.currentPage,
            accumulatedSeconds: nextRound.accumulatedSeconds,
            status: nextRound.status,
            completedAt: nextRound.status === 'completed' ? nextRound.completedAt ?? updatedRecord.date : null,
          })
        }

        if (isActiveRound) {
          await updateRemoteBook(targetBook.id, {
            currentPage: nextCurrentPage,
            accumulatedSeconds: nextAccumulatedSeconds,
            status: isCompleted ? 'completed' : 'reading',
            completedAt: isCompleted ? targetBook.completedAt ?? updatedRecord.date : targetBook.completedAt ?? null,
          })
        }

        setBooks((current) =>
          current.map((book) =>
            book.id === targetBook.id
              ? (() => {
                  const nextBook = nextRound ? (isActiveRound ? applyActiveRoundToBook(book, nextRound) : replaceBookRound(book, nextRound)) : book

                  return {
                    ...nextBook,
                    sentences: updatedHighlight
                      ? book.sentences.some((sentenceItem) => sentenceItem.id === updatedHighlight.id)
                        ? book.sentences.map((sentenceItem) => (sentenceItem.id === updatedHighlight.id ? updatedHighlight : sentenceItem))
                        : [updatedHighlight, ...book.sentences]
                      : deletedHighlightId
                        ? book.sentences.filter((sentenceItem) => sentenceItem.id !== deletedHighlightId)
                        : book.sentences,
                  }
                })()
              : book,
          ),
        )
      }

      setRecords(nextRecords)
    } catch (error) {
      handleSyncFailure(error, '독서 기록을 수정하지 못했습니다.')
    }
  }

  const handleDeleteRecord = async (recordId: string) => {
    const targetRecord = records.find((record) => record.id === recordId)
    if (!targetRecord) return

    const targetBook = books.find((book) => book.id === targetRecord.bookId)
    const targetRound =
      targetBook && targetRecord.roundId
        ? getBookRounds(targetBook).find((round) => round.id === targetRecord.roundId)
        : targetBook
          ? getBookRounds(targetBook).find((round) => round.roundNumber === (targetRecord.roundNumber ?? 1)) ?? getActiveRound(targetBook)
          : undefined

    try {
      setSyncError(null)
      await deleteRemoteRecord(recordId)

      const targetHighlight = targetBook ? findHighlightForRecord(targetBook, targetRecord) : undefined
      if (targetHighlight) {
        await deleteRemoteHighlight(targetHighlight.id)
      }

      const nextRecords = records.filter((record) => record.id !== recordId)

      if (targetBook) {
        const remainingBookRecords = nextRecords.filter(
          (record) =>
            record.bookId === targetBook.id &&
            (targetRound?.id ? record.roundId === targetRound.id : (record.roundNumber ?? 1) === (targetRound?.roundNumber ?? 1)),
        )
        const fallbackPage = Math.max(targetRecord.startPage, ...remainingBookRecords.map((record) => record.endPage), 1)
        const isActiveRound = Boolean(targetRound && targetRound.id === targetBook.activeRoundId)
        const nextRoundCurrentPage =
          targetRound?.currentPage === targetRecord.endPage ? clampBookPage(fallbackPage, targetBook.totalPages) : (targetRound?.currentPage ?? targetBook.currentPage)
        const nextCurrentPage = isActiveRound ? nextRoundCurrentPage : targetBook.currentPage
        const nextAccumulatedSeconds = Math.max((targetRound?.accumulatedSeconds ?? targetBook.accumulatedSeconds) - targetRecord.durationSeconds, 0)
        const isCompleted = isBookCompletedByPage(nextCurrentPage, targetBook.totalPages)
        const nextRoundCompleted = isBookCompletedByPage(nextRoundCurrentPage, targetBook.totalPages)
        const nextRoundStatus: BookStatus = nextRoundCompleted ? 'completed' : 'reading'
        const nextRound = targetRound
          ? {
              ...targetRound,
              currentPage: nextRoundCurrentPage,
              accumulatedSeconds: nextAccumulatedSeconds,
              status: nextRoundStatus,
              completedAt: nextRoundCompleted ? targetRound.completedAt ?? targetRecord.date : undefined,
            }
          : null

        if (nextRound && !nextRound.id.includes('-round-')) {
          await updateRemoteReadingRound(nextRound.id, {
            currentPage: nextRound.currentPage,
            accumulatedSeconds: nextRound.accumulatedSeconds,
            status: nextRound.status,
            completedAt: nextRound.status === 'completed' ? nextRound.completedAt ?? targetRecord.date : null,
          })
        }

        if (isActiveRound) {
          await updateRemoteBook(targetBook.id, {
            currentPage: nextCurrentPage,
            accumulatedSeconds: nextAccumulatedSeconds,
            status: isCompleted ? 'completed' : 'reading',
            completedAt: isCompleted ? targetBook.completedAt ?? targetRecord.date : targetBook.completedAt ?? null,
          })
        }

        setBooks((current) =>
          current.map((book) =>
            book.id === targetBook.id
              ? {
                  ...(nextRound ? (isActiveRound ? applyActiveRoundToBook(book, nextRound) : replaceBookRound(book, nextRound)) : book),
                  sentences: targetHighlight ? book.sentences.filter((sentence) => sentence.id !== targetHighlight.id) : book.sentences,
                }
              : book,
          ),
        )
      }

      setRecords(nextRecords)
    } catch (error) {
      handleSyncFailure(error, '독서 기록을 삭제하지 못했습니다.')
    }
  }

  const handleAddBook = async (input: NewBookInput) => {
    try {
      setSyncError(null)
      const date = todayLabel()
      const palette = bookPalettes[books.length % bookPalettes.length]
      const newBook = await createRemoteBook(user.id, input, palette, date)

      setBooks((current) => [newBook, ...current])
      setCurrentBookId(newBook.id)

      return newBook.id
    } catch (error) {
      return handleSyncFailure(error, '새 책을 저장하지 못했습니다.')
    }
  }

  const handleUpdateSentence = async (bookId: string, sentenceId: string, text: string, page: number) => {
    const targetBook = books.find((book) => book.id === bookId)
    if (!targetBook) return
    try {
      setSyncError(null)
      await updateRemoteHighlight(sentenceId, {
        text,
        page: clampBookPage(page, targetBook.totalPages),
      })

      setBooks((current) =>
        current.map((book) => {
          if (book.id !== bookId) return book

          return {
            ...book,
            sentences: book.sentences.map((sentence) =>
              sentence.id === sentenceId
                ? {
                    ...sentence,
                    text: text.trim(),
                    page: clampBookPage(page, book.totalPages),
                  }
                : sentence,
            ),
          }
        }),
      )
    } catch (error) {
      handleSyncFailure(error, '문장을 수정하지 못했습니다.')
    }
  }

  const handleAddSentence = async (bookId: string, text: string, page: number) => {
    const date = todayLabel()
    const targetBook = books.find((book) => book.id === bookId)
    if (!targetBook) return
    try {
      setSyncError(null)
      const newHighlight = await createRemoteHighlight(user.id, {
        bookId,
        text,
        page: clampBookPage(page, targetBook.totalPages),
        recordedAt: date,
      })

      setBooks((current) =>
        current.map((book) => {
          if (book.id !== bookId) return book

          return {
            ...book,
            sentences: [newHighlight, ...book.sentences],
          }
        }),
      )
    } catch (error) {
      handleSyncFailure(error, '문장을 추가하지 못했습니다.')
    }
  }

  const handleUpdateBookPage = async (bookId: string, page: number) => {
    const date = todayLabel()
    const targetBook = books.find((book) => book.id === bookId)
    if (!targetBook) return
    try {
      setSyncError(null)
      const activeRound = getActiveRound(targetBook)
      const currentPage = clampBookPage(page, targetBook.totalPages)
      const isCompleted = isBookCompletedByPage(currentPage, targetBook.totalPages)
      const nextRoundStatus: BookStatus = isCompleted ? 'completed' : 'reading'
      const nextRound = activeRound
        ? {
            ...activeRound,
            currentPage,
            status: nextRoundStatus,
            completedAt: isCompleted ? activeRound.completedAt ?? date : undefined,
          }
        : null

      if (nextRound && !nextRound.id.includes('-round-')) {
        await updateRemoteReadingRound(nextRound.id, {
          currentPage: nextRound.currentPage,
          status: nextRound.status,
          completedAt: nextRound.status === 'completed' ? nextRound.completedAt ?? date : null,
        })
      }

      await updateRemoteBook(bookId, {
        currentPage,
        status: isCompleted ? 'completed' : 'reading',
        completedAt: isCompleted ? targetBook.completedAt ?? date : targetBook.completedAt ?? null,
      })

      setBooks((current) =>
        current.map((book) => {
          if (book.id !== bookId) return book
          const nextBook = nextRound ? applyActiveRoundToBook(book, nextRound) : book

          return {
            ...nextBook,
            currentPage,
            status: isCompleted ? 'completed' : 'reading',
            completedAt: isCompleted ? nextBook.completedAt ?? date : nextBook.completedAt,
          }
        }),
      )
    } catch (error) {
      handleSyncFailure(error, '현재 페이지를 저장하지 못했습니다.')
    }
  }

  const handleUpdateBookTotalPages = async (bookId: string, totalPages: number) => {
    const targetBook = books.find((book) => book.id === bookId)
    if (!targetBook) return

    const nextTotalPages = Math.max(Math.floor(totalPages) || targetBook.currentPage, targetBook.currentPage)
    const isCompleted = targetBook.currentPage >= nextTotalPages
    const date = todayLabel()
    const activeRound = getActiveRound(targetBook)
    const nextRound = activeRound
      ? {
          ...activeRound,
          status: (isCompleted ? 'completed' : activeRound.status) as BookStatus,
          completedAt: isCompleted ? activeRound.completedAt ?? date : activeRound.completedAt,
        }
      : null

    try {
      setSyncError(null)
      if (nextRound && !nextRound.id.includes('-round-')) {
        await updateRemoteReadingRound(nextRound.id, {
          status: nextRound.status,
          completedAt: nextRound.status === 'completed' ? nextRound.completedAt ?? date : null,
        })
      }
      await updateRemoteBook(bookId, {
        totalPages: nextTotalPages,
        status: isCompleted ? 'completed' : targetBook.status,
        completedAt: isCompleted ? targetBook.completedAt ?? date : targetBook.completedAt ?? null,
      })
      setBooks((current) =>
        current.map((book) => {
          if (book.id !== bookId) return book
          const nextBook = nextRound ? applyActiveRoundToBook(book, nextRound) : book

          return {
            ...nextBook,
            totalPages: nextTotalPages,
            status: isCompleted ? 'completed' : nextBook.status,
            completedAt: isCompleted ? nextBook.completedAt ?? date : nextBook.completedAt,
          }
        }),
      )
    } catch (error) {
      handleSyncFailure(error, '전체 페이지를 저장하지 못했습니다.')
    }
  }

  const handleDeleteSentence = async (bookId: string, sentenceId: string) => {
    try {
      setSyncError(null)
      await deleteRemoteHighlight(sentenceId)

      setBooks((current) =>
        current.map((book) =>
          book.id === bookId
            ? {
                ...book,
                sentences: book.sentences.filter((sentence) => sentence.id !== sentenceId),
              }
            : book,
        ),
      )
    } catch (error) {
      handleSyncFailure(error, '문장을 삭제하지 못했습니다.')
    }
  }

  const handleStartReread = async (bookId: string) => {
    const targetBook = books.find((book) => book.id === bookId)
    if (!targetBook) return

    try {
      setSyncError(null)
      const date = todayLabel()
      const nextRound = await createRemoteReadingRound(user.id, {
        bookId,
        roundNumber: getNextRoundNumber(targetBook),
        startedAt: date,
        currentPage: 1,
      })

      await updateRemoteBook(bookId, {
        currentPage: 1,
        accumulatedSeconds: 0,
        status: 'reading',
        completedAt: targetBook.completedAt ?? null,
      })

      setBooks((current) => current.map((book) => (book.id === bookId ? applyActiveRoundToBook(book, nextRound) : book)))
      setCurrentBookId(bookId)
      setActiveTab('session')
      readingTimer.reset()
    } catch (error) {
      handleSyncFailure(error, '재독을 시작하지 못했습니다.')
    }
  }

  const handleDeleteRound = async (bookId: string, roundId: string) => {
    const targetBook = books.find((book) => book.id === bookId)
    const targetRound = targetBook ? getBookRounds(targetBook).find((round) => round.id === roundId) : undefined
    if (!targetBook || !targetRound || targetRound.roundNumber <= 1) return

    const remainingRounds = getBookRounds(targetBook).filter((round) => round.id !== roundId)
    const nextActiveRound =
      remainingRounds.find((round) => round.status === 'reading') ??
      [...remainingRounds].sort((left, right) => right.roundNumber - left.roundNumber)[0]
    if (!nextActiveRound) return

    try {
      setSyncError(null)
      const roundRecords = records.filter((record) => record.bookId === bookId && record.roundId === roundId)
      const highlightIdsToDelete = new Set(
        roundRecords
          .map((record) => findHighlightForRecord(targetBook, record)?.id)
          .filter((highlightId): highlightId is string => Boolean(highlightId)),
      )

      await Promise.all([...highlightIdsToDelete].map((highlightId) => deleteRemoteHighlight(highlightId)))
      await deleteRemoteRecordsByRound(roundId)
      await deleteRemoteReadingRound(roundId)

      await updateRemoteBook(bookId, {
        currentPage: nextActiveRound.currentPage,
        accumulatedSeconds: nextActiveRound.accumulatedSeconds,
        status: nextActiveRound.status,
        completedAt: nextActiveRound.completedAt ?? targetBook.completedAt ?? null,
      })

      const nextRecords = records.filter((record) => record.roundId !== roundId)

      setRecords(nextRecords)
      setBooks((current) =>
        current.map((book) =>
          book.id === bookId
            ? {
                ...removeBookRound(book, roundId, nextActiveRound),
                sentences: book.sentences.filter((sentence) => !highlightIdsToDelete.has(sentence.id)),
              }
            : book,
        ),
      )

      if (currentBookId === bookId) {
        const fallbackReadingBook = books.find((book) => book.id !== bookId && book.status === 'reading')
        setCurrentBookId(nextActiveRound.status === 'reading' ? bookId : fallbackReadingBook?.id ?? bookId)
        readingTimer.reset()
      }
    } catch (error) {
      handleSyncFailure(error, '회차를 삭제하지 못했습니다.')
    }
  }

  const handleDeleteBook = async (bookId: string) => {
    if (books.length <= 1) return
    try {
      setSyncError(null)
      await deleteRemoteBook(bookId)

      const remainingBooks = books.filter((book) => book.id !== bookId)
      setBooks(remainingBooks)

      if (currentBookId === bookId) {
        const nextBook = remainingBooks.find((book) => book.status === 'reading') ?? remainingBooks[0]

        setCurrentBookId(nextBook?.id ?? '')
        readingTimer.reset()
      }

      setTierBoard((current) => {
        const next = createEmptyTierBoard()

        Object.entries(current).forEach(([tier, bookIds]) => {
          next[tier as keyof TierBoard] = bookIds.filter((id) => id !== bookId)
        })

        return next
      })
    } catch (error) {
      handleSyncFailure(error, '책을 삭제하지 못했습니다.')
    }
  }

  const activeScreen = (
    <>
      {activeTab === 'home' && (
        <HomeScreen
          books={books}
          records={records}
          currentBook={currentBook}
          dailyGoalSeconds={dailyGoalSeconds}
          weeklyGoalDays={weeklyGoalDays}
          onStart={() => setActiveTab('session')}
          onAddFirstBook={openBookFormFromHome}
        />
      )}
      {activeTab === 'session' && (
        <SessionScreen
          books={books}
          records={records}
          currentBook={currentBook}
          dailyGoalSeconds={dailyGoalSeconds}
          timer={readingTimer}
          onChangeBook={setCurrentBookId}
          onSaveRecord={handleSaveRecord}
          onGoLibrary={() => setActiveTab('library')}
        />
      )}
      {activeTab === 'records' && <RecordScreen books={books} records={records} onUpdateRecord={handleUpdateRecord} onDeleteRecord={handleDeleteRecord} />}
      {activeTab === 'library' && (
        <LibraryScreen
          key={bookFormOpenRequest}
          books={books}
          records={records}
          tierBoard={tierBoard}
          onChangeTierBoard={handleChangeTierBoard}
          onAddBook={handleAddBook}
          onAddSentence={handleAddSentence}
          onUpdateSentence={handleUpdateSentence}
          onDeleteSentence={handleDeleteSentence}
          onDeleteBook={handleDeleteBook}
          onUpdateBookPage={handleUpdateBookPage}
          onUpdateBookTotalPages={handleUpdateBookTotalPages}
          onStartReread={handleStartReread}
          onDeleteRound={handleDeleteRound}
          shouldOpenBookForm={bookFormOpenRequest > 0 && books.length === 0}
          onDetailModeChange={setIsLibraryDetailMode}
        />
      )}
      {activeTab === 'profile' && (
        <ProfileScreen
          userEmail={user.email ?? ''}
          books={books}
          records={records}
          dailyGoalSeconds={dailyGoalSeconds}
          weeklyGoalDays={weeklyGoalDays}
          onAdjustDailyGoal={handleAdjustDailyGoal}
          onAdjustWeeklyGoal={handleAdjustWeeklyGoal}
          onSignOut={onSignOut}
        />
      )}
    </>
  )
  const shouldHideBottomTabs = activeTab === 'library' && isLibraryDetailMode

  if (isDataLoading) {
    return (
      <main className="grid min-h-svh place-items-center bg-[#F8F8F5] px-4 text-stone-900">
        <div className="w-full max-w-[430px] border-2 border-[#2F2A26] bg-[#FCFBF7] p-5 text-center shadow-pixel">
          <p className="text-sm font-black">독서 데이터를 불러오는 중</p>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-svh bg-[#F8F8F5] text-stone-900">
      <div className="mx-auto flex min-h-svh max-w-[430px] flex-col bg-[#FCFBF7] shadow-[0_18px_60px_rgba(47,42,38,0.12)]">
        <div
          className={`min-h-0 flex-1 overflow-y-auto ${
            shouldHideBottomTabs ? 'pb-0' : 'px-4 pb-28 pt-5'
          }`}
        >
          {syncError && (
            <div className="mb-4 border-2 border-[#2F2A26] bg-[#F4D8CF] px-3 py-2 text-sm font-black text-[#8A3F2D]">
              {syncError}
            </div>
          )}
          {activeScreen}
        </div>
        {!shouldHideBottomTabs && (
          <BottomTabs
            activeTab={activeTab}
            disabledTabs={books.length === 0 ? ['session'] : []}
            onChange={setActiveTab}
          />
        )}
      </div>
    </main>
  )
}

function App() {
  const auth = useAuth()

  if (auth.isLoading) {
    return (
      <main className="grid min-h-svh place-items-center bg-[#F8F8F5] px-4 text-stone-900">
        <div className="w-full max-w-[430px] border-2 border-[#2F2A26] bg-[#FCFBF7] p-5 text-center shadow-pixel">
          <p className="text-sm font-black">로그인 상태 확인 중</p>
        </div>
      </main>
    )
  }

  if (!auth.user) {
    return <AuthScreen error={auth.error} onSignIn={auth.signIn} onSignUp={auth.signUp} onResetPassword={auth.resetPassword} />
  }

  return <AuthenticatedApp user={auth.user} onSignOut={auth.signOut} />
}

export default App
