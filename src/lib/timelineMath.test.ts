import { describe, it, expect } from 'vitest';
import {
  snapTo,
  getInsertionBeforeId,
  eventColor,
  calcProposedTime,
  calcTimeFromY,
  type CardAnchor,
  type DragState,
} from './timelineMath';

describe('snapTo — 5분 단위 반올림', () => {
  it('480은 그대로', () => expect(snapTo(480)).toBe(480));
  it('487 → 485 (가까운 5분)', () => expect(snapTo(487)).toBe(485));
  it('488 → 490', () => expect(snapTo(488)).toBe(490));
});

describe('getInsertionBeforeId — 삽입 위치 판단', () => {
  const anchors: CardAnchor[] = [
    { todoId: 'a', time: 480, centerY: 100 },
    { todoId: 'b', time: 540, centerY: 200 },
  ];
  it('맨 위로 올리면 첫 카드 앞', () => {
    expect(getInsertionBeforeId(50, anchors)).toBe('a');
  });
  it('두 카드 사이면 아래 카드 앞', () => {
    expect(getInsertionBeforeId(150, anchors)).toBe('b');
  });
  it('맨 아래로 내리면 null(맨 뒤)', () => {
    expect(getInsertionBeforeId(250, anchors)).toBeNull();
  });
});

describe('eventColor — 상태별 색상', () => {
  it('완료는 회색', () => {
    expect(eventColor(480, false, true, 500, 'today')).toBe('#9CA3AF');
  });
  it('시간이 지났으면 빨강', () => {
    expect(eventColor(480, true, false, 500, 'today')).toBe('#EF4444');
  });
  it('시간 미지정은 보라', () => {
    expect(eventColor(null, false, false, 500, 'today')).toBe('#7C3AED');
  });
  it('1시간 이내는 주황', () => {
    expect(eventColor(500, false, false, 480, 'today')).toBe('#F59E0B');
  });
  it('1시간보다 멀면 파랑', () => {
    expect(eventColor(600, false, false, 480, 'today')).toBe('#3B5BDB');
  });
  it("내일 탭은 하루(1440분)를 더해 '먼 미래'로 계산 → 파랑", () => {
    expect(eventColor(480, false, false, 480, 'tomorrow')).toBe('#3B5BDB');
  });
});

describe('calcProposedTime — 두 카드 사이 시간 보간', () => {
  it('중간에 놓으면 두 시간의 중간값', () => {
    const anchors: CardAnchor[] = [
      { todoId: 'a', time: 480, centerY: 100 },
      { todoId: 'b', time: 600, centerY: 300 },
    ];
    const ds: DragState = {
      todoId: 'x',
      originalTime: 999,
      initialCardCenterY: 0,
      cardHeight: 0,
      currentY: 200, // 정확히 가운데
      anchors,
      containerTop: 0,
      containerBottom: 400,
      containerLeft: 0,
    };
    expect(calcProposedTime(ds)).toBe(540); // (480~600 사이, 가운데)
  });

  it('앵커가 없으면 원래 시간을 유지', () => {
    const ds: DragState = {
      todoId: 'x', originalTime: 720, initialCardCenterY: 0, cardHeight: 0,
      currentY: 100, anchors: [], containerTop: 0, containerBottom: 400, containerLeft: 0,
    };
    expect(calcProposedTime(ds)).toBe(720);
  });
});

describe('calcTimeFromY — 미지정 카드의 Y→시간', () => {
  it('앵커가 없고 맨 위면 하루 시작(새벽 4시=240분)', () => {
    expect(calcTimeFromY(0, [], 0, 100)).toBe(240);
  });
});
