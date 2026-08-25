import { Icon } from '../components/Icon'
import type { Book, ReadingRecord } from '../types/reading'
import { buildInfo } from '../utils/buildInfo'

type ProfileScreenProps = {
  userEmail: string
  books: Book[]
  records: ReadingRecord[]
  onSignOut: () => Promise<void>
}

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

export const ProfileScreen = ({ userEmail, books, records, onSignOut }: ProfileScreenProps) => {
  const totalSeconds = books.reduce(
    (sum, book) => sum + ((book.rounds?.length ?? 0) > 0 ? book.rounds!.reduce((roundSum, round) => roundSum + round.accumulatedSeconds, 0) : book.accumulatedSeconds),
    0,
  )
  const completedBooks = books.filter((book) => book.status === 'completed' || Boolean(book.rounds?.some((round) => round.status === 'completed'))).length
  const totalPages = records.reduce((sum, record) => sum + Math.max(record.endPage - record.startPage, 0), 0)
  return (
    <div className="profile-page">
      <header className="profile-page-header">
        <div>
          <h1>프로필</h1>
          <p>{userEmail || '내 독서 기록'}</p>
        </div>
      </header>

      <section className="profile-summary-section">
        <div className="profile-section-heading">
          <h2>독서 기록</h2>
        </div>
        <div className="profile-stats-grid">
          <div className="profile-stat-card">
            <div className="profile-stat-label">
              <Icon name="clock" className="h-4 w-4" />
              <p>누적 독서 시간</p>
            </div>
            <strong>{formatFriendlyDuration(totalSeconds)}</strong>
          </div>
          <div className="profile-stat-card">
            <div className="profile-stat-label">
              <Icon name="records" className="h-4 w-4" />
              <p>독서 기록</p>
            </div>
            <strong>{formatCount(records.length)}회</strong>
          </div>
          <div className="profile-stat-card">
            <div className="profile-stat-label">
              <Icon name="check" className="h-4 w-4" />
              <p>완독</p>
            </div>
            <strong>{formatCount(completedBooks)}권</strong>
          </div>
          <div className="profile-stat-card">
            <div className="profile-stat-label">
              <Icon name="book" className="h-4 w-4" />
              <p>기록한 페이지</p>
            </div>
            <strong>{formatCount(totalPages)}p</strong>
          </div>
        </div>
      </section>

      <section className="profile-account-section">
        <div className="profile-section-heading">
          <h2>계정</h2>
        </div>
        <div className="profile-account-row">
          <Icon name="mail" className="h-5 w-5" />
          <div>
            <span>로그인 계정</span>
            <strong>{userEmail || '연결된 계정'}</strong>
          </div>
        </div>
        <button type="button" className="profile-sign-out-button" onClick={() => void onSignOut()}>
          로그아웃
        </button>
      </section>

      <footer className="profile-build-info">
        <p>버전 {buildInfo.version}</p>
        <p>
          배포 {buildInfo.commit} · {buildInfo.builtAt}
        </p>
      </footer>
    </div>
  )
}
