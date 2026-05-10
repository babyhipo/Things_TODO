export interface ParsedTime {
  time: number | null;
  endTime: number | null;
  cleanText: string;
}

// ── 단일 시간 패턴 ──────────────────────────────────────────
interface SinglePattern {
  regex: RegExp;
  extract: (m: RegExpMatchArray) => { hour: number; minute: number; meridiem?: string } | null;
}

// ── 구간 패턴 ──────────────────────────────────────────────
interface RangePattern {
  regex: RegExp;
  extract: (m: RegExpMatchArray) => {
    sh: number; sm: number;
    eh: number; em: number;
    meridiem?: string;
  } | null;
}

const SEP = '[-~]'; // 구분자: - 또는 ~

const rangePatterns: RangePattern[] = [
  // ── 오전/오후 + 시분 범위 ──
  // 오후 2시30분-3시30분
  {
    regex: new RegExp(`(오전|오후)\\s*(\\d{1,2})\\s*시\\s*(\\d{1,2})\\s*분\\s*${SEP}\\s*(\\d{1,2})\\s*시\\s*(\\d{1,2})\\s*분`),
    extract: (m) => ({ meridiem: m[1], sh: +m[2], sm: +m[3], eh: +m[4], em: +m[5] }),
  },
  // 오후 2시반-3시30분
  {
    regex: new RegExp(`(오전|오후)\\s*(\\d{1,2})\\s*시\\s*반\\s*${SEP}\\s*(\\d{1,2})\\s*시\\s*(\\d{1,2})\\s*분`),
    extract: (m) => ({ meridiem: m[1], sh: +m[2], sm: 30, eh: +m[3], em: +m[4] }),
  },
  // 오후 2시30분-3시반
  {
    regex: new RegExp(`(오전|오후)\\s*(\\d{1,2})\\s*시\\s*(\\d{1,2})\\s*분\\s*${SEP}\\s*(\\d{1,2})\\s*시\\s*반`),
    extract: (m) => ({ meridiem: m[1], sh: +m[2], sm: +m[3], eh: +m[4], em: 30 }),
  },
  // 오후 2시반-3시반
  {
    regex: new RegExp(`(오전|오후)\\s*(\\d{1,2})\\s*시\\s*반\\s*${SEP}\\s*(\\d{1,2})\\s*시\\s*반`),
    extract: (m) => ({ meridiem: m[1], sh: +m[2], sm: 30, eh: +m[3], em: 30 }),
  },
  // 오후 2시30분-3시
  {
    regex: new RegExp(`(오전|오후)\\s*(\\d{1,2})\\s*시\\s*(\\d{1,2})\\s*분\\s*${SEP}\\s*(\\d{1,2})\\s*시`),
    extract: (m) => ({ meridiem: m[1], sh: +m[2], sm: +m[3], eh: +m[4], em: 0 }),
  },
  // 오후 2시반-3시
  {
    regex: new RegExp(`(오전|오후)\\s*(\\d{1,2})\\s*시\\s*반\\s*${SEP}\\s*(\\d{1,2})\\s*시`),
    extract: (m) => ({ meridiem: m[1], sh: +m[2], sm: 30, eh: +m[3], em: 0 }),
  },
  // 오후 2시-3시
  {
    regex: new RegExp(`(오전|오후)\\s*(\\d{1,2})\\s*시\\s*${SEP}\\s*(\\d{1,2})\\s*시`),
    extract: (m) => ({ meridiem: m[1], sh: +m[2], sm: 0, eh: +m[3], em: 0 }),
  },

  // ── HH:MM-HH:MM ──
  {
    regex: new RegExp(`(\\d{1,2}):(\\d{2})\\s*${SEP}\\s*(\\d{1,2}):(\\d{2})`),
    extract: (m) => ({ sh: +m[1], sm: +m[2], eh: +m[3], em: +m[4] }),
  },

  // ── 시분 조합 범위 ──
  // X시Y분-A시B분
  {
    regex: new RegExp(`(\\d{1,2})\\s*시\\s*(\\d{1,2})\\s*분\\s*${SEP}\\s*(\\d{1,2})\\s*시\\s*(\\d{1,2})\\s*분`),
    extract: (m) => ({ sh: +m[1], sm: +m[2], eh: +m[3], em: +m[4] }),
  },
  // X시반-A시B분
  {
    regex: new RegExp(`(\\d{1,2})\\s*시\\s*반\\s*${SEP}\\s*(\\d{1,2})\\s*시\\s*(\\d{1,2})\\s*분`),
    extract: (m) => ({ sh: +m[1], sm: 30, eh: +m[2], em: +m[3] }),
  },
  // X시Y분-A시반
  {
    regex: new RegExp(`(\\d{1,2})\\s*시\\s*(\\d{1,2})\\s*분\\s*${SEP}\\s*(\\d{1,2})\\s*시\\s*반`),
    extract: (m) => ({ sh: +m[1], sm: +m[2], eh: +m[3], em: 30 }),
  },
  // X시반-A시반
  {
    regex: new RegExp(`(\\d{1,2})\\s*시\\s*반\\s*${SEP}\\s*(\\d{1,2})\\s*시\\s*반`),
    extract: (m) => ({ sh: +m[1], sm: 30, eh: +m[2], em: 30 }),
  },
  // X시Y분-A시
  {
    regex: new RegExp(`(\\d{1,2})\\s*시\\s*(\\d{1,2})\\s*분\\s*${SEP}\\s*(\\d{1,2})\\s*시`),
    extract: (m) => ({ sh: +m[1], sm: +m[2], eh: +m[3], em: 0 }),
  },
  // X시반-A시
  {
    regex: new RegExp(`(\\d{1,2})\\s*시\\s*반\\s*${SEP}\\s*(\\d{1,2})\\s*시`),
    extract: (m) => ({ sh: +m[1], sm: 30, eh: +m[2], em: 0 }),
  },
  // X시-A시Y분
  {
    regex: new RegExp(`(\\d{1,2})\\s*시\\s*${SEP}\\s*(\\d{1,2})\\s*시\\s*(\\d{1,2})\\s*분`),
    extract: (m) => ({ sh: +m[1], sm: 0, eh: +m[2], em: +m[3] }),
  },
  // X시-A시반
  {
    regex: new RegExp(`(\\d{1,2})\\s*시\\s*${SEP}\\s*(\\d{1,2})\\s*시\\s*반`),
    extract: (m) => ({ sh: +m[1], sm: 0, eh: +m[2], em: 30 }),
  },
  // X시-A시  (가장 마지막에)
  {
    regex: new RegExp(`(\\d{1,2})\\s*시\\s*${SEP}\\s*(\\d{1,2})\\s*시`),
    extract: (m) => ({ sh: +m[1], sm: 0, eh: +m[2], em: 0 }),
  },
  // X-A시  (숫자만 앞에, 시는 뒤에만)
  {
    regex: new RegExp(`(\\d{1,2})\\s*${SEP}\\s*(\\d{1,2})\\s*시`),
    extract: (m) => ({ sh: +m[1], sm: 0, eh: +m[2], em: 0 }),
  },
];

