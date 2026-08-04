import { Icon } from '../Icon'

type LandingNavProps = {
  activeItem?: 'timer' | 'sentences' | 'words' | 'library'
}

const navigationItems = [
  { key: 'timer', title: 'TIMER', href: '/timer' },
  { key: 'sentences', title: 'SENTENCES', href: '#' },
  { key: 'words', title: 'WORDS', href: '#' },
  { key: 'library', title: 'LIBRARY', href: '#' },
] as const

export const LandingNav = ({ activeItem }: LandingNavProps) => (
  <header className="landing-nav">
    <a href="/" className="landing-brand" aria-label="북로그 홈">
      <Icon name="book" className="h-5 w-5" />
      <span>BOOKLOG</span>
    </a>
    <nav aria-label="웹 메뉴">
      {navigationItems.map((item) => (
        <a
          key={item.key}
          href={item.href}
          className={activeItem === item.key ? 'landing-nav-active' : undefined}
          aria-current={activeItem === item.key ? 'page' : undefined}
        >
          {item.title}
        </a>
      ))}
    </nav>
    <a className="landing-nav-cta" href="/login">
      GET STARTED
      <Icon name="chevronRight" className="h-4 w-4" />
    </a>
  </header>
)
