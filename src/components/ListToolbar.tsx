import styles from './ListToolbar.module.css';
import { useTodoStore } from '../store/useTodoStore';
import type { DayKey } from '../types/todo';

interface ListToolbarProps {
  day: DayKey;
}

export function ListToolbar({ day }: ListToolbarProps) {
  const clearDay = useTodoStore((s) => s.clearDay);
  const todos = useTodoStore((s) => s.days[day]);

  const handleClear = () => {
    if (todos.length === 0) return;
    clearDay(day);
  };

  return (
    <div className={styles.bar}>
      <button
        type="button"
        className={styles.clearBtn}
        onClick={handleClear}
        disabled={todos.length === 0}
      >
        전체 지우기
      </button>
    </div>
  );
}
