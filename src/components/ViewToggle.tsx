import styles from './ViewToggle.module.css';

export type ContentView = 'list' | 'mix';

interface ViewToggleProps {
  active: ContentView;
  onChange: (view: ContentView) => void;
}

function ListIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="3" y="5" width="18" height="2" rx="1" fill="currentColor" />
      <rect x="3" y="11" width="18" height="2" rx="1" fill="currentColor" />
      <rect x="3" y="17" width="18" height="2" rx="1" fill="currentColor" />
    </svg>
  );
}

function MixIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="3" y="5" width="8" height="2" rx="1" fill="currentColor" />
      <rect x="3" y="11" width="8" height="2" rx="1" fill="currentColor" />
      <rect x="3" y="17" width="8" height="2" rx="1" fill="currentColor" />
      <rect x="14" y="3" width="7" height="18" rx="2" stroke="currentColor" strokeWidth="1.8" fill="none" />
      <line x1="14" y1="9" x2="21" y2="9" stroke="currentColor" strokeWidth="1.2" />
      <line x1="14" y1="15" x2="21" y2="15" stroke="currentColor" strokeWidth="1.2" />
    </svg>
  );
}

const VIEWS: { id: ContentView; icon: React.ReactNode; label: string }[] = [
  { id: 'list', icon: <ListIcon />, label: '목록' },
  { id: 'mix',  icon: <MixIcon />,  label: '믹스' },
];

export function ViewToggle({ active, onChange }: ViewToggleProps) {
  return (
    <div className={styles.pill} role="tablist" aria-label="뷰 선택">
      {VIEWS.map(({ id, icon, label }) => (
        <button
          key={id}
          type="button"
          role="tab"
          aria-selected={active === id}
          className={`${styles.seg} ${active === id ? styles.segActive : ''}`}
          onClick={() => onChange(id)}
          aria-label={`${label} 보기`}
        >
          <span className={styles.segIcon}>{icon}</span>
          <span className={styles.segLabel}>{label}</span>
        </button>
      ))}
    </div>
  );
}
