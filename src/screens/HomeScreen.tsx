import { DigitalTimer } from '../components/DigitalTimer'
import { Icon } from '../components/Icon'
import { MiniBook } from '../components/MiniBook'
import { PixelCard } from '../components/PixelCard'
import { ReadingCharacter } from '../components/ReadingCharacter'
import type { Book, ReadingRecord } from '../types/reading'
import { formatDuration } from '../utils/formatDuration'

type HomeScreenProps = {
  books: Book[]
  records: ReadingRecord[]
  currentBook: Book | null
  dailyGoalSeconds: number
  weeklyGoalDays: number
  onStart: () => void
  onAddFirstBook: () => void
}

const todayLabel = () =>
  new Intl.DateTimeFormat('ko-KR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
    .format(new Date())
    .replace(/\.\s?/g, '.')
    .replace(/\.$/, '')

const parseDateLabel = (dateLabel: string) => {
  const [year, month, day] = dateLabel.split('.').map(Number)

  return new Date(year, month - 1, day)
}

const isSameDateLabel = (dateLabel: string, targetLabel: string) => dateLabel === targetLabel

const isThisWeek = (dateLabel: string) => {
  const target = parseDateLabel(dateLabel)
  const today = new Date()
  const startOfWeek = new Date(today)
  const day = today.getDay()
  const mondayOffset = day === 0 ? -6 : 1 - day

  startOfWeek.setDate(today.getDate() + mondayOffset)
  startOfWeek.setHours(0, 0, 0, 0)

  const endOfWeek = new Date(startOfWeek)
  endOfWeek.setDate(startOfWeek.getDate() + 7)

  return target >= startOfWeek && target < endOfWeek
}

const formatShortDuration = (seconds: number) => {
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)

  if (hours === 0) return `${minutes}분`
  if (minutes === 0) return `${hours}시간`

  return `${hours}시간 ${minutes}분`
}

