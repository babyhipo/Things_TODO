// 일정 공유 링크 만들기/풀기.
// 서버 없이, 고른 일정을 압축해서 링크의 # 뒤에 붙여 보낸다.
// (# 뒤 내용은 GitHub 서버로 전송되지 않고 받는 사람 브라우저 안에서만 풀린다)
import type { Todo } from '../types/todo';
import { toVirt } from './dayBoundary';
import { formatTime } from './timeFormatter';

/** 링크 # 뒤에 붙는 이름표. 예) #share=압축된글자 */
export const SHARE_HASH_KEY = 'share';

/** 공유되는 일정 하나(받는 쪽 화면에 필요한 것만) */
export interface SharedItem {
  text: string;
  time: number | null;
  endTime: number | null;
  completed: boolean;
  starred: boolean;
  /** 하위 일정(한 단계만) */
  subs: SharedItem[];
}

export interface SharedDay {
  /** 실제 날짜 'YYYY-MM-DD' */
  date: string;
  items: SharedItem[];
}

// ─── 고른 일정 → 공유용 목록 ─────────────────────────────────

// 시간순(새벽 4시 기준), 시간 없는 일정은 맨 뒤, 같으면 기존 순서
export function byTimeThenOrder(a: Todo, b: Todo): number {
  const ta = a.time === null ? Infinity : toVirt(a.time);
  const tb = b.time === null ? Infinity : toVirt(b.time);
  if (ta !== tb) return ta - tb;
  return a.order - b.order;
}

function toSharedItem(t: Todo, subs: SharedItem[]): SharedItem {
  return {
    text: t.text,
    time: t.time,
    endTime: t.endTime ?? null,
    completed: t.completed,
    starred: t.starred === true,
    subs,
  };
}

/**
 * 하루 일정 중 selectedIds에 든 것만 골라 공유용 목록으로 만든다.
 * 부모가 선택되지 않은 하위 일정은 빠진다(선택 창에서 하위만 켜면 부모도 같이 켜지므로 정상적으론 없음).
 */
export function buildSharedItems(todos: Todo[], selectedIds: ReadonlySet<string>): SharedItem[] {
  const parents = todos
    .filter((t) => t.parentId === null && selectedIds.has(t.id))
    .sort(byTimeThenOrder);
  return parents.map((p) => {
    const subs = todos
      .filter((t) => t.parentId === p.id && selectedIds.has(t.id))
      .sort((a, b) => a.order - b.order)
      .map((c) => toSharedItem(c, []));
    return toSharedItem(p, subs);
  });
}

// ─── 압축 형식 ───────────────────────────────────────────────
// 링크를 짧게 하려고 이름표 없이 배열로 줄여 담는다.
// 일정 1개 = [글, 시작, 끝, 표시(1=완료, 2=별), 하위일정들?]
type WireItem = [string, number | null, number | null, number, WireItem[]?];
interface WireDay { v: 1; d: string; i: WireItem[] }

function toWire(it: SharedItem): WireItem {
  const flags = (it.completed ? 1 : 0) | (it.starred ? 2 : 0);
  const base: WireItem = [it.text, it.time, it.endTime, flags];
  if (it.subs.length > 0) base.push(it.subs.map(toWire));
  return base;
}

// 받은 값은 믿지 않고 하나하나 검사한다(망가지거나 조작된 링크 대비)
const MAX_TEXT = 500;
const MAX_ITEMS = 200;

function readTime(v: unknown): number | null {
  if (typeof v !== 'number' || !Number.isInteger(v) || v < 0 || v > 1439) return null;
  return v;
}

function fromWire(w: unknown, depth: number): SharedItem | null {
  if (!Array.isArray(w) || typeof w[0] !== 'string') return null;
  const flags = typeof w[3] === 'number' ? w[3] : 0;
  const rawSubs = depth === 0 && Array.isArray(w[4]) ? w[4].slice(0, MAX_ITEMS) : [];
  const time = readTime(w[1]);
  return {
    text: w[0].slice(0, MAX_TEXT),
    time,
    endTime: time === null ? null : readTime(w[2]),
    completed: (flags & 1) === 1,
    starred: (flags & 2) === 2,
    subs: rawSubs
      .map((s: unknown) => fromWire(s, depth + 1))
      .filter((s): s is SharedItem => s !== null),
  };
}

