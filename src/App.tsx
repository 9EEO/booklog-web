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
  getInitialActiveTab,
  getInitialBooks,
  getInitialCurrentBookId,
  getInitialDailyGoalSeconds,
  getInitialRecords,
  getInitialWeeklyGoalDays,
  saveActiveTab,
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

const createId = (prefix: string) => `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`

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
  const readingTimer = useReadingTimer(15 * 60)

  const currentBook = useMemo(
    () => books.find((book) => book.id === currentBookId) ?? books[0] ?? null,
    [books, currentBookId],
  )

  useEffect(() => {
    saveActiveTab(activeTab)
  }, [activeTab])

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

  const handleSaveRecord = (input: ReadingCompletionInput) => {
    if (!currentBook) return

    const date = todayLabel()
    const startPage = currentBook.currentPage
    const endPage = Math.min(Math.max(input.endPage, startPage), currentBook.totalPages)
    const sentence = input.sentence?.trim()
    const sentencePage = input.sentencePage ? Math.min(Math.max(input.sentencePage, 1), currentBook.totalPages) : undefined

    const newRecord: ReadingRecord = {
      id: createId('record'),
      bookId: currentBook.id,
      bookTitle: currentBook.title,
      date,
      durationSeconds: input.durationSeconds,
      startPage,
      endPage,
      sentence: sentence || undefined,
      sentencePage,
    }

    setRecords((current) => [newRecord, ...current])
    setBooks((current) =>
      current.map((book) => {
        if (book.id !== currentBook.id) return book

        const isCompleted = endPage >= book.totalPages

        return {
          ...book,
          currentPage: endPage,
          accumulatedSeconds: book.accumulatedSeconds + input.durationSeconds,
          status: isCompleted ? 'completed' : 'reading',
          completedAt: isCompleted ? date : book.completedAt,
          sentences: sentence
            ? [
                {
                  id: createId('highlight'),
                  text: sentence,
                  page: sentencePage ?? endPage,
                  recordedAt: date,
                },
                ...book.sentences,
              ]
            : book.sentences,
        }
      }),
    )

    setActiveTab('records')
  }

  const handleAddBook = (input: NewBookInput) => {
    const id = createId('book')
    const date = todayLabel()
    const totalPages = Math.max(Math.floor(input.totalPages) || 1, 1)
    const isCompletedInput = input.status === 'completed'
    const currentPage = isCompletedInput ? totalPages : Math.min(Math.max(Math.floor(input.currentPage) || 1, 1), totalPages)

    setBooks((current) => {
      const palette = bookPalettes[current.length % bookPalettes.length]

      const newBook: Book = {
        id,
        title: input.title.trim(),
        author: input.author.trim() || '작가 미상',
        totalPages,
        currentPage,
        startedAt: input.startedAt?.trim() || date,
        accumulatedSeconds: 0,
        status: isCompletedInput || currentPage >= totalPages ? 'completed' : 'reading',
        completedAt: isCompletedInput || currentPage >= totalPages ? input.completedAt?.trim() || date : undefined,
        coverColor: palette.coverColor,
        accentColor: palette.accentColor,
        thumbnail: input.thumbnail,
        sentences: [],
      }

      return [newBook, ...current]
    })
    setCurrentBookId(id)

    return id
  }

  const handleUpdateSentence = (bookId: string, sentenceId: string, text: string, page: number) => {
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
  }

  const handleAddSentence = (bookId: string, text: string, page: number) => {
    const date = todayLabel()

    setBooks((current) =>
      current.map((book) => {
        if (book.id !== bookId) return book

        return {
          ...book,
          sentences: [
            {
              id: createId('highlight'),
              text: text.trim(),
              page: Math.min(Math.max(page, 1), book.totalPages),
              recordedAt: date,
            },
            ...book.sentences,
          ],
        }
      }),
    )
  }

  const handleUpdateBookPage = (bookId: string, page: number) => {
    const date = todayLabel()

    setBooks((current) =>
      current.map((book) => {
        if (book.id !== bookId) return book

        const currentPage = Math.min(Math.max(Math.floor(page) || 1, 1), book.totalPages)
        const isCompleted = currentPage >= book.totalPages

        return {
          ...book,
          currentPage,
          status: isCompleted ? 'completed' : 'reading',
          completedAt: isCompleted ? book.completedAt ?? date : undefined,
        }
      }),
    )
  }

  const handleDeleteSentence = (bookId: string, sentenceId: string) => {
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
  }

  const handleDeleteBook = (bookId: string) => {
    if (books.length <= 1) return

    const remainingBooks = books.filter((book) => book.id !== bookId)
    setBooks(remainingBooks)

    if (currentBookId === bookId) {
      const nextBook = remainingBooks.find((book) => book.status === 'reading') ?? remainingBooks[0]

      setCurrentBookId(nextBook?.id ?? '')
      readingTimer.reset()
    }
  }

  return (
    <main className="min-h-svh bg-[#F8F8F5] text-stone-900">
      <div className="mx-auto flex min-h-svh max-w-[430px] flex-col bg-[#FCFBF7] shadow-[0_18px_60px_rgba(47,42,38,0.12)]">
        <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-28 pt-5">
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
