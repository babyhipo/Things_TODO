import {
  type KeyboardEvent,
  type ChangeEvent,
  useEffect,
  useRef,
  useState,
} from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import styles from './TodoItem.module.css';
import { useTodoStore } from '../store/useTodoStore';
import { formatTime } from '../lib/timeFormatter';
import type { DayKey, Todo } from '../types/todo';

interface TodoItemProps {
  todo: Todo;
  day: DayKey;
  now: number;
}

function buildEditableValue(todo: Todo): string {
  if (todo.time !== null) {
    return todo.text ? `${formatTime(todo.time)} ${todo.text}` : formatTime(todo.time);
  }
  return todo.text;
}

export function TodoItem({ todo, day, now }: TodoItemProps) {
  const toggleComplete = useTodoStore((s) => s.toggleComplete);
  const deleteTodo = useTodoStore((s) => s.deleteTodo);
  const updateTodoText = useTodoStore((s) => s.updateTodoText);
  const indentTodo = useTodoStore((s) => s.indentTodo);
  const outdentTodo = useTodoStore((s) => s.outdentTodo);

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: todo.id });

  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<string>(() => buildEditableValue(todo));
  const inputRef = useRef<HTMLInputElement | null>(null);
  // 편집 취소(Escape) 시 blur 저장 로직이 실행되지 않도록 플래그로 구분
  const cancelRef = useRef(false);

  useEffect(() => {
    if (!editing) {
      setDraft(buildEditableValue(todo));
    }
  }, [todo, editing]);

  useEffect(() => {
    if (editing && inputRef.current) {
      const el = inputRef.current;
      el.focus();
      const len = el.value.length;
      el.setSelectionRange(len, len);
    }
  }, [editing]);

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : undefined,
    zIndex: isDragging ? 2 : undefined,
  };

  const isSub = todo.parentId !== null;
  const isOverdue =
    !todo.completed &&
    todo.time !== null &&
    day === 'today' &&
    todo.time < now;

  const beginEdit = () => {
    if (editing) return;
    setDraft(buildEditableValue(todo));
    cancelRef.current = false;
    setEditing(true);
  };

  const commitEdit = () => {
    const value = draft.trim();
    if (!value) {
      deleteTodo(day, todo.id);
    } else {
      updateTodoText(day, todo.id, value);
    }
    setEditing(false);
  };

  const cancelEdit = () => {
    cancelRef.current = true;
    setDraft(buildEditableValue(todo));
    setEditing(false);
  };

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    setDraft(e.target.value);
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      commitEdit();
      return;
    }
    if (e.key === 'Escape') {
      e.preventDefault();
      cancelEdit();
      return;
    }
    if (e.key === 'Tab') {
      e.preventDefault();
      if (e.shiftKey) {
        if (isSub) outdentTodo(day, todo.id);
      } else {
        if (!isSub) indentTodo(day, todo.id);
      }
    }
  };

  const handleBlur = () => {
    if (cancelRef.current) {
      cancelRef.current = false;
      return;
    }
    commitEdit();
  };

  const handleRowKeyDown = (e: KeyboardEvent<HTMLLIElement>) => {
    if (editing) return;
    if (e.key === 'Tab') {
      e.preventDefault();
      if (e.shiftKey) {
        if (isSub) outdentTodo(day, todo.id);
      } else {
        if (!isSub) indentTodo(day, todo.id);
      }
    }
  };

  return (
    <li
      ref={setNodeRef}
      style={style}
      className={`${styles.item} ${isSub ? styles.itemSub : ''} ${
        isDragging ? styles.itemDragging : ''
      } ${todo.completed ? styles.itemCompleted : ''}`}
      onKeyDown={handleRowKeyDown}
      {...attributes}
    >
      <button
        type="button"
        aria-label="드래그로 순서 변경"
        className={styles.handle}
        {...listeners}
      >
        <span className={styles.handleIcon} aria-hidden="true" />
      </button>

      <button
        type="button"
        role="checkbox"
        aria-checked={todo.completed}
        aria-label={todo.completed ? '완료 취소' : '완료 처리'}
        className={`${styles.checkbox} ${todo.completed ? styles.checkboxChecked : ''}`}
        onClick={() => toggleComplete(day, todo.id)}
      >
        <span className={styles.checkboxInner} aria-hidden="true" />
      </button>

      {isOverdue ? (
        <span className={styles.warnBadge} aria-label="시간이 지났습니다">
          !
        </span>
      ) : null}

      {todo.time !== null ? (
        <span className={styles.time} aria-label={`시간 ${formatTime(todo.time)}`}>
          {formatTime(todo.time)}
        </span>
      ) : (
        <span className={styles.timeEmpty} aria-hidden="true" />
      )}

      <div className={styles.textWrap}>
        {editing ? (
          <input
            ref={inputRef}
            type="text"
            className={styles.textInput}
            value={draft}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            onBlur={handleBlur}
            autoComplete="off"
          />
        ) : (
          <button
            type="button"
            className={styles.textButton}
            onClick={beginEdit}
          >
            {todo.text || <span className={styles.textEmpty}>(내용 없음)</span>}
          </button>
        )}
      </div>

      {editing ? (
        <div className={styles.indentButtons}>
          {isSub ? (
            <button
              type="button"
              aria-label="내어쓰기"
              className={styles.iconButton}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => outdentTodo(day, todo.id)}
            >
              {'←'}
            </button>
          ) : (
            <button
              type="button"
              aria-label="들여쓰기"
              className={styles.iconButton}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => indentTodo(day, todo.id)}
            >
              {'→'}
            </button>
          )}
        </div>
      ) : null}

      <button
        type="button"
        aria-label="삭제"
        className={styles.deleteButton}
        onClick={() => deleteTodo(day, todo.id)}
      >
        {'×'}
      </button>
    </li>
  );
}
