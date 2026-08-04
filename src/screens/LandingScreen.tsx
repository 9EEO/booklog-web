import { motion } from 'framer-motion'
import { LandingNav } from '../components/landing/LandingNav'
import { Icon } from '../components/Icon'

const heroTitleWords = ['READING', 'NOTES', 'BECOME', 'YOUR', 'LIBRARY']

const landingLabels = [
  { icon: 'timer' as const, label: 'Reading Timer' },
  { icon: 'quote' as const, label: 'Sentence Archive' },
  { icon: 'search' as const, label: 'Word Lookup' },
]

const landingFeatures = [
  {
    icon: 'book' as const,
    title: 'Choose a Book',
    description: 'Start a focused session from the book you are reading now.',
  },
  {
    icon: 'edit' as const,
    title: 'Capture the Moment',
    description: 'Save sentences, pages, and words while the reading flow is fresh.',
  },
  {
    icon: 'library' as const,
    title: 'Build a Library',
    description: 'Turn small reading traces into a personal archive you can revisit.',
  },
]

export const LandingScreen = () => (
  <main className="landing-screen">
    <div className="landing-shell">
      <LandingNav />

      <section className="landing-hero">
        <motion.h1
          initial={{ filter: 'blur(10px)', opacity: 0, y: 50 }}
          animate={{ filter: 'blur(0px)', opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          {heroTitleWords.map((word, index) => (
            <motion.span
              key={word}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.15, duration: 0.6 }}
            >
              {word}
            </motion.span>
          ))}
        </motion.h1>
        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.2, duration: 0.6 }}
        >
          타이머를 켜고 책을 읽어보세요. 마음에 남은 문장과 모르는 단어까지
          한곳에 차곡차곡 모을 수 있어요.
        </motion.p>

        <motion.div
          className="landing-labels"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.8, duration: 0.6 }}
        >
          {landingLabels.map((item, index) => (
            <motion.span
              key={item.label}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{
                delay: 1.8 + index * 0.15,
                duration: 0.6,
                type: 'spring',
                stiffness: 100,
                damping: 10,
              }}
            >
              <Icon name={item.icon} className="h-5 w-5" />
              {item.label}
            </motion.span>
          ))}
        </motion.div>

        <motion.div
          className="landing-actions"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{
            delay: 2.4,
            duration: 0.6,
            type: 'spring',
            stiffness: 100,
            damping: 10,
          }}
        >
          <a href="/login?mode=signUp">
            GET STARTED
            <Icon name="chevronRight" className="h-4 w-4" />
          </a>
        </motion.div>
      </section>

      <section className="landing-features" aria-label="핵심 기능">
        {landingFeatures.map((feature, index) => (
          <motion.article
            key={feature.title}
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{
              delay: 3.2 + index * 0.2,
              duration: 0.6,
              type: 'spring',
              stiffness: 100,
              damping: 10,
            }}
          >
            <span>
              <Icon name={feature.icon} className="h-8 w-8" />
            </span>
            <h2>{feature.title}</h2>
            <p>{feature.description}</p>
          </motion.article>
        ))}
      </section>
    </div>
  </main>
)
