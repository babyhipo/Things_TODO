import styles from './ListToolbar.module.css';
import { useTodoStore } from '../store/useTodoStore';
import type { DayKey } from '../types/todo';

interface ListToolbarProps {
  day: DayKey;
}

export function ListToolbar({ day }: ListToolbarProps) {
  const clearDay = useTodoStore((s) => s.clearDay);
  const deduplicateDay = useTodoStore((s) => s.deduplicateDay);
  const todos = useTodoStore((s) => s.days[day]);

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
