import { Icon } from '../components/Icon'
import { PixelCard } from '../components/PixelCard'
import type { Book, ReadingRecord } from '../types/reading'
import { buildInfo } from '../utils/buildInfo'
import { formatDuration } from '../utils/formatDuration'

type ProfileScreenProps = {
  userEmail: string
  books: Book[]
  records: ReadingRecord[]
  dailyGoalSeconds: number
  weeklyGoalDays: number
  onAdjustDailyGoal: (deltaSeconds: number) => void
  onAdjustWeeklyGoal: (deltaDays: number) => void
  onSignOut: () => Promise<void>
}

const formatGoalMinutes = (seconds: number) => `${Math.round(seconds / 60)}분`

export const ProfileScreen = ({ userEmail, books, records, dailyGoalSeconds, weeklyGoalDays, onAdjustDailyGoal, onAdjustWeeklyGoal, onSignOut }: ProfileScreenProps) => {
  const totalSeconds = books.reduce(
    (sum, book) => sum + ((book.rounds?.length ?? 0) > 0 ? book.rounds!.reduce((roundSum, round) => roundSum + round.accumulatedSeconds, 0) : book.accumulatedSeconds),
    0,
  )
  const completedBooks = books.filter((book) => book.status === 'completed' || Boolean(book.rounds?.some((round) => round.status === 'completed'))).length
  const totalPages = records.reduce((sum, record) => sum + Math.max(record.endPage - record.startPage, 0), 0)
  const canDecreaseGoal = dailyGoalSeconds > 5 * 60
  const canIncreaseGoal = dailyGoalSeconds < 180 * 60
  const canDecreaseWeeklyGoal = weeklyGoalDays > 1
  const canIncreaseWeeklyGoal = weeklyGoalDays < 7

  return (
    <div className="space-y-4">
      <header>
        <p className="pixel-label">PROFILE</p>
        <h1 className="mt-1 text-2xl font-black">프로필</h1>
      </header>

      <PixelCard className="bg-[#2F2A26] text-[#FFFDF8]">
        <div className="flex items-center gap-3">
          <div className="grid h-14 w-14 place-items-center border-2 border-[#FFFDF8] bg-[#F3E8D0] text-[#2F2A26]">
            <Icon name="profile" className="h-8 w-8" />
          </div>
          <div>
            <p className="text-xl font-black">책갈피 수집가</p>
            <p className="text-sm font-bold text-[#E8DFC2]">{userEmail || '조용한 독서 루틴'}</p>
          </div>
        </div>
      </PixelCard>

      <PixelCard className="bg-[#F3E8D0]">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-black text-stone-500">하루 독서 목표</p>
            <p className="mt-1 text-xl font-black">{formatGoalMinutes(dailyGoalSeconds)}</p>
          </div>
          <Icon name="clock" className="h-6 w-6 text-[#5F6D57]" />
        </div>
        <div className="target-stepper">
          <button
            type="button"
            className="target-step-button"
            onClick={() => onAdjustDailyGoal(-5 * 60)}
            disabled={!canDecreaseGoal}
            aria-label="하루 목표 5분 줄이기"
          >
            <Icon name="minus" className="h-5 w-5" />
          </button>
          <div className="target-step-value" aria-live="polite">
            <span>목표</span>
            <strong>{formatGoalMinutes(dailyGoalSeconds)}</strong>
          </div>
          <button
            type="button"
            className="target-step-button"
            onClick={() => onAdjustDailyGoal(5 * 60)}
            disabled={!canIncreaseGoal}
            aria-label="하루 목표 5분 늘리기"
          >
            <Icon name="plus" className="h-5 w-5" />
          </button>
        </div>
      </PixelCard>

      <PixelCard className="bg-[#FCFBF7]">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-black text-stone-500">주간 독서 루틴</p>
            <p className="mt-1 text-xl font-black">주 {weeklyGoalDays}일</p>
          </div>
          <Icon name="records" className="h-6 w-6 text-[#2563EB]" />
        </div>
        <div className="target-stepper">
          <button
            type="button"
            className="target-step-button"
            onClick={() => onAdjustWeeklyGoal(-1)}
            disabled={!canDecreaseWeeklyGoal}
            aria-label="주간 목표 하루 줄이기"
          >
            <Icon name="minus" className="h-5 w-5" />
          </button>
          <div className="target-step-value" aria-live="polite">
            <span>루틴</span>
            <strong>{weeklyGoalDays}일</strong>
          </div>
          <button
            type="button"
            className="target-step-button"
            onClick={() => onAdjustWeeklyGoal(1)}
            disabled={!canIncreaseWeeklyGoal}
            aria-label="주간 목표 하루 늘리기"
          >
            <Icon name="plus" className="h-5 w-5" />
          </button>
        </div>
      </PixelCard>

      <div className="grid grid-cols-2 gap-3">
        <PixelCard className="bg-[#FCFBF7]">
          <p className="text-xs font-black text-stone-500">총 독서 시간</p>
          <p className="mt-2 text-lg font-black">{formatDuration(totalSeconds)}</p>
        </PixelCard>
        <PixelCard className="bg-[#FCFBF7]">
          <p className="text-xs font-black text-stone-500">독서 기록</p>
          <p className="mt-2 text-lg font-black">{records.length}개</p>
        </PixelCard>
        <PixelCard className="bg-[#FCFBF7]">
          <p className="text-xs font-black text-stone-500">완독</p>
          <p className="mt-2 text-lg font-black">{completedBooks}권</p>
        </PixelCard>
        <PixelCard className="bg-[#FCFBF7]">
          <p className="text-xs font-black text-stone-500">기록 페이지</p>
          <p className="mt-2 text-lg font-black">{totalPages}p</p>
        </PixelCard>
      </div>

      <button type="button" className="secondary-button w-full" onClick={() => void onSignOut()}>
        로그아웃
      </button>

      <div className="border-2 border-dashed border-stone-300 bg-[#FCFBF7] px-3 py-2 text-[11px] font-black leading-relaxed text-stone-500">
        <p>버전 {buildInfo.version}</p>
        <p>
          배포 {buildInfo.commit} · {buildInfo.builtAt}
        </p>
      </div>
    </div>
  )
}
