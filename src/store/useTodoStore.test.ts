import { describe, it, expect, beforeEach } from 'vitest';
import { useTodoStore } from './useTodoStore';
import { getLogicalDate } from '../lib/dayBoundary';
import type { Todo } from '../types/todo';

// 스토어는 앱의 '두뇌'입니다. 브라우저 저장소(localStorage)를 쓰므로
// 가상 브라우저(jsdom) 환경에서 실제 동작을 검증합니다.

const store = () => useTodoStore.getState();

/** 테스트용 Todo 한 개를 간단히 만든다 */
function mk(p: Partial<Todo> & { id: string }): Todo {
  return {
    id: p.id,
    text: p.text ?? '',
    time: p.time ?? null,
    endTime: p.endTime ?? null,
    completed: p.completed ?? false,
    parentId: p.parentId ?? null,
    order: p.order ?? 0,
    createdAt: p.createdAt ?? new Date().toISOString(),
  };
}

beforeEach(() => {
  useTodoStore.setState({ days: { today: [], tomorrow: [] }, templates: [] });
});

describe('addTodo — 일정 추가', () => {
  it('입력 문장에서 시간을 읽어 목록에 추가한다', () => {
    store().addTodo('today', '8시 기상');
    const list = useTodoStore.getState().days.today;
    expect(list).toHaveLength(1);
    expect(list[0]).toMatchObject({ text: '기상', time: 480, completed: false, parentId: null });
  });

  it('오후(pm) 버튼 힌트는 오전 시각에 12시간을 더한다 ("2시" → 14시)', () => {
    store().addTodo('today', '2시 회의', 'pm');
    expect(useTodoStore.getState().days.today[0].time).toBe(840);
  });
});

describe('toggleComplete — 완료 토글', () => {
  it('완료/미완료를 번갈아 뒤집는다', () => {
    useTodoStore.setState({ days: { today: [mk({ id: 'a', text: 'x' })], tomorrow: [] } });
    store().toggleComplete('today', 'a');
    expect(useTodoStore.getState().days.today[0].completed).toBe(true);
    store().toggleComplete('today', 'a');
    expect(useTodoStore.getState().days.today[0].completed).toBe(false);
  });
});

describe('deleteTodo — 삭제', () => {
  it('부모를 지우면 그 하위 일정(자식)도 함께 삭제된다', () => {
    useTodoStore.setState({
      days: {
        today: [
          mk({ id: 'p', text: '부모', order: 0 }),
          mk({ id: 'c', text: '자식', parentId: 'p', order: 1 }),
          mk({ id: 'o', text: '남는것', order: 2 }),
        ],
        tomorrow: [],
      },
    });
    store().deleteTodo('today', 'p');
    expect(useTodoStore.getState().days.today.map((t) => t.id)).toEqual(['o']);
  });
});

describe('deduplicateDay — 중복 제거', () => {
  it('같은 시간·같은 내용의 중복만 제거한다', () => {
    useTodoStore.setState({
      days: {
        today: [
          mk({ id: 'a', text: '기상', time: 480, order: 0 }),
          mk({ id: 'b', text: '기상', time: 480, order: 1 }),
          mk({ id: 'c', text: '헬스', time: 540, order: 2 }),
        ],
        tomorrow: [],
      },
    });
    store().deduplicateDay('today');
    const list = useTodoStore.getState().days.today;
    expect(list).toHaveLength(2);
    expect(list.map((t) => t.text)).toEqual(['기상', '헬스']);
  });
});

describe('reorderTodos — 드래그 시 시간 자동 조정', () => {
  it('두 일정 사이로 옮기면 시간이 중간값으로 바뀐다 (8:00과 9:00 사이 → 8:30)', () => {
    useTodoStore.setState({
      days: {
        today: [
          mk({ id: 'a', text: 'A', time: 480, order: 0 }), // 8:00
          mk({ id: 'b', text: 'B', time: 540, order: 1 }), // 9:00
          mk({ id: 'c', text: 'C', time: 600, order: 2 }), // 10:00
        ],
        tomorrow: [],
      },
    });
    // C를 A와 B 사이로 이동
    store().reorderTodos('today', ['a', 'c', 'b'], 'c');
    const c = useTodoStore.getState().days.today.find((t) => t.id === 'c')!;
    expect(c.time).toBe(510); // (480 + 540) / 2 = 8:30
  });
});

describe('moveTodoToTomorrow — 내일로 넘기기', () => {
  it('부모와 자식을 함께 내일로 옮기고 완료 상태를 초기화한다', () => {
    useTodoStore.setState({
      days: {
        today: [
          mk({ id: 'p', text: '부모', completed: true, order: 0 }),
          mk({ id: 'c', text: '자식', parentId: 'p', completed: true, order: 1 }),
        ],
        tomorrow: [],
      },
    });
    store().moveTodoToTomorrow('today', 'p');
    const s = useTodoStore.getState();
    expect(s.days.today).toHaveLength(0);
    expect(s.days.tomorrow).toHaveLength(2);
    const parent = s.days.tomorrow.find((t) => t.parentId === null)!;
    const child = s.days.tomorrow.find((t) => t.parentId !== null)!;
    expect(parent.text).toBe('부모');
    expect(parent.completed).toBe(false); // 완료 초기화
    expect(child.parentId).toBe(parent.id); // 부모-자식 관계 유지
  });
});

describe('indentTodo / outdentTodo — 하위/상위 이동', () => {
  it('바로 위 항목의 하위로 넣었다가 다시 최상위로 뺀다', () => {
    useTodoStore.setState({
      days: {
        today: [mk({ id: 'a', text: 'A', order: 0 }), mk({ id: 'b', text: 'B', order: 1 })],
        tomorrow: [],
      },
    });
    store().indentTodo('today', 'b');
    expect(useTodoStore.getState().days.today.find((t) => t.id === 'b')!.parentId).toBe('a');
    store().outdentTodo('today', 'b');
    expect(useTodoStore.getState().days.today.find((t) => t.id === 'b')!.parentId).toBeNull();
  });
});

describe('performRolloverIfNeeded — 자정(새벽 4시) 넘김', () => {
  it('마지막 넘김 날짜가 과거면 내일 일정을 오늘로 옮기고 완료를 초기화한다', () => {
    useTodoStore.setState({
      days: { today: [], tomorrow: [mk({ id: 't', text: '내일일정', time: 480, completed: true, order: 0 })] },
      lastRolloverDate: '2000-01-01',
    });
    store().performRolloverIfNeeded();
    const s = useTodoStore.getState();
    expect(s.days.tomorrow).toHaveLength(0);
    expect(s.days.today).toHaveLength(1);
    expect(s.days.today[0].text).toBe('내일일정');
    expect(s.days.today[0].completed).toBe(false);
  });

  it('날짜가 그대로면 아무 일도 하지 않는다', () => {
    useTodoStore.setState({
      days: { today: [mk({ id: 'x', text: '오늘것', order: 0 })], tomorrow: [] },
      lastRolloverDate: getLogicalDate(), // 이미 오늘로 넘김 완료 상태
    });
    store().performRolloverIfNeeded();
    expect(useTodoStore.getState().days.today).toHaveLength(1);
  });
});
