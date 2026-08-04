import { describe, it, expect } from 'vitest';
import {
  snapTo,
  getInsertionBeforeId,
  getInsertionBeforeIdByTime,
  eventColor,
  calcTimeFromY,
  calcDragTime,
  calcDragInsertBeforeId,
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

describe('calcDragTime / calcDragInsertBeforeId — 카드 상대 위치 기준', () => {
  // 카드 a(8:00, centerY 100), b(10:00, centerY 200)
  const anchors: CardAnchor[] = [
    { todoId: 'a', time: 480, centerY: 100 },
    { todoId: 'b', time: 600, centerY: 200 },
  ];
  const base = (over: Partial<DragState>): DragState => ({
    todoId: 'x', initialCardCenterY: 150, cardHeight: 44,
    currentY: 150, anchors, containerTop: 0, containerBottom: 2000, containerLeft: 0,
    ...over,
  });

  it('두 카드 사이 정중앙이면 그 사이 시간(=9:00)', () => {
    // a(480)~b(600) 사이 centerY 150 → 정중앙 → 540
    expect(calcDragTime(base({ currentY: 150 }))).toBe(540);
  });
  it('포인터 위치가 곧 삽입 위치 (a 위=a앞, 사이=b앞, b 아래=맨뒤)', () => {
    expect(calcDragInsertBeforeId(base({ currentY: 50 }))).toBe('a');  // a(100) 위
    expect(calcDragInsertBeforeId(base({ currentY: 150 }))).toBe('b'); // a~b 사이
    expect(calcDragInsertBeforeId(base({ currentY: 300 }))).toBeNull(); // b 아래 → 맨 뒤
  });
  it('같은 시간 두 카드 사이에 놓으면 그 시간 유지(=재정렬)', () => {
    const same: CardAnchor[] = [
      { todoId: 'a', time: 720, centerY: 100 },
      { todoId: 'b', time: 720, centerY: 200 },
    ];
    expect(calcDragTime(base({ currentY: 150, anchors: same }))).toBe(720);
    expect(calcDragInsertBeforeId(base({ currentY: 150, anchors: same }))).toBe('b');
  });

  it('now 라인도 앵커로 섞어 빨간 바 위치가 현재시각과 이어진다', () => {
    // a(8:00, centerY100) — now(9:00=540, centerY150) — b(11:00=660, centerY200)
    const ab: CardAnchor[] = [
      { todoId: 'a', time: 480, centerY: 100 },
      { todoId: 'b', time: 660, centerY: 200 },
    ];
    const nowAnchor: CardAnchor = { todoId: '__now__', time: 540, centerY: 150 };
    // now 없이 y=150 → a·b만 보간 → 9:30(570)
    expect(calcDragTime(base({ currentY: 150, anchors: ab }))).toBe(570);
    // now 앵커 섞으면 빨간 바 위치(150)에서 현재시각(9:00) 부근으로 당겨짐
    expect(calcDragTime(base({ currentY: 150, anchors: ab, nowAnchor }))).toBe(545);
    // 삽입 순서는 now 무시(실제 카드 a/b 기준) — 150은 b(200) 위 → b 앞
    expect(calcDragInsertBeforeId(base({ currentY: 150, anchors: ab, nowAnchor }))).toBe('b');
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
