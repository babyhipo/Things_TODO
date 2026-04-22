import styles from './DayTabs.module.css';
import { useTodoStore } from '../store/useTodoStore';
import type { DayKey } from '../types/todo';

interface TabButtonProps {
  day: DayKey;
  label: string;
  active: boolean;
  onClick: () => void;
}

function TabButton({ day, label, active, onClick }: TabButtonProps) {
  return (
    <button
      type="button"
      role="tab"
      id={`daytab-${day}`}
      aria-selected={active}
      aria-controls={`daypanel-${day}`}
      tabIndex={active ? 0 : -1}
      className={`${styles.tab} ${active ? styles.tabActive : ''}`}
      onClick={onClick}
    >
      {label}
    </button>
  );
}

export function DayTabs() {
  const activeDay = useTodoStore((s) => s.activeDay);
  const setActiveDay = useTodoStore((s) => s.setActiveDay);

  return (
    <nav className={styles.tabs} role="tablist" aria-label="날짜 선택">
      <TabButton
        day="today"
        label="오늘 할 일"
        active={activeDay === 'today'}
        onClick={() => setActiveDay('today')}
      />
      <TabButton
        day="tomorrow"
        label="내일 계획"
        active={activeDay === 'tomorrow'}
        onClick={() => setActiveDay('tomorrow')}
      />
    </nav>
  );
}
