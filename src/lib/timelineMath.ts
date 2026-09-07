// 믹스뷰 드래그/보간에 쓰는 순수 계산 로직과 타입.
import { toVirt, DAY_START_MIN } from './dayBoundary';
import type { Todo } from '../types/todo';

// ── 드래그 관련 타입 ─────────────────────────────────────────
export interface CardAnchor {
  todoId: string;
  time: number;
  centerY: number; // 드래그 시작 시 측정된 고정값
}

export interface DragState {
  todoId: string;
  initialCardCenterY: number;
  cardHeight: number; // 카드 높이 + margin (드롭존 크기로 사용)
  currentY: number;
  anchors: CardAnchor[]; // 다른 카드들의 위치 스냅샷 (정렬됨)
  containerTop: number;
  containerBottom: number;
  containerLeft: number;
  // 누른 지점과 카드 중심의 차이. currentY를 이 값으로 보정해 그립의 어느 지점을 눌러도
  // 시작 시점이 카드 중심(=원래 시간)으로 맞춰지게 한다.
  grabOffset: number;
  // 잡은 카드 자신의 원래 슬롯(시간·위치)을 보간 waypoint로 사용 →
  // 잡는 순간 시간이 안 바뀌게 한다. 삽입 순서 계산에는 쓰지 않는다.
  selfAnchor?: CardAnchor;
  // 현재시각 빨간 바(now 라인)도 시간 보간의 waypoint로 사용 (오늘 탭에만 존재).
  nowAnchor?: CardAnchor;
  // 섹션 구분선(오후/저녁/자정)도 시간 waypoint로 사용 → 카드가 없는 구간에서
  // 시간이 훅 건너뛰지 않고 구분선 사이로 완만하게 보간된다(감도 완화).
  sectionAnchors?: CardAnchor[];
}

/**
 * 제안 시간(가상분): 포인터가 카드들 사이 어디에 있느냐로 정한다(카드 상대 위치 기준).
 * 손가락 위치 = 실제 배치 위치가 일치하도록. self·now 앵커는 정확히 그 시간에 도달 가능한
 * waypoint로 섞는다(겹침방지 간격 없음) → 잡는 순간 원래 시간 유지, 빨간 바=현재시각 일치.
 */
export function calcDragTime(ds: DragState): number {
  const sorted = [
    ...ds.anchors,
    ...(ds.selfAnchor ? [ds.selfAnchor] : []),
    ...(ds.nowAnchor ? [ds.nowAnchor] : []),
    ...(ds.sectionAnchors ?? []),
  ].sort((a, b) => a.centerY - b.centerY);
  const { currentY, containerTop, containerBottom } = ds;

  if (sorted.length === 0) {
    const t = Math.max(0, Math.min(1, (currentY - containerTop) / Math.max(1, containerBottom - containerTop)));
    return snapTo(Math.round(DAY_START_MIN + t * (1439 - DAY_START_MIN)));
  }

  // 스냅 존: 어느 앵커든 중심 ±DRAG_SNAP_ZONE 안이면 그 시간으로 고정
  // (같은 시간 등록 여유 — 순서 앞/뒤는 getInsertionBeforeId가 중심 기준으로 판단)
  let nearest: CardAnchor | null = null;
  let nearestDist = Infinity;
  for (const a of sorted) {
    const d = Math.abs(currentY - a.centerY);
    if (d <= DRAG_SNAP_ZONE && d < nearestDist) { nearest = a; nearestDist = d; }
  }
  if (nearest) return nearest.time;

  const first = sorted[0], last = sorted[sorted.length - 1];
  // 첫 카드 위: 하루 시작(새벽4시)~첫 카드 시간 (존 바깥부터 보간)
  if (currentY < first.centerY) {
    const hi = first.centerY - DRAG_SNAP_ZONE;
    const t = Math.max(0, Math.min(1, (currentY - containerTop) / Math.max(1, hi - containerTop)));
    return snapTo(Math.max(DAY_START_MIN, Math.round(DAY_START_MIN + t * (first.time - DAY_START_MIN))));
  }
  // 마지막 카드 아래: 마지막 카드 시간~하루 끝
  if (currentY > last.centerY) {
    const lo = last.centerY + DRAG_SNAP_ZONE;
    const t = Math.max(0, Math.min(1, (currentY - lo) / Math.max(1, containerBottom - lo)));
    return snapTo(Math.min(1679, Math.round(last.time + t * (1679 - last.time))));
  }
  // 두 앵커 사이(존 바깥 중간 영역): 선형 보간
  for (let i = 0; i < sorted.length - 1; i++) {
    const above = sorted[i], below = sorted[i + 1];
    if (currentY > above.centerY && currentY < below.centerY) {
      if (below.time <= above.time) return above.time; // 같은 시간 → 그 시간 유지
      const lo = above.centerY + DRAG_SNAP_ZONE;
      const hi = below.centerY - DRAG_SNAP_ZONE;
      if (currentY <= lo) return above.time;
      if (currentY >= hi) return below.time;
      const t = (currentY - lo) / Math.max(1, hi - lo);
      return snapTo(Math.round(above.time + t * (below.time - above.time)));
    }
  }
  return snapTo(DAY_START_MIN + 480); // fallback: 12:00
}

/**
 * 드래그 중인 카드가 타임라인 아래(= '시간 미지정' 구역)로 내려갔는지.
 * true면 시간을 보간하지 않고 '시간 지정 해제'로 처리한다.
 * (예전에는 맨 아래로 내리면 하루 끝 = 새벽 3:59로 등록됐음)
 */
export function isDragOverUnscheduled(ds: DragState): boolean {
  return ds.currentY > ds.containerBottom;
}

