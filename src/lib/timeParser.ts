export interface ParsedTime {
  time: number | null;
  cleanText: string;
}

interface Pattern {
  regex: RegExp;
  extract: (m: RegExpMatchArray) => { hour: number; minute: number; meridiem?: string } | null;
}

const patterns: Pattern[] = [
  {
    regex: /(오전|오후)\s*(\d{1,2})\s*시\s*(\d{1,2})\s*분/,
    extract: (m) => ({ meridiem: m[1], hour: parseInt(m[2], 10), minute: parseInt(m[3], 10) }),
  },
  {
    regex: /(오전|오후)\s*(\d{1,2})\s*시\s*반/,
    extract: (m) => ({ meridiem: m[1], hour: parseInt(m[2], 10), minute: 30 }),
  },
  {
    regex: /(오전|오후)\s*(\d{1,2})\s*시/,
    extract: (m) => ({ meridiem: m[1], hour: parseInt(m[2], 10), minute: 0 }),
  },
  {
    regex: /(\d{1,2})\s*시\s*반/,
    extract: (m) => ({ hour: parseInt(m[1], 10), minute: 30 }),
  },
  {
    regex: /(\d{1,2})\s*시\s*(\d{1,2})\s*분/,
    extract: (m) => ({ hour: parseInt(m[1], 10), minute: parseInt(m[2], 10) }),
  },
  {
    regex: /(\d{1,2})\s*시/,
    extract: (m) => ({ hour: parseInt(m[1], 10), minute: 0 }),
  },
  {
    regex: /(\d{1,2}):(\d{2})/,
    extract: (m) => ({ hour: parseInt(m[1], 10), minute: parseInt(m[2], 10) }),
  },
];

function applyMeridiem(hour: number, meridiem?: string): number | null {
  if (!meridiem) return hour;
  if (meridiem === '오전') {
    // 오전 12시 -> 0시
    return hour === 12 ? 0 : hour;
  }
  // 오후: 12시는 그대로, 그 외는 +12
  if (hour === 12) return 12;
  return hour + 12;
}

export function parseTime(input: string): ParsedTime {
  const raw = input ?? '';
  let best: { index: number; length: number; hour: number; minute: number } | null = null;

  for (const p of patterns) {
    const m = raw.match(p.regex);
    if (!m || m.index === undefined) continue;
    const ext = p.extract(m);
    if (!ext) continue;
    const hour = applyMeridiem(ext.hour, ext.meridiem);
    if (hour === null) continue;
    if (hour < 0 || hour > 23) continue;
    if (ext.minute < 0 || ext.minute > 59) continue;
    // 첫 매칭(가장 이른 위치) 우선, 동위치면 더 긴 매칭 우선
    if (
      best === null ||
      m.index < best.index ||
      (m.index === best.index && m[0].length > best.length)
    ) {
      best = { index: m.index, length: m[0].length, hour, minute: ext.minute };
    }
  }

  if (!best) {
    return { time: null, cleanText: raw.trim() };
  }

  const before = raw.slice(0, best.index);
  const after = raw.slice(best.index + best.length);
  const cleanText = (before + after).replace(/\s+/g, ' ').trim();
  return { time: best.hour * 60 + best.minute, cleanText };
}
