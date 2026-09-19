import { Fragment } from 'react';
import styles from './MixView.module.css';
import { formatTime } from '../lib/timeFormatter';
import type { DayKey } from '../types/todo';
import { toVirt } from '../lib/dayBoundary';
import { eventColor, getSwipeVisual } from '../lib/timelineMath';
import { SubItemRow } from './SubItemRow';
import { EditTextArea } from './EditTextArea';
import { StarIcon, StarToggleButton, STAR_COLOR, STAR_DONE_COLOR } from './StarIcon';
import { caretFromClick } from '../lib/caretFromClick';
import { useTimelineInteractions } from '../hooks/useTimelineInteractions';

interface MixViewProps { day: DayKey; }

export function MixView({ day }: MixViewProps) {
  const {
    now, pendingParentId, toggleComplete, setPendingParentId, toggleStar,
    editingId, editDraft, setEditDraft, editInputRef, beginEdit, commitEdit, cancelEdit,
    scheduled, unscheduled, displayUnscheduled, childrenByParent, segments,
    expandedGaps, toggleGap,
    drag, unscheduledDrag, swipe, subDrag, proposedSubOrder, subDragParentTarget,
    timelineRef, pillRef, dragSpacerRef,
    handleDragStart, handleSwipeStart, handleSubDragStart, handleUnscheduledDragStart,
    isOverTl, unscheduledProposedTime,
    unscheduledDropHint, promotingSubId, dragIndentOffset,
    dragProposedTime,
  } = useTimelineInteractions(day);

  if (scheduled.length === 0 && unscheduled.length === 0) {
    return (
      <div className={styles.empty}>
        <p className={styles.emptyText}>시간별 일정이 없습니다</p>
        <p className={styles.emptyHint}>목록 탭에서 "8시 기상" 형식으로 추가해보세요</p>
      </div>
    );
  }

  return (
    <div className={`${styles.container} ${drag || unscheduledDrag ? styles.containerDragging : ''}`}>
      <div
        ref={timelineRef}
        className={styles.timeline}
        style={scheduled.length === 0 ? { minHeight: unscheduled.length > 0 ? 100 : 0 } : undefined}
      >
        {scheduled.length === 0 && unscheduled.length > 0 && (
          <div className={`${styles.emptyTimelineDrop} ${isOverTl ? styles.emptyTimelineDropActive : ''}`}>
            {isOverTl ? `${formatTime(unscheduledProposedTime!)} 에 배치` : '위로 드래그하여 시간 지정'}
          </div>
        )}

        {segments.map(seg => {

          /* ── 섹션 구분선 (오후 12시 / 저녁 오후 6시) ── */
          if (seg.type === 'section') {
            return (
              <div key={seg.key} className={styles.sectionDivider} data-section-min={seg.virtMin}>
                <span className={styles.sectionLabel}>{seg.label}</span>
                <div className={styles.sectionLine} />
              </div>
            );
          }

          /* ── 갭 ── */
          if (seg.type === 'gap') {
            const isExp   = expandedGaps.has(seg.key);
            const fromH   = Math.floor(seg.fromMin / 60) + 1;
            const toH     = Math.floor(seg.toMin   / 60) - 1;
            const skipped = Math.max(0, toH - fromH + 1);
            if (skipped === 0) return null;
            return (
              <div key={seg.key} className={styles.gapRow}>
                <div className={styles.gapLine} />
                <button type="button" className={styles.gapButton}
                  onClick={() => toggleGap(seg.key)} aria-expanded={isExp}>
                  {isExp ? '접기 ▲' : `${skipped}시간 생략 ▼`}
                </button>
                {isExp && (
                  <div className={styles.expandedHours}>
                    {Array.from({ length: skipped }, (_, i) => {
                      const h = fromH + i;
                      return (
                        <div key={h} className={styles.emptyHourRow}>
                          <span className={styles.emptyHourLabel}>
                            {String(h % 24).padStart(2, '0')}:00
                          </span>
                          <div className={styles.emptyHourLine} />
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          }

          /* ── 빈 정각 줄 (드래그하는 동안만) — 카드가 없는 시간에도 놓기 쉽게 ── */
          if (seg.type === 'hour') {
            return (
              <div key={seg.key} className={styles.dragHourRow} data-hour-min={seg.virtMin}>
                <span className={styles.dragHourLabel}>{formatTime(seg.virtMin)}</span>
                <div className={styles.dragHourLine} />
              </div>
            );
          }

          /* ── 현재 시간 인디케이터 ── */
          if (seg.type === 'now') {
            return (
              <div key="now" data-now-line="" className={styles.nowRow}>
                <div className={styles.nowTimeArea}>
                  <span className={styles.nowBadge}>{formatTime(seg.time)}</span>
                </div>
                <div className={styles.nowLine} />
              </div>
            );
          }

          /* ── 이벤트 카드 ── */
          const { todo }   = seg;
          const isDragging       = drag?.todoId === todo.id;
          // 미지정 카드를 타임라인 위로 끌어 여기(목표 슬롯)에 삽입돼 있는 상태
          const isPlacing        = unscheduledDrag?.todoId === todo.id;
          const lifted           = isDragging || isPlacing; // 집어올린 카드(반투명·강조)
          const isSelected       = pendingParentId === todo.id;
          const isSubDropTarget  = subDragParentTarget === todo.id;

          const virtTodoTime = toVirt(todo.time!);
          const displayTime = isDragging ? dragProposedTime! : virtTodoTime;
          const isOverdue   = !todo.completed && todo.time !== null
                            && day === 'today' && virtTodoTime < now && !lifted;
          const color = eventColor(todo.time, isOverdue, todo.completed, now, day);

          const { active: isSwipingThis, offset: swipeOffset, deleteProgress, moveProgress } =
            getSwipeVisual(swipe, todo.id);

          const card = (
            <div
              data-todo-id={todo.id}
              className={`${styles.eventRow}
                ${todo.completed ? styles.eventCompleted : ''}
                ${lifted        ? styles.eventRowDragging : ''}`}
              style={lifted ? { zIndex: 50 } : undefined}
            >
              {/* 드롭될 자리 점선 박스 — 카드 뒤(하위 레이어)에서 살짝 삐져나옴 */}
              {lifted && <div className={styles.dropBox} aria-hidden="true" />}

              {/* 스와이프 삭제 힌트 (왼쪽) */}
              {isSwipingThis && swipeOffset < -12 && (
                <div className={styles.swipeDeleteHint} style={{ opacity: deleteProgress }}>×</div>
              )}
              {/* 스와이프 내일 이동 힌트 (오른쪽) — 오늘 탭만 */}
              {isSwipingThis && swipeOffset > 12 && day === 'today' && !todo.completed && (
                <div className={styles.swipeMoveHint} style={{ opacity: moveProgress }}>→</div>
              )}

              {/* 카드: 시간 레이블 포함 */}
              <div
                className={`${styles.card} ${lifted ? styles.cardDragging : ''} ${todo.endTime != null ? styles.cardRange : ''} ${isSelected ? styles.cardSelected : ''} ${isSubDropTarget ? styles.cardSubDropTarget : ''}`}
                onPointerDown={e => handleSwipeStart(e, todo.id)}
                style={{
                  // 드래그로 하위 편입 중이면 오른쪽으로 들여쓰기 미리보기
                  transform: `translateX(${isDragging ? dragIndentOffset : swipeOffset}px)`,
                  transition: isSwipingThis || isDragging ? 'none' : 'transform 200ms ease, box-shadow 150ms',
                }}
              >
                {/* 드래그 중: 카드 왼쪽에 시간 알약(+짧은 선)을 붙여 이 카드의 시간으로 표시 */}
                {lifted && (
                  <div className={styles.dragPill} aria-hidden="true">
                    <span ref={pillRef} className={styles.dragPillBadge}>{formatTime(displayTime)}</span>
                    <span className={styles.dragPillLine} />
                  </div>
                )}

                {/* 시간 레이블 (카드 내 좌측) — 드래그 중엔 알약으로 대체하므로 숨김 */}
                <div className={styles.timeWrap}>
                  {!lifted && (
                    <>
                      <span className={styles.timeLabel} style={{ color }}>
                        {formatTime(displayTime)}
                      </span>
                      {todo.endTime != null && (
                        <span className={styles.timeEnd}>-{formatTime(todo.endTime)}</span>
                      )}
                    </>
                  )}
                </div>

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
                    <StarIcon size={18} color={todo.completed ? STAR_DONE_COLOR : STAR_COLOR} />
                  ) : (
                    <span
                      className={styles.checkboxInner}
                      style={{
                        borderColor: color,
                        backgroundColor: todo.completed ? color : undefined,
                      }}
                      aria-hidden="true"
                    />
                  )}
                </button>

                {/* 텍스트 */}
                <div className={styles.textWrap}>
                  {editingId === todo.id ? (
                    <EditTextArea
                      inputRef={editInputRef}
                      className={styles.editInput}
                      value={editDraft}
                      onChange={setEditDraft}
                      onCommit={() => commitEdit(todo.id)}
                      onCancel={cancelEdit}
                      onBlur={() => commitEdit(todo.id)}
                      stopPointer
                    />
                  ) : (
                    <button
                      type="button"
                      className={`${styles.cardTitle} ${todo.completed ? styles.cardTitleDone : ''}`}
                      onClick={e => { if (!todo.completed) beginEdit(todo, caretFromClick(e)); }}
                    >
                      {todo.text || <span className={styles.noText}>(내용 없음)</span>}
                    </button>
                  )}
                </div>

                {/* 수정 중: + 자리에 별 켜기/끄기 버튼 (주요 일정 지정) */}
                {editingId === todo.id ? (
                  <StarToggleButton starred={!!todo.starred} onToggle={() => toggleStar(todo.id)} />
                ) : !todo.parentId && (
                  <button
                    type="button"
                    aria-label="하위 일정 추가"
                    className={`${styles.addSubButton} ${isSelected ? styles.addSubButtonActive : ''}`}
                    onPointerDown={e => e.stopPropagation()}
                    onClick={() => setPendingParentId(isSelected ? null : todo.id)}
                  >
                    <span className={styles.plusIcon} aria-hidden="true" />
                  </button>
                )}

                {/* 그립 핸들 (오른쪽, 2선 스타일) */}
                <button
                  type="button"
                  className={styles.dragHandle}
                  onPointerDown={e => { e.stopPropagation(); handleDragStart(e, todo); }}
                  aria-label="드래그로 시간 변경"
                  style={{ touchAction: 'none' }}
                >
                  <span className={styles.handleIcon} aria-hidden="true" />
                </button>
              </div>
            </div>
          );

          // 하위 항목은 손으로 끌어둔 순서(order) 기준 — 세 뷰 통일
          const children = (childrenByParent.get(todo.id) ?? [])
            .slice().sort((a, b) => a.order - b.order);

          const isThisParentDragging = subDrag?.parentId === todo.id;
          const displayChildren = isThisParentDragging && proposedSubOrder
            ? [...children].sort((a, b) =>
                proposedSubOrder.indexOf(a.id) - proposedSubOrder.indexOf(b.id))
            : children;

          return (
            <div key={todo.id}>
              {card}
              {!isDragging && !isPlacing && displayChildren
                .filter(c => c.id !== promotingSubId)
                .map(child => (
                  <SubItemRow
                    key={child.id}
                    child={child}
                    day={day}
                    swipe={swipe}
                    onSwipeStart={handleSwipeStart}
                    onToggle={id => toggleComplete(day, id)}
                    dragging={subDrag?.todoId === child.id}
                    onDragStart={handleSubDragStart}
                    editingId={editingId}
                    editDraft={editDraft}
                    setEditDraft={setEditDraft}
                    editInputRef={editInputRef}
                    beginEdit={beginEdit}
                    commitEdit={commitEdit}
                    cancelEdit={cancelEdit}
                    onToggleStar={toggleStar}
                  />
                ))}
            </div>
          );
        })}
      </div>

      {/* 시간 미지정 — 일정카드를 여기로 내리면 시간 지정이 해제된다 */}
      {displayUnscheduled.length > 0 && (
        <div className={`${styles.unscheduled} ${unscheduledDropHint ? styles.unscheduledDropActive : ''}`}>
          <h3 className={styles.unscheduledTitle}>
            {unscheduledDropHint ?? '시간 미지정'}
          </h3>
          <div className={styles.unscheduledList}>
            {displayUnscheduled.map(todo => {
              // 타임라인 위로 끌어 실제 카드가 타임라인에 삽입돼 있으면 여기선 숨김
              if (isOverTl && unscheduledDrag?.todoId === todo.id) return null;
              const {
                active: isSwipingU, offset: swipeOffsetU,
                deleteProgress: deleteProgressU, moveProgress: moveProgressU,
              } = getSwipeVisual(swipe, todo.id);
              const unschedChildren = (childrenByParent.get(todo.id) ?? [])
                .slice()
                .sort((a, b) => a.order - b.order);
              return (
                <Fragment key={todo.id}>
                <div style={{ position: 'relative' }}>
                  {isSwipingU && swipeOffsetU < -12 && (
                    <div className={styles.swipeDeleteHint} style={{ opacity: deleteProgressU }}>×</div>
                  )}
                  {isSwipingU && swipeOffsetU > 12 && day === 'today' && !todo.completed && (
                    <div className={styles.swipeMoveHint} style={{ opacity: moveProgressU }}>→</div>
                  )}
                  <div
                    data-unsched-id={todo.id}
                    className={`${styles.unscheduledItem} ${todo.completed ? styles.unscheduledItemDone : ''} ${(unscheduledDrag?.todoId === todo.id || drag?.todoId === todo.id) ? styles.unscheduledItemDragging : ''}`}
                    onPointerDown={e => handleSwipeStart(e, todo.id)}
                    style={{
                      transform: `translateX(${swipeOffsetU}px)`,
                      transition: isSwipingU ? 'none' : 'transform 200ms ease',
                    }}
                  >
                    {/* 체크박스 */}
                    <button
                      type="button"
                      role="checkbox"
                      aria-checked={todo.completed}
                      aria-label={todo.completed ? '완료 취소' : '완료 처리'}
                      className={`${styles.checkbox} ${todo.completed ? styles.checkboxChecked : ''}`}
                      onClick={() => toggleComplete(day, todo.id)}
                    >
                      {todo.starred ? (
                        <StarIcon size={18} color={todo.completed ? STAR_DONE_COLOR : STAR_COLOR} />
                      ) : (
                        <span className={styles.checkboxInner} aria-hidden="true"
                          style={{ borderColor: todo.completed ? '#9CA3AF' : '#7C3AED',
                                   backgroundColor: todo.completed ? '#9CA3AF' : undefined }} />
                      )}
                    </button>

                    {/* 텍스트: 클릭 시 편집 (다른 카드와 동일) */}
                    {editingId === todo.id ? (
                      <EditTextArea
                        inputRef={editInputRef}
                        className={styles.editInput}
                        value={editDraft}
                        onChange={setEditDraft}
                        onCommit={() => commitEdit(todo.id)}
                        onCancel={cancelEdit}
                        onBlur={() => commitEdit(todo.id)}
                        stopPointer
                      />
                    ) : (
                      <button
                        type="button"
                        className={`${styles.unscheduledText} ${todo.completed ? styles.unscheduledTextDone : ''}`}
                        onClick={e => { if (!todo.completed) beginEdit(todo, caretFromClick(e)); }}
                      >
                        {todo.text || <span className={styles.noText}>(내용 없음)</span>}
                      </button>
                    )}

                    {/* 수정 중: 별 켜기/끄기 버튼 (주요 일정 지정) */}
                    {editingId === todo.id && (
                      <StarToggleButton starred={!!todo.starred} onToggle={() => toggleStar(todo.id)} />
                    )}

                    {/* 그립 (오른쪽, 2선) */}
                    {!todo.completed && (
                      <button
                        type="button"
                        className={styles.dragHandle}
                        onPointerDown={e => { e.stopPropagation(); handleUnscheduledDragStart(e, todo); }}
                        aria-label="드래그로 시간 지정 또는 순서 변경"
                        style={{ touchAction: 'none' }}
                      >
                        <span className={styles.handleIcon} aria-hidden="true" />
                      </button>
                    )}
                  </div>
                </div>

                {/* 미지정 카드의 하위일정 — 시간이 해제돼도 하위일정이 화면에서 사라지지 않게 함 */}
                {unschedChildren.map(child => (
                  <SubItemRow
                    key={child.id}
                    child={child}
                    day={day}
                    swipe={swipe}
                    onSwipeStart={handleSwipeStart}
                    onToggle={id => toggleComplete(day, id)}
                    dragging={subDrag?.todoId === child.id}
                    onDragStart={handleSubDragStart}
                    editingId={editingId}
                    editDraft={editDraft}
                    setEditDraft={setEditDraft}
                    editInputRef={editInputRef}
                    beginEdit={beginEdit}
                    commitEdit={commitEdit}
                    cancelEdit={cancelEdit}
                    onToggleStar={toggleStar}
                  />
                ))}
                </Fragment>
              );
            })}
          </div>
        </div>
      )}

      {/* 드래그 중 스크롤 보정용 빈 공간 (평소엔 높이 0) */}
      <div ref={dragSpacerRef} aria-hidden="true" />
    </div>
  );
}
