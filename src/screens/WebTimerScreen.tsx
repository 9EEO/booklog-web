import { BookStackCarousel } from '../components/landing/BookStackCarousel'
import { LandingNav } from '../components/landing/LandingNav'
import type { Book } from '../types/reading'

type WebTimerScreenProps = {
  books: Book[]
}

export const WebTimerScreen = ({ books }: WebTimerScreenProps) => (
  <main className="landing-screen">
    <div className="landing-shell">
      <LandingNav activeItem="timer" />
      {/* <section className="web-timer-hero">
        <span>TIMER</span>
        <h1>Choose your next reading session.</h1>
        <p>
          읽을 책을 고르고 타이머를 시작해보세요. 책마다 쌓인 시간과 문장을
          자연스럽게 이어갈 수 있어요.
        </p>
      </section> */}
      <BookStackCarousel books={books} />
    </div>
  </main>
)
