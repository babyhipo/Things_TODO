import { useEffect, useMemo, useRef, useState } from 'react';
import styles from './MixView.module.css';
import { useTodoStore } from '../store/useTodoStore';
import { formatTime } from '../lib/timeFormatter';
import type { DayKey, Todo } from '../types/todo';

const DAY_START_MIN = 4 * 60;

function toVirt(t: number): number {
  return t < DAY_START_MIN ? t + 1440 : t;
}
function fromVirt(t: number): number {
  return t >= 1440 ? t - 1440 : t;
}

function getCurrentMinutes(): number {
  const d = new Date();
  const total = d.getHours() * 60 + d.getMinutes();
  return total < DAY_START_MIN ? total + 1440 : total;
}
function useNowMinutes(): number {
  const [now, setNow] = useState(getCurrentMinutes);
  useEffect(() => {
    const t = setInterval(() => setNow(getCurrentMinutes()), 60_000);
    return () => clearInterval(t);
  }, []);
  return now;
}

interface CardAnchor {
  todoId: string;
  time: number;
  centerY: number;
}

interface DragState {
  todoId: string;
  originalTime: number;
  initialCardCenterY: number;
  cardHeight: number;
  currentY: number;
  anchors: CardAnchor[];
  containerTop: number;
  containerBottom: number;
  containerLeft: number;
}

interface SwipeState {
  todoId: string;
  startX: number;
  startY: number;
  currentX: number;
  direction: 'undecided' | 'h' | 'v';
}

interface UnscheduledDragState {
  todoId: string;
  text: string;
  currentY: number;
  timelineTop: number;
  timelineBottom: number;
  timelineLeft: number;
  anchors: CardAnchor[];
}

const SNAP = 5;

function calcTimeFromY(
  currentY: number,
  anchors: CardAnchor[],
  containerTop: number,
  containerBottom: number,
): number {
  const sorted = [...anchors].sort((a, b) => a.centerY - b.centerY);
  if (sorted.length === 0) {
    const t = Math.max(0, Math.min(1, (currentY - containerTop) / Math.max(1, containerBottom - containerTop)));
    return snapTo(Math.round(DAY_START_MIN + t * (1439 - DAY_START_MIN)));
  }
  if (currentY <= sorted[0].centerY) {
    const t = Math.max(0, (currentY - containerTop) / Math.max(1, sorted[0].centerY - containerTop));
    return snapTo(Math.max(DAY_START_MIN, Math.round(t * Math.max(DAY_START_MIN, sorted[0].time - SNAP))));
  }
  const last = sorted[sorted.length - 1];
  if (currentY >= last.centerY) {
    const t = Math.min(1, (currentY - last.centerY) / Math.max(1, containerBottom - last.centerY));
    const minT = last.time + SNAP;
    return snapTo(Math.max(minT, Math.min(1679, minT + Math.round(t * (1679 - minT)))));
  }
  for (let i = 0; i < sorted.length - 1; i++) {
    const above = sorted[i], below = sorted[i + 1];
    if (currentY >= above.centerY && currentY < below.centerY) {
      const minT = above.time + SNAP, maxT = below.time - SNAP;
      if (minT > maxT) return snapTo(above.time + Math.round((below.time - above.time) / 2));
      const t = (currentY - above.centerY) / (below.centerY - above.centerY);
      return snapTo(Math.max(minT, Math.min(maxT, minT + t * (maxT - minT))));
    }
  }
  return snapTo(DAY_START_MIN + 480);
}

function calcProposedTime(ds: DragState): number {
  const { currentY, anchors, originalTime, containerTop, containerBottom } = ds;
  const sorted = [...anchors].sort((a, b) => a.centerY - b.centerY);
  if (sorted.length === 0) return originalTime;

  const first = sorted[0];
  const last  = sorted[sorted.length - 1];

  if (currentY <= first.centerY) {
    const t = Math.max(0, (currentY - containerTop) / Math.max(1, first.centerY - containerTop));
    return snapTo(Math.max(0, Math.round(t * Math.max(0, first.time - SNAP))));
  }
  if (currentY >= last.centerY) {
    const t = Math.min(1, (currentY - last.centerY) / Math.max(1, containerBottom - last.centerY));
    const minT = last.time + SNAP;
    return snapTo(Math.max(minT, Math.min(1679, minT + Math.round(t * (1679 - minT)))));
  }
  for (let i = 0; i < sorted.length - 1; i++) {
    const above = sorted[i];
    const below = sorted[i + 1];
    if (currentY >= above.centerY && currentY < below.centerY) {
      const minT = above.time + SNAP;
      const maxT = below.time - SNAP;
      if (minT > maxT) return snapTo(above.time + Math.round((below.time - above.time) / 2));
      const t   = (currentY - above.centerY) / (below.centerY - above.centerY);
      return snapTo(Math.max(minT, Math.min(maxT, minT + t * (maxT - minT))));
    }
  }
  return originalTime;
}

