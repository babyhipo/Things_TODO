import { type FormEvent, useState } from 'react';
import styles from './TodoInput.module.css';
import { useTodoStore } from '../store/useTodoStore';
import type { DayKey } from '../types/todo';

interface TodoInputProps {
  day?: DayKey;
}

export function TodoInput({ day }: TodoInputProps) {
  const activeDay = useTodoStore((s) => s.activeDay);
  const addTodo = useTodoStore((s) => s.addTodo);
  const target = day ?? activeDay;

  const [value, setValue] = useState('');

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const trimmed = value.trim();
    if (!trimmed) return;
    addTodo(target, trimmed);
    setValue('');
  };

  return (
    <form className={styles.form} onSubmit={submit} role="search">
      <input
        type="text"
        className={styles.input}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="6시 기상, 8시 헬스..."
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="off"
        spellCheck={false}
        enterKeyHint="done"
        aria-label="할 일 입력"
      />
      <button
        type="submit"
        className={styles.addButton}
        aria-label="할 일 추가"
        disabled={value.trim().length === 0}
      >
        +
      </button>
    </form>
  );
}
