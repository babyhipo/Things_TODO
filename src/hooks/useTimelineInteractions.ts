// 믹스뷰·시간표뷰가 공유하는 상호작용 로직(편집·드래그·스와이프·하위항목 이동)을
// 한 곳으로 모은 훅. 두 뷰는 레이아웃(JSX)만 다르고 동작 로직은 동일하므로,
// 상태·핸들러·파생값을 여기서 만들어 두 컴포넌트가 함께 쓴다.
// (레이아웃은 일부러 분리 유지 — 강제 병합하지 않는다.)
import { useEffect, useMemo, useRef, useState } from 'react';
import { useTodoStore } from '../store/useTodoStore';
import { formatTime } from '../lib/timeFormatter';
import { hapticGrab, hapticTick, hapticReorder, hapticDrop, hapticDelete } from '../lib/haptics';
import type { DayKey, Todo } from '../types/todo';
import { toVirt, fromVirt } from '../lib/dayBoundary';
import { useNowMinutes } from './useNowMinutes';
import {
  SECTION_MARKS,
  calcTimeFromY,
  calcProposedTime,
  getInsertionBeforeId,
  getInsertionBeforeIdByTime,
  type CardAnchor,
  type DragState,
  type SwipeState,
  type UnscheduledDragState,
  type SubDragState,
  type Segment,
} from '../lib/timelineMath';

export function useTimelineInteractions(day: DayKey) {
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

  // ── 인라인 편집 ──
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState('');
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

  // ── 드래그/스와이프 상태 ──
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

  // ── 데이터 가공: 루트/하위/시간지정 분류 ──
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

  // ── 세그먼트: 이벤트/갭/현재시각/섹션 구분선 ──
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
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  // ── 드래그 시작 (시간 지정된 루트 카드) ──
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
      startY: e.clientY,
      initialCardCenterY: er ? er.top + er.height / 2 : e.clientY,
      cardHeight: er ? er.height + 8 : 44, // +8 = margin-bottom
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

  // ── 스와이프 시작 ──
  const handleSwipeStart = (e: React.PointerEvent, todoId: string) => {
    if ((e.target as Element).closest('button')) return;
    const ds: SwipeState = { todoId, startX: e.clientX, startY: e.clientY, currentX: e.clientX, direction: 'undecided' };
    setSwipe(ds);
    swipeRef.current = ds;
  };

  // ── 하위 일정 드래그 시작 ──
  const handleSubDragStart = (e: React.PointerEvent, child: Todo) => {
    e.preventDefault();
    e.stopPropagation();
    const cr = timelineRef.current?.getBoundingClientRect() ?? { top: 0, bottom: 300, left: 0, width: 0 };
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

  // ── 언스케줄(시간 미지정) 드래그 시작 ──
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

  // ── 스와이프 이동·종료 ──
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
          // '내일로 미루기'는 미완료 카드만 (완료 카드는 오른쪽 스와이프해도 이동 안 함)
          const target = useTodoStore.getState().days[day].find(t => t.id === s.todoId);
          if (target && !target.completed) {
            hapticDrop();
            moveTodoToTomorrow(day, s.todoId);
          }
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

  // ── 드래그 이동·종료 (시간 재지정) ──
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
      // 고정 감도: 드래그 거리로 정해진 시간을 그대로 적용 (밖으로 끌어 해제하던 동작은 제거)
      hapticDrop(pillRef.current);
      setTodoTime(day, ds.todoId, fromVirt(calcProposedTime(ds)));
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

  // ── 언스케줄 드래그 이동·종료 (카드 위 → 하위일정 편입 / 빈 타임라인 → 시간 부여) ──
  useEffect(() => {
    if (!unscheduledDrag) return;
    const onMove = (e: PointerEvent) => {
      const ds = unscheduledDragRef.current;
      // 포인터 아래 루트 카드 감지 (그 카드의 하위일정으로 편입할 대상)
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
      if (subDragParentTargetRef.current !== found) {
        subDragParentTargetRef.current = found;
        setSubDragParentTarget(found);
        if (found) hapticReorder(ghostRef.current);
      }
      // 카드 위가 아닐 때만 시간 스냅 햅틱
      if (ds && !found) {
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
      const target = subDragParentTargetRef.current;
      if (target) {
        // 카드 위에 드롭 → 그 카드의 하위일정으로 편입
        hapticDrop(ghostRef.current);
        setParentId(day, ds.todoId, target);
      } else {
        const overTl = ds.currentY >= ds.timelineTop && ds.currentY <= ds.timelineBottom;
        if (overTl) {
          hapticDrop(pillRef.current);
          const t = calcTimeFromY(ds.currentY, ds.anchors, ds.timelineTop, ds.timelineBottom);
          setTodoTime(day, ds.todoId, fromVirt(t));
        }
      }
      subDragParentTargetRef.current = null;
      setSubDragParentTarget(null);
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
  }, [!!unscheduledDrag, day, setTodoTime, setParentId]);

  // ── 하위 일정 드래그: 부모 변경 or 형제 순서 변경 ──
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

        const newOrder: string[] = [];
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

  // ── 드롭존 삽입 위치·파생값 ──
  // 고정 감도에서는 포인터 위치가 아니라 "제안된 시간" 기준으로 삽입 위치를 잡아야 일관됨
  const insertBeforeId = drag ? getInsertionBeforeIdByTime(calcProposedTime(drag), drag.anchors) : null;

  // 언스케줄 드래그가 카드 위에 있으면(하위일정 편입 대상) 시간 배정 UI는 숨긴다
  const unscheduledOverCard = !!unscheduledDrag && subDragParentTarget !== null;
  const isOverTl = !!unscheduledDrag
    && !unscheduledOverCard
    && unscheduledDrag.currentY >= unscheduledDrag.timelineTop
    && unscheduledDrag.currentY <= unscheduledDrag.timelineBottom;
  const unscheduledProposedTime = (unscheduledDrag && isOverTl)
    ? calcTimeFromY(unscheduledDrag.currentY, unscheduledDrag.anchors, unscheduledDrag.timelineTop, unscheduledDrag.timelineBottom)
    : null;
  const unscheduledInsertBeforeId = (unscheduledDrag && isOverTl)
    ? getInsertionBeforeId(unscheduledDrag.currentY, unscheduledDrag.anchors)
    : null;

  const effectiveInsertBeforeId = drag ? insertBeforeId : unscheduledInsertBeforeId;
  const showDropZone = !!drag || isOverTl;
  const dropZoneHeight = drag ? drag.cardHeight : 44;

  return {
    // 스토어 값(JSX에서 사용)
    now, pendingParentId, toggleComplete, setPendingParentId,
    // 편집
    editingId, editDraft, setEditDraft, editInputRef, beginEdit, commitEdit, cancelEdit,
    // 데이터
    scheduled, unscheduled, childrenByParent, segments,
    // 갭
    expandedGaps, toggleGap,
    // 드래그/스와이프 상태
    drag, unscheduledDrag, swipe, subDrag, proposedSubOrder, subDragParentTarget,
    // ref
    timelineRef, pillRef, ghostRef,
    // 핸들러
    handleDragStart, handleSwipeStart, handleSubDragStart, handleUnscheduledDragStart,
    // 파생값
    isOverTl, unscheduledProposedTime, effectiveInsertBeforeId, showDropZone, dropZoneHeight,
  };
}
