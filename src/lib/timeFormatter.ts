export function formatTime(minutes: number): string {
  const norm = minutes % 1440; // 가상 시간(1440~1679) → 실제 시간(0~239)으로 정규화
  const h = Math.floor(norm / 60);
  const m = norm % 60;
  return `${h}:${m.toString().padStart(2, '0')}`;
}
