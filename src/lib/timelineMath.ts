// 믹스뷰·시간표뷰가 공유하는 순수 계산 로직과 타입.
// (두 뷰에 동일하게 복사돼 있던 것을 한 곳으로 모음)
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
  originalTime: number;
  startY: number; // 드래그 시작 시 포인터 Y (고정 감도 계산 기준)
  initialCardCenterY: number;
  cardHeight: number; // 카드 높이 + margin (드롭존 크기로 사용)
  currentY: number;
  anchors: CardAnchor[]; // 다른 카드들의 위치 스냅샷 (정렬됨)
  containerTop: number;
  containerBottom: number;
  containerLeft: number;
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
  | { type: 'section'; label: string; key: string };

// ── 상수 ────────────────────────────────────────────────────
export const SNAP = 5; // 시간 스냅 단위(분)
// 가속 감도: 시작점에서 가까울수록 미세(분), 멀수록 빠르게(시간).
//   분 = DRAG_BASE_MIN_PER_PX·dy + DRAG_ACCEL·dy·|dy|
// (감도 조절 지점: BASE를 키우면 근처가 더 민감, ACCEL을 키우면 멀리서 더 빠르게)
export const DRAG_BASE_MIN_PER_PX = 0.7; // 시작점 부근 감도 (분/px)
export const DRAG_ACCEL = 0.003;         // 거리 제곱 가속 계수

export const SECTION_MARKS = [
  { virtMin: 12 * 60, label: '오후', key: 'section-pm' },
  { virtMin: 18 * 60, label: '저녁', key: 'section-eve' },
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

/**
 * 가속 감도: 드래그 시작점(startY)에서 끌어올린/내린 거리에 따라 시간을 바꾼다.
 * 시작점 부근은 미세(분 단위), 멀어질수록 빠르게(시간 단위) → 한 번의 드래그로
 * 정밀 조정과 몇 시간 이동을 모두 처리. 카드 간격·위치와는 무관.
 * 반환값은 가상 시간(virtual minutes), 하루 범위(새벽4시~다음날새벽3시59분)로 클램프, 5분 스냅.
 */
export function calcProposedTime(ds: DragState): number {
  const { currentY, startY, originalTime } = ds;
  const dy = currentY - startY;
  const deltaMin = DRAG_BASE_MIN_PER_PX * dy + DRAG_ACCEL * dy * Math.abs(dy);
  const proposed = snapTo(originalTime + deltaMin);
  return Math.max(DAY_START_MIN, Math.min(1679, proposed));
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
