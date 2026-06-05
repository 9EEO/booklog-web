import type { ReactNode } from 'react'
import { motion } from 'framer-motion'
import type { TabKey } from '../types/reading'

type BottomTabsProps = {
  activeTab: TabKey
  onChange: (tab: TabKey) => void
}

const tabs: Array<{ key: TabKey; label: string }> = [
  { key: 'home', label: '홈' },
  { key: 'session', label: '독서중' },
  { key: 'records', label: '기록' },
  { key: 'library', label: '서재' },
  { key: 'profile', label: '프로필' },
]

const tabIcons: Record<TabKey, ReactNode> = {
  home: (
    <>
      <path d="M3.5 10.7 12 3.8l8.5 6.9" />
      <path d="M5.8 9.6v10.1h4.1v-5.8h4.2v5.8h4.1V9.6" />
    </>
  ),
  session: (
    <>
      <path d="M10 3h4" />
      <path d="M12 7v5.2l3.2 2" />
      <path d="M12 21a8 8 0 1 0 0-16 8 8 0 0 0 0 16Z" />
    </>
  ),
  records: (
    <>
      <path d="M7 4.5h10a2 2 0 0 1 2 2v13H5v-13a2 2 0 0 1 2-2Z" />
      <path d="M8.5 9h7" />
      <path d="M8.5 13h7" />
      <path d="M8.5 17h4" />
    </>
  ),
  library: (
    <>
      <path d="M4.5 5.5h5a3 3 0 0 1 3 3v11a3 3 0 0 0-3-3h-5v-11Z" />
      <path d="M19.5 5.5h-5a3 3 0 0 0-3 3v11a3 3 0 0 1 3-3h5v-11Z" />
    </>
  ),
  profile: (
    <>
      <path d="M12 12.2a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z" />
      <path d="M4.8 20c1-3.1 3.4-4.7 7.2-4.7s6.2 1.6 7.2 4.7" />
    </>
  ),
}

const BottomTabIcon = ({ tab }: { tab: TabKey }) => (
  <svg
    className="bottom-tab-svg"
    viewBox="0 0 24 24"
    aria-hidden="true"
    fill="none"
  >
    {tabIcons[tab]}
  </svg>
)

export const BottomTabs = ({ activeTab, onChange }: BottomTabsProps) => (
  <nav className="bottom-tabs" aria-label="주요 화면">
    <div className="bottom-tabs-shell">
      {tabs.map((tab) => {
        const isActive = activeTab === tab.key

        return (
          <motion.button
            key={tab.key}
            type="button"
            className={`bottom-tab-button ${isActive ? 'bottom-tab-button-active' : ''}`}
            onClick={() => onChange(tab.key)}
            aria-current={isActive ? 'page' : undefined}
            aria-label={tab.label}
            whileTap={{ scale: 0.96 }}
            transition={{ type: 'spring', stiffness: 500, damping: 28 }}
          >
            <span className="bottom-tab-icon">
              <BottomTabIcon tab={tab.key} />
            </span>
            {isActive && <span className="bottom-tab-label">{tab.label}</span>}
          </motion.button>
        )
      })}
    </div>
  </nav>
)