function snapTo(v: number): number {
  return Math.round(v / SNAP) * SNAP;
}

function getInsertionBeforeId(currentY: number, anchors: CardAnchor[]): string | null {
  const sorted = [...anchors].sort((a, b) => a.centerY - b.centerY);
  for (const anchor of sorted) {
    if (currentY < anchor.centerY) return anchor.todoId;
  }
  return null;
}

/* 시간 기반 색상 (TimelineView와 동일한 로직) */
function eventColor(time: number | null, overdue: boolean, completed: boolean, now: number, day: string): string {
  if (completed) return '#9CA3AF';
  if (overdue)   return '#EF4444';
  if (time === null) return '#7C3AED';
  const offset = day === 'tomorrow' ? 1440 : 0;
  const diff = toVirt(time) + offset - now;
  if (diff <= 60)  return '#F59E0B';
  if (diff <= 180) return '#10B981';
  return '#3B5BDB';
}

const SECTION_MARKS = [
  { virtMin: 12 * 60, label: '오후', key: 'section-pm' },
  { virtMin: 18 * 60, label: '저녁', key: 'section-eve' },
];

type Segment =
  | { type: 'event'; todo: Todo }
  | { type: 'gap'; fromMin: number; toMin: number; key: string }
  | { type: 'now'; time: number; key: string }
  | { type: 'section'; label: string; key: string };

interface MixViewProps { day: DayKey; }

