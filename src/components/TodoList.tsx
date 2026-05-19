import { useEffect, useMemo, useState } from 'react';
import {
  DndContext,
  DragOverlay,
  type DragEndEvent,
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
import { useTodoStore } from '../store/useTodoStore';
import { TodoItem } from './TodoItem';

const DAY_START_MIN = 4 * 60; // 타임라인과 동일: 새벽 4시 기준

function toVirt(t: number): number {
  return t < DAY_START_MIN ? t + 1440 : t;
}

function getCurrentMinutes(): number {
  const d = new Date();
  return d.getHours() * 60 + d.getMinutes();
}

function useNowTickLocal(): number {
  const [now, setNow] = useState(() => getCurrentMinutes());
  useEffect(() => {
    const timer = setInterval(() => setNow(getCurrentMinutes()), 60_000);
    return () => clearInterval(timer);
  }, []);
  return now;
}

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

  const now = useNowTickLocal();

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
      const kids = (childrenByParent.get(r.id) ?? []).slice().sort(cmp);
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

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(String(event.active.id));
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && String(active.id) !== String(over.id)) {
      const oldIndex = ids.indexOf(String(active.id));
      const newIndex = ids.indexOf(String(over.id));
      if (oldIndex !== -1 && newIndex !== -1) {
        const newIds = arrayMove(ids, oldIndex, newIndex);
        reorderTodos(activeDay, newIds, String(active.id));
      }
    }
    setActiveId(null);
  };

  const handleDragCancel = () => setActiveId(null);

  const activeTodo = activeId ? todos.find((t) => t.id === activeId) : null;

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
            <span className={styles.dragGhostText}>{activeTodo.text || '(내용 없음)'}</span>
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