export const HomeScreen = ({ books, records, currentBook, dailyGoalSeconds, weeklyGoalDays, onStart, onAddFirstBook }: HomeScreenProps) => {
  const today = todayLabel()
  const todaySeconds = records
    .filter((record) => isSameDateLabel(record.date, today))
    .reduce((sum, record) => sum + record.durationSeconds, 0)
  const weekSeconds = records
    .filter((record) => isThisWeek(record.date))
    .reduce((sum, record) => sum + record.durationSeconds, 0)
  const weeklyReadingDays = new Set(records.filter((record) => isThisWeek(record.date)).map((record) => record.date)).size
  const completedBooks = books.filter((book) => book.status === 'completed').length
  const currentProgress = currentBook ? Math.round((currentBook.currentPage / currentBook.totalPages) * 100) : 0
  const dailyGoalProgress = Math.min(Math.round((todaySeconds / dailyGoalSeconds) * 100), 100)
  const weeklyGoalProgress = Math.min(Math.round((weeklyReadingDays / weeklyGoalDays) * 100), 100)
  const weeklyGoalFilledDays = Math.min(weeklyReadingDays, weeklyGoalDays)
  const recentSentence = books
    .flatMap((book) => book.sentences.map((sentence) => ({ ...sentence, bookTitle: book.title })))
    .sort((a, b) => b.recordedAt.localeCompare(a.recordedAt))[0]

  if (books.length === 0) {
    return (
      <div className="space-y-4">
        <header className="flex items-start justify-between gap-3">
          <div>
            <p className="pixel-label">BOOKLOG TIMER</p>
            <h1 className="mt-2 text-3xl font-black leading-tight text-stone-950">첫 책을 추가하고 독서를 시작해요</h1>
          </div>
          <div className="rounded-md border-2 border-[#2F2A26] bg-[#87937A] p-2 shadow-pixel">
            <Icon name="leaf" className="h-6 w-6 text-[#FFFDF8]" />
          </div>
        </header>

        <PixelCard className="overflow-hidden bg-[#F3E8D0]">
          <div className="grid grid-cols-[1fr_116px] items-center gap-3">
            <div>
              <p className="text-lg font-black leading-tight">서재에 책을 담으면 타이머와 기록이 이어집니다.</p>
              <p className="mt-3 text-sm font-bold leading-relaxed text-stone-600">카카오 책 검색으로 제목과 표지를 빠르게 불러올 수 있어요.</p>
              <button type="button" className="primary-button mt-4 w-full" onClick={onAddFirstBook}>
                <Icon name="plus" className="h-5 w-5" />
                책 추가하기
              </button>
            </div>
            <ReadingCharacter />
          </div>
        </PixelCard>

        <div className="grid gap-3">
          {[
            ['1', '책 추가', '서재에 첫 책을 등록합니다.'],
            ['2', '타이머 시작', '독서중 탭에서 목표 시간을 정하고 읽습니다.'],
            ['3', '문장 기록', '완료 화면에서 기억할 문장을 선택으로 남깁니다.'],
          ].map(([step, title, description]) => (
            <PixelCard key={step} className="bg-[#FCFBF7]">
              <div className="flex gap-3">
                <span className="grid h-8 w-8 shrink-0 place-items-center border-2 border-[#2F2A26] bg-[#DCE3D2] text-sm font-black text-[#5F6D57]">{step}</span>
                <div>
                  <p className="font-black">{title}</p>
                  <p className="mt-1 text-sm font-bold leading-relaxed text-stone-600">{description}</p>
                </div>
              </div>
            </PixelCard>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <header className="flex items-start justify-between gap-3">
        <div>
          <p className="pixel-label">BOOKLOG TIMER</p>
          <h1 className="mt-2 text-3xl font-black leading-tight text-stone-950">오늘도 한 장씩</h1>
        </div>
        <div className="rounded-md border-2 border-[#2F2A26] bg-[#87937A] p-2 shadow-pixel">
          <Icon name="leaf" className="h-6 w-6 text-[#FFFDF8]" />
        </div>
      </header>

      <section className="grid grid-cols-2 gap-3">
        <PixelCard className="bg-[#FCFBF7]">
          <Icon name="clock" className="mb-3 h-6 w-6 text-[#87937A]" />
          <p className="text-xs font-black text-stone-500">오늘 독서</p>
          <p className="mt-1 text-xl font-black">{formatShortDuration(todaySeconds)}</p>
        </PixelCard>
        <PixelCard className="bg-[#FCFBF7]">
          <Icon name="records" className="mb-3 h-6 w-6 text-[#5B8DEE]" />
          <p className="text-xs font-black text-stone-500">이번 주</p>
          <p className="mt-1 text-xl font-black">{formatShortDuration(weekSeconds)}</p>
        </PixelCard>
      </section>

      <PixelCard className="bg-[#FCFBF7]">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-black text-stone-500">오늘 목표</p>
            <p className="mt-1 text-xl font-black">
              {formatShortDuration(todaySeconds)} / {formatShortDuration(dailyGoalSeconds)}
            </p>
          </div>
          <span className="border-2 border-[#2F2A26] bg-[#DCE3D2] px-2 py-1 text-xs font-black text-[#5F6D57]">{dailyGoalProgress}%</span>
        </div>
        <div className="mt-3 h-3 rounded-full border-2 border-[#2F2A26] bg-[#FCFBF7]">
          <div className="h-full rounded-full bg-[#76B852]" style={{ width: `${dailyGoalProgress}%` }} />
        </div>
      </PixelCard>

      <PixelCard className="bg-[#FCFBF7]">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-black text-stone-500">이번 주 루틴</p>
            <p className="mt-1 text-xl font-black">
              {weeklyReadingDays}/{weeklyGoalDays}일
            </p>
          </div>
          <span className="border-2 border-[#2F2A26] bg-[#F3E8D0] px-2 py-1 text-xs font-black text-[#5B8DEE]">{weeklyGoalProgress}%</span>
        </div>
        <div className="mt-3 grid gap-1" style={{ gridTemplateColumns: `repeat(${weeklyGoalDays}, minmax(0, 1fr))` }}>
          {Array.from({ length: weeklyGoalDays }, (_, index) => (
            <span
              key={index}
              className={`h-4 border-2 border-[#2F2A26] ${index < weeklyGoalFilledDays ? 'bg-[#5B8DEE]' : 'bg-[#FCFBF7]'}`}
              aria-hidden="true"
            />
          ))}
        </div>
      </PixelCard>

      {currentBook ? (
        <PixelCard className="overflow-hidden bg-[#F3E8D0]">
          <div className="grid grid-cols-[1fr_126px] items-center gap-3">
            <div className="space-y-4">
              <div>
                <p className="text-sm font-black text-stone-700">지금 읽는 책</p>
                <div className="mt-3">
                  <MiniBook book={currentBook} />
                </div>
              </div>
              <div className="h-3 rounded-full border-2 border-[#2F2A26] bg-[#FCFBF7]">
                <div className="h-full rounded-full bg-[#5F6D57]" style={{ width: `${currentProgress}%` }} />
              </div>
              <p className="text-right text-xs font-black text-[#5F6D57]">
                {currentBook.currentPage}/{currentBook.totalPages}p · {currentProgress}%
              </p>
              <button type="button" className="primary-button w-full" onClick={onStart}>
                <Icon name="play" className="h-5 w-5" />
                독서 시작
              </button>
            </div>
            <ReadingCharacter />
          </div>
        </PixelCard>
      ) : (
        <PixelCard className="bg-[#F3E8D0] text-center">
          <Icon name="book" className="mx-auto mb-3 h-8 w-8 text-[#5F6D57]" />
          <p className="text-lg font-black">첫 책을 서재에 추가해 주세요.</p>
          <p className="mt-2 text-sm font-bold leading-relaxed text-stone-600">책을 추가하면 독서 타이머와 기록을 시작할 수 있습니다.</p>
        </PixelCard>
      )}

      <div className="grid grid-cols-2 gap-3">
        <PixelCard className="bg-[#FCFBF7]">
          <Icon name="clock" className="mb-3 h-6 w-6 text-[#87937A]" />
          <p className="text-xs font-black text-stone-500">누적 독서</p>
          <p className="mt-1 text-xl font-black">{formatDuration(books.reduce((sum, book) => sum + book.accumulatedSeconds, 0))}</p>
        </PixelCard>
        <PixelCard className="bg-[#FCFBF7]">
          <Icon name="check" className="mb-3 h-6 w-6 text-[#5F6D57]" />
          <p className="text-xs font-black text-stone-500">완독한 책</p>
          <p className="mt-1 text-xl font-black">{completedBooks}권</p>
        </PixelCard>
      </div>

      <PixelCard className="bg-[#2F2A26] text-[#FFFDF8]">
        {recentSentence ? (
          <div>
            <div className="mb-3 flex items-center gap-2 text-[#F2C94C]">
              <Icon name="quote" className="h-5 w-5" />
              <p className="text-xs font-black">최근 기록한 문장</p>
            </div>
            <p className="text-sm font-black leading-relaxed">“{recentSentence.text}”</p>
            <p className="mt-3 text-right text-xs font-black text-[#E8DFC2]">
              {recentSentence.bookTitle} · p.{recentSentence.page}
            </p>
          </div>
        ) : (
          <DigitalTimer seconds={todaySeconds} label="오늘 독서 시간" />
        )}
      </PixelCard>
    </div>
  )
}
