import { describe, it, expect } from 'vitest';
import {
  snapTo,
  getInsertionBeforeId,
  getInsertionBeforeIdByTime,
  eventColor,
  calcTimeFromY,
  calcDragTime,
  calcDragInsertBeforeId,
  isDragOverUnscheduled,
  isDemoteGesture,
  getSwipeVisual,
  SWIPE_MAX_PX,
  SWIPE_TRIGGER_PX,
  DRAG_DEMOTE_DX,
  SECTION_MARKS,
  calcEmptyHourSlots,
  buildSegments,
  calcUnscheduledDropTime,
  type CardAnchor,
  type DragState,
  type SwipeState,
  type Segment,
  type UnscheduledDragState,
} from './timelineMath';
import type { Todo } from '../types/todo';

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
    todoId: 'x', initialCardCenterY: 150, cardHeight: 44, grabOffset: 0,
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

  it('잡은 카드 자신 슬롯(self)이 앵커면 그 위치에서 원래 시간 그대로 (잡는 순간 안 바뀜)', () => {
    // a(8:00,100) — self(10:00=600, centerY150) — b(14:00=840, centerY200)
    const ab: CardAnchor[] = [
      { todoId: 'a', time: 480, centerY: 100 },
      { todoId: 'b', time: 840, centerY: 200 },
    ];
    const selfAnchor: CardAnchor = { todoId: 'x', time: 600, centerY: 150 };
    // self 없으면 y=150(카드 원래 위치)이 a·b 보간으로 11:00(660)으로 튐 → 이게 버그
    expect(calcDragTime(base({ currentY: 150, anchors: ab }))).toBe(660);
    // self 앵커 있으면 원래 위치(150)에서 정확히 원래 시간(10:00=600)
    expect(calcDragTime(base({ currentY: 150, anchors: ab, selfAnchor }))).toBe(600);
  });

  it('같은 시간 스냅 존: 카드 중심 근처면 그 시간 고정 + 중심 위=앞/아래=뒤로 순서만 갈림', () => {
    // am(8:00,100) — y(9:00=540, centerY200) — pm(10:00,300)
    const grp: CardAnchor[] = [
      { todoId: 'am', time: 480, centerY: 100 },
      { todoId: 'y',  time: 540, centerY: 200 },
      { todoId: 'pm', time: 600, centerY: 300 },
    ];
    // 중심보다 살짝 위(197): 시간 9:00 고정 + y 앞(첫번째)
    expect(calcDragTime(base({ currentY: 197, anchors: grp }))).toBe(540);
    expect(calcDragInsertBeforeId(base({ currentY: 197, anchors: grp }))).toBe('y');
    // 중심보다 살짝 아래(203): 시간 9:00 고정 + y 다음(pm 앞 = 두번째)
    expect(calcDragTime(base({ currentY: 203, anchors: grp }))).toBe(540);
    expect(calcDragInsertBeforeId(base({ currentY: 203, anchors: grp }))).toBe('pm');
    // 존을 벗어나면(13px 아래) 시간이 바뀌기 시작
    expect(calcDragTime(base({ currentY: 213, anchors: grp }))).not.toBe(540);
  });

  it('now 라인도 앵커로 섞어 빨간 바 위치가 현재시각과 정확히 이어진다', () => {
    // a(8:00, centerY100) — now(9:00=540, centerY150) — b(11:00=660, centerY200)
    const ab: CardAnchor[] = [
      { todoId: 'a', time: 480, centerY: 100 },
      { todoId: 'b', time: 660, centerY: 200 },
    ];
    const nowAnchor: CardAnchor = { todoId: '__now__', time: 540, centerY: 150 };
    // now 없이 y=150 → a·b만 보간 → 9:30(570)
    expect(calcDragTime(base({ currentY: 150, anchors: ab }))).toBe(570);
    // now 앵커 섞으면 빨간 바 위치(150)에서 정확히 현재시각(9:00=540)
    expect(calcDragTime(base({ currentY: 150, anchors: ab, nowAnchor }))).toBe(540);
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

describe('isDragOverUnscheduled — 타임라인 아래 = 시간 해제 구역', () => {
  const base: DragState = {
    todoId: 'a',
    initialCardCenterY: 100,
    cardHeight: 40,
    currentY: 100,
    anchors: [],
    containerTop: 50,
    containerBottom: 300,
    containerLeft: 0,
    grabOffset: 0,
  };

  it('타임라인 안쪽이면 false', () => {
    expect(isDragOverUnscheduled({ ...base, currentY: 299 })).toBe(false);
  });

  it('타임라인 아래로 내려가면 true', () => {
    expect(isDragOverUnscheduled({ ...base, currentY: 301 })).toBe(true);
  });
});

describe('SECTION_MARKS — 구분선', () => {
  it("'자정'(가상 1440분) 구분선이 저녁 뒤에 있다", () => {
    expect(SECTION_MARKS.map((m) => m.label)).toEqual(['오후', '저녁', '자정']);
    expect(SECTION_MARKS[2].virtMin).toBe(1440);
  });
});

describe('calcDragTime — 구분선 앵커(감도 완화)', () => {
  it('저녁~자정 구분선 사이에서는 그 사이 시간으로 보간된다', () => {
    const ds: DragState = {
      todoId: 'a',
      initialCardCenterY: 100,
      cardHeight: 40,
      currentY: 300, // 저녁(200) 과 자정(400) 의 정확히 중간
      anchors: [],
      containerTop: 0,
      containerBottom: 500,
      containerLeft: 0,
      grabOffset: 0,
      sectionAnchors: [
        { todoId: '__section-1080__', time: 1080, centerY: 200 }, // 저녁 18:00
        { todoId: '__section-1440__', time: 1440, centerY: 400 }, // 자정 24:00
      ],
    };
    const t = calcDragTime(ds);
    expect(t).toBeGreaterThan(1080);
    expect(t).toBeLessThan(1440);
    expect(Math.abs(t - 1260)).toBeLessThanOrEqual(30); // 대략 21시 부근
  });
});

describe('isDemoteGesture — 하위 편입 제스처(좌우 양방향)', () => {
  const base: DragState = {
    todoId: 'a',
    initialCardCenterY: 100,
    cardHeight: 40,
    currentY: 100,
    anchors: [],
    containerTop: 0,
    containerBottom: 300,
    containerLeft: 0,
    grabOffset: 0,
    startX: 200,
    currentX: 200,
  };

  it('조금만 흔들린 정도로는 발동하지 않는다', () => {
    expect(isDemoteGesture({ ...base, currentX: 200 + DRAG_DEMOTE_DX - 1 })).toBe(false);
    expect(isDemoteGesture({ ...base, currentX: 200 - DRAG_DEMOTE_DX + 1 })).toBe(false);
  });

  it('오른쪽으로 밀면 발동한다', () => {
    expect(isDemoteGesture({ ...base, currentX: 200 + DRAG_DEMOTE_DX })).toBe(true);
  });

  it('왼쪽으로 밀어도 발동한다(모바일: 손잡이가 오른쪽 끝이라 오른쪽 여유가 없음)', () => {
    expect(isDemoteGesture({ ...base, currentX: 200 - DRAG_DEMOTE_DX })).toBe(true);
  });

  it('가로 좌표가 없으면(구형 상태) 발동하지 않는다', () => {
    expect(isDemoteGesture({ ...base, startX: undefined, currentX: undefined })).toBe(false);
  });
});

describe('getSwipeVisual — 좌우 스와이프 표시값', () => {
  const swipe = (over: Partial<SwipeState> = {}): SwipeState => ({
    todoId: 'a', startX: 100, currentX: 100, startY: 0, direction: 'h', ...over,
  });

  it('스와이프 중이 아니면 움직이지 않는다', () => {
    expect(getSwipeVisual(null, 'a').offset).toBe(0);
    expect(getSwipeVisual(swipe({ currentX: 200 }), 'other').offset).toBe(0);
  });

  it('세로로 판정된 제스처는 카드를 밀지 않는다(목록 스크롤)', () => {
    expect(getSwipeVisual(swipe({ currentX: 200, direction: 'v' }), 'a').active).toBe(false);
  });

  it('오른쪽으로 끌면 내일로 미루기 힌트가 진해진다', () => {
    const v = getSwipeVisual(swipe({ currentX: 100 + SWIPE_TRIGGER_PX }), 'a');
    expect(v.offset).toBe(SWIPE_TRIGGER_PX);
    expect(v.moveProgress).toBe(1);
    expect(v.deleteProgress).toBeLessThanOrEqual(0);
  });

  it('왼쪽으로 끌면 삭제 힌트가 진해진다', () => {
    const v = getSwipeVisual(swipe({ currentX: 100 - SWIPE_TRIGGER_PX }), 'a');
    expect(v.deleteProgress).toBe(1);
  });

  it('아무리 끌어도 최대 이동량을 넘지 않는다', () => {
    expect(getSwipeVisual(swipe({ currentX: 999 }), 'a').offset).toBe(SWIPE_MAX_PX);
    expect(getSwipeVisual(swipe({ currentX: -999 }), 'a').offset).toBe(-SWIPE_MAX_PX);
  });
});

describe('calcEmptyHourSlots — 드래그 중 펼칠 빈 정각', () => {
  it('내일 탭: 아침 6시~밤 11시, 구분선(12시·18시) 정각은 제외', () => {
    const hours = calcEmptyHourSlots([], 'tomorrow', 0);
    expect(hours[0]).toBe(6 * 60);
    expect(hours[hours.length - 1]).toBe(23 * 60);
    expect(hours).not.toContain(12 * 60);
    expect(hours).not.toContain(18 * 60);
    expect(hours).toHaveLength(16); // 6~23시 18개 - 구분선 2개
  });
  it('오늘 탭: 지금 시각 이후의 정각부터 (17:00이면 19시부터 — 18시는 저녁 구분선)', () => {
    expect(calcEmptyHourSlots([], 'today', 17 * 60)[0]).toBe(19 * 60);
    expect(calcEmptyHourSlots([], 'today', 16 * 60 + 59)[0]).toBe(17 * 60);
  });
  it('그 1시간 안에 일정이 있으면 그 정각은 없음 (15:30 일정 → 15시 줄 없음, 16시 줄은 있음)', () => {
    const hours = calcEmptyHourSlots([15 * 60 + 30], 'tomorrow', 0);
    expect(hours).not.toContain(15 * 60);
    expect(hours).toContain(16 * 60);
  });
  it('자정이 지난 새벽(가상분 1440 이상)이면 펼칠 정각 없음', () => {
    expect(calcEmptyHourSlots([], 'today', 25 * 60)).toEqual([]);
  });
});

describe('buildSegments — 타임라인 그리는 순서', () => {
  const todo = (id: string, time: number): Todo => ({
    id, text: id, time, endTime: null, completed: false, parentId: null, order: 0,
    createdAt: '2026-01-01T00:00:00.000Z',
  });
  const kinds = (segs: Segment[]) => segs.map(s =>
    s.type === 'event' ? s.todo.id
    : s.type === 'section' ? s.label
    : s.type === 'hour' ? `${s.virtMin / 60}시`
    : s.type === 'now' ? 'now' : 'gap');

  it('평소(드래그 아님): 구분선은 시간 순서대로 카드 사이에, 3시간 넘는 빈 구간은 갭', () => {
    const segs = buildSegments([todo('a', 9 * 60), todo('b', 20 * 60)], 'tomorrow', 0, null);
    expect(kinds(segs)).toEqual(['a', 'gap', '오후', '저녁', 'b', '자정']);
  });
  it('일정이 없고 드래그 중도 아니면 아무것도 안 그림', () => {
    expect(buildSegments([], 'tomorrow', 0, null)).toEqual([]);
  });
  it('드래그 중: 갭 대신 빈 정각 줄이 시간 순서대로 들어간다', () => {
    const segs = buildSegments([todo('a', 9 * 60), todo('b', 14 * 60)], 'tomorrow', 0, [10 * 60, 11 * 60, 13 * 60]);
    expect(kinds(segs)).toEqual(['a', '10시', '11시', '오후', '13시', 'b', '저녁', '자정']);
  });
  it('현재시각 표시도 시간 순서대로 (11:40이면 오후 구분선보다 위)', () => {
    const segs = buildSegments([todo('a', 13 * 60)], 'today', 11 * 60 + 40, null);
    expect(kinds(segs)).toEqual(['now', '오후', 'a', '저녁', '자정']);
  });
  it('같은 시간이면 정각 줄은 카드 위, 현재시각은 카드 아래', () => {
    const segs = buildSegments([todo('a', 15 * 60)], 'today', 15 * 60, [15 * 60]);
    expect(kinds(segs)).toEqual(['오후', '15시', 'a', 'now', '저녁', '자정']);
  });
});

describe('calcUnscheduledDropTime — 시간 미지정 카드를 놓을 시간', () => {
  const base: UnscheduledDragState = {
    todoId: 'u', text: 'u', currentY: 0, timelineTop: 0, timelineBottom: 1000, timelineLeft: 0,
    anchors: [{ todoId: 'a', time: 9 * 60, centerY: 100 }],
    waypoints: [
      { todoId: '__hour-600__', time: 10 * 60, centerY: 200 },
      { todoId: '__hour-660__', time: 11 * 60, centerY: 300 },
    ],
    snapTop: 0, snapBottom: 1000, scrollDelta: 0,
  };
  it('펼친 정각 줄 위에 놓으면 그 정각', () => {
    expect(calcUnscheduledDropTime({ ...base, currentY: 300 })).toBe(11 * 60);
  });
  it('두 정각 줄 사이 가운데면 그 사이 시간(10:30)', () => {
    expect(calcUnscheduledDropTime({ ...base, currentY: 250 })).toBe(10 * 60 + 30);
  });
  it('자동 스크롤된 양만큼 손가락 위치를 보정 (화면 200 + 스크롤 100 = 11시 줄)', () => {
    expect(calcUnscheduledDropTime({ ...base, currentY: 200, scrollDelta: 100 })).toBe(11 * 60);
  });
});
