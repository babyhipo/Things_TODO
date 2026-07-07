import { describe, it, expect } from 'vitest';
import { parseTime } from './timeParser';

// time/endTime은 "자정 이후 분(minute)" 단위입니다. 예: 오전 8시 = 8*60 = 480
// 이 테스트는 "사용자가 툭툭 적은 문장"에서 시간을 정확히 읽고,
// 시간 부분을 뺀 나머지 글자(cleanText)를 깔끔히 남기는지 검증합니다.

describe('parseTime — 단일 시간 읽기', () => {
  it('"8시 기상" → 오전 8시(480분), 나머지 글자는 "기상"', () => {
    expect(parseTime('8시 기상')).toEqual({ time: 480, endTime: null, cleanText: '기상' });
  });

  it('"14:30 회의" → 14시 30분(870분)', () => {
    expect(parseTime('14:30 회의')).toEqual({ time: 870, endTime: null, cleanText: '회의' });
  });

  it('"3시반" → 3시 30분(210분), "반"을 30분으로 인식', () => {
    expect(parseTime('3시반')).toEqual({ time: 210, endTime: null, cleanText: '' });
  });

  it('"오전 9시15분" → 9시 15분(555분)', () => {
    expect(parseTime('오전 9시15분')).toEqual({ time: 555, endTime: null, cleanText: '' });
  });

  it('시간 앞뒤의 글자를 모두 보존한다 ("내일 3시 미팅")', () => {
    expect(parseTime('내일 3시 미팅')).toEqual({ time: 180, endTime: null, cleanText: '내일 미팅' });
  });
});

describe('parseTime — 오전/오후(12시 경계 포함)', () => {
  it('"오후 2시" → 14시(840분)', () => {
    expect(parseTime('오후 2시')).toEqual({ time: 840, endTime: null, cleanText: '' });
  });

  it('"오전 12시" → 자정 0시(0분)', () => {
    expect(parseTime('오전 12시')).toEqual({ time: 0, endTime: null, cleanText: '' });
  });

  it('"오후 12시" → 정오 12시(720분)', () => {
    expect(parseTime('오후 12시')).toEqual({ time: 720, endTime: null, cleanText: '' });
  });
});

describe('parseTime — 시간 구간(시작~끝)', () => {
  it('"2시-4시 카공" → 시작 120분, 끝 240분', () => {
    expect(parseTime('2시-4시 카공')).toEqual({ time: 120, endTime: 240, cleanText: '카공' });
  });

  it('"14:00-16:00" → 840분~960분', () => {
    expect(parseTime('14:00-16:00')).toEqual({ time: 840, endTime: 960, cleanText: '' });
  });

  it('물결(~) 구분자도 인식한다 ("9시~10시")', () => {
    expect(parseTime('9시~10시')).toEqual({ time: 540, endTime: 600, cleanText: '' });
  });

  it('구간에 붙은 오전/오후는 시작·끝 모두에 적용된다 ("오후 2시30분-3시30분")', () => {
    expect(parseTime('오후 2시30분-3시30분')).toEqual({ time: 870, endTime: 930, cleanText: '' });
  });

  it('"2시반-3시반" → 150분~210분', () => {
    expect(parseTime('2시반-3시반')).toEqual({ time: 150, endTime: 210, cleanText: '' });
  });
});

describe('parseTime — 시간 없음/예외 상황', () => {
  it('시간이 없으면 time은 null, 글자는 그대로 ("저녁 약속")', () => {
    expect(parseTime('저녁 약속')).toEqual({ time: null, endTime: null, cleanText: '저녁 약속' });
  });

  it('빈 문자열은 모두 비어있게 처리한다', () => {
    expect(parseTime('')).toEqual({ time: null, endTime: null, cleanText: '' });
  });

  it('말이 안 되는 시각(25시)은 시간으로 인식하지 않는다', () => {
    expect(parseTime('25시')).toEqual({ time: null, endTime: null, cleanText: '25시' });
  });
});
