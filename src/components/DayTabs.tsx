import styles from './DayTabs.module.css';

export type DayTabValue = 'today' | 'tomorrow' | 'template';

interface DayTabsProps {
  activeTab: DayTabValue;
  onChange: (tab: DayTabValue) => void;
}

function getTodayDate(): { day: number; month: number } {
  const d = new Date();
  return { day: d.getDate(), month: d.getMonth() + 1 };
}

function getTomorrowDate(): { day: number; month: number } {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return { day: d.getDate(), month: d.getMonth() + 1 };
}

export function DayTabs({ activeTab, onChange }: DayTabsProps) {
  const today = getTodayDate();
  const tomorrow = getTomorrowDate();

  return (
    <div className={styles.container}>
      <button
        type="button"
        className={`${styles.tab} ${activeTab === 'today' ? styles.tabActive : ''}`}
        onClick={() => onChange('today')}
        aria-pressed={activeTab === 'today'}
      >
        <span className={styles.tabLabel}>오늘</span>
        <span className={styles.tabDate}>{today.month}/{today.day}</span>
      </button>

      <button
        type="button"
        className={`${styles.tab} ${activeTab === 'tomorrow' ? styles.tabActive : ''}`}
        onClick={() => onChange('tomorrow')}
        aria-pressed={activeTab === 'tomorrow'}
      >
        <span className={styles.tabLabel}>내일</span>
        <span className={styles.tabDate}>{tomorrow.month}/{tomorrow.day}</span>
      </button>

      <button
        type="button"
        className={`${styles.tab} ${activeTab === 'template' ? styles.tabActive : ''}`}
        onClick={() => onChange('template')}
        aria-pressed={activeTab === 'template'}
      >
        <span className={styles.tabLabel}>템플릿</span>
        <span className={styles.tabDate}>✦</span>
      </button>
    </div>
  );
}
