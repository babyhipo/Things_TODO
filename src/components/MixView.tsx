import { useEffect, useMemo, useRef, useState } from 'react';
import styles from './MixView.module.css';
import { useTodoStore } from '../store/useTodoStore';
import { formatTime } from '../lib/timeFormatter';
import { hapticGrab, hapticTick, hapticReorder, hapticDrop, hapticDelete } from '../lib/haptics';
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

interface SubDragState {
  todoId: string;
  text: string;
  currentX: number;
  currentY: number;
  timelineTop: number;
  timelineBottom: number;
  timelineLeft: number;
  anchors: CardAnchor[];
  parentId: string;
  siblingIds: string[]; // 드래그 시작 시 형제 순서 (자신 포함)
  timelineWidth: number;
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
  const days               = useTodoStore((s) => s.days);
  const toggleComplete     = useTodoStore((s) => s.toggleComplete);
  const deleteTodo         = useTodoStore((s) => s.deleteTodo);
  const moveTodoToTomorrow = useTodoStore((s) => s.moveTodoToTomorrow);
  const updateTodoText     = useTodoStore((s) => s.updateTodoText);
  const setTodoTime        = useTodoStore((s) => s.setTodoTime);
  const setParentId        = useTodoStore((s) => s.setParentId);
  const reorderSubItems    = useTodoStore((s) => s.reorderSubItems);
  const pendingParentId    = useTodoStore((s) => s.pendingParentId);
  const setPendingParentId = useTodoStore((s) => s.setPendingParentId);
  const now = useNowMinutes();

  const [editingId, setEditingId]   = useState<string | null>(null);
  const [editDraft, setEditDraft]   = useState('');
  const editInputRef  = useRef<HTMLInputElement | null>(null);
  const cancelEditRef = useRef(false);

  const beginEdit = (todo: Todo) => {
    const timeStr = todo.time !== null
      ? (todo.endTime != null
          ? `${formatTime(todo.time)}-${formatTime(todo.endTime)} `
          : `${formatTime(todo.time)} `)
      : '';
    setEditDraft(timeStr + todo.text);
    cancelEditRef.current = false;
    setEditingId(todo.id);
  };
  const commitEdit = (id: string) => {
    if (cancelEditRef.current) return;
    const v = editDraft.trim();
    if (!v) deleteTodo(day, id);
    else updateTodoText(day, id, v);
    setEditingId(null);
  };
  const cancelEdit = () => {
    cancelEditRef.current = true;
    setEditingId(null);
  };

  useEffect(() => {
    if (editingId && editInputRef.current) {
      const el = editInputRef.current;
      el.focus();
      el.setSelectionRange(el.value.length, el.value.length);
    }
  }, [editingId]);

  const [expandedGaps, setExpandedGaps] = useState<Set<string>>(new Set());
  const [drag, setDrag] = useState<DragState | null>(null);
  const dragRef         = useRef<DragState | null>(null);
  const [unscheduledDrag, setUnscheduledDrag] = useState<UnscheduledDragState | null>(null);
  const unscheduledDragRef = useRef<UnscheduledDragState | null>(null);
  const [swipe, setSwipe] = useState<SwipeState | null>(null);
  const swipeRef = useRef<SwipeState | null>(null);
  const timelineRef        = useRef<HTMLDivElement>(null);
  const [subDrag, setSubDrag] = useState<SubDragState | null>(null);
  const [proposedSubOrder, setProposedSubOrder] = useState<string[] | null>(null);
  const proposedSubOrderRef = useRef<string[] | null>(null);
  const subDragRef         = useRef<SubDragState | null>(null);
  const [subDragParentTarget, setSubDragParentTarget] = useState<string | null>(null);
  const subDragParentTargetRef = useRef<string | null>(null);
  const lastSnapRef        = useRef<number | null>(null);
  const lastSubOrderRef    = useRef<string | null>(null);
  const pillRef            = useRef<HTMLDivElement>(null);
  const ghostRef           = useRef<HTMLDivElement>(null);
  useEffect(() => { dragRef.current = drag; });
  useEffect(() => { unscheduledDragRef.current = unscheduledDrag; });
  useEffect(() => { swipeRef.current = swipe; });
  useEffect(() => { subDragRef.current = subDrag; });

