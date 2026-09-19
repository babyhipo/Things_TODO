import { describe, it, expect } from 'vitest';
import type { Todo } from '../types/todo';
import {
  buildSharedItems,
  encodeSharedDay,
  decodeSharedDay,
  buildShareUrl,
  readShareCode,
  addDaysYMD,
  formatShareDate,
  buildShareText,
  type SharedDay,
} from './shareCodec';

function todo(partial: Partial<Todo> & { id: string; text: string }): Todo {
  return {
    time: null,
    completed: false,
    parentId: null,
    order: 0,
    createdAt: '2026-09-19T00:00:00.000Z',
    ...partial,
  };
}

const TODOS: Todo[] = [
  todo({ id: 'a', text: '카공 - 기획서 초안', time: 600, order: 2, starred: true }),
  todo({ id: 'a1', text: '목차 잡기', parentId: 'a', order: 0 }),
  todo({ id: 'a2', text: '자료 찾기', parentId: 'a', order: 1 }),
  todo({ id: 'b', text: '기상', time: 480, order: 0, completed: true }),
  todo({ id: 'c', text: '새벽 영화', time: 60, order: 3 }),
  todo({ id: 'd', text: '시간 없는 일', time: null, order: 1 }),
  todo({ id: 'e', text: '광고 리포트', time: 840, endTime: 960, order: 4 }),
];

describe('buildSharedItems', () => {
  it('고른 것만, 시간순(새벽은 맨 뒤, 시간 없는 일정은 그 다음)으로 담는다', () => {
    const items = buildSharedItems(TODOS, new Set(['a', 'b', 'c', 'd', 'e']));
    expect(items.map((i) => i.text)).toEqual([
      '기상', '카공 - 기획서 초안', '광고 리포트', '새벽 영화', '시간 없는 일',
    ]);
  });

  it('하위 일정도 고른 것만 부모 밑에 담고, 별·완료·끝시간을 유지한다', () => {
    const items = buildSharedItems(TODOS, new Set(['a', 'a2', 'b', 'e']));
    const a = items.find((i) => i.text === '카공 - 기획서 초안')!;
    expect(a.starred).toBe(true);
    expect(a.subs.map((s) => s.text)).toEqual(['자료 찾기']);
    expect(items.find((i) => i.text === '기상')!.completed).toBe(true);
    expect(items.find((i) => i.text === '광고 리포트')!.endTime).toBe(960);
  });

  it('부모가 빠진 하위 일정은 담지 않는다', () => {
    const items = buildSharedItems(TODOS, new Set(['a1', 'b']));
    expect(items.map((i) => i.text)).toEqual(['기상']);
  });
});

describe('encode/decode', () => {
  it('한글·하위 일정·별·완료·시간 범위가 그대로 돌아온다', async () => {
    const day: SharedDay = {
      date: '2026-09-19',
      items: buildSharedItems(TODOS, new Set(TODOS.map((t) => t.id))),
    };
    const code = await encodeSharedDay(day);
    expect(code).toMatch(/^[A-Za-z0-9_-]+$/); // 링크에 그대로 넣을 수 있는 글자만
    expect(await decodeSharedDay(code)).toEqual(day);
  });

  it('망가진 링크는 null (앱이 멈추지 않음)', async () => {
    expect(await decodeSharedDay('')).toBeNull();
    expect(await decodeSharedDay('망가진링크')).toBeNull();
    expect(await decodeSharedDay('AAAAAAAA')).toBeNull();
  });

  it('형식이 이상한 값은 걸러낸다(잘못된 시간 → 시간 없음, 글자 아닌 항목 → 제외)', async () => {
    const raw = JSON.stringify({ v: 1, d: '2026-09-19', i: [['정상', 9999, 10, 0], [123], ['별', 480, null, 2]] });
    const packed = await new Response(
      new Blob([new TextEncoder().encode(raw)]).stream().pipeThrough(new CompressionStream('deflate-raw')),
    ).arrayBuffer();
    let bin = '';
    new Uint8Array(packed).forEach((b) => { bin += String.fromCharCode(b); });
    const code = btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

    const day = await decodeSharedDay(code);
    expect(day!.items).toHaveLength(2);
    expect(day!.items[0]).toMatchObject({ text: '정상', time: null, endTime: null });
    expect(day!.items[1]).toMatchObject({ text: '별', time: 480, starred: true });
  });
});

describe('링크 주소', () => {
  it('# 뒤에 붙이고 다시 꺼낼 수 있다', () => {
    const url = buildShareUrl('https://babyhipo.github.io/Things_TODO/', 'abc-_123');
    expect(url).toBe('https://babyhipo.github.io/Things_TODO/#share=abc-_123');
    expect(readShareCode(new URL(url).hash)).toBe('abc-_123');
  });

  it('공유 링크가 아니면 null', () => {
    expect(readShareCode('')).toBeNull();
    expect(readShareCode('#other=1')).toBeNull();
    expect(readShareCode('#share=')).toBeNull();
  });
});

describe('날짜·요약 글', () => {
  it('날짜 더하기와 표시 (월말 넘김 포함)', () => {
    expect(addDaysYMD('2026-09-30', 1)).toBe('2026-10-01');
    expect(formatShareDate('2026-09-19')).toBe('9월 19일 (토)');
  });

  it('요약 글: 완료 ✓, 별 ★, 시간 범위, 하위 일정은 생략', () => {
    const day: SharedDay = {
      date: '2026-09-19',
      items: buildSharedItems(TODOS, new Set(['a', 'a1', 'b', 'd', 'e'])),
    };
    expect(buildShareText(day)).toBe(
      ['9월 19일 (토) 일정', '✓ 8:00 기상', '★ 10:00 카공 - 기획서 초안', '· 14:00~16:00 광고 리포트', '· 시간 없는 일'].join('\n'),
    );
  });
});
