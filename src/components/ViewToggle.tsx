import styles from './ViewToggle.module.css';

export type ContentView = 'list' | 'timetable';

interface ViewToggleProps {
  active: ContentView;
  onChange: (view: ContentView) => void;
}

function ListIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="3" y="5" width="18" height="2" rx="1" fill="currentColor" />
      <rect x="3" y="11" width="18" height="2" rx="1" fill="currentColor" />
      <rect x="3" y="17" width="18" height="2" rx="1" fill="currentColor" />
    </svg>
  );
}

function TimetableIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="3" y="3" width="18" height="18" rx="3" stroke="currentColor" strokeWidth="2" fill="none" />
      <line x1="3" y1="9" x2="21" y2="9" stroke="currentColor" strokeWidth="1.5" />
      <line x1="3" y1="15" x2="21" y2="15" stroke="currentColor" strokeWidth="1.5" />
      <line x1="9" y1="3" x2="9" y2="21" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

export function ViewToggle({ active, onChange }: ViewToggleProps) {
  const isTimetable = active === 'timetable';

  return (
    <button
      type="button"
      className={`${styles.toggle} ${isTimetable ? styles.on : styles.off}`}
      onClick={() => onChange(isTimetable ? 'list' : 'timetable')}
      aria-label={isTimetable ? '목록 보기로 전환' : '시간표 보기로 전환'}
    >
      <span className={styles.circle}>
        {isTimetable ? <TimetableIcon /> : <ListIcon />}
      </span>
      <span className={styles.label}>
        {isTimetable ? '시간표' : '목록'}
      </span>
    </button>
  );
}
