import { describe, it, expect } from 'vitest';
import { formatTime } from './timeFormatter';

// formatTime: 분(minute) → "H:MM" 표시 문자열.
// 가상 시간(1440~1679, 새벽으로 밀린 값)도 실제 시각으로 정규화해서 보여준다.

describe('formatTime — 분을 시각 문자열로', () => {
  it('480분 → "8:00"', () => {
    expect(formatTime(480)).toBe('8:00');
  });

  it('0분(자정) → "0:00"', () => {
    expect(formatTime(0)).toBe('0:00');
  });

  it('870분 → "14:30"', () => {
    expect(formatTime(870)).toBe('14:30');
  });

  it('정오 720분 → "12:00"', () => {
    expect(formatTime(720)).toBe('12:00');
  });

  it('분은 항상 두 자리로 채운다 (65분 → "1:05")', () => {
    expect(formatTime(65)).toBe('1:05');
  });

  it('하루 끝 1439분 → "23:59"', () => {
    expect(formatTime(1439)).toBe('23:59');
  });

  it('가상 자정 1440 → "0:00"으로 정규화', () => {
    expect(formatTime(1440)).toBe('0:00');
  });

  it('가상 새벽 1시 1500 → "1:00"으로 정규화', () => {
    expect(formatTime(1500)).toBe('1:00');
  });
});
