import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { Todo, Template, DayKey } from '../types/todo';
import { parseTime } from '../lib/timeParser';
import { getLogicalDate } from '../lib/dayBoundary';
import { STORAGE_KEY } from '../lib/storage/localStorageRepo';

interface TodoState {
  days: Record<DayKey, Todo[]>;
  templates: Template[];
  activeDay: DayKey;
  lastRolloverDate: string;
  historyLength: number;

  setActiveDay: (day: DayKey) => void;
  undo: () => void;

  pendingParentId: string | null;
  setPendingParentId: (id: string | null) => void;

  addTodo: (day: DayKey, rawText: string, meridiemHint?: 'am' | 'pm', parentId?: string | null) => void;
  updateTodoText: (day: DayKey, id: string, rawText: string) => void;
  toggleComplete: (day: DayKey, id: string) => void;
  deleteTodo: (day: DayKey, id: string) => void;

  reorderTodos: (day: DayKey, newOrderIds: string[], movedId: string) => void;
  clearDay: (day: DayKey) => void;
  deduplicateDay: (day: DayKey) => void;

  indentTodo: (day: DayKey, id: string) => void;
  outdentTodo: (day: DayKey, id: string) => void;

  applyTemplate: (day: DayKey, templateId: string) => void;
  saveAsTemplate: (day: DayKey, name: string) => void;
  deleteTemplate: (templateId: string) => void;
  renameTemplate: (templateId: string, name: string) => void;
  updateTemplate: (templateId: string, name: string, items: Template['items']) => void;
  reorderTemplates: (newOrderIds: string[]) => void;
  createEmptyTemplate: () => string;
  setTodoTime: (day: DayKey, id: string, time: number | null) => void;
  setParentId: (day: DayKey, id: string, parentId: string | null) => void;
  reorderSubItems: (day: DayKey, parentId: string, newOrderIds: string[]) => void;

  performRolloverIfNeeded: () => void;
}

