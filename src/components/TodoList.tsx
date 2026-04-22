import { useEffect, useMemo, useState } from 'react';
import {
  DndContext,
  type DragEndEvent,
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

function getCurrentMinutes(): number {
  const d = new Date();
  return d.getHours() * 60 + d.getMinutes();
}

// Phase 2-C의 useNowTick 훅과 파일 충돌을 피하기 위해 로컬 구현 사용
function useNowTickLocal(): number {
  const [now, setNow] = useState(() => getCurrentMinutes());
  useEffect(() => {
    const timer = setInterval(() => setNow(getCurrentMinutes()), 60_000);
    return () => clearInterval(timer);
  }, []);
  return now;
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
      if (a.time !== b.time) return a.time - b.time;
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
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const ids = useMemo(() => todos.map((t) => t.id), [todos]);

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = ids.indexOf(String(active.id));
    const newIndex = ids.indexOf(String(over.id));
    if (oldIndex === -1 || newIndex === -1) return;
    const newIds = arrayMove(ids, oldIndex, newIndex);
    reorderTodos(activeDay, newIds, String(active.id));
  };

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
      onDragEnd={handleDragEnd}
    >
      <SortableContext items={ids} strategy={verticalListSortingStrategy}>
        <ul
          className={styles.list}
          id={`daypanel-${activeDay}`}
          role="tabpanel"
          aria-labelledby={`daytab-${activeDay}`}
        >
          {todos.map((todo) => (
            <TodoItem key={todo.id} todo={todo} day={activeDay} now={now} />
          ))}
        </ul>
      </SortableContext>
    </DndContext>
  );
}
