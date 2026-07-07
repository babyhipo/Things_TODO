import { describe, it, expect } from 'vitest';
import {
  toVirt,
  DAY_START_MIN,
  getLogicalDate,
  getNextRolloverTime,
  msUntilNextRollover,
} from './dayBoundary';

// 이 앱의 "하루"는 자정이 아니라 새벽 4시에 시작합니다(ROLLOVER_HOUR=4).
// 새벽 4시 이전(0~3시대)은 아직 '어제'로 취급되고, 정렬에서도 하루의 맨 끝에 놓입니다.

describe('toVirt — 새벽 시간을 하루 끝으로 보내는 정렬 변환', () => {
  it('기준값은 새벽 4시 = 240분', () => {
    expect(DAY_START_MIN).toBe(240);
  });

  it('오전 8시(480분)는 그대로 480', () => {
    expect(toVirt(480)).toBe(480);
  });

  it('정확히 새벽 4시(240분)는 하루의 시작이라 그대로 240', () => {
    expect(toVirt(240)).toBe(240);
  });

  it('새벽 4시 직전(239분)은 다음날로 밀려 239+1440=1679', () => {
    expect(toVirt(239)).toBe(1679);
  });

  it('자정 0시는 1440으로 밀린다', () => {
    expect(toVirt(0)).toBe(1440);
  });

  it('밤 11시(1380)가 새벽 1시(60)보다 앞서 정렬된다', () => {
    expect(toVirt(1380)).toBeLessThan(toVirt(60));
  });
});

describe('getLogicalDate — 지금이 논리적으로 며칠인지 (새벽 4시 경계)', () => {
  it('낮 시간(10시)은 오늘 날짜를 그대로 반환', () => {
    expect(getLogicalDate(new Date(2026, 6, 7, 10, 0, 0))).toBe('2026-07-07');
  });

  it('새벽 2시는 아직 "어제"로 취급 → 하루 전 날짜', () => {
    expect(getLogicalDate(new Date(2026, 6, 7, 2, 0, 0))).toBe('2026-07-06');
  });

  it('정확히 새벽 4시부터는 새 날로 넘어간다', () => {
    expect(getLogicalDate(new Date(2026, 6, 7, 4, 0, 0))).toBe('2026-07-07');
  });

  it('새벽 3시59분은 여전히 어제', () => {
    expect(getLogicalDate(new Date(2026, 6, 7, 3, 59, 0))).toBe('2026-07-06');
  });

  it('월/연 경계도 올바르게 넘어간다 (1월 1일 새벽 2시 → 작년 12월 31일)', () => {
    expect(getLogicalDate(new Date(2026, 0, 1, 2, 0, 0))).toBe('2025-12-31');
  });
});

describe('getNextRolloverTime — 다음 자동 넘김(새벽 4시) 시각', () => {
  it('낮이면 다음 넘김은 내일 새벽 4시', () => {
    const next = getNextRolloverTime(new Date(2026, 6, 7, 10, 0, 0));
    expect(next).toEqual(new Date(2026, 6, 8, 4, 0, 0));
  });

  it('새벽 2시면 다음 넘김은 오늘 새벽 4시', () => {
    const next = getNextRolloverTime(new Date(2026, 6, 7, 2, 0, 0));
    expect(next).toEqual(new Date(2026, 6, 7, 4, 0, 0));
  });

  it('정확히 새벽 4시면 다음 넘김은 내일 새벽 4시(이미 지난 것으로 처리)', () => {
    const next = getNextRolloverTime(new Date(2026, 6, 7, 4, 0, 0));
    expect(next).toEqual(new Date(2026, 6, 8, 4, 0, 0));
  });
});

describe('msUntilNextRollover — 다음 넘김까지 남은 밀리초', () => {
  it('새벽 3시면 넘김까지 정확히 1시간', () => {
    const ms = msUntilNextRollover(new Date(2026, 6, 7, 3, 0, 0));
    expect(ms).toBe(60 * 60 * 1000);
  });
});
