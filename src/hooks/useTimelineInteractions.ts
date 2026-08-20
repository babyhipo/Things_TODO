// 믹스뷰의 상호작용 로직(편집·드래그·스와이프·하위항목 이동)을 한 곳으로 모은 훅.
// 뷰 컴포넌트는 레이아웃(JSX)만 담당하고, 상태·핸들러·파생값은 여기서 만든다.
// (예전엔 시간표뷰와 공유했으나 시간표뷰는 제거됨. 재사용 가능하도록 구조는 유지)
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
  getInsertionBeforeId,
  getInsertionBeforeIdByTime,
  calcDragTime,
  calcDragInsertBeforeId,
  type CardAnchor,
  type DragState,
  type SwipeState,
  type UnscheduledDragState,
  type SubDragState,
  type Segment,
} from '../lib/timelineMath';

// 햅틱 펄스(iOS)용 요소 조회 — 드래그 대상 루트카드/하위항목 DOM을 찾는다.
const cardEl = (id: string | null) =>
  id ? document.querySelector<HTMLElement>(`[data-todo-id="${id}"]`) : null;
const subEl = (id: string | null) =>
  id ? document.querySelector<HTMLElement>(`[data-sub-id="${id}"]`) : null;

export function useTimelineInteractions(day: DayKey) {
  const days               = useTodoStore((s) => s.days);
  const toggleComplete     = useTodoStore((s) => s.toggleComplete);
  const deleteTodo         = useTodoStore((s) => s.deleteTodo);
  const moveTodoToTomorrow = useTodoStore((s) => s.moveTodoToTomorrow);
  const updateTodoText     = useTodoStore((s) => s.updateTodoText);
  const assignTimeAt       = useTodoStore((s) => s.assignTimeAt);
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
  const lastInsertRef      = useRef<string | null>(null); // 재정렬 삽입 위치 변화 햅틱용
  const lastSubOrderRef    = useRef<string | null>(null);
  const pillRef            = useRef<HTMLDivElement>(null);
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
      // 시간 오름차순, 같은 시간이면 등록 순서(order) → 먼저 등록한 카드가 위
      scheduled:        roots.filter(t => t.time !== null).sort((a, b) => toVirt(a.time ?? 0) - toVirt(b.time ?? 0) || a.order - b.order),
      unscheduled:      roots.filter(t => t.time === null).sort((a, b) => a.order - b.order),
      childrenByParent: childMap,
    };
  }, [days, day]);

  // ── 드래그 중 표시용 순서 ──
  // 잡은 카드를 "놓일 위치"에 실제로 끼워넣은 순서를 만든다. (점선 미리보기 칸 대신
  // 진짜 카드가 그 자리에 배치되고, 나머지 카드는 자연 재배치로 밀려난다.)
  // 클론의 time을 목표 시간으로 덮어써서 섹션 구분선·갭 계산도 목표 시간 기준이 되게 한다.
  const displayScheduled = useMemo(() => {
    // 1) 시간지정 카드 드래그: 잡은 카드를 목표 위치로 재배치
    if (drag) {
      const dragged = scheduled.find(t => t.id === drag.todoId);
      if (!dragged) return scheduled;
      const proposed = calcDragTime(drag);           // 가상분
      const beforeId = calcDragInsertBeforeId(drag); // null이면 맨 뒤
      const rest  = scheduled.filter(t => t.id !== drag.todoId);
      const clone = { ...dragged, time: fromVirt(proposed) };
      const idx   = beforeId == null ? rest.length : rest.findIndex(t => t.id === beforeId);
      const out   = [...rest];
      out.splice(idx < 0 ? rest.length : idx, 0, clone);
      return out;
    }
    // 2) 미지정 카드를 타임라인 위로 드래그(카드 위가 아닐 때): 실제 카드를 목표 시간 슬롯에 삽입
    if (unscheduledDrag && subDragParentTarget === null) {
      const overTl = unscheduledDrag.currentY >= unscheduledDrag.timelineTop
                  && unscheduledDrag.currentY <= unscheduledDrag.timelineBottom;
      if (overTl) {
        const dragged = unscheduled.find(t => t.id === unscheduledDrag.todoId);
        if (dragged) {
          const t = calcTimeFromY(unscheduledDrag.currentY, unscheduledDrag.anchors, unscheduledDrag.timelineTop, unscheduledDrag.timelineBottom);
          const beforeId = getInsertionBeforeId(unscheduledDrag.currentY, unscheduledDrag.anchors);
          const clone = { ...dragged, time: fromVirt(t) };
          const idx = beforeId == null ? scheduled.length : scheduled.findIndex(s => s.id === beforeId);
          const out = [...scheduled];
          out.splice(idx < 0 ? scheduled.length : idx, 0, clone);
          return out;
        }
      }
    }
    return scheduled;
  }, [scheduled, drag, unscheduledDrag, subDragParentTarget, unscheduled]);

  // ── 세그먼트: 이벤트/갭/현재시각/섹션 구분선 ──
  const segments = useMemo<Segment[]>(() => {
    const result: Segment[] = [];
    let nowInserted = false;
    const sectionsInserted = new Set<string>();

    for (let i = 0; i < displayScheduled.length; i++) {
      const virtTime = toVirt(displayScheduled[i].time ?? 0);

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

      result.push({ type: 'event', todo: displayScheduled[i] });

      if (i < displayScheduled.length - 1) {
        const fromMin = virtTime;
        const toMin   = toVirt(displayScheduled[i + 1].time ?? 0);
        const gap     = toMin - fromMin;
        const isPast  = day === 'today' && fromMin < now;
        if (gap > 180 && !isPast)
          result.push({ type: 'gap', fromMin, toMin, key: `${fromMin}-${toMin}` });
      }
    }

    // 루프 후 미삽입 항목(구분선 + now 배지)을 시간순으로 정렬해 추가
    if (displayScheduled.length > 0) {
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
  }, [displayScheduled, day, now]);

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

    // 잡은 카드 자신의 원래 슬롯 → 잡는 순간 시간이 안 바뀌도록 하는 waypoint
    const selfCenterY = er ? er.top + er.height / 2 : e.clientY;
    const selfAnchor: CardAnchor = { todoId: todo.id, time: toVirt(todo.time!), centerY: selfCenterY };
    // 그립의 어느 지점을 눌러도 시작=카드 중심이 되도록 보정값 저장
    const grabOffset = e.clientY - selfCenterY;

    // 현재시각 빨간 바(now 라인)를 시간 보간 waypoint로 (오늘 탭에만 있음)
    let nowAnchor: CardAnchor | undefined;
    const nowEl = timelineRef.current.querySelector<HTMLElement>('[data-now-line]');
    if (nowEl) {
      const nr = nowEl.getBoundingClientRect();
      nowAnchor = { todoId: '__now__', time: now, centerY: nr.top + nr.height / 2 };
    }

    const ds: DragState = {
      todoId: todo.id,
      initialCardCenterY: selfCenterY,
      cardHeight: er ? er.height + 8 : 44, // +8 = margin-bottom
      currentY: selfCenterY, // 보정: 시작은 카드 중심 = 원래 시간
      anchors,
      containerTop:    cr.top,
      containerBottom: cr.bottom,
      containerLeft:   cr.left,
      grabOffset,
      selfAnchor,
      nowAnchor,
    };
    hapticGrab(el ?? undefined);
    lastSnapRef.current = toVirt(todo.time!);
    setDrag(ds);
    dragRef.current = ds;
  };

  // ── 스와이프 시작 ──
  const handleSwipeStart = (e: React.PointerEvent, todoId: string) => {
    // 카드/하위항목 어느 지점(텍스트·체크박스 포함)에서도 좌우 스와이프가 시작되게 한다.
    // 탭은 이동이 없어 삭제/이동이 발동하지 않고 클릭(편집·완료)만 실행됨.
    // 드래그 핸들은 자체 onPointerDown에서 stopPropagation 하므로 여기로 오지 않는다.
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
        const y = e.clientY - ds.grabOffset; // 누른 지점 보정
        const dsNow = { ...ds, currentY: y };
        const t = calcDragTime(dsNow);
        const before = calcDragInsertBeforeId(dsNow) ?? '(end)';
        if (lastSnapRef.current !== t || lastInsertRef.current !== before) {
          hapticTick(pillRef.current);
          lastSnapRef.current = t;
          lastInsertRef.current = before;
        }
      }
      setDrag(prev => prev ? { ...prev, currentY: e.clientY - prev.grabOffset } : null);
    };
    const onEnd = () => {
      const ds = dragRef.current;
      if (!ds) return;
      hapticDrop(pillRef.current);
      // 시간과 순서를 함께 확정 (재정렬 모드면 시간 고정, 아니면 가속 시간)
      assignTimeAt(day, ds.todoId, fromVirt(calcDragTime(ds)), calcDragInsertBeforeId(ds));
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
  }, [!!drag, day, assignTimeAt]);

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
        if (found) hapticReorder(cardEl(found));
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
        hapticDrop(cardEl(target));
        setParentId(day, ds.todoId, target);
      } else {
        const overTl = ds.currentY >= ds.timelineTop && ds.currentY <= ds.timelineBottom;
        if (overTl) {
          hapticDrop(pillRef.current);
          const t = calcTimeFromY(ds.currentY, ds.anchors, ds.timelineTop, ds.timelineBottom);
          // 같은 시간이 이미 있으면 그 무리의 맨 아래(=다음 시간 카드 앞)로
          const beforeId = getInsertionBeforeIdByTime(t, ds.anchors);
          assignTimeAt(day, ds.todoId, fromVirt(t), beforeId);
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
  }, [!!unscheduledDrag, day, assignTimeAt, setParentId]);

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
          hapticReorder(subEl(ds.todoId));
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
        hapticDrop(cardEl(target));
        setParentId(day, ds.todoId, target);
      } else {
        const order = proposedSubOrderRef.current;
        if (order && order.length > 1) {
          hapticDrop(subEl(ds.todoId));
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

  // ── 파생값 ──
  // 드래그 중 표시할 제안 시간(가상분) — 일정카드 시간 텍스트에 반영
  const dragProposedTime = drag ? calcDragTime(drag) : null;

  // 언스케줄 드래그가 카드 위에 있으면(하위일정 편입 대상) 시간 배정 UI는 숨긴다
  const unscheduledOverCard = !!unscheduledDrag && subDragParentTarget !== null;
  // 미지정 카드가 타임라인 영역 위에 있는지(= 실제 카드가 타임라인에 삽입돼 있는지)
  const isOverTl = !!unscheduledDrag
    && !unscheduledOverCard
    && unscheduledDrag.currentY >= unscheduledDrag.timelineTop
    && unscheduledDrag.currentY <= unscheduledDrag.timelineBottom;
  // 빈 타임라인 안내 문구용 제안 시간
  const unscheduledProposedTime = (unscheduledDrag && isOverTl)
    ? calcTimeFromY(unscheduledDrag.currentY, unscheduledDrag.anchors, unscheduledDrag.timelineTop, unscheduledDrag.timelineBottom)
    : null;

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
    timelineRef, pillRef,
    // 핸들러
    handleDragStart, handleSwipeStart, handleSubDragStart, handleUnscheduledDragStart,
    // 파생값
    isOverTl, unscheduledProposedTime,
    dragProposedTime,
  };
}
