import { useEffect, useMemo, useRef, useState } from 'react';
import styles from './TimelineView.module.css';
import { useTodoStore } from '../store/useTodoStore';
import { formatTime } from '../lib/timeFormatter';
import type { DayKey, Todo } from '../types/todo';

/* ── 하루 기준: 새벽 4시 ── */
const DAY_START_MIN = 4 * 60; // 240

/** 저장값(0~1439) → 가상 시간(240~1679): 새벽 0~3시는 하루 끝에 배치 */
function toVirt(t: number): number {
  return t < DAY_START_MIN ? t + 1440 : t;
}
/** 가상 시간(240~1679) → 저장값(0~1439) */
function fromVirt(t: number): number {
  return t >= 1440 ? t - 1440 : t;
}

/* ── 현재 시각 (가상 시간) ── */
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

/* ── 이벤트 색상 ── */
function eventColor(time: number | null, overdue: boolean, completed: boolean, now: number): string {
  if (completed) return '#9CA3AF';
  if (overdue)   return '#EF4444';
  if (time === null) return '#7C3AED'; // 시간 미지정 → 보라
  const diff = toVirt(time) - now;   // 가상 시간 기준 차이
  if (diff <= 60)  return '#F59E0B'; // 1시간 내 임박 → 노랑
  if (diff <= 180) return '#10B981'; // 3시간 내 예정 → 초록
  return '#3B5BDB';                  // 그 이후 → 파랑
}

/* ── 드래그 타입 ── */
interface CardAnchor {
  todoId: string;
  time: number;
  centerY: number; // 드래그 시작 시 측정된 고정값
}

interface DragState {
  todoId: string;
  originalTime: number;
  initialCardCenterY: number;
  cardHeight: number;   // 카드 높이 + margin (드롭존 크기로 사용)
  currentY: number;
  anchors: CardAnchor[]; // 다른 카드들의 위치 스냅샷 (정렬됨)
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

/** 앵커 기반 Y좌표 → 분 단위 시간 보간 (언스케줄 드래그용) */
function calcTimeFromY(
  currentY: number,
  anchors: CardAnchor[],
  containerTop: number,
  containerBottom: number,
): number {
  const sorted = [...anchors].sort((a, b) => a.centerY - b.centerY);
  if (sorted.length === 0) {
    const t = Math.max(0, Math.min(1, (currentY - containerTop) / Math.max(1, containerBottom - containerTop)));
    return snapTo(Math.round(DAY_START_MIN + t * (1439 - DAY_START_MIN))); // 4:00~23:59 범위
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
  return snapTo(DAY_START_MIN + 480); // fallback: 12:00
}

/** 포인터 Y → 인접 두 카드 사이 시간 범위만 보간 */
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
      const raw = minT + t * (maxT - minT);
      return snapTo(Math.max(minT, Math.min(maxT, raw)));
    }
  }
  return originalTime;
}

function snapTo(v: number): number {
  return Math.round(v / SNAP) * SNAP;
}

/**
 * 드롭존이 들어갈 위치: anchors 중 어떤 카드 "바로 앞"에 삽입되는지 todoId 반환
 * null이면 모든 카드 뒤에 삽입
 */
function getInsertionBeforeId(currentY: number, anchors: CardAnchor[]): string | null {
  const sorted = [...anchors].sort((a, b) => a.centerY - b.centerY);
  for (const anchor of sorted) {
    if (currentY < anchor.centerY) return anchor.todoId;
  }
  return null; // 가장 뒤에 삽입
}

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

type Segment =
  | { type: 'event'; todo: Todo }
  | { type: 'gap'; fromMin: number; toMin: number; key: string }
  | { type: 'now'; time: number; key: string };

interface TimelineViewProps { day: DayKey; }

