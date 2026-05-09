export const ROLLOVER_HOUR = 4;

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
