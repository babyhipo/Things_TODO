export type DayKey = 'today' | 'tomorrow';

export interface Todo {
  id: string;
  text: string;
  time: number | null;
  endTime?: number | null;
  completed: boolean;
  parentId: string | null;
  order: number;
  createdAt: string;
  /** 주요 일정(별표). 등록할 때 입력창의 별 버튼을 켜 두면 true. 없으면 일반 일정 */
  starred?: boolean;
}

export interface Template {
  id: string;
  name: string;
  items: Array<{
    text: string;
    time: number | null;
    endTime?: number | null;
    parentId: string | null;
    tempId?: string;
    order: number;
  }>;
  isBuiltIn?: boolean;
}
