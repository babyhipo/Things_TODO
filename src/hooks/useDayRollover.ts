import { useEffect } from 'react';
import { useTodoStore } from '../store/useTodoStore';
import { msUntilNextRollover } from '../lib/dayBoundary';

const DAY_MS = 24 * 60 * 60 * 1000;

export function useDayRollover(): void {
  useEffect(() => {
    const run = () => {
      useTodoStore.getState().performRolloverIfNeeded();
    };

    run();

    let intervalId: ReturnType<typeof setInterval> | null = null;
    const timeoutId = setTimeout(() => {
      run();
      intervalId = setInterval(run, DAY_MS);
    }, msUntilNextRollover());

    // 백그라운드 탭에서 setTimeout이 지연될 수 있으므로 가시화 시 재확인
    const onVisibility = () => {
      if (document.visibilityState === 'visible') run();
    };
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      clearTimeout(timeoutId);
      if (intervalId !== null) clearInterval(intervalId);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, []);
}
