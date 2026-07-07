export const ROLLOVER_HOUR = 4;

// 정렬 기준: 새벽 4시(240분) 이전 시각은 "다음날 새벽"으로 취급해 하루 끝에 배치한다.
// ROLLOVER_HOUR(자정 넘김 시각)와 묶어 '새벽 4시'라는 값을 한 곳에서만 관리한다.
export const DAY_START_MIN = ROLLOVER_HOUR * 60;

/**
 * 자정 이후 분(minute)을, '새벽 4시를 하루 시작'으로 보는 가상 시간으로 변환한다.
 * 예) 23:00(1380) → 1380, 01:00(60) → 1500 → 밤 11시가 새벽 1시보다 앞서 정렬된다.
 */
export function toVirt(t: number): number {
  return t < DAY_START_MIN ? t + 1440 : t;
}

function pad2(n: number): string {
  return n.toString().padStart(2, '0');
}

function toYMD(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

export function getLogicalDate(now: Date = new Date()): string {
  const base = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (now.getHours() < ROLLOVER_HOUR) {
    base.setDate(base.getDate() - 1);
  }
  return toYMD(base);
}

export function getNextRolloverTime(now: Date = new Date()): Date {
  const next = new Date(now.getFullYear(), now.getMonth(), now.getDate(), ROLLOVER_HOUR, 0, 0, 0);
  if (next.getTime() <= now.getTime()) {
    next.setDate(next.getDate() + 1);
  }
  return next;
}

export function msUntilNextRollover(now: Date = new Date()): number {
  return getNextRolloverTime(now).getTime() - now.getTime();
}
