import styles from './TimelineView.module.css';
import { formatTime } from '../lib/timeFormatter';
import type { DayKey } from '../types/todo';
import { toVirt } from '../lib/dayBoundary';
import { calcProposedTime, eventColor } from '../lib/timelineMath';
import { useTimelineInteractions } from '../hooks/useTimelineInteractions';

/* ── 그립 아이콘 ── */
function GripIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 13 13" fill="none" aria-hidden="true">
      <circle cx="4" cy="2.5"  r="1.3" fill="currentColor" />
      <circle cx="9" cy="2.5"  r="1.3" fill="currentColor" />
      <circle cx="4" cy="6.5"  r="1.3" fill="currentColor" />
      <circle cx="9" cy="6.5"  r="1.3" fill="currentColor" />
      <circle cx="4" cy="10.5" r="1.3" fill="currentColor" />
      <circle cx="9" cy="10.5" r="1.3" fill="currentColor" />
    </svg>
  );
}

interface TimelineViewProps { day: DayKey; }

export function TimelineView({ day }: TimelineViewProps) {
  const {
    now, pendingParentId, toggleComplete, setPendingParentId,
    editingId, editDraft, setEditDraft, editInputRef, beginEdit, commitEdit, cancelEdit,
    scheduled, unscheduled, childrenByParent, segments,
    expandedGaps, toggleGap,
    drag, unscheduledDrag, swipe, subDrag, proposedSubOrder, subDragParentTarget,
    timelineRef, pillRef, ghostRef,
    handleDragStart, handleSwipeStart, handleSubDragStart, handleUnscheduledDragStart,
    isOverTl, unscheduledProposedTime, effectiveInsertBeforeId, showDropZone, dropZoneHeight,
  } = useTimelineInteractions(day);

  let dropZoneRendered = false;

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

            /* ── 섹션 구분선 ── */
            if (seg.type === 'section') {
              return (
                <div key={seg.key} className={styles.sectionDivider}>
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
                            <div className={styles.timeCol} style={{ paddingTop: 0 }}>
                              <span className={styles.timeLabel}>{String(h % 24).padStart(2, '0')}:00</span>
                              <div className={styles.dot} data-empty="true" />
                            </div>
                            <div className={styles.emptyHourLine} />
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            }

            /* ── 현재 시간 인디케이터 ── */
            if (seg.type === 'now') {
              return (
                <div key="now" className={styles.nowRow}>
                  <div className={styles.nowBadge}>
                    <span className={styles.nowBadgeInner}>{formatTime(seg.time)}</span>
                  </div>
                  <div className={styles.nowLine} />
                </div>
              );
            }

            /* ── 이벤트 카드 ── */
            const { todo }          = seg;
            const isDragging        = drag?.todoId === todo.id;
            const isSelected        = pendingParentId === todo.id;
            const isSubDropTarget   = subDragParentTarget === todo.id;

            // 드롭존: 이 카드 바로 앞에 삽입
            const showDropZoneHere =
              showDropZone && !isDragging && !dropZoneRendered && todo.id === effectiveInsertBeforeId;
            if (showDropZoneHere) dropZoneRendered = true;

            const virtTodoTime = toVirt(todo.time!);
            const displayTime = isDragging ? calcProposedTime(drag!) : virtTodoTime;
            const isOverdue   = !todo.completed && todo.time !== null
                              && day === 'today' && virtTodoTime < now && !isDragging;
            const color       = eventColor(todo.time, isOverdue, todo.completed, now, day);
            const isCurrent   = !isDragging && todo.time !== null
                              && virtTodoTime <= now && now < virtTodoTime + 60;
            const translateY  = isDragging && drag
              ? drag.currentY - drag.initialCardCenterY
              : 0;

            const isSwipingThis  = swipe?.todoId === todo.id && swipe.direction !== 'v';
            const rawOffset      = isSwipingThis ? swipe!.currentX - swipe!.startX : 0;
            const swipeOffset    = Math.max(-80, Math.min(80, rawOffset));
            const deleteProgress = Math.min(1, -swipeOffset / 72);
            const moveProgress   = Math.min(1, swipeOffset / 72);

            const isDragOutside = isDragging && drag
              ? drag.currentY < drag.containerTop || drag.currentY > drag.containerBottom
              : false;

            const card = (
              <div
                data-todo-id={todo.id}
                className={`${styles.eventRow}
                  ${todo.completed ? styles.eventCompleted : ''}
                  ${isDragging    ? styles.eventRowDragging : ''}`}
                style={isDragging
                  ? { transform: `translateY(${translateY}px)`, zIndex: 50 }
                  : undefined}
              >
                {/* 시간 컬럼 */}
                <div className={`${styles.timeCol} ${todo.endTime != null ? styles.timeColRange : ''}`}>
                  <div className={styles.timeLabelGroup}>
                    <span
                      className={`${styles.timeLabel} ${isDragging ? styles.timeLabelDragging : ''}`}
                      style={{ color: isDragging ? undefined : color }}
                    >
                      {formatTime(displayTime)}
                    </span>
                    {todo.endTime != null && !isDragging && (
                      <span className={styles.timeEnd}>-{formatTime(todo.endTime)}</span>
                    )}
                  </div>
                  <div
                    className={`${styles.dot}
                      ${isCurrent  ? styles.dotCurrent  : ''}
                      ${isDragging ? styles.dotDragging  : ''}`}
                    style={{
                      borderColor:     isDragging ? '#3B5BDB' : color,
                      backgroundColor: (isCurrent || isDragging)
                        ? (isDragging ? '#3B5BDB' : color) : undefined,
                    }}
                  />
                </div>

                {/* 스와이프 삭제 힌트 */}
                {isSwipingThis && swipeOffset < -12 && (
                  <div className={styles.swipeDeleteHint} style={{ opacity: deleteProgress }}>×</div>
                )}
                {/* 스와이프 내일 이동 힌트 — 오늘 탭만 */}
                {isSwipingThis && swipeOffset > 12 && day === 'today' && (
                  <div className={styles.swipeMoveHint} style={{ opacity: moveProgress }}>→</div>
                )}

                {/* 카드 */}
                <div
                  className={`${styles.card} ${isDragging ? styles.cardDragging : ''} ${isDragOutside ? styles.cardDragOutside : ''} ${isSelected ? styles.cardSelected : ''} ${isSubDropTarget ? styles.cardSubDropTarget : ''}`}
                  onPointerDown={e => handleSwipeStart(e, todo.id)}
                  style={{
                    borderLeftColor: isDragOutside ? '#9CA3AF' : isDragging ? '#3B5BDB' : color,
                    transform: `translateX(${swipeOffset}px)`,
                    transition: isSwipingThis ? 'none' : 'transform 200ms ease, box-shadow 150ms, border-left-color 150ms',
                  }}
                >
                  {/* 체크박스 */}
                  <button type="button"
                    className={`${styles.checkBtn} ${todo.completed ? styles.checkBtnDone : ''}`}
                    style={{ borderColor: color, backgroundColor: todo.completed ? color : undefined }}
                    onClick={() => toggleComplete(day, todo.id)}
                    aria-label={todo.completed ? '완료 취소' : '완료'}>
                    {todo.completed && (
                      <svg width="8" height="8" viewBox="0 0 10 10" fill="none" aria-hidden="true">
                        <path d="M1.5 5L4 7.5L8.5 2.5" stroke="#fff" strokeWidth="2"
                          strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    )}
                  </button>
                  <div className={styles.cardContent}>
                    {editingId === todo.id ? (
                      <input
                        ref={editInputRef}
                        type="text"
                        className={styles.editInput}
                        value={editDraft}
                        onChange={e => setEditDraft(e.target.value)}
                        onPointerDown={e => e.stopPropagation()}
                        onKeyDown={e => {
                          if (e.key === 'Enter') { e.preventDefault(); commitEdit(todo.id); }
                          if (e.key === 'Escape') { e.preventDefault(); cancelEdit(); }
                        }}
                        onBlur={() => commitEdit(todo.id)}
                        autoComplete="off"
                      />
                    ) : (
                      <button
                        type="button"
                        className={`${styles.cardTitle} ${todo.completed ? styles.cardTitleDone : ''}`}
                        onClick={() => { if (!todo.completed) beginEdit(todo); }}
                      >
                        {todo.text || <span className={styles.noText}>(내용 없음)</span>}
                      </button>
                    )}
                  </div>
                  {/* 하위 일정 추가 버튼 (루트 아이템만) */}
                  {!todo.parentId && (
                    <button
                      type="button"
                      aria-label="하위 일정 추가"
                      className={`${styles.addSubButton} ${isSelected ? styles.addSubButtonActive : ''}`}
                      onPointerDown={e => e.stopPropagation()}
                      onClick={() => setPendingParentId(isSelected ? null : todo.id)}
                    >
                      +
                    </button>
                  )}

                  <button
                    type="button"
                    className={styles.cardDragHandle}
                    onPointerDown={e => handleDragStart(e, todo)}
                    aria-label="드래그로 시간 변경"
                    style={{ touchAction: 'none' }}
                  >
                    <GripIcon />
                  </button>
                </div>
              </div>
            );

            const rawChildren = (childrenByParent.get(todo.id) ?? [])
              .slice().sort((a, b) => a.order - b.order);

            const isThisParentDragging = subDrag?.parentId === todo.id;
            const displayChildren = isThisParentDragging && proposedSubOrder
              ? [...rawChildren].sort((a, b) =>
                  proposedSubOrder.indexOf(a.id) - proposedSubOrder.indexOf(b.id))
              : rawChildren;

            return (
              <div key={todo.id}>
                {showDropZoneHere && (
                  <div className={styles.dropZone} style={{ height: dropZoneHeight }} />
                )}
                {isDragging
                  ? <div style={{ height: 0, overflow: 'visible' }}>{card}</div>
                  : card}
                {!isDragging && displayChildren.map(child => {
                  // 부모카드와 동일한 스와이프(왼쪽 삭제 / 오른쪽 내일 이동) 계산
                  const isSwipingSub  = swipe?.todoId === child.id && swipe.direction !== 'v';
                  const rawOffsetSub  = isSwipingSub ? swipe!.currentX - swipe!.startX : 0;
                  const swipeOffsetSub = Math.max(-80, Math.min(80, rawOffsetSub));
                  const deleteProgressSub = Math.min(1, -swipeOffsetSub / 72);
                  const moveProgressSub   = Math.min(1, swipeOffsetSub / 72);
                  return (
                  <div key={child.id} style={{ position: 'relative' }}>
                    {isSwipingSub && swipeOffsetSub < -12 && (
                      <div className={styles.swipeDeleteHint} style={{ opacity: deleteProgressSub }}>×</div>
                    )}
                    {isSwipingSub && swipeOffsetSub > 12 && day === 'today' && (
                      <div className={styles.swipeMoveHint} style={{ opacity: moveProgressSub }}>→</div>
                    )}
                    <div
                      data-sub-id={child.id}
                      className={`${styles.subItem} ${child.completed ? styles.subItemDone : ''} ${subDrag?.todoId === child.id ? styles.subItemDragging : ''}`}
                      onPointerDown={e => handleSwipeStart(e, child.id)}
                      style={{
                        transform: `translateX(${swipeOffsetSub}px)`,
                        transition: isSwipingSub ? 'none' : 'transform 200ms ease',
                      }}
                    >
                      <span className={styles.subItemArrow} aria-hidden="true">└</span>
                      {/* 체크박스 (시간 바로 우측) */}
                      <button
                        type="button"
                        className={`${styles.subItemCheckbox} ${child.completed ? styles.subItemCheckboxChecked : ''}`}
                        onClick={() => toggleComplete(day, child.id)}
                        aria-label={child.completed ? '완료 취소' : '완료 처리'}
                        role="checkbox"
                        aria-checked={child.completed}
                      >
                        <span className={styles.subItemCheckboxInner} aria-hidden="true" />
                      </button>
                      {/* 텍스트: 클릭 시 편집 (부모카드와 동일) */}
                      {editingId === child.id ? (
                        <input
                          ref={editInputRef}
                          type="text"
                          className={styles.editInput}
                          value={editDraft}
                          onChange={e => setEditDraft(e.target.value)}
                          onPointerDown={e => e.stopPropagation()}
                          onKeyDown={e => {
                            if (e.key === 'Enter') { e.preventDefault(); commitEdit(child.id); }
                            if (e.key === 'Escape') { e.preventDefault(); cancelEdit(); }
                          }}
                          onBlur={() => commitEdit(child.id)}
                          autoComplete="off"
                        />
                      ) : (
                        <button
                          type="button"
                          className={`${styles.subItemText} ${child.completed ? styles.subItemTextDone : ''}`}
                          onClick={() => { if (!child.completed) beginEdit(child); }}
                        >
                          {child.text || '(내용 없음)'}
                        </button>
                      )}
                      <button
                        type="button"
                        className={styles.subItemHandle}
                        onPointerDown={!child.completed ? (e => { e.stopPropagation(); handleSubDragStart(e, child); }) : undefined}
                        aria-label="드래그로 이동"
                        disabled={child.completed}
                        style={{ touchAction: 'none' }}
                      >
                        <GripIcon />
                      </button>
                    </div>
                  </div>
                  );
                })}
              </div>
            );
          })}

          {/* 드롭존: 모든 카드 뒤에 삽입하는 경우 */}
          {showDropZone && !dropZoneRendered && effectiveInsertBeforeId === null && scheduled.length > 0 && (
            <div className={styles.dropZone} style={{ height: dropZoneHeight }} />
          )}
      </div>

      {/* 플로팅 시간 인디케이터 */}
      {drag && (
        <div className={styles.floatingIndicator}
          style={{ top: drag.currentY, left: drag.containerLeft }}>
          <div ref={pillRef} className={styles.floatingPill}>{formatTime(calcProposedTime(drag))}</div>
          <div className={styles.floatingLine} />
        </div>
      )}

      {/* 언스케줄 드래그: 플로팅 인디케이터 + 고스트 */}
      {unscheduledDrag && isOverTl && unscheduledProposedTime !== null && (
        <div className={styles.floatingIndicator}
          style={{ top: unscheduledDrag.currentY, left: unscheduledDrag.timelineLeft }}>
          <div ref={pillRef} className={styles.floatingPill}>{formatTime(unscheduledProposedTime)}</div>
          <div className={styles.floatingLine} />
        </div>
      )}
      {unscheduledDrag && (
        <div
          className={styles.ghostCard}
          style={{ top: unscheduledDrag.currentY, left: unscheduledDrag.timelineLeft + 64 }}
        >
          {unscheduledDrag.text || '(내용 없음)'}
        </div>
      )}

      {/* 하위 일정 드래그: 부모 변경 대상 위에 있을 때만 인디케이터 표시 */}
      {subDrag && (
        <div ref={ghostRef} className={styles.ghostCard}
          style={{
            top: subDrag.currentY,
            left: subDrag.timelineLeft + 56,
            width: subDrag.timelineWidth - 72,
          }}>
          {subDrag.text || '(내용 없음)'}
        </div>
      )}

      {/* 시간 미지정 */}
      {unscheduled.length > 0 && (
        <div className={styles.unscheduled}>
          <h3 className={styles.unscheduledTitle}>시간 미지정</h3>
          <div className={styles.unscheduledList}>
            {unscheduled.map(todo => {
              const isSwipingU      = swipe?.todoId === todo.id && swipe.direction !== 'v';
              const rawOffsetU      = isSwipingU ? swipe!.currentX - swipe!.startX : 0;
              const swipeOffsetU    = Math.max(-80, Math.min(80, rawOffsetU));
              const deleteProgressU = Math.min(1, -swipeOffsetU / 72);
              const moveProgressU   = Math.min(1, swipeOffsetU / 72);
              return (
                <div key={todo.id} style={{ position: 'relative' }}>
                  {isSwipingU && swipeOffsetU < -12 && (
                    <div className={styles.swipeDeleteHint} style={{ opacity: deleteProgressU }}>×</div>
                  )}
                  {isSwipingU && swipeOffsetU > 12 && day === 'today' && (
                    <div className={styles.swipeMoveHint} style={{ opacity: moveProgressU }}>→</div>
                  )}
                  <div
                    className={`${styles.unscheduledItem} ${todo.completed ? styles.unscheduledItemDone : ''} ${unscheduledDrag?.todoId === todo.id ? styles.unscheduledItemDragging : ''}`}
                    onPointerDown={e => handleSwipeStart(e, todo.id)}
                    style={{
                      transform: `translateX(${swipeOffsetU}px)`,
                      transition: isSwipingU ? 'none' : 'transform 200ms ease',
                    }}
                  >
                    <button type="button"
                      className={`${styles.checkBtn} ${todo.completed ? styles.checkBtnDone : ''}`}
                      style={{ borderColor: todo.completed ? '#9CA3AF' : '#7C3AED',
                               backgroundColor: todo.completed ? '#9CA3AF' : undefined }}
                      onClick={() => toggleComplete(day, todo.id)}
                      aria-label={todo.completed ? '완료 취소' : '완료'}>
                      {todo.completed && (
                        <svg width="8" height="8" viewBox="0 0 10 10" fill="none" aria-hidden="true">
                          <path d="M1.5 5L4 7.5L8.5 2.5" stroke="#fff" strokeWidth="2"
                            strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      )}
                    </button>
                    <span className={styles.unscheduledText}>{todo.text}</span>
                    {!todo.completed && (
                      <button
                        type="button"
                        className={styles.cardDragHandle}
                        onPointerDown={e => handleUnscheduledDragStart(e, todo)}
                        aria-label="드래그로 시간 지정"
                        style={{ touchAction: 'none' }}
                      >
                        <GripIcon />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
