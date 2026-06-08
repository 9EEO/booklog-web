import { Icon } from '../components/Icon'
import type { Book, ReadingRecord } from '../types/reading'
import { buildInfo } from '../utils/buildInfo'

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
const formatCount = (value: number) => value.toLocaleString('ko-KR')

const formatFriendlyDuration = (seconds: number) => {
  if (seconds <= 0) return '0분'

  const minutes = Math.max(Math.round(seconds / 60), 1)
  const hours = Math.floor(minutes / 60)
  const remainMinutes = minutes % 60

  if (hours === 0) return `${minutes}분`
  if (remainMinutes === 0) return `${hours}시간`

  return `${hours}시간 ${remainMinutes}분`
}

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
    <div className="profile-page">
      <header className="profile-page-header">
        <h1>프로필</h1>
        <p>독서 목표와 누적 기록을 한눈에 확인해요.</p>
      </header>

      <section className="profile-hero-card">
        <div className="profile-avatar">
          <Icon name="profile" className="h-7 w-7" />
        </div>
        <div className="profile-hero-copy">
          <h2>책갈피 수집가</h2>
          <p>{userEmail || '조용한 독서 루틴'}</p>
        </div>
      </section>

      <section className="profile-goal-card">
        <div className="profile-card-heading">
          <p>하루 독서 목표</p>
          <strong>{formatGoalMinutes(dailyGoalSeconds)}</strong>
        </div>
        <div className="profile-stepper">
          <button
            type="button"
            className="profile-step-button"
            onClick={() => onAdjustDailyGoal(-5 * 60)}
            disabled={!canDecreaseGoal}
            aria-label="하루 목표 5분 줄이기"
          >
            <Icon name="minus" className="h-5 w-5" />
          </button>
          <div className="profile-step-value" aria-live="polite">
            <span>목표</span>
            <strong>{formatGoalMinutes(dailyGoalSeconds)}</strong>
          </div>
          <button
            type="button"
            className="profile-step-button"
            onClick={() => onAdjustDailyGoal(5 * 60)}
            disabled={!canIncreaseGoal}
            aria-label="하루 목표 5분 늘리기"
          >
            <Icon name="plus" className="h-5 w-5" />
          </button>
        </div>
      </section>

      <section className="profile-goal-card">
        <div className="profile-card-heading">
          <p>주간 독서 루틴</p>
          <strong>주 {weeklyGoalDays}일</strong>
        </div>
        <div className="profile-stepper">
          <button
            type="button"
            className="profile-step-button"
            onClick={() => onAdjustWeeklyGoal(-1)}
            disabled={!canDecreaseWeeklyGoal}
            aria-label="주간 목표 하루 줄이기"
          >
            <Icon name="minus" className="h-5 w-5" />
          </button>
          <div className="profile-step-value" aria-live="polite">
            <span>루틴</span>
            <strong>{weeklyGoalDays}일</strong>
          </div>
          <button
            type="button"
            className="profile-step-button"
            onClick={() => onAdjustWeeklyGoal(1)}
            disabled={!canIncreaseWeeklyGoal}
            aria-label="주간 목표 하루 늘리기"
          >
            <Icon name="plus" className="h-5 w-5" />
          </button>
        </div>
      </section>

      <div className="profile-stats-grid">
        <div className="profile-stat-card">
          <div className="profile-stat-label">
            <span>
              <Icon name="clock" className="h-3.5 w-3.5" />
            </span>
            <p>총 독서 시간</p>
          </div>
          <strong>{formatFriendlyDuration(totalSeconds)}</strong>
        </div>
        <div className="profile-stat-card">
          <div className="profile-stat-label">
            <span>
              <Icon name="records" className="h-3.5 w-3.5" />
            </span>
            <p>독서 기록</p>
          </div>
          <strong>{formatCount(records.length)}개</strong>
        </div>
        <div className="profile-stat-card">
          <div className="profile-stat-label">
            <span>
              <Icon name="check" className="h-3.5 w-3.5" />
            </span>
            <p>완독</p>
          </div>
          <strong>{formatCount(completedBooks)}권</strong>
        </div>
        <div className="profile-stat-card">
          <div className="profile-stat-label">
            <span>
              <Icon name="book" className="h-3.5 w-3.5" />
            </span>
            <p>기록 페이지</p>
          </div>
          <strong>{formatCount(totalPages)}p</strong>
        </div>
      </div>

      <div className="profile-footer-actions">
        <button type="button" className="profile-sign-out-button" onClick={() => void onSignOut()}>
          로그아웃
        </button>
      </div>

      <div className="profile-build-info">
        <p>버전 {buildInfo.version}</p>
        <p>
          배포 {buildInfo.commit} · {buildInfo.builtAt}
        </p>
      </div>
    </div>
  )
}