export function MixView({ day }: MixViewProps) {
  const days           = useTodoStore((s) => s.days);
  const toggleComplete = useTodoStore((s) => s.toggleComplete);
  const deleteTodo     = useTodoStore((s) => s.deleteTodo);
  const setTodoTime    = useTodoStore((s) => s.setTodoTime);
  const now = useNowMinutes();

  const [expandedGaps, setExpandedGaps] = useState<Set<string>>(new Set());
  const [drag, setDrag] = useState<DragState | null>(null);
  const dragRef         = useRef<DragState | null>(null);
  const [unscheduledDrag, setUnscheduledDrag] = useState<UnscheduledDragState | null>(null);
  const unscheduledDragRef = useRef<UnscheduledDragState | null>(null);
  const [swipe, setSwipe] = useState<SwipeState | null>(null);
  const swipeRef = useRef<SwipeState | null>(null);
  const timelineRef     = useRef<HTMLDivElement>(null);
  useEffect(() => { dragRef.current = drag; });
  useEffect(() => { unscheduledDragRef.current = unscheduledDrag; });
  useEffect(() => { swipeRef.current = swipe; });

  const { scheduled, unscheduled } = useMemo(() => {
    const all = days[day];
    return {
      scheduled:   all.filter(t => t.time !== null).sort((a, b) => toVirt(a.time ?? 0) - toVirt(b.time ?? 0)),
      unscheduled: all.filter(t => t.time === null).sort((a, b) => a.order - b.order),
    };
  }, [days, day]);

  const segments = useMemo<Segment[]>(() => {
    const result: Segment[] = [];
    let nowInserted = false;
    const sectionsInserted = new Set<string>();

    for (let i = 0; i < scheduled.length; i++) {
      const virtTime = toVirt(scheduled[i].time ?? 0);

      for (const mark of SECTION_MARKS) {
        if (!sectionsInserted.has(mark.key) && virtTime >= mark.virtMin) {
          result.push({ type: 'section', label: mark.label, key: mark.key });
          sectionsInserted.add(mark.key);
        }
      }

      if (day === 'today' && !nowInserted && virtTime > now) {
        result.push({ type: 'now', time: now, key: 'now' });
        nowInserted = true;
      }

      result.push({ type: 'event', todo: scheduled[i] });

      if (i < scheduled.length - 1) {
        const fromMin = virtTime;
        const toMin   = toVirt(scheduled[i + 1].time ?? 0);
        const gap     = toMin - fromMin;
        const isPast  = day === 'today' && fromMin < now;
        if (gap > 180 && !isPast)
          result.push({ type: 'gap', fromMin, toMin, key: `${fromMin}-${toMin}` });
      }
    }

    // 루프 후 미삽입 항목(구분선 + now 배지)을 시간순으로 정렬해 추가
    if (scheduled.length > 0) {
      const pending: { virtMin: number; fn: () => void }[] = [];

      for (const mark of SECTION_MARKS) {
        if (!sectionsInserted.has(mark.key)) {
          const { virtMin, label, key } = mark;
          pending.push({ virtMin, fn: () => result.push({ type: 'section', label, key }) });
        }
      }

      if (day === 'today' && !nowInserted) {
        pending.push({ virtMin: now, fn: () => result.push({ type: 'now', time: now, key: 'now' }) });
      }

      pending.sort((a, b) => a.virtMin - b.virtMin);
      pending.forEach(({ fn }) => fn());
    }

    return result;
  }, [scheduled, day, now]);

  const toggleGap = (key: string) =>
    setExpandedGaps(prev => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });

  const handleDragStart = (e: React.PointerEvent, todo: Todo) => {
    if (todo.time === null || !timelineRef.current || todo.completed) return;
    e.preventDefault();

    const cr = timelineRef.current.getBoundingClientRect();
    const el = document.querySelector<HTMLElement>(`[data-todo-id="${todo.id}"]`);
    const er = el?.getBoundingClientRect();

    const anchors: CardAnchor[] = scheduled
      .filter(t => t.id !== todo.id && t.time !== null)
      .flatMap(t => {
        const ae = document.querySelector<HTMLElement>(`[data-todo-id="${t.id}"]`);
        if (!ae) return [];
        const ar = ae.getBoundingClientRect();
        return [{ todoId: t.id, time: toVirt(t.time!), centerY: ar.top + ar.height / 2 }];
      });

    const ds: DragState = {
      todoId: todo.id,
      originalTime: toVirt(todo.time!),
      initialCardCenterY: er ? er.top + er.height / 2 : e.clientY,
      cardHeight: er ? er.height + 8 : 44,
      currentY: e.clientY,
      anchors,
      containerTop:    cr.top,
      containerBottom: cr.bottom,
      containerLeft:   cr.left,
    };
    setDrag(ds);
    dragRef.current = ds;
  };

  const handleSwipeStart = (e: React.PointerEvent, todoId: string) => {
    if ((e.target as Element).closest('button')) return;
    const ds: SwipeState = { todoId, startX: e.clientX, startY: e.clientY, currentX: e.clientX, direction: 'undecided' };
    setSwipe(ds);
    swipeRef.current = ds;
  };

  const handleUnscheduledDragStart = (e: React.PointerEvent, todo: Todo) => {
    e.preventDefault();
    const tlEl = timelineRef.current;
    const cr = tlEl?.getBoundingClientRect() ?? { top: 0, bottom: 300, left: 0 };

    const anchors: CardAnchor[] = scheduled.flatMap(t => {
      const ae = document.querySelector<HTMLElement>(`[data-todo-id="${t.id}"]`);
      if (!ae) return [];
      const ar = ae.getBoundingClientRect();
      return [{ todoId: t.id, time: toVirt(t.time!), centerY: ar.top + ar.height / 2 }];
    });

    const ds: UnscheduledDragState = {
      todoId: todo.id,
      text: todo.text,
      currentY: e.clientY,
      timelineTop: cr.top,
      timelineBottom: cr.bottom,
      timelineLeft: cr.left,
      anchors,
    };
    setUnscheduledDrag(ds);
    unscheduledDragRef.current = ds;
  };

  useEffect(() => {
    if (!swipe) return;
    const onMove = (e: PointerEvent) => {
      setSwipe(prev => {
        if (!prev) return null;
        const dx = e.clientX - prev.startX;
        const dy = e.clientY - prev.startY;
        let { direction } = prev;
        if (direction === 'undecided' && (Math.abs(dx) > 8 || Math.abs(dy) > 8)) {
          direction = Math.abs(dx) >= Math.abs(dy) ? 'h' : 'v';
        }
        return { ...prev, currentX: e.clientX, direction };
      });
    };
    const onEnd = () => {
      const s = swipeRef.current;
      if (s && s.direction === 'h' && s.startX - s.currentX >= 72) {
        deleteTodo(day, s.todoId);
      }
      setSwipe(null);
    };
    window.addEventListener('pointermove', onMove, { passive: true });
    window.addEventListener('pointerup',   onEnd);
    window.addEventListener('pointercancel', onEnd);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup',   onEnd);
      window.removeEventListener('pointercancel', onEnd);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [!!swipe, day, deleteTodo]);

  useEffect(() => {
    if (!drag) return;
    const onMove = (e: PointerEvent) =>
      setDrag(prev => prev ? { ...prev, currentY: e.clientY } : null);
    const onEnd = () => {
      const ds = dragRef.current;
      if (!ds) return;
      const isOutside = ds.currentY < ds.containerTop || ds.currentY > ds.containerBottom;
      setTodoTime(day, ds.todoId, isOutside ? null : fromVirt(calcProposedTime(ds)));
      setDrag(null);
    };
    window.addEventListener('pointermove', onMove, { passive: true });
    window.addEventListener('pointerup',   onEnd);
    window.addEventListener('pointercancel', onEnd);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup',   onEnd);
      window.removeEventListener('pointercancel', onEnd);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [!!drag, day, setTodoTime]);

  useEffect(() => {
    if (!unscheduledDrag) return;
    const onMove = (e: PointerEvent) => {
      setUnscheduledDrag(prev => {
        if (!prev) return null;
        const cr = timelineRef.current?.getBoundingClientRect();
        return {
          ...prev,
          currentY: e.clientY,
          ...(cr ? { timelineTop: cr.top, timelineBottom: cr.bottom, timelineLeft: cr.left } : {}),
        };
      });
    };
    const onEnd = () => {
      const ds = unscheduledDragRef.current;
      if (!ds) return;
      const overTl = ds.currentY >= ds.timelineTop && ds.currentY <= ds.timelineBottom;
      if (overTl) {
        const t = calcTimeFromY(ds.currentY, ds.anchors, ds.timelineTop, ds.timelineBottom);
        setTodoTime(day, ds.todoId, fromVirt(t));
      }
      setUnscheduledDrag(null);
    };
    window.addEventListener('pointermove', onMove, { passive: true });
    window.addEventListener('pointerup',   onEnd);
    window.addEventListener('pointercancel', onEnd);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup',   onEnd);
      window.removeEventListener('pointercancel', onEnd);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [!!unscheduledDrag, day, setTodoTime]);

  const insertBeforeId = drag ? getInsertionBeforeId(drag.currentY, drag.anchors) : null;

  const isOverTl = unscheduledDrag
    ? unscheduledDrag.currentY >= unscheduledDrag.timelineTop
      && unscheduledDrag.currentY <= unscheduledDrag.timelineBottom
    : false;
  const unscheduledProposedTime = (unscheduledDrag && isOverTl)
    ? calcTimeFromY(unscheduledDrag.currentY, unscheduledDrag.anchors, unscheduledDrag.timelineTop, unscheduledDrag.timelineBottom)
    : null;
  const unscheduledInsertBeforeId = (unscheduledDrag && isOverTl)
    ? getInsertionBeforeId(unscheduledDrag.currentY, unscheduledDrag.anchors)
    : null;

  const effectiveInsertBeforeId = drag ? insertBeforeId : unscheduledInsertBeforeId;
  const showDropZone = !!drag || isOverTl;
  const dropZoneHeight = drag ? drag.cardHeight : 44;

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

          /* ── 현재 시간 인디케이터 ── */
          if (seg.type === 'now') {
            return (
              <div key="now" className={styles.nowRow}>
                <div className={styles.nowTimeArea}>
                  <span className={styles.nowBadge}>{formatTime(seg.time)}</span>
                </div>
                <div className={styles.nowLine} />
              </div>
            );
          }

          /* ── 이벤트 카드 ── */
          const { todo }   = seg;
          const isDragging = drag?.todoId === todo.id;

          const showDropZoneHere =
            showDropZone && !isDragging && !dropZoneRendered && todo.id === effectiveInsertBeforeId;
          if (showDropZoneHere) dropZoneRendered = true;

          const virtTodoTime = toVirt(todo.time!);
          const displayTime = isDragging ? calcProposedTime(drag!) : virtTodoTime;
          const isOverdue   = !todo.completed && todo.time !== null
                            && day === 'today' && virtTodoTime < now && !isDragging;
          const color = eventColor(todo.time, isOverdue, todo.completed, now, day);
          const translateY  = isDragging && drag
            ? drag.currentY - drag.initialCardCenterY
            : 0;
          const isDragOutside = isDragging && drag
            ? drag.currentY < drag.containerTop || drag.currentY > drag.containerBottom
            : false;

          const isSwipingThis = swipe?.todoId === todo.id && swipe.direction !== 'v';
          const swipeOffset   = isSwipingThis ? Math.min(0, swipe!.currentX - swipe!.startX) : 0;
          const deleteProgress = Math.min(1, -swipeOffset / 72);

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
              {/* 스와이프 삭제 힌트 */}
              {isSwipingThis && swipeOffset < -12 && (
                <div className={styles.swipeDeleteHint} style={{ opacity: deleteProgress }}>×</div>
              )}

              {/* 카드: 시간 레이블 포함 */}
              <div
                className={`${styles.card} ${isDragging ? styles.cardDragging : ''} ${isDragOutside ? styles.cardDragOutside : ''} ${todo.endTime != null ? styles.cardRange : ''}`}
                onPointerDown={e => handleSwipeStart(e, todo.id)}
                style={{
                  transform: `translateX(${swipeOffset}px)`,
                  transition: isSwipingThis ? 'none' : 'transform 200ms ease, box-shadow 150ms',
                }}
              >
                {/* 시간 레이블 (카드 내 좌측) */}
                <div className={styles.timeWrap}>
                  <span className={`${styles.timeLabel} ${isOverdue ? styles.timeLabelOverdue : ''} ${isDragging ? styles.timeLabelDragging : ''}`}>
                    {formatTime(displayTime)}
                  </span>
                  {todo.endTime != null && !isDragging && (
                    <span className={styles.timeEnd}>-{formatTime(todo.endTime)}</span>
                  )}
                </div>

                {/* 체크박스 - 테두리/배경에 시간 기반 색상 적용 */}
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
                    style={{
                      borderColor: color,
                      backgroundColor: todo.completed ? color : undefined,
                    }}
                    aria-hidden="true"
                  />
                </button>

                {/* 텍스트 */}
                <div className={styles.textWrap}>
                  <span className={`${styles.cardTitle} ${todo.completed ? styles.cardTitleDone : ''}`}>
                    {todo.text || <span className={styles.noText}>(내용 없음)</span>}
                  </span>
                </div>

                {/* ! 배지 (지남 표시) */}
                {isOverdue && (
                  <span className={styles.warnBadge} aria-label="시간이 지났습니다">!</span>
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

          return (
            <div key={todo.id}>
              {showDropZoneHere && (
                <div className={styles.dropZone} style={{ height: dropZoneHeight }} />
              )}
              {isDragging
                ? <div style={{ height: 0, overflow: 'visible' }}>{card}</div>
                : card}
            </div>
          );
        })}

        {showDropZone && !dropZoneRendered && effectiveInsertBeforeId === null && scheduled.length > 0 && (
          <div className={styles.dropZone} style={{ height: dropZoneHeight }} />
        )}
      </div>

      {/* 플로팅 시간 인디케이터 */}
      {drag && (
        <div className={styles.floatingIndicator}
          style={{ top: drag.currentY, left: drag.containerLeft }}>
          <div className={styles.floatingPill}>{formatTime(calcProposedTime(drag))}</div>
          <div className={styles.floatingLine} />
        </div>
      )}

      {unscheduledDrag && isOverTl && unscheduledProposedTime !== null && (
        <div className={styles.floatingIndicator}
          style={{ top: unscheduledDrag.currentY, left: unscheduledDrag.timelineLeft }}>
          <div className={styles.floatingPill}>{formatTime(unscheduledProposedTime)}</div>
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

      {/* 시간 미지정 */}
      {unscheduled.length > 0 && (
        <div className={styles.unscheduled}>
          <h3 className={styles.unscheduledTitle}>시간 미지정</h3>
          <div className={styles.unscheduledList}>
            {unscheduled.map(todo => {
              const isSwipingU      = swipe?.todoId === todo.id && swipe.direction !== 'v';
              const swipeOffsetU    = isSwipingU ? Math.min(0, swipe!.currentX - swipe!.startX) : 0;
              const deleteProgressU = Math.min(1, -swipeOffsetU / 72);
              return (
                <div key={todo.id} style={{ position: 'relative' }}>
                  {isSwipingU && swipeOffsetU < -12 && (
                    <div className={styles.swipeDeleteHint} style={{ opacity: deleteProgressU }}>×</div>
                  )}
                  <div
                    className={`${styles.unscheduledItem} ${todo.completed ? styles.unscheduledItemDone : ''} ${unscheduledDrag?.todoId === todo.id ? styles.unscheduledItemDragging : ''}`}
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
                      <span className={styles.checkboxInner} aria-hidden="true" />
                    </button>

                    <span className={`${styles.unscheduledText} ${todo.completed ? styles.unscheduledTextDone : ''}`}>
                      {todo.text}
                    </span>

                    {/* 그립 (오른쪽, 2선) */}
                    {!todo.completed && (
                      <button
                        type="button"
                        className={styles.dragHandle}
                        onPointerDown={e => { e.stopPropagation(); handleUnscheduledDragStart(e, todo); }}
                        aria-label="드래그로 시간 지정"
                        style={{ touchAction: 'none' }}
                      >
                        <span className={styles.handleIcon} aria-hidden="true" />
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
