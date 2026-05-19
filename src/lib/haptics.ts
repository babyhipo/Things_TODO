// Web Vibration API wrapper — silently no-ops on unsupported browsers (iOS Safari)
const vib = (pattern: number | number[]) => {
  try { navigator.vibrate?.(pattern); } catch { /* unsupported */ }
};

/** 드래그 시작 — 잡는 느낌 */
export const hapticGrab   = () => vib(10);
/** 5분 단위 스냅 틱 */
export const hapticTick   = () => vib(4);
/** 순서 변경 틱 */
export const hapticReorder = () => vib(6);
/** 드롭 확정 */
export const hapticDrop   = () => vib([8, 25, 8]);
/** 삭제 확정 (스와이프) */
export const hapticDelete  = () => vib([6, 20, 12]);
