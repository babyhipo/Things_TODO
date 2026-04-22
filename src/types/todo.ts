export type DayKey = 'today' | 'tomorrow';

export interface Todo {
  id: string;
  text: string;
  time: number | null;
  completed: boolean;
  parentId: string | null;
  order: number;
  createdAt: string;
}

export interface Template {
  id: string;
  name: string;
  items: Array<{
    text: string;
    time: number | null;
    parentId: string | null;
    tempId?: string;
    order: number;
  }>;
  isBuiltIn?: boolean;
}
