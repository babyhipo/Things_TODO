import styles from './ListToolbar.module.css';
import { useTodoStore } from '../store/useTodoStore';
import type { DayKey } from '../types/todo';

interface ListToolbarProps {
  day: DayKey;
}

function UndoIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
      <path
        d="M2 4.5h6.5a3.5 3.5 0 0 1 0 7H5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M4.5 2L2 4.5 4.5 7"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function ListToolbar({ day }: ListToolbarProps) {
  const clearDay       = useTodoStore((s) => s.clearDay);
  const deduplicateDay = useTodoStore((s) => s.deduplicateDay);
  const undo           = useTodoStore((s) => s.undo);
  const historyLength  = useTodoStore((s) => s.historyLength);
  const todos          = useTodoStore((s) => s.days[day]);

  const hasDuplicates = (() => {
    const seen = new Set<string>();
    return todos.some((t) => {
      const key = `${t.time ?? 'null'}::${t.text}`;
      if (seen.has(key)) return true;
      seen.add(key);
      return false;
    });
  })();

  return (
    <div className={styles.bar}>
      <button
        type="button"
        className={styles.undoBtn}
        onClick={undo}
        disabled={historyLength === 0}
        aria-label="되돌리기"
      >
        <UndoIcon />
      </button>
      <button
        type="button"
        className={styles.dedupBtn}
        onClick={() => deduplicateDay(day)}
        disabled={!hasDuplicates}
      >
        중복 지우기
      </button>
      <button
        type="button"
        className={styles.clearBtn}
        onClick={() => { if (todos.length > 0) clearDay(day); }}
        disabled={todos.length === 0}
      >
        전체 지우기
      </button>
    </div>
  );
}