const singlePatterns: SinglePattern[] = [
  {
    regex: /(오전|오후)\s*(\d{1,2})\s*시\s*(\d{1,2})\s*분/,
    extract: (m) => ({ meridiem: m[1], hour: +m[2], minute: +m[3] }),
  },
  {
    regex: /(오전|오후)\s*(\d{1,2})\s*시\s*반/,
    extract: (m) => ({ meridiem: m[1], hour: +m[2], minute: 30 }),
  },
  {
    regex: /(오전|오후)\s*(\d{1,2})\s*시/,
    extract: (m) => ({ meridiem: m[1], hour: +m[2], minute: 0 }),
  },
  {
    regex: /(\d{1,2})\s*시\s*반/,
    extract: (m) => ({ hour: +m[1], minute: 30 }),
  },
  {
    regex: /(\d{1,2})\s*시\s*(\d{1,2})\s*분/,
    extract: (m) => ({ hour: +m[1], minute: +m[2] }),
  },
  {
    regex: /(\d{1,2})\s*시/,
    extract: (m) => ({ hour: +m[1], minute: 0 }),
  },
  {
    regex: /(\d{1,2}):(\d{2})/,
    extract: (m) => ({ hour: +m[1], minute: +m[2] }),
  },
];

function applyMeridiem(hour: number, meridiem?: string): number | null {
  if (!meridiem) return hour;
  if (meridiem === '오전') return hour === 12 ? 0 : hour;
  if (hour === 12) return 12;
  return hour + 12;
}

function validHour(h: number) { return h >= 0 && h <= 23; }
function validMin(m: number) { return m >= 0 && m <= 59; }

export function parseTime(input: string): ParsedTime {
  const raw = input ?? '';

  // ── 1. 구간 패턴 먼저 시도 ──
  let bestRange: { index: number; length: number; startMin: number; endMin: number } | null = null;

  for (const p of rangePatterns) {
    const m = raw.match(p.regex);
    if (!m || m.index === undefined) continue;
    const ext = p.extract(m);
    if (!ext) continue;

    const sh = applyMeridiem(ext.sh, ext.meridiem);
    const eh = applyMeridiem(ext.eh, ext.meridiem);
    if (sh === null || eh === null) continue;
    if (!validHour(sh) || !validMin(ext.sm)) continue;
    if (!validHour(eh) || !validMin(ext.em)) continue;

    if (
      bestRange === null ||
      m.index < bestRange.index ||
      (m.index === bestRange.index && m[0].length > bestRange.length)
    ) {
      bestRange = {
        index: m.index,
        length: m[0].length,
        startMin: sh * 60 + ext.sm,
        endMin: eh * 60 + ext.em,
      };
    }
  }

  if (bestRange) {
    const before = raw.slice(0, bestRange.index);
    const after  = raw.slice(bestRange.index + bestRange.length);
    const cleanText = (before + after).replace(/\s+/g, ' ').trim();
    return { time: bestRange.startMin, endTime: bestRange.endMin, cleanText };
  }

  // ── 2. 단일 시간 패턴 ──
  let best: { index: number; length: number; hour: number; minute: number } | null = null;

  for (const p of singlePatterns) {
    const m = raw.match(p.regex);
    if (!m || m.index === undefined) continue;
    const ext = p.extract(m);
    if (!ext) continue;
    const hour = applyMeridiem(ext.hour, ext.meridiem);
    if (hour === null) continue;
    if (!validHour(hour) || !validMin(ext.minute)) continue;
    if (
      best === null ||
      m.index < best.index ||
      (m.index === best.index && m[0].length > best.length)
    ) {
      best = { index: m.index, length: m[0].length, hour, minute: ext.minute };
    }
  }

  if (!best) return { time: null, endTime: null, cleanText: raw.trim() };

  const before = raw.slice(0, best.index);
  const after  = raw.slice(best.index + best.length);
  const cleanText = (before + after).replace(/\s+/g, ' ').trim();
  return { time: best.hour * 60 + best.minute, endTime: null, cleanText };
}
