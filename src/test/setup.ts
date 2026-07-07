// 테스트 환경 준비: 브라우저의 localStorage를 흉내 낸 '메모리 저장소'를 심는다.
// 스토어가 zustand persist로 저장/불러오기를 할 때 실제 브라우저 없이도 동작하게 한다.
class MemoryStorage {
  private m = new Map<string, string>();
  getItem(key: string): string | null {
    return this.m.has(key) ? this.m.get(key)! : null;
  }
  setItem(key: string, value: string): void {
    this.m.set(key, String(value));
  }
  removeItem(key: string): void {
    this.m.delete(key);
  }
  clear(): void {
    this.m.clear();
  }
  key(index: number): string | null {
    return Array.from(this.m.keys())[index] ?? null;
  }
  get length(): number {
    return this.m.size;
  }
}

globalThis.localStorage = new MemoryStorage() as unknown as Storage;
