import { describe, it, expect } from 'vitest';
import {
  snapTo,
  getInsertionBeforeId,
  getInsertionBeforeIdByTime,
  eventColor,
  calcProposedTime,
  calcTimeFromY,
  DRAG_PX_PER_STEP,
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

describe('calcProposedTime — 고정 감도(드래그 거리 비례)', () => {
  const base = (over: Partial<DragState>): DragState => ({
    todoId: 'x', originalTime: 480, startY: 100, initialCardCenterY: 100, cardHeight: 0,
    currentY: 100, anchors: [], containerTop: 0, containerBottom: 2000, containerLeft: 0,
    ...over,
  });

  it('움직임이 없으면 원래 시간 유지', () => {
    expect(calcProposedTime(base({ currentY: 100 }))).toBe(480);
  });
  it(`아래로 ${DRAG_PX_PER_STEP * 3}px 끌면 +15분`, () => {
    expect(calcProposedTime(base({ currentY: 100 + DRAG_PX_PER_STEP * 3 }))).toBe(495);
  });
  it('위로 22px 끌면 -10분(2칸 반올림)', () => {
    expect(calcProposedTime(base({ currentY: 78 }))).toBe(470);
  });
  it('카드 간격·앵커와 무관하게 동일 감도', () => {
    // 앵커가 있어도 결과는 드래그 거리에만 의존
    const anchors: CardAnchor[] = [
      { todoId: 'a', time: 480, centerY: 100 },
      { todoId: 'b', time: 1200, centerY: 130 },
    ];
    expect(calcProposedTime(base({ currentY: 120, anchors }))).toBe(490); // 20px → +10분
  });
  it('하루 범위(새벽 4시=240분)로 클램프', () => {
    expect(calcProposedTime(base({ originalTime: 260, currentY: 100 - DRAG_PX_PER_STEP * 20 }))).toBe(240);
  });
});

describe('getInsertionBeforeIdByTime — 제안 시간 기준 삽입 위치', () => {
  const anchors: CardAnchor[] = [
    { todoId: 'a', time: 480, centerY: 100 },
    { todoId: 'b', time: 600, centerY: 200 },
  ];
  it('두 카드 시간 사이면 뒤 카드 앞', () => {
    expect(getInsertionBeforeIdByTime(540, anchors)).toBe('b');
  });
  it('가장 이른 시간보다 앞서면 첫 카드 앞', () => {
    expect(getInsertionBeforeIdByTime(400, anchors)).toBe('a');
  });
  it('가장 늦은 시간보다 뒤면 null(맨 뒤)', () => {
    expect(getInsertionBeforeIdByTime(700, anchors)).toBeNull();
  });
});

describe('calcTimeFromY — 미지정 카드의 Y→시간', () => {
  it('앵커가 없고 맨 위면 하루 시작(새벽 4시=240분)', () => {
    expect(calcTimeFromY(0, [], 0, 100)).toBe(240);
  });
});