  const { scheduled, unscheduled, childrenByParent } = useMemo(() => {
    const all = days[day];
    const childMap = new Map<string, typeof all>();
    all.filter(t => t.parentId).forEach(c => {
      const arr = childMap.get(c.parentId!) ?? [];
      arr.push(c);
      childMap.set(c.parentId!, arr);
    });
    const roots = all.filter(t => !t.parentId);
    return {
      scheduled:        roots.filter(t => t.time !== null).sort((a, b) => toVirt(a.time ?? 0) - toVirt(b.time ?? 0)),
      unscheduled:      roots.filter(t => t.time === null).sort((a, b) => a.order - b.order),
      childrenByParent: childMap,
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
    hapticGrab(el ?? undefined);
    lastSnapRef.current = toVirt(todo.time!);
    setDrag(ds);
    dragRef.current = ds;
  };

  const handleSwipeStart = (e: React.PointerEvent, todoId: string) => {
    if ((e.target as Element).closest('button')) return;
    const ds: SwipeState = { todoId, startX: e.clientX, startY: e.clientY, currentX: e.clientX, direction: 'undecided' };
    setSwipe(ds);
    swipeRef.current = ds;
  };

  const handleSubDragStart = (e: React.PointerEvent, child: Todo) => {
    e.preventDefault();
    e.stopPropagation();
    const cr = timelineRef.current?.getBoundingClientRect() ?? { top: 0, bottom: 300, left: 0 };
    const anchors: CardAnchor[] = scheduled.flatMap(t => {
      const el = document.querySelector<HTMLElement>(`[data-todo-id="${t.id}"]`);
      if (!el) return [];
      const r = el.getBoundingClientRect();
      return [{ todoId: t.id, time: toVirt(t.time!), centerY: r.top + r.height / 2 }];
    });
    const parentId = child.parentId!;
    const siblingIds = (childrenByParent.get(parentId) ?? [])
      .slice().sort((a, b) => a.order - b.order)
      .map(c => c.id);
    const ds: SubDragState = {
      todoId: child.id,
      text: child.text,
      currentX: e.clientX,
      currentY: e.clientY,
      timelineTop: cr.top,
      timelineBottom: cr.bottom,
      timelineLeft: cr.left,
      timelineWidth: cr.width,
      anchors,
      parentId,
      siblingIds,
    };
    const childEl = document.querySelector<HTMLElement>(`[data-sub-id="${child.id}"]`);
    hapticGrab(childEl ?? undefined);
    lastSubOrderRef.current = siblingIds.join(',');
    setSubDrag(ds);
    subDragRef.current = ds;
    setProposedSubOrder(siblingIds);
    proposedSubOrderRef.current = siblingIds;
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
    hapticGrab();
    lastSnapRef.current = null;
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
      if (s && s.direction === 'h') {
        const dx = s.currentX - s.startX;
        if (dx <= -72) {
          hapticDelete();
          deleteTodo(day, s.todoId);
        } else if (dx >= 72 && day === 'today') {
          hapticDrop();
          moveTodoToTomorrow(day, s.todoId);
        }
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
  }, [!!swipe, day, deleteTodo, moveTodoToTomorrow]);

  useEffect(() => {
    if (!drag) return;
    const onMove = (e: PointerEvent) => {
      const ds = dragRef.current;
      if (ds) {
        const newSnap = calcProposedTime({ ...ds, currentY: e.clientY });
        if (lastSnapRef.current !== newSnap) {
          hapticTick(pillRef.current);
          lastSnapRef.current = newSnap;
        }
      }
      setDrag(prev => prev ? { ...prev, currentY: e.clientY } : null);
    };
    const onEnd = () => {
      const ds = dragRef.current;
      if (!ds) return;
      const isOutside = ds.currentY < ds.containerTop || ds.currentY > ds.containerBottom;
      hapticDrop(pillRef.current);
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
      const ds = unscheduledDragRef.current;
      if (ds) {
        const overTl = e.clientY >= ds.timelineTop && e.clientY <= ds.timelineBottom;
        if (overTl) {
          const newSnap = calcTimeFromY(e.clientY, ds.anchors, ds.timelineTop, ds.timelineBottom);
          if (lastSnapRef.current !== newSnap) {
            hapticTick(pillRef.current);
            lastSnapRef.current = newSnap;
          }
        } else {
          lastSnapRef.current = null;
        }
      }
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
        hapticDrop(pillRef.current);
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

  /* ── 하위 일정 드래그: 부모 변경 or 형제 순서 변경 ── */
  useEffect(() => {
    if (!subDrag) return;
    const onMove = (e: PointerEvent) => {
      setSubDrag(prev => {
        if (!prev) return null;
        const cr = timelineRef.current?.getBoundingClientRect();
        return {
          ...prev,
          currentX: e.clientX,
          currentY: e.clientY,
          ...(cr ? { timelineTop: cr.top, timelineBottom: cr.bottom, timelineLeft: cr.left } : {}),
        };
      });
      // 포인터 아래 루트 카드 감지 (부모 변경 대상)
      let found: string | null = null;
      for (const t of scheduled) {
        const el = document.querySelector<HTMLElement>(`[data-todo-id="${t.id}"]`);
        if (!el) continue;
        const rect = el.getBoundingClientRect();
        if (e.clientY >= rect.top + rect.height * 0.2 && e.clientY <= rect.bottom - rect.height * 0.2) {
          found = t.id;
          break;
        }
      }
      subDragParentTargetRef.current = found;
      setSubDragParentTarget(found);

      // 같은 부모 내 형제 순서 계산
      if (!found) {
        const ds = subDragRef.current;
        if (!ds) return;
        const others = ds.siblingIds.filter(id => id !== ds.todoId);
        const positions = others.map(id => {
          const el = document.querySelector<HTMLElement>(`[data-sub-id="${id}"]`);
          const rect = el?.getBoundingClientRect();
          return { id, centerY: rect ? rect.top + rect.height / 2 : 0 };
        }).sort((a, b) => a.centerY - b.centerY);

        let newOrder: string[] = [];
        let inserted = false;
        for (const p of positions) {
          if (!inserted && e.clientY < p.centerY) {
            newOrder.push(ds.todoId);
            inserted = true;
          }
          newOrder.push(p.id);
        }
        if (!inserted) newOrder.push(ds.todoId);
        const orderKey = newOrder.join(',');
        if (lastSubOrderRef.current !== orderKey) {
          hapticReorder(ghostRef.current);
          lastSubOrderRef.current = orderKey;
        }
        setProposedSubOrder(newOrder);
        proposedSubOrderRef.current = newOrder;
      }
    };
    const onEnd = () => {
      const ds = subDragRef.current;
      if (!ds) return;
      const target = subDragParentTargetRef.current;
      if (target) {
        hapticDrop(ghostRef.current);
        setParentId(day, ds.todoId, target);
      } else {
        const order = proposedSubOrderRef.current;
        if (order && order.length > 1) {
          hapticDrop(ghostRef.current);
          reorderSubItems(day, ds.parentId, order);
        }
      }
      setSubDrag(null);
      subDragRef.current = null;
      subDragParentTargetRef.current = null;
      setSubDragParentTarget(null);
      setProposedSubOrder(null);
      proposedSubOrderRef.current = null;
    };
    window.addEventListener('pointermove', onMove, { passive: true });
    window.addEventListener('pointerup', onEnd);
    window.addEventListener('pointercancel', onEnd);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onEnd);
      window.removeEventListener('pointercancel', onEnd);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [!!subDrag, day, setParentId, reorderSubItems]);

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
          const isDragging       = drag?.todoId === todo.id;
          const isSelected       = pendingParentId === todo.id;
          const isSubDropTarget  = subDragParentTarget === todo.id;

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

          const isSwipingThis  = swipe?.todoId === todo.id && swipe.direction !== 'v';
          const rawOffset      = isSwipingThis ? swipe!.currentX - swipe!.startX : 0;
          const swipeOffset    = Math.max(-80, Math.min(80, rawOffset));
          const deleteProgress = Math.min(1, -swipeOffset / 72);
          const moveProgress   = Math.min(1, swipeOffset / 72);

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
              {/* 스와이프 삭제 힌트 (왼쪽) */}
              {isSwipingThis && swipeOffset < -12 && (
                <div className={styles.swipeDeleteHint} style={{ opacity: deleteProgress }}>×</div>
              )}
              {/* 스와이프 내일 이동 힌트 (오른쪽) — 오늘 탭만 */}
              {isSwipingThis && swipeOffset > 12 && day === 'today' && (
                <div className={styles.swipeMoveHint} style={{ opacity: moveProgress }}>→</div>
              )}

              {/* 카드: 시간 레이블 포함 */}
              <div
                className={`${styles.card} ${isDragging ? styles.cardDragging : ''} ${isDragOutside ? styles.cardDragOutside : ''} ${todo.endTime != null ? styles.cardRange : ''} ${isSelected ? styles.cardSelected : ''} ${isSubDropTarget ? styles.cardSubDropTarget : ''}`}
                onPointerDown={e => handleSwipeStart(e, todo.id)}
                style={{
                  transform: `translateX(${swipeOffset}px)`,
                  transition: isSwipingThis ? 'none' : 'transform 200ms ease, box-shadow 150ms',
                }}
              >
                {/* 시간 레이블 (카드 내 좌측) */}
                <div className={styles.timeWrap}>
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
                    style={{
                      borderColor: color,
                      backgroundColor: todo.completed ? color : undefined,
                    }}
                    aria-hidden="true"
                  />
                </button>

                {/* 텍스트 */}
                <div className={styles.textWrap}>
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

          const children = (childrenByParent.get(todo.id) ?? [])
            .slice().sort((a, b) => {
              if (a.time == null && b.time == null) return a.order - b.order;
              if (a.time == null) return 1;
              if (b.time == null) return -1;
              if (a.time !== b.time) return a.time - b.time;
              return a.order - b.order;
            });

          const isThisParentDragging = subDrag?.parentId === todo.id;
          const displayChildren = isThisParentDragging && proposedSubOrder
            ? [...children].sort((a, b) =>
                proposedSubOrder.indexOf(a.id) - proposedSubOrder.indexOf(b.id))
            : children;

          return (
            <div key={todo.id}>
              {showDropZoneHere && (
                <div className={styles.dropZone} style={{ height: dropZoneHeight }} />
              )}
              {isDragging
                ? <div style={{ height: 0, overflow: 'visible' }}>{card}</div>
                : card}
              {!isDragging && displayChildren.map(child => (
                <div
                  key={child.id}
                  data-sub-id={child.id}
                  className={`${styles.subItem} ${child.completed ? styles.subItemDone : ''} ${subDrag?.todoId === child.id ? styles.subItemDragging : ''}`}
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
                  <span className={`${styles.subItemText} ${child.completed ? styles.subItemTextDone : ''}`}>
                    {child.text || '(내용 없음)'}
                  </span>
                  <button
                    type="button"
                    className={styles.subItemHandle}
                    onPointerDown={!child.completed ? (e => { e.stopPropagation(); handleSubDragStart(e, child); }) : undefined}
                    aria-label="드래그로 이동"
                    disabled={child.completed}
                    style={{ touchAction: 'none' }}
                  >
                    <span className={styles.handleIcon} aria-hidden="true" />
                  </button>
                </div>
              ))}
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
          <div ref={pillRef} className={styles.floatingPill}>{formatTime(calcProposedTime(drag))}</div>
          <div className={styles.floatingLine} />
        </div>
      )}

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
                    {/* 체크박스 */}
                    <button
                      type="button"
                      role="checkbox"
                      aria-checked={todo.completed}
                      aria-label={todo.completed ? '완료 취소' : '완료 처리'}
                      className={`${styles.checkbox} ${todo.completed ? styles.checkboxChecked : ''}`}
                      onClick={() => toggleComplete(day, todo.id)}
                    >
                      <span className={styles.checkboxInner} aria-hidden="true"
                        style={{ borderColor: todo.completed ? '#9CA3AF' : '#7C3AED',
                                 backgroundColor: todo.completed ? '#9CA3AF' : undefined }} />
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
