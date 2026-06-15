import { motion } from "framer-motion";
import { Icon, type IconName } from "./Icon";
import type { TabKey } from "../types/reading";

type BottomTabsProps = {
  activeTab: TabKey;
  disabledTabs?: TabKey[];
  onChange: (tab: TabKey) => void;
};

const tabs: Array<{ key: TabKey; label: string }> = [
  { key: "session", label: "독서중" },
  { key: "records", label: "기록" },
  { key: "library", label: "서재" },
  { key: "profile", label: "프로필" },
];

const tabIcons: Record<TabKey, IconName> = {
  home: "home",
  session: "timer",
  records: "records",
  library: "library",
  profile: "profile",
};

const BottomTabIcon = ({ tab }: { tab: TabKey }) => (
  <Icon name={tabIcons[tab]} variant="bulk" className="bottom-tab-svg" />
);

export const BottomTabs = ({
  activeTab,
  disabledTabs = [],
  onChange,
}: BottomTabsProps) => (
  <nav className="bottom-tabs" aria-label="주요 화면">
    <div className="bottom-tabs-shell">
      {tabs.map((tab) => {
        const isActive = activeTab === tab.key;
        const isDisabled = disabledTabs.includes(tab.key);

        return (
          <motion.button
            key={tab.key}
            type="button"
            className={`bottom-tab-button ${isActive ? "bottom-tab-button-active" : ""} ${isDisabled ? "bottom-tab-button-disabled" : ""}`}
            onClick={() => onChange(tab.key)}
            disabled={isDisabled}
            aria-current={isActive ? "page" : undefined}
            aria-label={tab.label}
            whileTap={isDisabled ? undefined : { scale: 0.96 }}
            transition={{ type: "spring", stiffness: 500, damping: 28 }}
          >
            <span className="bottom-tab-icon">
              <BottomTabIcon tab={tab.key} />
            </span>
            <span className="bottom-tab-label">{tab.label}</span>
          </motion.button>
        );
      })}
    </div>
  </nav>
);
