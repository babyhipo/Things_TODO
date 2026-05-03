import { useEffect, useMemo, useRef, useState } from 'react';
import styles from './TimelineView.module.css';
import { useTodoStore } from '../store/useTodoStore';
import { formatTime } from '../lib/timeFormatter';
import type { DayKey, Todo } from '../types/todo';

/* ── 현재 시각 ── */
function getCurrentMinutes(): number {
  const d = new Date();
  return d.getHours() * 60 + d.getMinutes();
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
const EVENT_COLORS = ['#3B5BDB', '#7C3AED', '#0891B2', '#059669', '#D97706'];
function eventColor(id: string, overdue: boolean, completed: boolean): string {
  if (completed) return '#9CA3AF';
  if (overdue)   return '#EF4444';
  const h = id.split('').reduce((a, c) => a + c.charCodeAt(0), 0);
  return EVENT_COLORS[h % EVENT_COLORS.length];
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

const SNAP = 5;

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
    return snapTo(Math.max(minT, Math.min(1439, minT + Math.round(t * (1439 - minT)))));
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
  | { type: 'gap'; fromMin: number; toMin: number; key: string };

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
  const timelineRef     = useRef<HTMLDivElement>(null);
  useEffect(() => { dragRef.current = drag; });

  /* ── 데이터 ── */
  const { scheduled, unscheduled } = useMemo(() => {
    const all = days[day];
    return {
      scheduled:   all.filter(t => t.time !== null).sort((a, b) => (a.time ?? 0) - (b.time ?? 0)),
      unscheduled: all.filter(t => t.time === null).sort((a, b) => a.order - b.order),
    };
  }, [days, day]);

  const segments = useMemo<Segment[]>(() => {
    const result: Segment[] = [];
    for (let i = 0; i < scheduled.length; i++) {
      result.push({ type: 'event', todo: scheduled[i] });
      if (i < scheduled.length - 1) {
        const gap = (scheduled[i + 1].time ?? 0) - (scheduled[i].time ?? 0);
        if (gap > 60)
          result.push({
            type: 'gap',
            fromMin: scheduled[i].time ?? 0,
            toMin: scheduled[i + 1].time ?? 0,
            key: `${scheduled[i].time}-${scheduled[i + 1].time}`,
          });
      }
    }
    return result;
  }, [scheduled]);

  const toggleGap = (key: string) =>
    setExpandedGaps(prev => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });

  /* ── 드래그 시작 ── */
  const handleDragStart = (e: React.PointerEvent, todo: Todo) => {
    if (todo.time === null || !timelineRef.current) return;
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
        return [{ todoId: t.id, time: t.time!, centerY: ar.top + ar.height / 2 }];
      });

    const ds: DragState = {
      todoId: todo.id,
      originalTime: todo.time,
      initialCardCenterY: er ? er.top + er.height / 2 : e.clientY,
      cardHeight: er ? er.height + 16 : 72, // +16 = margin-bottom
      currentY: e.clientY,
      anchors,
      containerTop:    cr.top,
      containerBottom: cr.bottom,
      containerLeft:   cr.left,
    };
    setDrag(ds);
    dragRef.current = ds;
  };

  /* ── 드래그 이동·종료 ── */
  useEffect(() => {
    if (!drag) return;
    const onMove = (e: PointerEvent) =>
      setDrag(prev => prev ? { ...prev, currentY: e.clientY } : null);
    const onEnd = () => {
      const ds = dragRef.current;
      if (!ds) return;
      setTodoTime(day, ds.todoId, calcProposedTime(ds));
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

  /* ── 드롭존 삽입 위치 계산 ── */
  const insertBeforeId = drag ? getInsertionBeforeId(drag.currentY, drag.anchors) : null;
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
    <div className={`${styles.container} ${drag ? styles.containerDragging : ''}`}>
      {scheduled.length > 0 && (
        <div ref={timelineRef} className={styles.timeline}>
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
                            <div className={styles.timeCol}>
                              <span className={styles.timeLabel}>{String(h).padStart(2, '0')}:00</span>
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

            /* ── 이벤트 카드 ── */
            const { todo }   = seg;
            const isDragging = drag?.todoId === todo.id;

            // 드롭존: 이 카드 바로 앞에 삽입
            const showDropZoneHere =
              drag && !isDragging && !dropZoneRendered && todo.id === insertBeforeId;
            if (showDropZoneHere) dropZoneRendered = true;

            const displayTime = isDragging ? calcProposedTime(drag!) : todo.time!;
            const isOverdue   = !todo.completed && todo.time !== null
                              && day === 'today' && todo.time < now && !isDragging;
            const color       = eventColor(todo.id, isOverdue, todo.completed);
            const isCurrent   = !isDragging && todo.time !== null
                              && todo.time <= now && now < (todo.time ?? 0) + 60;
            const translateY  = isDragging && drag
              ? drag.currentY - drag.initialCardCenterY
              : 0;

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

                {/* 카드 */}
                <div
                  className={`${styles.card} ${isDragging ? styles.cardDragging : ''}`}
                  style={{ borderLeftColor: isDragging ? '#3B5BDB' : color }}
                >
                  <button
                    type="button"
                    className={styles.cardDragHandle}
                    onPointerDown={e => handleDragStart(e, todo)}
                    aria-label="드래그로 시간 변경"
                    style={{ touchAction: 'none' }}
                  >
                    <GripIcon />
                  </button>
                  <div className={styles.cardContent}>
                    <p className={`${styles.cardTitle} ${todo.completed ? styles.cardTitleDone : ''}`}>
                      {todo.text || <span className={styles.noText}>(내용 없음)</span>}
                    </p>
                    {isOverdue && <span className={styles.overdueBadge}>지남</span>}
                  </div>
                  <div className={styles.cardActions}>
                    <button type="button"
                      className={`${styles.checkBtn} ${todo.completed ? styles.checkBtnDone : ''}`}
                      style={{ borderColor: color, backgroundColor: todo.completed ? color : undefined }}
                      onClick={() => toggleComplete(day, todo.id)}
                      aria-label={todo.completed ? '완료 취소' : '완료'}>
                      {todo.completed && (
                        <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden="true">
                          <path d="M1.5 5L4 7.5L8.5 2.5" stroke="#fff" strokeWidth="1.8"
                            strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      )}
                    </button>
                    <button type="button" className={styles.deleteBtn}
                      onClick={() => deleteTodo(day, todo.id)} aria-label="삭제">×</button>
                  </div>
                </div>
              </div>
            );

            return (
              <div key={todo.id}>
                {/* 드롭존: 이 카드 위에 공간을 열어 아래 카드들이 내려감 */}
                {showDropZoneHere && (
                  <div
                    className={styles.dropZone}
                    style={{ height: drag!.cardHeight }}
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
          {drag && !dropZoneRendered && insertBeforeId === null && (
            <div className={styles.dropZone} style={{ height: drag.cardHeight }} />
          )}
        </div>
      )}

      {/* 플로팅 시간 인디케이터 */}
      {drag && (
        <div className={styles.floatingIndicator}
          style={{ top: drag.currentY, left: drag.containerLeft }}>
          <div className={styles.floatingPill}>{formatTime(calcProposedTime(drag))}</div>
          <div className={styles.floatingLine} />
        </div>
      )}

      {/* 시간 미지정 */}
      {unscheduled.length > 0 && (
        <div className={styles.unscheduled}>
          <h3 className={styles.unscheduledTitle}>시간 미지정</h3>
          <div className={styles.unscheduledList}>
            {unscheduled.map(todo => (
              <div key={todo.id}
                className={`${styles.unscheduledItem} ${todo.completed ? styles.unscheduledItemDone : ''}`}>
                <button type="button"
                  className={`${styles.checkBtn} ${todo.completed ? styles.checkBtnDone : ''}`}
                  style={{ borderColor: todo.completed ? '#9CA3AF' : '#3B5BDB',
                           backgroundColor: todo.completed ? '#9CA3AF' : undefined }}
                  onClick={() => toggleComplete(day, todo.id)}
                  aria-label={todo.completed ? '완료 취소' : '완료'}>
                  {todo.completed && (
                    <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden="true">
                      <path d="M1.5 5L4 7.5L8.5 2.5" stroke="#fff" strokeWidth="1.8"
                        strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  )}
                </button>
                <span className={styles.unscheduledText}>{todo.text}</span>
                <button type="button" className={styles.deleteBtn}
                  onClick={() => deleteTodo(day, todo.id)} aria-label="삭제">×</button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
