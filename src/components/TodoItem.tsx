import {
  type KeyboardEvent,
  type MouseEvent,
  useEffect,
  useRef,
  useState,
} from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import styles from './TodoItem.module.css';
import { useTodoStore } from '../store/useTodoStore';
import { formatTime } from '../lib/timeFormatter';
import { toVirt } from '../lib/dayBoundary';
import type { DayKey, Todo } from '../types/todo';
import { EditTextArea } from './EditTextArea';
import { StarIcon, STAR_COLOR, STAR_DONE_COLOR } from './StarIcon';
import { caretFromClick } from '../lib/caretFromClick';

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
  const inputRef = useRef<HTMLTextAreaElement | null>(null);
  const cancelRef = useRef(false);
  // 수정칸이 열릴 때 커서를 둘 위치 (null = 맨 끝)
  const caretRef = useRef<number | null>(null);

  useEffect(() => {
    if (!editing) {
      setDraft(buildEditableValue(todo));
    }
  }, [todo, editing]);

  useEffect(() => {
    if (editing && inputRef.current) {
      const el = inputRef.current;
      el.focus();
      const pos = caretRef.current ?? el.value.length;
      el.setSelectionRange(pos, pos);
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

  const virtNow  = toVirt(now);
  const virtTime = todo.time !== null ? toVirt(todo.time) : null;

  const isOverdue =
    !todo.completed &&
    virtTime !== null &&
    day === 'today' &&
    virtTime < virtNow;

  const timeColor = (() => {
    if (todo.completed) return '#9CA3AF';
    if (virtTime === null) return isSub ? undefined : '#7C3AED';
    if (isOverdue) return '#EF4444';
    const offset = day === 'tomorrow' ? 1440 : 0;
    const diff = virtTime + offset - virtNow;
    if (diff <= 60) return '#F59E0B';
    return '#3B5BDB';
  })();

  const beginEdit = (e: MouseEvent<HTMLButtonElement>) => {
    if (editing) return;
    const value = buildEditableValue(todo);
    // 누른 글자 위치 + 수정칸 앞에 붙는 시간 문자열 길이만큼 보정
    const caret = caretFromClick(e);
    caretRef.current = caret === null
      ? null
      : value.length - todo.text.length + Math.min(caret, todo.text.length);
    setDraft(value);
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

  // 엔터(저장)·ESC(취소)는 EditTextArea가 처리 — 여기선 Tab 들여쓰기/내어쓰기만
  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
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
        {/* 주요 일정이면 동그라미 대신 별 (완료 시 회색) */}
        {todo.starred ? (
          <StarIcon size={isSub ? 15 : 18} color={todo.completed ? STAR_DONE_COLOR : STAR_COLOR} />
        ) : (
          <span
            className={styles.checkboxInner}
            style={{ borderColor: timeColor, backgroundColor: todo.completed ? timeColor : undefined }}
            aria-hidden="true"
          />
        )}
      </button>

      {/* 일정 내용 */}
      <div className={styles.textWrap}>
        {editing ? (
          <EditTextArea
            inputRef={inputRef}
            className={styles.textInput}
            value={draft}
            onChange={setDraft}
            onCommit={commitEdit}
            onCancel={cancelEdit}
            onBlur={handleBlur}
            onKeyDown={handleKeyDown}
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
          <span className={styles.plusIcon} aria-hidden="true" />
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
