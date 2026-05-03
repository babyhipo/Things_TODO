import styles from './BottomNav.module.css';

export type ViewMode = 'list' | 'timetable' | 'template';

interface BottomNavProps {
  active: ViewMode;
  onChange: (mode: ViewMode) => void;
}

function ListIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="3" y="5" width="18" height="2" rx="1" fill="currentColor" />
      <rect x="3" y="11" width="18" height="2" rx="1" fill="currentColor" />
      <rect x="3" y="17" width="18" height="2" rx="1" fill="currentColor" />
    </svg>
  );
}

function TimetableIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="3" y="3" width="18" height="18" rx="3" stroke="currentColor" strokeWidth="2" fill="none" />
      <line x1="3" y1="9" x2="21" y2="9" stroke="currentColor" strokeWidth="1.5" />
      <line x1="3" y1="15" x2="21" y2="15" stroke="currentColor" strokeWidth="1.5" />
      <line x1="9" y1="3" x2="9" y2="21" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

function TemplateIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="3" y="3" width="8" height="8" rx="1.5" fill="currentColor" opacity="0.8" />
      <rect x="13" y="3" width="8" height="8" rx="1.5" fill="currentColor" opacity="0.5" />
      <rect x="3" y="13" width="8" height="8" rx="1.5" fill="currentColor" opacity="0.5" />
      <rect x="13" y="13" width="8" height="8" rx="1.5" fill="currentColor" opacity="0.3" />
    </svg>
  );
}

export function BottomNav({ active, onChange }: BottomNavProps) {
  return (
    <nav className={styles.nav} role="navigation" aria-label="보기 모드 선택">
      <button
        type="button"
        className={`${styles.item} ${active === 'list' ? styles.itemActive : ''}`}
        onClick={() => onChange('list')}
        aria-label="목록 보기"
        aria-pressed={active === 'list'}
      >
        <span className={styles.icon}><ListIcon /></span>
        <span className={styles.label}>목록</span>
      </button>

      <button
        type="button"
        className={`${styles.item} ${active === 'timetable' ? styles.itemActive : ''}`}
        onClick={() => onChange('timetable')}
        aria-label="시간표 보기"
        aria-pressed={active === 'timetable'}
      >
        <span className={styles.icon}><TimetableIcon /></span>
        <span className={styles.label}>시간표</span>
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
