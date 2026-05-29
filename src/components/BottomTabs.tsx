import { motion } from 'framer-motion'
import { Icon } from './Icon'
import type { IconName } from './Icon'
import type { TabKey } from '../types/reading'

type BottomTabsProps = {
  activeTab: TabKey
  onChange: (tab: TabKey) => void
}

const tabs: Array<{ key: TabKey; label: string; icon: IconName }> = [
  { key: 'home', label: '홈', icon: 'home' },
  { key: 'session', label: '독서중', icon: 'timer' },
  { key: 'records', label: '기록', icon: 'records' },
  { key: 'library', label: '서재', icon: 'library' },
  { key: 'profile', label: '프로필', icon: 'profile' },
]

export const BottomTabs = ({ activeTab, onChange }: BottomTabsProps) => (
  <nav className="fixed inset-x-0 bottom-0 z-30 mx-auto max-w-[430px] border-t-2 border-[#2F2A26] bg-[#FCFBF7] px-2 pb-[max(10px,env(safe-area-inset-bottom))] pt-2 shadow-[0_-10px_28px_rgba(47,42,38,0.08)]">
    <div className="grid grid-cols-5 gap-1">
      {tabs.map((tab) => {
        const isActive = activeTab === tab.key

        return (
          <motion.button
            key={tab.key}
            type="button"
            className={`tab-button ${isActive ? 'tab-button-active' : ''}`}
            onClick={() => onChange(tab.key)}
            aria-current={isActive ? 'page' : undefined}
            whileTap={{ scale: 0.94, y: 1 }}
            transition={{ type: 'spring', stiffness: 500, damping: 28 }}
          >
            <Icon name={tab.icon} className="h-5 w-5" />
            <span>{tab.label}</span>
          </motion.button>
        )
      })}
    </div>
  </nav>
)
