import styles from './FolderTabs.module.css';

export type FolderTabValue = 'today' | 'tomorrow';

const DAYS_KR = ['일', '월', '화', '수', '목', '금', '토'];

function getDateInfo(offset: number) {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return {
    year: d.getFullYear(),
    month: d.getMonth() + 1,
    day: d.getDate(),
    dow: DAYS_KR[d.getDay()],
  };
}

interface FolderTabsProps {
  activeTab: FolderTabValue;
  onChange: (tab: FolderTabValue) => void;
}

export function FolderTabs({ activeTab, onChange }: FolderTabsProps) {
  const today = getDateInfo(0);
  const tomorrow = getDateInfo(1);

  return (
    <div className={styles.container}>
      <button
        type="button"
        className={`${styles.tab} ${activeTab === 'today' ? styles.tabActive : styles.tabInactive}`}
        onClick={() => onChange('today')}
        aria-pressed={activeTab === 'today'}
      >
        <span className={styles.label}>오늘</span>
        <span className={styles.date}>{today.year}년 {today.month}월 {today.day}일 {today.dow}요일</span>
      </button>

      <button
        type="button"
        className={`${styles.tab} ${activeTab === 'tomorrow' ? styles.tabActive : styles.tabInactive}`}
        onClick={() => onChange('tomorrow')}
        aria-pressed={activeTab === 'tomorrow'}
      >
        <span className={styles.label}>내일</span>
        <span className={styles.date}>{tomorrow.month}/{tomorrow.day} {tomorrow.dow}</span>
      </button>
    </div>
  );
}
