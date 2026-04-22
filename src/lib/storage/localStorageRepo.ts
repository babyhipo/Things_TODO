import type { PersistedState, TodoRepository } from './repository';

export const STORAGE_KEY = 'oneul-todo/v1';

export class LocalStorageTodoRepository implements TodoRepository {
  private key: string;

  constructor(key: string = STORAGE_KEY) {
    this.key = key;
  }

  load(): PersistedState | null {
    try {
      const raw = localStorage.getItem(this.key);
      if (!raw) return null;
      return JSON.parse(raw) as PersistedState;
    } catch {
      return null;
    }
  }

  save(state: PersistedState): void {
    try {
      localStorage.setItem(this.key, JSON.stringify(state));
    } catch {
      // 저장 실패 무시(용량 초과 등)
    }
  }

  clear(): void {
    try {
      localStorage.removeItem(this.key);
    } catch {
      // 무시
    }
  }
}
