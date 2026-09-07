import { useMemo, useState } from 'react';
import { hapticGrab, hapticDrop } from '../lib/haptics';
import {
  DndContext,
  DragOverlay,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  closestCenter,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import styles from './TodoList.module.css';
import { useTodoStore, computeReorderedTime } from '../store/useTodoStore';
import { TodoItem } from './TodoItem';
import { toVirt } from '../lib/dayBoundary';
import { useNowTick } from '../hooks/useNowTick';
import { formatTime } from '../lib/timeFormatter';

// 아이템 아래 간격: 부모→자식, 자식 형제끼리는 좁게
function getGapAfter(
  todos: import('../types/todo').Todo[],
  index: number,
): number {
  const current = todos[index];
  const next = todos[index + 1];
  if (!next) return 0;
  if (!current.parentId && next.parentId === current.id) return 0;
  if (current.parentId && next.parentId === current.parentId) return 0;
  return 6;
}

export function TodoList() {
  const activeDay = useTodoStore((s) => s.activeDay);
  const days = useTodoStore((s) => s.days);
  const reorderTodos = useTodoStore((s) => s.reorderTodos);

  const now = useNowTick();

  const todos = useMemo(() => {
    const all = days[activeDay];
    const cmp = (a: typeof all[number], b: typeof all[number]) => {
      if (a.time == null && b.time == null) return a.order - b.order;
      if (a.time == null) return 1;
      if (b.time == null) return -1;
      if (a.time !== b.time) return toVirt(a.time) - toVirt(b.time);
      return a.order - b.order;
    };
    const roots = all.filter((t) => !t.parentId);
    const childrenByParent = new Map<string, typeof all>();
    all
      .filter((t) => t.parentId)
      .forEach((c) => {
        const list = childrenByParent.get(c.parentId as string) ?? [];
        list.push(c);
        childrenByParent.set(c.parentId as string, list);
      });
    roots.sort(cmp);
    const result: typeof all = [];
    for (const r of roots) {
      result.push(r);
      // 하위 항목은 손으로 끌어둔 순서(order) 기준 — 세 뷰 통일
      const kids = (childrenByParent.get(r.id) ?? [])
        .slice()
        .sort((a, b) => a.order - b.order);
      result.push(...kids);
    }
    return result;
  }, [days, activeDay]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const ids = useMemo(() => todos.map((t) => t.id), [todos]);

  const [activeId, setActiveId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);

  const handleDragStart = (event: DragStartEvent) => {
    hapticGrab();
    setActiveId(String(event.active.id));
    setOverId(String(event.active.id));
  };

  const handleDragOver = (event: DragOverEvent) => {
    setOverId(event.over ? String(event.over.id) : null);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && String(active.id) !== String(over.id)) {
      const oldIndex = ids.indexOf(String(active.id));
      const newIndex = ids.indexOf(String(over.id));
      if (oldIndex !== -1 && newIndex !== -1) {
        hapticDrop();
        const newIds = arrayMove(ids, oldIndex, newIndex);
        reorderTodos(activeDay, newIds, String(active.id));
      }
    }
    setActiveId(null);
    setOverId(null);
  };

  const handleDragCancel = () => { setActiveId(null); setOverId(null); };

  const activeTodo = activeId ? todos.find((t) => t.id === activeId) : null;

  // 드래그로 순서를 바꿀 때 배정될 시간(미리보기) — 실제 드롭 결과와 동일한 계산
  const previewTime = useMemo(() => {
    if (!activeId || !overId || activeId === overId) return null;
    const oldIndex = ids.indexOf(activeId);
    const newIndex = ids.indexOf(overId);
    if (oldIndex === -1 || newIndex === -1) return null;
    const newIds = arrayMove(ids, oldIndex, newIndex);
    const byId = new Map(todos.map((t) => [t.id, t] as const));
    const reordered = newIds.map((id, i) => ({ ...byId.get(id)!, order: i }));
    return computeReorderedTime(reordered, activeId);
  }, [activeId, overId, ids, todos]);

  if (todos.length === 0) {
    return (
      <div
        className={styles.empty}
        id={`daypanel-${activeDay}`}
        role="tabpanel"
        aria-labelledby={`daytab-${activeDay}`}
      >
        <p className={styles.emptyText}>할 일을 적어보세요</p>
      </div>
    );
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
    >
      <SortableContext items={ids} strategy={verticalListSortingStrategy}>
        <ul
          className={styles.list}
          id={`daypanel-${activeDay}`}
          role="tabpanel"
          aria-labelledby={`daytab-${activeDay}`}
        >
          {todos.map((todo, index) => (
            <TodoItem
              key={todo.id}
              todo={todo}
              day={activeDay}
              now={now}
              gapAfter={getGapAfter(todos, index)}
            />
          ))}
        </ul>
      </SortableContext>

      <DragOverlay>
        {activeTodo ? (
          <div className={styles.dragGhost}>
            {previewTime !== null && (
              <span className={styles.dragGhostTime}>{formatTime(previewTime)}</span>
            )}
            <span className={styles.dragGhostText}>{activeTodo.text || '(내용 없음)'}</span>
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
