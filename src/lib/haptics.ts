// iOS Safari does not support navigator.vibrate.
// Fallback: Web Animations API pulse on the provided DOM element.

const _isIOS =
  typeof navigator !== 'undefined' &&
  /iPad|iPhone|iPod/.test(navigator.userAgent) &&
  !(window as unknown as Record<string, unknown>)['MSStream'];

const vib = (pattern: number | number[]) => {
  if (_isIOS) return;
  try { navigator.vibrate?.(pattern); } catch { /* unsupported */ }
};

function pulse(el: HTMLElement | null | undefined, scale: number, ms: number) {
  if (!el) return;
  el.animate(
    [
      { transform: 'scale(1)',       easing: 'ease-out' },
      { transform: `scale(${scale})` },
      { transform: 'scale(1)' },
    ],
    { duration: ms, fill: 'none' },
  );
}

/** 드래그 시작 — 잡는 느낌 (iOS: 카드 살짝 확대) */
export const hapticGrab = (el?: HTMLElement | null) => {
  vib(10);
  if (_isIOS) pulse(el, 1.04, 130);
};

/** 5분 단위 스냅 틱 (iOS: 필 펄스) */
export const hapticTick = (el?: HTMLElement | null) => {
  vib(4);
  if (_isIOS) pulse(el, 1.09, 65);
};

/** 순서 변경 틱 (iOS: 고스트 펄스) */
export const hapticReorder = (el?: HTMLElement | null) => {
  vib(6);
  if (_isIOS) pulse(el, 1.06, 75);
};

/** 드롭 확정 (iOS: 필/고스트 강하게 펄스) */
export const hapticDrop = (el?: HTMLElement | null) => {
  vib([8, 25, 8]);
  if (_isIOS) pulse(el, 1.12, 140);
};

/** 삭제 확정 — 스와이프 (iOS: 카드 펄스) */
export const hapticDelete = (el?: HTMLElement | null) => {
  vib([6, 20, 12]);
  if (_isIOS) pulse(el, 1.08, 120);
};
