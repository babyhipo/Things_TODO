import { useEffect, useState } from 'react';

function currentMinuteOfDay(now: Date = new Date()): number {
  return now.getHours() * 60 + now.getMinutes();
}

export function useNowTick(): number {
  const [minute, setMinute] = useState<number>(() => currentMinuteOfDay());

  useEffect(() => {
    let intervalId: ReturnType<typeof setInterval> | null = null;
    // 첫 틱은 다음 분 경계에 정확히 맞추고, 이후 60s 간격으로 유지
    const now = new Date();
    const msToNextMinute = 60_000 - (now.getSeconds() * 1000 + now.getMilliseconds());

    const timeoutId = setTimeout(() => {
      setMinute(currentMinuteOfDay());
      intervalId = setInterval(() => {
        setMinute(currentMinuteOfDay());
      }, 60_000);
    }, msToNextMinute);

    return () => {
      clearTimeout(timeoutId);
      if (intervalId !== null) clearInterval(intervalId);
    };
  }, []);

  return minute;
}
