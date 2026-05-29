import { useEffect, useMemo, useState } from 'react'
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
  createRemoteRecord,
  deleteRemoteBook,
  deleteRemoteHighlight,
  fetchReadingSnapshot,
  migrateLocalSnapshotToSupabase,
  saveReadingSettings,
  updateRemoteBook,
  updateRemoteHighlight,
} from './services/readingSync'
import {
  defaultDailyGoalSeconds,
  defaultWeeklyGoalDays,
  getInitialActiveTab,
  getInitialBooks,
  getInitialCurrentBookId,
  getInitialDailyGoalSeconds,
  getInitialRecords,
  getInitialWeeklyGoalDays,
  getStoredDataOwnerUserId,
  saveActiveTab,
  saveDataOwnerUserId,
  saveBooks,
  saveCurrentBookId,
  saveDailyGoalSeconds,
  saveRecords,
  saveWeeklyGoalDays,
} from './storage/readingStorage'
import type { Book, NewBookInput, ReadingCompletionInput, ReadingRecord, TabKey } from './types/reading'

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

function AuthenticatedApp({ user, onSignOut }: { user: User; onSignOut: () => Promise<void> }) {
  const [activeTab, setActiveTab] = useState<TabKey>(getInitialActiveTab)
  const [books, setBooks] = useState<Book[]>(getInitialBooks)
  const [records, setRecords] = useState<ReadingRecord[]>(getInitialRecords)
  const [currentBookId, setCurrentBookId] = useState(() => getInitialCurrentBookId(getInitialBooks()))
  const [dailyGoalSeconds, setDailyGoalSeconds] = useState(getInitialDailyGoalSeconds)
  const [weeklyGoalDays, setWeeklyGoalDays] = useState(getInitialWeeklyGoalDays)
  const [bookFormOpenRequest, setBookFormOpenRequest] = useState(0)
  const [isDataLoading, setIsDataLoading] = useState(true)
  const [syncError, setSyncError] = useState<string | null>(null)
  const readingTimer = useReadingTimer(15 * 60)

  const currentBook = useMemo(
    () => books.find((book) => book.id === currentBookId) ?? books[0] ?? null,
    [books, currentBookId],
  )

  const handleSyncFailure = (error: unknown, fallbackMessage: string) => {
    const message = error instanceof Error ? error.message : fallbackMessage
    setSyncError(message)
    throw error instanceof Error ? error : new Error(message)
  }

  useEffect(() => {
    saveActiveTab(activeTab)
  }, [activeTab])

  useEffect(() => {
    saveDataOwnerUserId(user.id)
  }, [user.id])

  useEffect(() => {
    let isMounted = true

    const loadSnapshot = async () => {
      setIsDataLoading(true)
      setSyncError(null)

      try {
        const remoteSnapshot = await fetchReadingSnapshot(user.id)
        const localSnapshot = {
          books: getInitialBooks(),
          records: getInitialRecords(),
          currentBookId: getInitialCurrentBookId(getInitialBooks()),
          dailyGoalSeconds: getInitialDailyGoalSeconds(),
          weeklyGoalDays: getInitialWeeklyGoalDays(),
        }
        const localDataOwnerUserId = getStoredDataOwnerUserId()

        const hasRemoteData =
          remoteSnapshot.books.length > 0 ||
          remoteSnapshot.records.length > 0 ||
          remoteSnapshot.currentBookId.length > 0 ||
          remoteSnapshot.dailyGoalSeconds !== defaultDailyGoalSeconds ||
          remoteSnapshot.weeklyGoalDays !== defaultWeeklyGoalDays

        const hasLocalData =
          localSnapshot.books.length > 0 ||
          localSnapshot.records.length > 0 ||
          localSnapshot.currentBookId.length > 0 ||
          localSnapshot.dailyGoalSeconds !== defaultDailyGoalSeconds ||
          localSnapshot.weeklyGoalDays !== defaultWeeklyGoalDays

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
      } catch (error) {
        if (!isMounted) return

        setSyncError(error instanceof Error ? error.message : '데이터를 불러오지 못했습니다.')
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
  }, [user.id])

  useEffect(() => {
    saveBooks(books)
  }, [books])

  useEffect(() => {
    saveRecords(records)
  }, [records])

  useEffect(() => {
    if (currentBookId) {
      saveCurrentBookId(currentBookId)
    }
  }, [currentBookId])

  useEffect(() => {
    saveDailyGoalSeconds(dailyGoalSeconds)
  }, [dailyGoalSeconds])

  useEffect(() => {
    saveWeeklyGoalDays(weeklyGoalDays)
  }, [weeklyGoalDays])

  useEffect(() => {
    if (isDataLoading) return

    void saveReadingSettings(user.id, {
      currentBookId,
      dailyGoalSeconds,
      weeklyGoalDays,
    }).catch((error) => {
      setSyncError(error instanceof Error ? error.message : '설정을 저장하지 못했습니다.')
    })
  }, [currentBookId, dailyGoalSeconds, weeklyGoalDays, isDataLoading, user.id])

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

  const handleSaveRecord = async (input: ReadingCompletionInput) => {
    if (!currentBook) return
    try {
      setSyncError(null)
      const date = todayLabel()
      const startPage = currentBook.currentPage
      const endPage = Math.min(Math.max(input.endPage, startPage), currentBook.totalPages)
      const sentence = input.sentence?.trim()
      const sentencePage = input.sentencePage ? Math.min(Math.max(input.sentencePage, 1), currentBook.totalPages) : undefined

      const newRecord = await createRemoteRecord(user.id, {
        bookId: currentBook.id,
        bookTitle: currentBook.title,
        date,
        durationSeconds: input.durationSeconds,
        startPage,
        endPage,
        sentence: sentence || undefined,
        sentencePage,
      })

      const isCompleted = endPage >= currentBook.totalPages

      await updateRemoteBook(currentBook.id, {
        currentPage: endPage,
        accumulatedSeconds: currentBook.accumulatedSeconds + input.durationSeconds,
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

          return {
            ...book,
            currentPage: endPage,
            accumulatedSeconds: book.accumulatedSeconds + input.durationSeconds,
            status: isCompleted ? 'completed' : 'reading',
            completedAt: isCompleted ? date : book.completedAt,
            sentences: newHighlight ? [newHighlight, ...book.sentences] : book.sentences,
          }
        }),
      )

      setActiveTab('records')
    } catch (error) {
      handleSyncFailure(error, '독서 기록을 저장하지 못했습니다.')
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
        page: Math.min(Math.max(page, 1), targetBook.totalPages),
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
                    page: Math.min(Math.max(page, 1), book.totalPages),
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
        page: Math.min(Math.max(page, 1), targetBook.totalPages),
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
      const currentPage = Math.min(Math.max(Math.floor(page) || 1, 1), targetBook.totalPages)
      const isCompleted = currentPage >= targetBook.totalPages

      await updateRemoteBook(bookId, {
        currentPage,
        status: isCompleted ? 'completed' : 'reading',
        completedAt: isCompleted ? targetBook.completedAt ?? date : null,
      })

      setBooks((current) =>
        current.map((book) => {
          if (book.id !== bookId) return book

          return {
            ...book,
            currentPage,
            status: isCompleted ? 'completed' : 'reading',
            completedAt: isCompleted ? book.completedAt ?? date : undefined,
          }
        }),
      )
    } catch (error) {
      handleSyncFailure(error, '현재 페이지를 저장하지 못했습니다.')
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
      {activeTab === 'records' && <RecordScreen books={books} records={records} />}
      {activeTab === 'library' && (
        <LibraryScreen
          key={bookFormOpenRequest}
          books={books}
          records={records}
          onAddBook={handleAddBook}
          onAddSentence={handleAddSentence}
          onUpdateSentence={handleUpdateSentence}
          onDeleteSentence={handleDeleteSentence}
          onDeleteBook={handleDeleteBook}
          onUpdateBookPage={handleUpdateBookPage}
          shouldOpenBookForm={bookFormOpenRequest > 0 && books.length === 0}
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
        <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-28 pt-5">
          {syncError && (
            <div className="mb-4 border-2 border-[#2F2A26] bg-[#F4D8CF] px-3 py-2 text-sm font-black text-[#8A3F2D]">
              {syncError}
            </div>
          )}
          {activeScreen}
        </div>
        <BottomTabs activeTab={activeTab} onChange={setActiveTab} />
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
