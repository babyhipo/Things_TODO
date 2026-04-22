import type { Template } from '../../types/todo';

export const DEFAULT_TEMPLATES: Template[] = [
  {
    id: 'builtin-weekday',
    name: '평일 루틴',
    isBuiltIn: true,
    items: [
      { tempId: 'w1', text: '기상', time: 360, parentId: null, order: 0 },
      { tempId: 'w2', text: '헬스', time: 420, parentId: null, order: 1 },
      { tempId: 'w3', text: '카공', time: 480, parentId: null, order: 2 },
      { tempId: 'w4', text: '출근', time: 540, parentId: null, order: 3 },
      { tempId: 'w5', text: '퇴근', time: 1140, parentId: null, order: 4 },
      { tempId: 'w6', text: '저녁 먹고 설거지', time: 1200, parentId: null, order: 5 },
      { tempId: 'w7', text: '독서', time: 1260, parentId: null, order: 6 },
      { tempId: 'w8', text: '취침', time: 1320, parentId: null, order: 7 },
    ],
  },
  {
    id: 'builtin-miracle-morning',
    name: '미라클 모닝',
    isBuiltIn: true,
    items: [
      { tempId: 'm1', text: '기상', time: 300, parentId: null, order: 0 },
      { tempId: 'm2', text: '물 한 잔', time: 305, parentId: null, order: 1 },
      { tempId: 'm3', text: '명상', time: 310, parentId: null, order: 2 },
      { tempId: 'm4', text: '운동', time: 330, parentId: null, order: 3 },
      { tempId: 'm5', text: '샤워', time: 400, parentId: null, order: 4 },
      { tempId: 'm6', text: '아침 식사', time: 420, parentId: null, order: 5 },
      { tempId: 'm7', text: '독서 또는 공부', time: 450, parentId: null, order: 6 },
    ],
  },
  {
    id: 'builtin-reset-day',
    name: '리셋 데이',
    isBuiltIn: true,
    items: [
      { tempId: 'r1', text: '늦잠 허용', time: 540, parentId: null, order: 0 },
      { tempId: 'r2', text: '청소', time: 600, parentId: null, order: 1 },
      { tempId: 'r3', text: '빨래', time: 660, parentId: null, order: 2 },
      { tempId: 'r4', text: '주간 회고', time: 780, parentId: null, order: 3 },
      { tempId: 'r5', text: '다음 주 계획', time: 840, parentId: null, order: 4 },
      { tempId: 'r6', text: '산책', time: 960, parentId: null, order: 5 },
      { tempId: 'r7', text: '가벼운 저녁', time: 1140, parentId: null, order: 6 },
      { tempId: 'r8', text: '일찍 취침', time: 1320, parentId: null, order: 7 },
    ],
  },
  {
    id: 'builtin-evening-workout',
    name: '저녁 운동 루틴',
    isBuiltIn: true,
    items: [
      { tempId: 'e1', text: '기상', time: 420, parentId: null, order: 0 },
      { tempId: 'e2', text: '출근', time: 540, parentId: null, order: 1 },
      { tempId: 'e3', text: '점심', time: 720, parentId: null, order: 2 },
      { tempId: 'e4', text: '퇴근', time: 1080, parentId: null, order: 3 },
      { tempId: 'e5', text: '헬스', time: 1140, parentId: null, order: 4 },
      { tempId: 'e6', text: '저녁', time: 1260, parentId: null, order: 5 },
      { tempId: 'e7', text: '취침', time: 1380, parentId: null, order: 6 },
    ],
  },
];