// ─── 글자 ↔ 압축 바이트 (브라우저 기본 압축 기능 사용) ─────────

async function pipeBytes(bytes: Uint8Array, stream: CompressionStream | DecompressionStream): Promise<Uint8Array> {
  const out = new Blob([bytes]).stream().pipeThrough(stream);
  return new Uint8Array(await new Response(out).arrayBuffer());
}

// 링크에 그대로 넣을 수 있는 base64 (+ / = 대신 - _ 사용, 끝 = 제거)
function toBase64Url(bytes: Uint8Array): string {
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(s: string): Uint8Array {
  const b64 = s.replace(/-/g, '+').replace(/_/g, '/');
  const bin = atob(b64 + '='.repeat((4 - (b64.length % 4)) % 4));
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

/** 공유할 하루 → 링크에 붙일 압축 글자 */
export async function encodeSharedDay(day: SharedDay): Promise<string> {
  const wire: WireDay = { v: 1, d: day.date, i: day.items.map(toWire) };
  const json = new TextEncoder().encode(JSON.stringify(wire));
  const packed = await pipeBytes(json, new CompressionStream('deflate-raw'));
  return toBase64Url(packed);
}

/** 압축 글자 → 공유된 하루. 망가진 링크면 null (앱이 멈추지 않게) */
export async function decodeSharedDay(code: string): Promise<SharedDay | null> {
  try {
    const bytes = await pipeBytes(fromBase64Url(code), new DecompressionStream('deflate-raw'));
    const wire = JSON.parse(new TextDecoder().decode(bytes)) as Partial<WireDay>;
    if (wire?.v !== 1 || typeof wire.d !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(wire.d)) return null;
    if (!Array.isArray(wire.i)) return null;
    const items = wire.i
      .slice(0, MAX_ITEMS)
      .map((w) => fromWire(w, 0))
      .filter((it): it is SharedItem => it !== null);
    return { date: wire.d, items };
  } catch {
    return null;
  }
}

// ─── 링크 주소 ───────────────────────────────────────────────

/** 앱 주소(origin + base) 뒤에 #share=... 를 붙인 공유 링크 */
export function buildShareUrl(appUrl: string, code: string): string {
  return `${appUrl}#${SHARE_HASH_KEY}=${code}`;
}

/** 주소의 # 부분에서 공유 글자를 꺼낸다. 없으면 null */
export function readShareCode(hash: string): string | null {
  const params = new URLSearchParams(hash.replace(/^#/, ''));
  const code = params.get(SHARE_HASH_KEY);
  return code && code.length > 0 ? code : null;
}

// ─── 날짜·요약 글 ─────────────────────────────────────────────

const DAYS_KR = ['일', '월', '화', '수', '목', '금', '토'];

function parseYMD(ymd: string): Date {
  const [y, m, d] = ymd.split('-').map(Number);
  return new Date(y, m - 1, d);
}

/** 'YYYY-MM-DD'에서 며칠 더한 날짜. 내일 탭 공유 날짜 계산용 */
export function addDaysYMD(ymd: string, days: number): string {
  const d = parseYMD(ymd);
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** '2026-09-19' → '9월 19일 (토)' */
export function formatShareDate(ymd: string): string {
  const d = parseYMD(ymd);
  return `${d.getMonth() + 1}월 ${d.getDate()}일 (${DAYS_KR[d.getDay()]})`;
}

/** 시간 표시: '8:00', 범위면 '14:00~16:00', 없으면 '' */
export function formatShareTime(it: Pick<SharedItem, 'time' | 'endTime'>): string {
  if (it.time === null) return '';
  const start = formatTime(it.time);
  return it.endTime === null ? start : `${start}~${formatTime(it.endTime)}`;
}

/** 공유창에 링크와 함께 보낼 글자 요약 (큰 일정만) */
export function buildShareText(day: SharedDay): string {
  const lines = day.items.map((it) => {
    const mark = it.completed ? '✓ ' : it.starred ? '★ ' : '· ';
    const time = formatShareTime(it);
    return `${mark}${time ? `${time} ` : ''}${it.text}`;
  });
  return [`${formatShareDate(day.date)} 일정`, ...lines].join('\n');
}