export function TimelineView({ day }: TimelineViewProps) {
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

  /* ── 데이터 ── */
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
    for (let i = 0; i < scheduled.length; i++) {
      const virtTime = toVirt(scheduled[i].time ?? 0);

      // 현재 시간 인디케이터 삽입 (오늘 탭, 아직 삽입 안 된 경우)
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

    // 모든 일정이 과거거나 일정이 없을 때 맨 끝에 삽입
    if (day === 'today' && !nowInserted) {
      result.push({ type: 'now', time: now, key: 'now' });
    }

    return result;
  }, [scheduled, day, now]);

  const toggleGap = (key: string) =>
    setExpandedGaps(prev => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });

  /* ── 드래그 시작 ── */
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
      cardHeight: er ? er.height + 8 : 44, // +8 = margin-bottom
      currentY: e.clientY,
      anchors,
      containerTop:    cr.top,
      containerBottom: cr.bottom,
      containerLeft:   cr.left,
    };
    setDrag(ds);
    dragRef.current = ds;
  };

  /* ── 스와이프 삭제 ── */
  const handleSwipeStart = (e: React.PointerEvent, todoId: string) => {
    if ((e.target as Element).closest('button')) return;
    const ds: SwipeState = { todoId, startX: e.clientX, startY: e.clientY, currentX: e.clientX, direction: 'undecided' };
    setSwipe(ds);
    swipeRef.current = ds;
  };

  /* ── 언스케줄 드래그 시작 ── */
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

  /* ── 스와이프 이동·종료 ── */
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

  /* ── 드래그 이동·종료 ── */
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

  /* ── 언스케줄 드래그 이동·종료 ── */
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

  /* ── 드롭존 삽입 위치 계산 ── */
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
            const { todo }   = seg;
            const isDragging = drag?.todoId === todo.id;

            // 드롭존: 이 카드 바로 앞에 삽입
            const showDropZoneHere =
              showDropZone && !isDragging && !dropZoneRendered && todo.id === effectiveInsertBeforeId;
            if (showDropZoneHere) dropZoneRendered = true;

            const virtTodoTime = toVirt(todo.time!);
            const displayTime = isDragging ? calcProposedTime(drag!) : virtTodoTime;
            const isOverdue   = !todo.completed && todo.time !== null
                              && day === 'today' && virtTodoTime < now && !isDragging;
            const color       = eventColor(todo.time, isOverdue, todo.completed, now);
            const isCurrent   = !isDragging && todo.time !== null
                              && virtTodoTime <= now && now < virtTodoTime + 60;
            const translateY  = isDragging && drag
              ? drag.currentY - drag.initialCardCenterY
              : 0;

            const isSwipingThis = swipe?.todoId === todo.id && swipe.direction !== 'v';
            const swipeOffset   = isSwipingThis ? Math.min(0, swipe!.currentX - swipe!.startX) : 0;
            const deleteProgress = Math.min(1, -swipeOffset / 72);

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
                <div className={styles.timeCol}>
                  <span className={`${styles.timeLabel}
                    ${isDragging ? styles.timeLabelDragging : ''}
                    ${isOverdue  ? styles.timeLabelOverdue  : ''}`}>
                    {formatTime(displayTime)}
                  </span>
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

                {/* 카드 */}
                <div
                  className={`${styles.card} ${isDragging ? styles.cardDragging : ''} ${isDragOutside ? styles.cardDragOutside : ''}`}
                  onPointerDown={e => handleSwipeStart(e, todo.id)}
                  style={{
                    borderLeftColor: isDragOutside ? '#9CA3AF' : isDragging ? '#3B5BDB' : color,
                    transform: `translateX(${swipeOffset}px)`,
                    transition: isSwipingThis ? 'none' : 'transform 200ms ease, box-shadow 150ms, border-left-color 150ms',
                  }}
                >
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
                    <p className={`${styles.cardTitle} ${todo.completed ? styles.cardTitleDone : ''}`}>
                      {todo.text || <span className={styles.noText}>(내용 없음)</span>}
                    </p>
                    {isOverdue && <span className={styles.overdueBadge}>지남</span>}
                  </div>
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

            return (
              <div key={todo.id}>
                {/* 드롭존: 이 카드 위에 공간을 열어 아래 카드들이 내려감 */}
                {showDropZoneHere && (
                  <div
                    className={styles.dropZone}
                    style={{ height: dropZoneHeight }}
                  />
                )}

                {/* 드래그 중인 카드: 레이아웃 공간 0 (아래 카드들이 올라옴) */}
                {isDragging
                  ? <div style={{ height: 0, overflow: 'visible' }}>{card}</div>
                  : card}
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
          <div className={styles.floatingPill}>{formatTime(calcProposedTime(drag))}</div>
          <div className={styles.floatingLine} />
        </div>
      )}

      {/* 언스케줄 드래그: 플로팅 인디케이터 + 고스트 */}
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
              const isSwipingU     = swipe?.todoId === todo.id && swipe.direction !== 'v';
              const swipeOffsetU   = isSwipingU ? Math.min(0, swipe!.currentX - swipe!.startX) : 0;
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
