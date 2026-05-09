import { type FormEvent, useState } from 'react';
import styles from './TodoInput.module.css';
import { useTodoStore } from '../store/useTodoStore';
import type { DayKey } from '../types/todo';

function TemplateIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="3" y="3" width="8" height="8" rx="1.5" fill="currentColor" opacity="0.85" />
      <rect x="13" y="3" width="8" height="8" rx="1.5" fill="currentColor" opacity="0.5" />
      <rect x="3" y="13" width="8" height="8" rx="1.5" fill="currentColor" opacity="0.5" />
      <rect x="13" y="13" width="8" height="8" rx="1.5" fill="currentColor" opacity="0.3" />
    </svg>
  );
}

interface TodoInputProps {
  day?: DayKey;
  onTemplateClick?: () => void;
}

export function TodoInput({ day, onTemplateClick }: TodoInputProps) {
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
      {onTemplateClick && (
        <button
          type="button"
          className={styles.templateButton}
          onClick={onTemplateClick}
          aria-label="템플릿 관리"
        >
          <TemplateIcon />
        </button>
      )}
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
