import styles from './BottomNav.module.css';

export type DayNavValue = 'today' | 'tomorrow' | 'template';

interface BottomNavProps {
  active: DayNavValue;
  onChange: (day: DayNavValue) => void;
  todayDate: string;
  tomorrowDate: string;
}

function TemplateIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="3" y="3" width="8" height="8" rx="1.5" fill="currentColor" opacity="0.8" />
      <rect x="13" y="3" width="8" height="8" rx="1.5" fill="currentColor" opacity="0.5" />
      <rect x="3" y="13" width="8" height="8" rx="1.5" fill="currentColor" opacity="0.5" />
      <rect x="13" y="13" width="8" height="8" rx="1.5" fill="currentColor" opacity="0.3" />
    </svg>
  );
}

export function BottomNav({ active, onChange, todayDate, tomorrowDate }: BottomNavProps) {
  return (
    <nav className={styles.nav} role="navigation" aria-label="날짜 선택">
      <button
        type="button"
        className={`${styles.item} ${active === 'today' ? styles.itemActive : ''}`}
        onClick={() => onChange('today')}
        aria-label="오늘"
        aria-pressed={active === 'today'}
      >
        <span className={styles.dayLabel}>오늘</span>
        <span className={styles.dayDate}>{todayDate}</span>
      </button>

      <button
        type="button"
        className={`${styles.item} ${active === 'tomorrow' ? styles.itemActive : ''}`}
        onClick={() => onChange('tomorrow')}
        aria-label="내일"
        aria-pressed={active === 'tomorrow'}
      >
        <span className={styles.dayLabel}>내일</span>
        <span className={styles.dayDate}>{tomorrowDate}</span>
      </button>

      <button
        type="button"
        className={`${styles.item} ${active === 'template' ? styles.itemActive : ''}`}
        onClick={() => onChange('template')}
        aria-label="템플릿 관리"
        aria-pressed={active === 'template'}
      >
        <span className={styles.icon}><TemplateIcon /></span>
        <span className={styles.label}>템플릿</span>
      </button>
    </nav>
  );
}
