import { type FormEvent, useEffect, useRef, useState } from 'react';
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
  const days = useTodoStore((s) => s.days);
  const pendingParentId = useTodoStore((s) => s.pendingParentId);
  const setPendingParentId = useTodoStore((s) => s.setPendingParentId);

  const target = day ?? activeDay;
  const [value, setValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  // pendingParentId가 설정되면 입력창 포커스
  useEffect(() => {
    if (pendingParentId) {
      inputRef.current?.focus();
    }
  }, [pendingParentId]);

  // 대상 부모 일정 텍스트 찾기
  const pendingParent = pendingParentId
    ? (days[target]?.find((t) => t.id === pendingParentId) ?? null)
    : null;

  const doSubmit = (meridiemHint: 'am' | 'pm') => {
    const trimmed = value.trim();
    if (!trimmed) return;
    addTodo(target, trimmed, meridiemHint, pendingParentId ?? undefined);
    setPendingParentId(null);
    setValue('');
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    doSubmit('am');
  };

  const submitPm = () => doSubmit('pm');

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape' && pendingParentId) {
      e.preventDefault();
      setPendingParentId(null);
    }
  };

  const empty = value.trim().length === 0;

  return (
    <div className={styles.wrapper}>
      {/* 하위 일정 추가 모드 표시 */}
      {pendingParent && (
        <div className={styles.parentChip}>
          <span className={styles.parentChipArrow}>↳</span>
          <span className={styles.parentChipText}>
            {pendingParent.text || '(내용 없음)'}
          </span>
          <span className={styles.parentChipLabel}>의 하위 일정</span>
          <button
            type="button"
            className={styles.parentChipCancel}
            aria-label="하위 일정 모드 취소"
            onClick={() => setPendingParentId(null)}
          >
            ×
          </button>
        </div>
      )}

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
          ref={inputRef}
          type="text"
          className={`${styles.input} ${pendingParent ? styles.inputSub : ''}`}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={pendingParent ? '하위 일정 입력...' : '6시 기상, 8시 헬스...'}
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
          spellCheck={false}
          enterKeyHint="done"
          aria-label="할 일 입력"
        />
        <button
          type="submit"
          className={styles.amButton}
          aria-label="오전 일정으로 추가"
          disabled={empty}
        >
          AM
        </button>
        <button
          type="button"
          className={styles.pmButton}
          aria-label="오후 일정으로 추가"
          disabled={empty}
          onClick={submitPm}
        >
          PM
        </button>
      </form>
    </div>
  );
}
