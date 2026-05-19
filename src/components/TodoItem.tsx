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
  gapAfter?: number;
}

function buildEditableValue(todo: Todo): string {
  if (todo.time !== null) {
    const timeStr = (todo.endTime != null)
      ? `${formatTime(todo.time)}-${formatTime(todo.endTime)}`
      : formatTime(todo.time);
    return todo.text ? `${timeStr} ${todo.text}` : timeStr;
  }
  return todo.text;
}

export function TodoItem({ todo, day, now, gapAfter = 6 }: TodoItemProps) {
  const toggleComplete = useTodoStore((s) => s.toggleComplete);
  const deleteTodo = useTodoStore((s) => s.deleteTodo);
  const updateTodoText = useTodoStore((s) => s.updateTodoText);
  const indentTodo = useTodoStore((s) => s.indentTodo);
  const outdentTodo = useTodoStore((s) => s.outdentTodo);
  const pendingParentId = useTodoStore((s) => s.pendingParentId);
  const setPendingParentId = useTodoStore((s) => s.setPendingParentId);

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
    opacity: isDragging ? 0 : undefined,
    zIndex: isDragging ? 2 : undefined,
    marginBottom: gapAfter,
  };

  const isSub = todo.parentId !== null;
  const isSelected = pendingParentId === todo.id;

  const DAY_START_MIN = 4 * 60;
  const toVirt = (t: number) => (t < DAY_START_MIN ? t + 1440 : t);

  const virtNow  = toVirt(now);
  const virtTime = todo.time !== null ? toVirt(todo.time) : null;

  const isOverdue =
    !todo.completed &&
    virtTime !== null &&
    day === 'today' &&
    virtTime < virtNow;

  const timeColor = (() => {
    if (todo.completed) return '#9CA3AF';
    if (virtTime === null) return undefined;
    if (isOverdue) return '#EF4444';
    const offset = day === 'tomorrow' ? 1440 : 0;
    const diff = virtTime + offset - virtNow;
    if (diff <= 60) return '#F59E0B';
    return '#3B5BDB';
  })();

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

  const handleAddSub = () => {
    setPendingParentId(isSelected ? null : todo.id);
  };

  return (
    <li
      ref={setNodeRef}
      style={style}
      className={[
        styles.item,
        isSub ? styles.itemSub : '',
        isDragging ? styles.itemDragging : '',
        todo.completed ? styles.itemCompleted : '',
        todo.endTime != null ? styles.itemRange : '',
        isSelected ? styles.itemSelected : '',
      ].filter(Boolean).join(' ')}
      onKeyDown={handleRowKeyDown}
      {...attributes}
    >
      {/* 시간 (자식카드는 시간 미표시) */}
      {!isSub && todo.time !== null ? (
        <div className={styles.timeWrap} aria-label={`시간 ${formatTime(todo.time)}`}>
          <span className={styles.time} style={{ color: timeColor }}>{formatTime(todo.time)}</span>
          {todo.endTime != null && (
            <span className={styles.timeEnd}>{`-${formatTime(todo.endTime)}`}</span>
          )}
        </div>
      ) : (
        <span className={styles.timeEmpty} aria-hidden="true" />
      )}

      {/* 체크박스 */}
      <button
        type="button"
        role="checkbox"
        aria-checked={todo.completed}
        aria-label={todo.completed ? '완료 취소' : '완료 처리'}
        className={`${styles.checkbox} ${todo.completed ? styles.checkboxChecked : ''}`}
        onClick={() => toggleComplete(day, todo.id)}
      >
        <span
          className={styles.checkboxInner}
          style={{ borderColor: timeColor, backgroundColor: todo.completed ? timeColor : undefined }}
          aria-hidden="true"
        />
      </button>

      {/* 일정 내용 */}
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


      {/* 하위 일정 추가 버튼 (루트 아이템만, 드래그 그립 바로 왼쪽) */}
      {!isSub && !editing ? (
        <button
          type="button"
          aria-label="하위 일정 추가"
          className={`${styles.addSubButton} ${isSelected ? styles.addSubButtonActive : ''}`}
          onClick={handleAddSub}
        >
          +
        </button>
      ) : null}

      {/* 그립 */}
      <button
        type="button"
        aria-label="드래그로 순서 변경"
        className={styles.handle}
        {...listeners}
      >
        <span className={styles.handleIcon} aria-hidden="true" />
      </button>
    </li>
  );
}