/** 삽입 위치(어느 카드 앞): 포인터 Y 기준 (null이면 맨 뒤) */
export function calcDragInsertBeforeId(ds: DragState): string | null {
  return getInsertionBeforeId(ds.currentY, ds.anchors);
}

export interface SwipeState {
  todoId: string;
  startX: number;
  startY: number;
  currentX: number;
  direction: 'undecided' | 'h' | 'v';
}

export interface UnscheduledDragState {
  todoId: string;
  text: string;
  currentY: number;
  timelineTop: number;
  timelineBottom: number;
  timelineLeft: number;
  anchors: CardAnchor[];
}

export interface SubDragState {
  todoId: string;
  text: string;
  currentX: number;
  currentY: number;
  timelineTop: number;
  timelineBottom: number;
  timelineLeft: number;
  anchors: CardAnchor[];
  parentId: string;
  siblingIds: string[]; // 드래그 시작 시 형제 순서 (자신 포함)
  timelineWidth: number;
}

export type Segment =
  | { type: 'event'; todo: Todo }
  | { type: 'gap'; fromMin: number; toMin: number; key: string }
  | { type: 'now'; time: number; key: string }
  | { type: 'section'; label: string; key: string; virtMin: number };

// ── 상수 ────────────────────────────────────────────────────
export const SNAP = 5; // 시간 스냅 단위(분)
// 같은 시간 스냅 존(px): 카드 중심 ±이 값 안에서는 시간이 그 카드 시간으로 고정되고,
// 중심보다 위=앞/아래=뒤로 순서만 갈린다. 이 존을 벗어나야 시간이 바뀐다.
export const DRAG_SNAP_ZONE = 8;

export const SECTION_MARKS = [
  { virtMin: 12 * 60, label: '오후', key: 'section-pm' },
  { virtMin: 18 * 60, label: '저녁', key: 'section-eve' },
  // 자정: 저녁~하루 끝 사이가 텅 비면 드래그 시간 조절이 너무 민감해져서
  // 중간 기준점(앵커) 겸 구분선으로 넣는다. 가상분 1440 = 다음날 00:00
  { virtMin: 24 * 60, label: '자정', key: 'section-midnight' },
];

// ── 계산 함수 ────────────────────────────────────────────────
/** 5분 단위로 반올림 */
export function snapTo(v: number): number {
  return Math.round(v / SNAP) * SNAP;
}

/** 앵커 기반 Y좌표 → 분 단위 시간 보간 (미지정 카드 드래그용) */
export function calcTimeFromY(
  currentY: number,
  anchors: CardAnchor[],
  containerTop: number,
  containerBottom: number,
): number {
  const sorted = [...anchors].sort((a, b) => a.centerY - b.centerY);
  if (sorted.length === 0) {
    const t = Math.max(0, Math.min(1, (currentY - containerTop) / Math.max(1, containerBottom - containerTop)));
    return snapTo(Math.round(DAY_START_MIN + t * (1439 - DAY_START_MIN)));
  }
  if (currentY <= sorted[0].centerY) {
    const t = Math.max(0, (currentY - containerTop) / Math.max(1, sorted[0].centerY - containerTop));
    return snapTo(Math.max(DAY_START_MIN, Math.round(t * Math.max(DAY_START_MIN, sorted[0].time - SNAP))));
  }
  const last = sorted[sorted.length - 1];
  if (currentY >= last.centerY) {
    const t = Math.min(1, (currentY - last.centerY) / Math.max(1, containerBottom - last.centerY));
    const minT = last.time + SNAP;
    return snapTo(Math.max(minT, Math.min(1679, minT + Math.round(t * (1679 - minT)))));
  }
  for (let i = 0; i < sorted.length - 1; i++) {
    const above = sorted[i], below = sorted[i + 1];
    if (currentY >= above.centerY && currentY < below.centerY) {
      const minT = above.time + SNAP, maxT = below.time - SNAP;
      if (minT > maxT) return snapTo(above.time + Math.round((below.time - above.time) / 2));
      const t = (currentY - above.centerY) / (below.centerY - above.centerY);
      return snapTo(Math.max(minT, Math.min(maxT, minT + t * (maxT - minT))));
    }
  }
  return snapTo(DAY_START_MIN + 480); // fallback: 12:00
}

/** 드롭존이 어떤 카드 "바로 앞"에 삽입되는지 todoId 반환 (포인터 위치 기준, null이면 맨 뒤) */
export function getInsertionBeforeId(currentY: number, anchors: CardAnchor[]): string | null {
  const sorted = [...anchors].sort((a, b) => a.centerY - b.centerY);
  for (const anchor of sorted) {
    if (currentY < anchor.centerY) return anchor.todoId;
  }
  return null;
}

/** 드롭존이 어떤 카드 "바로 앞"에 삽입되는지 todoId 반환 (제안 시간 기준, null이면 맨 뒤) */
export function getInsertionBeforeIdByTime(proposedTime: number, anchors: CardAnchor[]): string | null {
  const sorted = [...anchors].sort((a, b) => a.time - b.time);
  for (const anchor of sorted) {
    if (proposedTime < anchor.time) return anchor.todoId;
  }
  return null;
}

/** 시간·상태 기반 카드 색상 (완료=회색, 지남=빨강, 미지정=보라, 1시간이내=주황, 그외=파랑) */
export function eventColor(
  time: number | null,
  overdue: boolean,
  completed: boolean,
  now: number,
  day: string,
): string {
  if (completed) return '#9CA3AF';
  if (overdue) return '#EF4444';
  if (time === null) return '#7C3AED';
  const offset = day === 'tomorrow' ? 1440 : 0;
  const diff = toVirt(time) + offset - now;
  if (diff <= 60) return '#F59E0B';
  return '#3B5BDB';
}
