import type { MutableRefObject } from 'react';
// 스타일은 믹스뷰와 완전히 동일해야 하므로 같은 CSS 모듈을 공유한다.
import styles from './MixView.module.css';
import { getSwipeVisual, type SwipeState } from '../lib/timelineMath';
import type { DayKey, Todo } from '../types/todo';
import { EditTextArea } from './EditTextArea';
import { StarIcon, StarToggleButton, STAR_COLOR, STAR_DONE_COLOR } from './StarIcon';
import { caretFromClick } from '../lib/caretFromClick';

interface SubItemRowProps {
  child: Todo;
  day: DayKey;
  /** 진행 중인 좌우 스와이프 상태(왼쪽 삭제 / 오른쪽 내일로) */
  swipe: SwipeState | null;
  onSwipeStart: (e: React.PointerEvent, todoId: string) => void;
  onToggle: (todoId: string) => void;
  /** 드래그로 들어올린 항목이면 반투명 표시 */
  dragging?: boolean;
  /** 드래그 손잡이 동작. 넘기지 않으면 손잡이를 그리지 않는다 */
  onDragStart?: (e: React.PointerEvent, child: Todo) => void;
  // 편집(부모 카드와 동일한 흐름)
  editingId: string | null;
  editDraft: string;
  setEditDraft: (v: string) => void;
  editInputRef: MutableRefObject<HTMLTextAreaElement | null>;
  beginEdit: (todo: Todo, caret?: number | null) => void;
  commitEdit: (todoId: string) => void;
  cancelEdit: () => void;
  /** 주요 일정(별) 켜기/끄기 — 수정 중에만 버튼이 나타남 */
  onToggleStar: (todoId: string) => void;
}

/**
 * 하위일정 한 줄. 타임라인 카드 아래와 '시간 미지정' 목록 아래에서 같은 모습으로 쓰인다.
 * (예전에는 두 곳에 같은 JSX가 복사돼 있었음)
 */
export function SubItemRow({
  child, day, swipe, onSwipeStart, onToggle, dragging = false, onDragStart,
  editingId, editDraft, setEditDraft, editInputRef, beginEdit, commitEdit, cancelEdit, onToggleStar,
}: SubItemRowProps) {
  const { active, offset, deleteProgress, moveProgress } = getSwipeVisual(swipe, child.id);

  return (
    <div className={styles.subRow}>
      {active && offset < -12 && (
        <div className={styles.swipeDeleteHint} style={{ opacity: deleteProgress }}>×</div>
      )}
      {active && offset > 12 && day === 'today' && !child.completed && (
        <div className={styles.swipeMoveHint} style={{ opacity: moveProgress }}>→</div>
      )}
      <div
        data-sub-id={child.id}
        className={`${styles.subItem} ${child.completed ? styles.subItemDone : ''} ${dragging ? styles.subItemDragging : ''}`}
        onPointerDown={e => onSwipeStart(e, child.id)}
        style={{
          transform: `translateX(${offset}px)`,
          transition: active ? 'none' : 'transform 200ms ease',
        }}
      >
        <span className={styles.subItemArrow} aria-hidden="true">└</span>

        {/* 체크박스 */}
        <button
          type="button"
          className={`${styles.subItemCheckbox} ${child.completed ? styles.subItemCheckboxChecked : ''}`}
          onClick={() => onToggle(child.id)}
          aria-label={child.completed ? '완료 취소' : '완료 처리'}
          role="checkbox"
          aria-checked={child.completed}
        >
          {/* 주요 일정이면 네모 대신 별 (완료 시 회색) */}
          {child.starred ? (
            <StarIcon size={15} color={child.completed ? STAR_DONE_COLOR : STAR_COLOR} />
          ) : (
            <span className={styles.subItemCheckboxInner} aria-hidden="true" />
          )}
        </button>

        {/* 텍스트: 클릭 시 편집 (부모카드와 동일) */}
        {editingId === child.id ? (
          <EditTextArea
            inputRef={editInputRef}
            className={styles.editInput}
            value={editDraft}
            onChange={setEditDraft}
            onCommit={() => commitEdit(child.id)}
            onCancel={cancelEdit}
            onBlur={() => commitEdit(child.id)}
            stopPointer
          />
        ) : (
          <button
            type="button"
            className={`${styles.subItemText} ${child.completed ? styles.subItemTextDone : ''}`}
            onClick={e => { if (!child.completed) beginEdit(child, caretFromClick(e)); }}
          >
            {child.text || '(내용 없음)'}
          </button>
        )}

        {/* 수정 중: 별 켜기/끄기 버튼 (주요 일정 지정) */}
        {editingId === child.id && (
          <StarToggleButton starred={!!child.starred} onToggle={() => onToggleStar(child.id)} />
        )}

        {/* 드래그 손잡이 */}
        {onDragStart && (
          <button
            type="button"
            className={styles.subItemHandle}
            onPointerDown={!child.completed ? (e => { e.stopPropagation(); onDragStart(e, child); }) : undefined}
            aria-label="드래그로 이동"
            disabled={child.completed}
            style={{ touchAction: 'none' }}
          >
            <span className={styles.handleIcon} aria-hidden="true" />
          </button>
        )}
      </div>
    </div>
  );
}
