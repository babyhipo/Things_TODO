import type { Todo, Template, DayKey } from '../../types/todo';

export interface PersistedState {
  days: Record<DayKey, Todo[]>;
  templates: Template[];
  lastRolloverDate: string;
}

export interface TodoRepository {
  load(): PersistedState | null;
  save(state: PersistedState): void;
  clear(): void;
}
