import { useEffect, useMemo, useRef, useState } from 'react';
import styles from './TimetableView.module.css';
import { useTodoStore } from '../store/useTodoStore';
import { formatTime } from '../lib/timeFormatter';

const HOUR_HEIGHT = 80; // px per hour

function snap5(min: number): number {
  return Math.round(min / 5) * 5;
}

export function TimetableView() {
  const activeDay = useTodoStore((s) => s.activeDay);
  const todos = useTodoStore((s) => s.days[activeDay]);
  const setTodoTime = useTodoStore((s) => s.setTodoTime);

  const scheduled = useMemo(
    () => todos.filter((t) => t.time !== null).sort((a, b) => (a.time ?? 0) - (b.time ?? 0)),
    [todos],
  );
  const unscheduled = useMemo(() => todos.filter((t) => t.time === null), [todos]);

  // 실제 일정 기준으로 표시 범위를 동적으로 결정
  const { startHour, endHour } = useMemo(() => {
    const times = scheduled.map((t) => t.time!);
    const minH = times.length ? Math.floor(Math.min(...times) / 60) : 8;
    const maxH = times.length ? Math.ceil(Math.max(...times) / 60) : 20;
    return {
      startHour: Math.max(0, Math.min(minH - 1, 6)),
      endHour: Math.min(24, Math.max(maxH + 1, 21)),
    };
  }, [scheduled]);

  const totalHeight = (endHour - startHour) * HOUR_HEIGHT;

  // 렌더마다 최신값을 ref에 저장해 useEffect 클로저 문제 방지
  const convRef = useRef({ startHour, endHour, activeDay, setTodoTime });
  convRef.current = { startHour, endHour, activeDay, setTodoTime };

  function minutesToPx(minutes: number): number {
    return ((minutes / 60) - startHour) * HOUR_HEIGHT;
  }

  const timelineRef = useRef<HTMLDivElement>(null);
  const dragIdRef = useRef<string | null>(null);
  const [dragVisual, setDragVisual] = useState<{
    id: string;
    x: number;
    y: number;
    previewTime: number | null;
  } | null>(null);

  useEffect(() => {
    const calcPreviewTime = (clientY: number): number | null => {
      const el = timelineRef.current;
      if (!el) return null;
      const rect = el.getBoundingClientRect();
      if (clientY < rect.top || clientY > rect.bottom) return null;
      const { startHour: sh, endHour: eh } = convRef.current;
      const raw = ((clientY - rect.top + el.scrollTop) / HOUR_HEIGHT + sh) * 60;
      return Math.max(sh * 60, Math.min(eh * 60 - 1, snap5(raw)));
    };

    const onMove = (e: PointerEvent) => {
      if (!dragIdRef.current) return;
      const previewTime = calcPreviewTime(e.clientY);
      setDragVisual((prev) =>
        prev ? { ...prev, x: e.clientX, y: e.clientY, previewTime } : null,
      );
    };

    const onUp = (e: PointerEvent) => {
      const id = dragIdRef.current;
      if (!id) return;
      dragIdRef.current = null;
      const time = calcPreviewTime(e.clientY);
      if (time !== null) {
        const { activeDay: day, setTodoTime: update } = convRef.current;
        update(day, id, time);
      }
      setDragVisual(null);
    };

    document.addEventListener('pointermove', onMove);
    document.addEventListener('pointerup', onUp);
    document.addEventListener('pointercancel', onUp);
    return () => {
      document.removeEventListener('pointermove', onMove);
      document.removeEventListener('pointerup', onUp);
      document.removeEventListener('pointercancel', onUp);
    };
  }, []);

  const handleChipDragStart = (e: React.PointerEvent, id: string) => {
    e.preventDefault();
    dragIdRef.current = id;
    setDragVisual({ id, x: e.clientX, y: e.clientY, previewTime: null });
  };

  const hours = Array.from({ length: endHour - startHour + 1 }, (_, i) => startHour + i);

  const draggedTodo = dragVisual ? todos.find((t) => t.id === dragVisual.id) : null;

  return (
    <div className={styles.root}>
      {/* 타임라인 */}
      <div className={styles.timelineScroller} ref={timelineRef}>
        <div className={styles.timelineSizer} style={{ height: totalHeight }}>
          {hours.map((h) => (
            <div
              key={h}
              className={styles.hourRow}
              style={{ top: (h - startHour) * HOUR_HEIGHT }}
            >
              <span className={styles.hourLabel}>
                {String(h % 24).padStart(2, '0')}:00
              </span>
              <div className={styles.hourLine} />
            </div>
          ))}

          {scheduled.map((todo) => (
            <div
              key={todo.id}
              className={`${styles.card} ${todo.completed ? styles.cardCompleted : ''} ${
                dragVisual?.id === todo.id ? styles.cardDragging : ''
              }`}
              style={{ top: minutesToPx(todo.time!) }}
            >
              <span className={styles.cardTime}>{formatTime(todo.time!)}</span>
              <span className={styles.cardText}>{todo.text || '(내용 없음)'}</span>
              {todo.parentId && <span className={styles.subBadge}>└</span>}
            </div>
          ))}

          {/* 드래그 프리뷰 */}
          {dragVisual?.previewTime !== null && dragVisual?.previewTime !== undefined && (
            <div
              className={`${styles.card} ${styles.cardPreview}`}
              style={{ top: minutesToPx(dragVisual.previewTime) }}
            >
              <span className={styles.cardTime}>{formatTime(dragVisual.previewTime)}</span>
              <span className={styles.cardText}>{draggedTodo?.text || '(내용 없음)'}</span>
            </div>
          )}
        </div>
      </div>

      {/* 시간 미지정 */}
      {unscheduled.length > 0 && (
        <div className={styles.unscheduled}>
          <p className={styles.unscheduledLabel}>시간 미지정</p>
          <div className={styles.unscheduledList}>
            {unscheduled.map((todo) => (
              <div
                key={todo.id}
                className={`${styles.unscheduledCard} ${
                  dragVisual?.id === todo.id ? styles.unscheduledCardDragging : ''
                } ${todo.completed ? styles.unscheduledCardCompleted : ''}`}
                onPointerDown={!todo.completed ? (e) => handleChipDragStart(e, todo.id) : undefined}
                style={{ touchAction: 'none' }}
              >
                {!todo.completed ? (
                  <span className={styles.cardGrip} aria-hidden="true" />
                ) : (
                  <span className={styles.cardGripPlaceholder} aria-hidden="true" />
                )}
                <span className={styles.unscheduledCardText}>
                  {todo.text || '(내용 없음)'}
                </span>
                {!todo.completed && (
                  <span className={styles.dragHint} aria-hidden="true">↑ 드래그</span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 드래그 고스트 */}
      {dragVisual && (
        <div
          className={styles.ghost}
          style={{
            left: dragVisual.x,
            top: dragVisual.y,
          }}
        >
          {draggedTodo?.text || '(내용 없음)'}
        </div>
      )}
    </div>
  );
}