function newId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `id-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function densifyOrder(todos: Todo[]): Todo[] {
  return [...todos]
    .sort((a, b) => a.order - b.order)
    .map((t, i) => (t.order === i ? t : { ...t, order: i }));
}

function clampTime(t: number): number {
  if (t < 0) return 0;
  if (t > 1439) return 1439;
  return t;
}

function roundToFive(n: number): number {
  return Math.round(n / 5) * 5;
}

// 입력 순서대로 맨 끝에 append. 시간순 자동 정렬은 하지 않음.
function insertTodo(list: Todo[], newTodo: Todo): Todo[] {
  const sorted = [...list].sort((a, b) => a.order - b.order);
  return densifyOrder([...sorted, newTodo]);
}

// ── Undo 히스토리 (메모리 전용, 미지속) ──────────────────────────────────────
const _hist: Record<DayKey, Todo[]>[] = [];
const MAX_HIST = 50;

function pushHist(days: Record<DayKey, Todo[]>) {
  _hist.push({ today: [...days.today], tomorrow: [...days.tomorrow] });
  if (_hist.length > MAX_HIST) _hist.shift();
}

export const useTodoStore = create<TodoState>()(
  persist(
    (set, get) => ({
      days: { today: [], tomorrow: [] },
      templates: [],
      activeDay: 'today',
      lastRolloverDate: getLogicalDate(),
      pendingParentId: null,
      historyLength: 0,

      setActiveDay: (day) => set({ activeDay: day }),
      setPendingParentId: (id) => set({ pendingParentId: id }),

      undo: () => {
        const snap = _hist.pop();
        if (!snap) return;
        set({ days: snap, historyLength: _hist.length });
      },

      addTodo: (day, rawText, meridiemHint, parentId) => {
        const { time, endTime, cleanText } = parseTime(rawText);
        if (!cleanText && time === null) return;
        let adjustedTime = time;
        let adjustedEndTime = endTime ?? null;
        if (meridiemHint === 'pm' && adjustedTime !== null && adjustedTime < 720) {
          adjustedTime += 720;
          if (adjustedEndTime !== null && adjustedEndTime < 720) adjustedEndTime += 720;
        }
        const newTodo: Todo = {
          id: newId(),
          text: cleanText,
          time: adjustedTime,
          endTime: adjustedEndTime,
          completed: false,
          parentId: parentId ?? null,
          order: 0,
          createdAt: new Date().toISOString(),
        };
        pushHist(get().days);
        set((state) => ({
          days: { ...state.days, [day]: insertTodo(state.days[day], newTodo) },
          historyLength: _hist.length,
        }));
      },

      updateTodoText: (day, id, rawText) => {
        const { time, endTime, cleanText } = parseTime(rawText);
        pushHist(get().days);
        set((state) => ({
          days: {
            ...state.days,
            [day]: state.days[day].map((t) =>
              t.id === id ? { ...t, text: cleanText, time, endTime: endTime ?? null } : t,
            ),
          },
          historyLength: _hist.length,
        }));
      },

      toggleComplete: (day, id) => {
        pushHist(get().days);
        set((state) => ({
          days: {
            ...state.days,
            [day]: state.days[day].map((t) =>
              t.id === id ? { ...t, completed: !t.completed } : t,
            ),
          },
          historyLength: _hist.length,
        }));
      },

      deleteTodo: (day, id) => {
        pushHist(get().days);
        set((state) => {
          const remaining = state.days[day].filter((t) => t.id !== id && t.parentId !== id);
          return {
            days: { ...state.days, [day]: densifyOrder(remaining) },
            historyLength: _hist.length,
          };
        });
      },

      clearDay: (day) => {
        pushHist(get().days);
        set((state) => ({ days: { ...state.days, [day]: [] }, historyLength: _hist.length }));
      },

      deduplicateDay: (day) => {
        pushHist(get().days);
        set((state) => {
          const sorted = [...state.days[day]].sort((a, b) => a.order - b.order);
          const seen = new Set<string>();
          const deduped = sorted.filter((t) => {
            const key = `${t.time ?? 'null'}::${t.text}`;
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
          });
          return { days: { ...state.days, [day]: densifyOrder(deduped) }, historyLength: _hist.length };
        });
      },

      reorderTodos: (day, newOrderIds, movedId) => {
        pushHist(get().days);
        set((state) => {
          const list = state.days[day];
          const byId = new Map(list.map((t) => [t.id, t] as const));
          const reordered: Todo[] = [];
          newOrderIds.forEach((id, i) => {
            const t = byId.get(id);
            if (t) reordered.push({ ...t, order: i });
          });
          // newOrderIds에 빠진 항목이 있다면 뒤에 붙여준다(안전장치)
          list.forEach((t) => {
            if (!newOrderIds.includes(t.id)) {
              reordered.push({ ...t, order: reordered.length });
            }
          });

          const moved = reordered.find((t) => t.id === movedId);
          if (!moved) {
            return { days: { ...state.days, [day]: reordered }, historyLength: _hist.length };
          }

          // 같은 부모를 공유하는 형제만 대상으로 prev/next 탐색
          const siblings = reordered
            .filter((t) => t.parentId === moved.parentId)
            .sort((a, b) => a.order - b.order);
          const idx = siblings.findIndex((t) => t.id === movedId);

          let prevTime: number | null = null;
          for (let i = idx - 1; i >= 0; i -= 1) {
            if (siblings[i].time !== null) {
              prevTime = siblings[i].time;
              break;
            }
          }
          let nextTime: number | null = null;
          for (let i = idx + 1; i < siblings.length; i += 1) {
            if (siblings[i].time !== null) {
              nextTime = siblings[i].time;
              break;
            }
          }

          let newTime: number | null = moved.time;
          if (prevTime !== null && nextTime !== null) {
            const mid = roundToFive((prevTime + nextTime) / 2);
            newTime = mid === prevTime ? clampTime(prevTime + 5) : clampTime(mid);
          } else if (prevTime !== null) {
            newTime = clampTime(prevTime + 5);
          } else if (nextTime !== null) {
            newTime = clampTime(nextTime - 5);
          }

          const next = reordered.map((t) => (t.id === movedId ? { ...t, time: newTime } : t));
          return { days: { ...state.days, [day]: next }, historyLength: _hist.length };
        });
      },

      indentTodo: (day, id) => {
        pushHist(get().days);
        set((state) => {
          const list = [...state.days[day]].sort((a, b) => a.order - b.order);
          const target = list.find((t) => t.id === id);
          if (!target) return {};
          if (target.parentId !== null) return {};

          // 직전 형제(같은 parentId=null, 바로 위 order) 찾기
          const siblings = list.filter((t) => t.parentId === null);
          const idx = siblings.findIndex((t) => t.id === id);
          if (idx <= 0) return {};
          const prev = siblings[idx - 1];

          const next = list.map((t) => (t.id === id ? { ...t, parentId: prev.id } : t));
          return { days: { ...state.days, [day]: next }, historyLength: _hist.length };
        });
      },

      outdentTodo: (day, id) => {
        pushHist(get().days);
        set((state) => ({
          days: {
            ...state.days,
            [day]: state.days[day].map((t) => (t.id === id ? { ...t, parentId: null } : t)),
          },
          historyLength: _hist.length,
        }));
      },

      applyTemplate: (day, templateId) => {
        pushHist(get().days);
        set((state) => {
          const tpl = state.templates.find((t) => t.id === templateId);
          if (!tpl) return {};
          const existing = state.days[day];
          const base = existing.length;
          // tempId -> 새 uuid 매핑
          const idMap = new Map<string, string>();
          tpl.items.forEach((item) => {
            if (item.tempId) idMap.set(item.tempId, newId());
          });
          const now = new Date().toISOString();
          const added: Todo[] = tpl.items
            .slice()
            .sort((a, b) => a.order - b.order)
            .map((item, i) => ({
              id: item.tempId ? (idMap.get(item.tempId) as string) : newId(),
              text: item.text,
              time: item.time,
              completed: false,
              parentId: item.parentId ? (idMap.get(item.parentId) ?? null) : null,
              order: base + i,
              createdAt: now,
            }));
          return {
            days: { ...state.days, [day]: densifyOrder([...existing, ...added]) },
            historyLength: _hist.length,
          };
        });
      },

      saveAsTemplate: (day, name) => {
        set((state) => {
          const todos = [...state.days[day]].sort((a, b) => a.order - b.order);
          const idToTemp = new Map<string, string>();
          todos.forEach((t) => idToTemp.set(t.id, newId()));
          const items = todos.map((t) => ({
            text: t.text,
            time: t.time,
            parentId: t.parentId ? (idToTemp.get(t.parentId) ?? null) : null,
            tempId: idToTemp.get(t.id),
            order: t.order,
          }));
          const tpl: Template = {
            id: newId(),
            name,
            items,
          };
          return { templates: [...state.templates, tpl] };
        });
      },

      deleteTemplate: (templateId) => {
        set((state) => {
          const tpl = state.templates.find((t) => t.id === templateId);
          if (!tpl) return {};
          if (tpl.isBuiltIn) return {};
          return { templates: state.templates.filter((t) => t.id !== templateId) };
        });
      },

      renameTemplate: (templateId, name) => {
        set((state) => ({
          templates: state.templates.map((t) =>
            t.id === templateId ? { ...t, name } : t,
          ),
        }));
      },

      setTodoTime: (day, id, time) => {
        pushHist(get().days);
        set((state) => ({
          days: {
            ...state.days,
            [day]: state.days[day].map((t) => (t.id === id ? { ...t, time } : t)),
          },
          historyLength: _hist.length,
        }));
      },

      setParentId: (day, id, parentId) => {
        pushHist(get().days);
        set((state) => ({
          days: {
            ...state.days,
            [day]: state.days[day].map((t) => (t.id === id ? { ...t, parentId } : t)),
          },
          historyLength: _hist.length,
        }));
      },

      reorderSubItems: (day, parentId, newOrderIds) => {
        pushHist(get().days);
        set((state) => {
          const list = [...state.days[day]].sort((a, b) => a.order - b.order);
          const result: Todo[] = [];
          let inserted = false;
          for (const t of list) {
            if (t.parentId === parentId) continue; // 나중에 삽입
            result.push({ ...t, order: result.length });
            if (t.id === parentId && !inserted) {
              for (const id of newOrderIds) {
                const child = list.find((c) => c.id === id);
                if (child) result.push({ ...child, order: result.length });
              }
              inserted = true;
            }
          }
          return { days: { ...state.days, [day]: result }, historyLength: _hist.length };
        });
      },

      updateTemplate: (templateId, name, items) => {
        set((state) => ({
          templates: state.templates.map((t) =>
            t.id === templateId ? { ...t, name, items } : t,
          ),
        }));
      },

      reorderTemplates: (newOrderIds) => {
        set((state) => {
          const byId = new Map(state.templates.map((t) => [t.id, t]));
          const reordered = newOrderIds.flatMap((id) => byId.get(id) ?? []);
          const rest = state.templates.filter((t) => !newOrderIds.includes(t.id));
          return { templates: [...reordered, ...rest] };
        });
      },

      createEmptyTemplate: () => {
        const id = newId();
        set((state) => ({
          templates: [...state.templates, { id, name: '새 템플릿', items: [] }],
        }));
        return id;
      },

      performRolloverIfNeeded: () => {
        const current = getLogicalDate();
        if (current === get().lastRolloverDate) return;
        set((state) => {
          const shifted: Todo[] = state.days.tomorrow.map((t) => ({
            ...t,
            id: newId(),
            completed: false,
          }));
          // parentId도 새 id로 다시 매핑
          const oldToNew = new Map<string, string>();
          state.days.tomorrow.forEach((t, i) => oldToNew.set(t.id, shifted[i].id));
          const remapped = shifted.map((t) => ({
            ...t,
            parentId: t.parentId ? (oldToNew.get(t.parentId) ?? null) : null,
          }));
          return {
            days: { today: densifyOrder(remapped), tomorrow: [] },
            lastRolloverDate: current,
          };
        });
      },
    }),
    {
      name: STORAGE_KEY,
      version: 2,
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        days: state.days,
        templates: state.templates,
        lastRolloverDate: state.lastRolloverDate,
        activeDay: state.activeDay,
      }),
      migrate: (persisted: unknown, fromVersion) => {
        if (fromVersion < 2 && persisted && typeof persisted === 'object') {
          const p = persisted as { days?: Record<DayKey, Todo[]> };
          if (p.days) {
            (['today', 'tomorrow'] as DayKey[]).forEach((day) => {
              const list = p.days![day];
              if (Array.isArray(list)) {
                const sorted = [...list].sort((a, b) => (a.createdAt ?? '').localeCompare(b.createdAt ?? ''));
                sorted.forEach((t, i) => (t.order = i));
                p.days![day] = sorted;
              }
            });
          }
        }
        return persisted;
      },
    },
  ),
);
